import { clearSession, json, rejectCrossOrigin } from '../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método no permitido.' });
  }
  if (rejectCrossOrigin(req, res)) return;
  clearSession(res, req);
  return json(res, 200, { ok: true });
}
