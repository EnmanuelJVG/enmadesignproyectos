const API = 'https://api.github.com';
const path = 'data/enma-studio-data.json';
function config() {
  const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO } = process.env;
  if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) throw new Error('Faltan variables de entorno en Vercel: GITHUB_TOKEN, GITHUB_OWNER y GITHUB_REPO.');
  return { token: GITHUB_TOKEN, owner: GITHUB_OWNER, repo: GITHUB_REPO };
}
async function gh(c, method, url, body) {
  const r = await fetch(`${API}${url}`, { method, headers: { Authorization: `Bearer ${c.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || `GitHub respondió ${r.status}`); e.status = r.status; throw e; }
  return j;
}
const empty = () => ({ clients: [], brands: [], projects: [], tasks: [], payments: [], expenses: [], calendar_events: [], corrections: [] });
async function read(c) {
  try {
    const f = await gh(c, 'GET', `/repos/${c.owner}/${c.repo}/contents/${path}`);
    return { data: JSON.parse(Buffer.from(f.content.replace(/\n/g, ''), 'base64').toString('utf8')), sha: f.sha };
  } catch (e) {
    if (e.status !== 404) throw e;
    return { data: empty(), sha: null };
  }
}
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  let c;
  try { c = config(); } catch (e) { return res.status(500).json({ error: e.message }); }
  try {
    const current = await read(c);
    if (req.method === 'GET') {
      if (!current.sha) {
        const content = Buffer.from(JSON.stringify(current.data, null, 2)).toString('base64');
        await gh(c, 'PUT', `/repos/${c.owner}/${c.repo}/contents/${path}`, { message: 'Inicializar datos de Enma Studio Manager', content });
      }
      return res.status(200).json(current.data);
    }
    if (req.method === 'PUT') {
      const data = req.body;
      if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Formato de datos inválido.' });
      const allowed = ['clients','brands','projects','tasks','payments','expenses','calendar_events','corrections'];
      for (const key of allowed) if (!Array.isArray(data[key])) return res.status(400).json({ error: `Falta la colección ${key}.` });
      const raw = JSON.stringify(data);
      if (Buffer.byteLength(raw, 'utf8') > 700000) return res.status(413).json({ error: 'Los datos superan el límite seguro de 700 KB.' });
      const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
      const payload = { message: 'Actualizar datos de Enma Studio Manager', content, ...(current.sha ? { sha: current.sha } : {}) };
      await gh(c, 'PUT', `/repos/${c.owner}/${c.repo}/contents/${path}`, payload);
      return res.status(200).json({ ok: true });
    }
    res.setHeader('Allow', 'GET, PUT, OPTIONS');
    return res.status(405).json({ error: 'Método no permitido.' });
  } catch (e) {
    console.error('ENMA data API:', e);
    if (e.status === 401) return res.status(502).json({ error: 'GitHub rechazó el token. Comprueba que GITHUB_TOKEN sea válido y no esté vencido.' });
    if (e.status === 403) return res.status(502).json({ error: 'GitHub no permite esta operación. Revisa que el token tenga Contents: Read and write para este repositorio.' });
    if (e.status === 404) return res.status(502).json({ error: 'GitHub no encuentra el repositorio. Comprueba GITHUB_OWNER, GITHUB_REPO y que el token tenga acceso al repositorio privado.' });
    if (e.status === 409 || e.status === 422) return res.status(409).json({ error: 'Los datos cambiaron en otro dispositivo o GitHub rechazó la actualización. Actualiza la aplicación e inténtalo de nuevo.' });
    return res.status(502).json({ error: `No se pudo guardar o leer el archivo de datos en GitHub (HTTP ${e.status || 'desconocido'}). Revisa el token y la configuración del repositorio.` });
  }
};
