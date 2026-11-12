import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'enma_session';
const SESSION_SECONDS = 60 * 60 * 24 * 7;

export function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.end(JSON.stringify(payload));
}

export function isConfigured() {
  const hasBlob = Boolean(
    (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) ||
    process.env.BLOB_READ_WRITE_TOKEN
  );
  return Boolean(
    process.env.ENMA_ADMIN_EMAIL &&
    process.env.ENMA_ADMIN_PASSWORD &&
    process.env.ENMA_SESSION_SECRET &&
    process.env.ENMA_SESSION_SECRET.length >= 32 &&
    hasBlob
  );
}

export function configurationMessage() {
  const missing = [];
  if (!process.env.ENMA_ADMIN_EMAIL) missing.push('ENMA_ADMIN_EMAIL');
  if (!process.env.ENMA_ADMIN_PASSWORD) missing.push('ENMA_ADMIN_PASSWORD');
  if (!process.env.ENMA_SESSION_SECRET || process.env.ENMA_SESSION_SECRET.length < 32) missing.push('ENMA_SESSION_SECRET (mínimo 32 caracteres)');
  if (!(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN) && !process.env.BLOB_READ_WRITE_TOKEN) {
    missing.push('conexión de Vercel Blob (BLOB_STORE_ID/OIDC o BLOB_READ_WRITE_TOKEN)');
  }
  return missing.length
    ? 'Falta terminar la configuración privada de Vercel: ' + missing.join(', ') + '. Revisa el README.'
    : '';
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function sign(payload) {
  return createHmac('sha256', process.env.ENMA_SESSION_SECRET)
    .update(payload)
    .digest('base64url');
}

export function credentialsMatch(email, password) {
  const expectedEmail = String(process.env.ENMA_ADMIN_EMAIL || '').trim().toLowerCase();
  const receivedEmail = String(email || '').trim().toLowerCase();
  return safeEqual(receivedEmail, expectedEmail) && safeEqual(password || '', process.env.ENMA_ADMIN_PASSWORD || '');
}

export function setSession(res, email, req) {
  const payload = Buffer.from(JSON.stringify({
    email: String(email).trim().toLowerCase(),
    exp: Math.floor(Date.now() / 1000) + SESSION_SECONDS
  })).toString('base64url');
  const token = payload + '.' + sign(payload);
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  const secure = process.env.NODE_ENV === 'production' || forwardedProto.split(',')[0].trim() === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure ? '; Secure' : ''}`);
}

export function clearSession(res, req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  const secure = process.env.NODE_ENV === 'production' || forwardedProto.split(',')[0].trim() === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`);
}

export function getSession(req) {
  const raw = String(req.headers.cookie || '');
  const entry = raw.split(';').map(x => x.trim()).find(x => x.startsWith(COOKIE + '='));
  if (!entry) return null;
  const token = entry.slice(COOKIE.length + 1);
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  let valid = false;
  try { valid = safeEqual(signature, sign(payload)); } catch { return null; }
  if (!valid) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.email || !Number.isFinite(data.exp) || data.exp <= Math.floor(Date.now() / 1000)) return null;
    if (data.email !== String(process.env.ENMA_ADMIN_EMAIL || '').trim().toLowerCase()) return null;
    return data;
  } catch {
    return null;
  }
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim().toLowerCase();
  try { return new URL(origin).host.toLowerCase() === host; }
  catch { return false; }
}

export function requireAuth(req, res) {
  if (!isConfigured()) {
    json(res, 503, { error: configurationMessage(), code: 'not_configured' });
    return null;
  }
  const session = getSession(req);
  if (!session) {
    json(res, 401, { error: 'Tu sesión expiró o no has iniciado sesión. Vuelve a entrar.', code: 'unauthorized' });
    return null;
  }
  return session;
}

export function rejectCrossOrigin(req, res) {
  if (!sameOrigin(req)) {
    json(res, 403, { error: 'Solicitud rechazada por seguridad.', code: 'bad_origin' });
    return true;
  }
  return false;
}
