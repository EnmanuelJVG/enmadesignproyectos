import { del, get, put } from '@vercel/blob';
import { json, rejectCrossOrigin, requireAuth } from '../../lib/server-auth.js';

const PREFIX = 'enma-studio/images/';
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
const imagePath = id => PREFIX + id + '.bin';

async function readRequest(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES) throw Object.assign(new Error('La imagen supera el límite permitido de 3 MB.'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return json(res, 405, { error: 'Método no permitido.' });
  }
  if (req.method !== 'GET' && rejectCrossOrigin(req, res)) return;
  const session = requireAuth(req, res);
  if (!session) return;

  const url = new URL(req.url, 'https://enma.invalid');
  const id = url.searchParams.get('id') || '';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return json(res, 400, { error: 'Identificador de imagen no válido.' });
  const path = imagePath(id);

  try {
    if (req.method === 'POST') {
      const body = await readRequest(req);
      if (!body.length) return json(res, 400, { error: 'La imagen está vacía.' });
      const contentType = String(req.headers['content-type'] || 'application/octet-stream');
      if (!contentType.startsWith('image/')) return json(res, 415, { error: 'El archivo no es una imagen.' });
      await put(path, body, {
        access: 'private',
        allowOverwrite: true,
        contentType,
        cacheControlMaxAge: 60
      });
      return json(res, 200, { ok: true });
    }

    if (req.method === 'DELETE') {
      await del(path);
      return json(res, 200, { ok: true });
    }

    const file = await get(path, { access: 'private' });
    if (!file || file.statusCode !== 200) return json(res, 404, { error: 'No se encontró esta imagen.' });
    res.statusCode = 200;
    res.setHeader('Content-Type', file.blob.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.blob.size));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(Buffer.from(await new Response(file.stream).arrayBuffer()));
  } catch (error) {
    console.error('ENMA cloud image:', {
      name: error?.name,
      code: error?.code,
      status: error?.status || error?.statusCode,
      message: error?.message
    });
    const status = Number(error?.status || error?.statusCode || 500);
    const rawCode = String(error?.code || error?.name || 'blob_image_error');
    const safeCode = rawCode.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48) || 'blob_image_error';
    return json(res, status === 413 ? 413 : 500, {
      error: status === 413
        ? 'La imagen supera el límite permitido de 3 MB.'
        : `No se pudo procesar la imagen en Vercel Blob (${safeCode}${status ? ` · HTTP ${status}` : ''}). Comprueba la conexión privada del almacenamiento.`,
      code: status === 413 ? 'image_too_large' : 'blob_image_error',
      blobCode: safeCode,
      blobStatus: status
    });
  }
}
