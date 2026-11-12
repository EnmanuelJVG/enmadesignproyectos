import { credentialsMatch, isConfigured, configurationMessage, json, rejectCrossOrigin, setSession } from '../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método no permitido.' });
  }
  if (rejectCrossOrigin(req, res)) return;
  if (!isConfigured()) return json(res, 503, { error: configurationMessage(), code: 'not_configured' });

  const email = req.body?.email;
  const password = req.body?.password;
  if (!email || !password) return json(res, 400, { error: 'Escribe tu correo y tu contraseña.' });
  if (!credentialsMatch(email, password)) return json(res, 401, { error: 'Correo o contraseña incorrectos.', code: 'invalid_credentials' });

  setSession(res, email, req);
  return json(res, 200, { authenticated: true, user: { email: String(email).trim().toLowerCase() } });
}
