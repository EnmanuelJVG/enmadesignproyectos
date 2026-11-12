import { get, put } from '@vercel/blob';
import { json, rejectCrossOrigin, requireAuth } from '../../lib/server-auth.js';

const INDEX_PATH = 'enma-studio/records/index.json';
const ALLOWED = new Set(['clients', 'jobs', 'revisions', 'payments', 'expenses', 'events']);
const MAX_ITEMS = 30;
const MAX_INDEX_RETRIES = 8;

// Serializa las escrituras que coinciden en la misma instancia de Vercel.
// Las instancias distintas siguen protegidas por ETag + reintentos con jitter.
let writeQueue = Promise.resolve();

async function readIndex() {
  const file = await get(INDEX_PATH, { access: 'private', useCache: false });
  if (!file || file.statusCode !== 200) return { records: {}, etag: null };
  const parsed = JSON.parse(await new Response(file.stream).text());
  return {
    records: parsed && parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
    etag: file.blob.etag
  };
}

function validItem(item) {
  if (!item || typeof item !== 'object') return false;
  if (typeof item.key !== 'string' || item.key.length > 220) return false;
  if (item.key === 'settings/main') {
    return Number.isFinite(Number(item.u)) && typeof item.data === 'string' && item.data.length <= 50000;
  }
  const [col, id, extra] = item.key.split('/');
  return ALLOWED.has(col) && !!id && !extra && /^[a-zA-Z0-9_-]{1,160}$/.test(id) &&
    Number.isFinite(Number(item.u)) && typeof item.data === 'string' && item.data.length <= 500000;
}

function isWriteConflict(error) {
  const name = String(error?.name || '');
  const code = String(error?.code || '');
  const status = Number(error?.status || error?.statusCode || 0);
  return name.includes('Precondition') || name.includes('AlreadyExists') ||
    code.includes('precondition') || code.includes('already_exists') || status === 409 || status === 412;
}

async function waitBeforeRetry(attempt) {
  // Jitter exponencial: evita que dos dispositivos vuelvan a competir al mismo tiempo.
  const ceiling = Math.min(650, 80 * (2 ** attempt));
  const delay = 50 + Math.floor(Math.random() * ceiling);
  await new Promise(resolve => setTimeout(resolve, delay));
}

async function mergeItems(items) {
  for (let attempt = 0; attempt < MAX_INDEX_RETRIES; attempt++) {
    const current = await readIndex();
    const records = { ...current.records };
    let saved = 0, skipped = 0;
    let ts = Date.now();

    for (const item of items) {
      const previous = records[item.key];
      if (previous && Number(previous.u) > Number(item.u)) {
        skipped++;
        continue;
      }
      ts = Math.max(Date.now(), ts + 1);
      const [col, id] = item.key.split('/');
      records[item.key] = {
        key: item.key,
        col,
        id: id || 'main',
        u: Number(item.u),
        del: Boolean(item.del),
        data: item.del ? '' : item.data,
        ts
      };
      saved++;
    }

    if (!saved) return { saved: 0, skipped };
    const options = {
      access: 'private',
      contentType: 'application/json',
      cacheControlMaxAge: 60,
      allowOverwrite: Boolean(current.etag)
    };
    if (current.etag) options.ifMatch = current.etag;

    try {
      await put(INDEX_PATH, JSON.stringify({ version: 1, records }), options);
      return { saved, skipped };
    } catch (error) {
      if (!isWriteConflict(error) || attempt === MAX_INDEX_RETRIES - 1) throw error;
      // Otro dispositivo guardó primero. Se vuelve a leer y fusionar sin pisar esa versión.
      await waitBeforeRetry(attempt);
    }
  }
  throw new Error('No se pudo resolver el conflicto de guardado.');
}

function queueMergeItems(items) {
  const task = writeQueue.then(() => mergeItems(items));
  // Un fallo no debe envenenar la cola: la siguiente petición debe poder continuar.
  writeQueue = task.catch(() => {});
  return task;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Método no permitido.' });
  }
  if (req.method === 'POST' && rejectCrossOrigin(req, res)) return;
  const session = requireAuth(req, res);
  if (!session) return;

  try {
    if (req.method === 'POST') {
      const items = req.body?.items;
      if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS || !items.every(validItem)) {
        return json(res, 400, { error: `El lote debe contener entre 1 y ${MAX_ITEMS} registros válidos.` });
      }
      const result = await queueMergeItems(items);
      return json(res, 200, result);
    }

    const url = new URL(req.url, 'https://enma.invalid');
    const rawSince = Number(url.searchParams.get('since') || 0);
    const since = Number.isFinite(rawSince) && rawSince > 0 ? rawSince : 0;
    const index = await readIndex();
    const all = Object.values(index.records).filter(record =>
      record && typeof record.key === 'string' && Number(record.ts) >= since - 1000
    ).sort((a, b) => Number(a.ts) - Number(b.ts));
    const maxMs = all.reduce((max, item) => Math.max(max, Number(item.ts) || 0), since);
    const max = maxMs > 0
      ? [Math.floor(maxMs / 1000), (maxMs % 1000) * 1000000]
      : null;
    return json(res, 200, {
      records: all.map(({ key, u, del, data }) => ({ key, u, del, data })),
      cursor: max
    });
  } catch (error) {
    // El detalle completo queda solo en los Logs privados de Vercel. La respuesta
    // al administrador incluye un código seguro para poder diagnosticar el fallo.
    const conflict = isWriteConflict(error);
    const blobStatus = Number(error?.status || error?.statusCode || 0) || null;
    if (conflict) {
      console.warn('ENMA cloud records: conflicto ETag después de reintentos', {
        name: error?.name,
        code: error?.code,
        status: blobStatus,
        attempts: MAX_INDEX_RETRIES
      });
      return json(res, 409, {
        error: 'Otro dispositivo modificó los datos al mismo tiempo. Tus cambios siguen guardados en este dispositivo; ENMA volverá a intentarlo automáticamente.',
        code: 'write_conflict',
        retryAfterMs: 1800
      });
    }
    console.error('ENMA cloud records:', {
      name: error?.name,
      code: error?.code,
      status: blobStatus,
      message: error?.message
    });
    const rawCode = String(error?.code || error?.name || 'blob_error');
    const safeCode = rawCode.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 48) || 'blob_error';
    let hint = 'Comprueba que el Blob privado esté vinculado a este proyecto y entorno Production.';
    if (blobStatus === 401 || blobStatus === 403) hint = 'Vercel rechazó la credencial OIDC/token. Comprueba la conexión del Blob en Storage → Projects y vuelve a publicar.';
    else if (blobStatus === 429) hint = 'Vercel aplicó un límite temporal. La aplicación volverá a intentarlo automáticamente.';
    return json(res, 500, {
      error: `No se pudo acceder a Vercel Blob (${safeCode}${blobStatus ? ` · HTTP ${blobStatus}` : ''}). ${hint}`,
      code: 'blob_error',
      blobCode: safeCode,
      blobStatus
    });
  }
}

export const config = { api: { bodyParser: { sizeLimit: '3mb' } } };
