import { getSession, isConfigured, configurationMessage, json } from '../../lib/server-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { error: 'Método no permitido.' });
  }
  if (!isConfigured()) return json(res, 503, { error: configurationMessage(), code: 'not_configured' });
  const session = getSession(req);
  return json(res, 200, session
    ? { authenticated: true, user: { email: session.email } }
    : { authenticated: false });
}
