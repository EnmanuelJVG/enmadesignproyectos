/* ENMA Studio Manager — núcleo: utilidades, iconos, datos y cálculos.
   Todo se guarda en este dispositivo (IndexedDB). No hay servidor ni base de datos externa. */
'use strict';

/* ---------- Utilidades básicas ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const REDUCED = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

/* ---------- Fechas (siempre texto AAAA-MM-DD en hora local) ---------- */
const pad = n => String(n).padStart(2, '0');
const ymd = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const todayStr = () => ymd(new Date());
const parseD = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
const addDays = (s, n) => { const d = parseD(s); d.setDate(d.getDate() + n); return ymd(d); };
const diffDays = (a, b) => Math.round((parseD(a) - parseD(b)) / 864e5);
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const mesCorto = i => MESES[i].slice(0, 3);
function fmtDate(s, long) {
  if (!s) return '';
  const d = parseD(s), y = d.getFullYear() !== new Date().getFullYear() ? ' ' + y2(d) : '';
  if (long) return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + y;
  return d.getDate() + ' ' + mesCorto(d.getMonth()) + y;
}
const y2 = d => d.getFullYear();
function rel(s) {
  if (!s) return '';
  const d = diffDays(s, todayStr());
  if (d === 0) return 'hoy';
  if (d === 1) return 'mañana';
  if (d === -1) return 'ayer';
  if (d > 1 && d <= 7) return 'en ' + d + ' días';
  if (d < -1 && d >= -7) return 'hace ' + (-d) + ' días';
  return fmtDate(s);
}
const weekStart = s => { const d = parseD(s); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return ymd(d); };

/* ---------- Dinero ---------- */
function parseNum(v) {
  let s = String(v ?? '').trim().replace(/\s/g, '');
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.');
  else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
}
const n2 = n => Number(n || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = n => (Math.round(n * 100) < 0 ? '-' : '') + '$' + n2(Math.abs(n));
const money = (m, cur) => (cur === 'VES' ? 'Bs ' : '$') + n2(m);
const toUSD = (monto, moneda, tasa) => moneda === 'VES' ? (tasa > 0 ? monto / tasa : 0) : (Number(monto) || 0);

/* ---------- Catálogos ---------- */
const ESTADOS = [
  { n: 'Solicitud recibida', g: 'wait' }, { n: 'Cotización pendiente', g: 'wait' }, { n: 'Esperando aprobación', g: 'wait' },
  { n: 'Aprobado', g: 'go' }, { n: 'En proceso', g: 'go' }, { n: 'En revisión del cliente', g: 'rev' },
  { n: 'Requiere modificaciones', g: 'rev' }, { n: 'Aprobado para entrega', g: 'go' },
  { n: 'Entregado', g: 'done' }, { n: 'Finalizado', g: 'done' }, { n: 'Cancelado', g: 'off' }
];
const ESTADO_G = Object.fromEntries(ESTADOS.map(e => [e.n, e.g]));
const EN_CURSO = ['Aprobado', 'En proceso', 'En revisión del cliente', 'Requiere modificaciones', 'Aprobado para entrega'];
const ENTREGADO = ['Entregado', 'Finalizado'];
const cerrado = e => ['Entregado', 'Finalizado', 'Cancelado'].includes(e);
const CAT_TRABAJO = ['Diseño de logotipos', 'Branding e identidad visual', 'Diseño para redes sociales', 'Flyers publicitarios', 'Diseño de publicaciones', 'Diseño de menús', 'Diseño de páginas web', 'Edición de videos', 'Motion graphics', 'Animaciones', 'Publicidad digital', 'Otros'];
const CAT_GASTO = ['Suscripciones', 'Herramientas de diseño', 'Software', 'Recursos gráficos', 'Publicidad', 'Servicios', 'Contrataciones externas', 'Otros gastos'];
const METODOS = ['Transferencia', 'Pago móvil', 'Efectivo', 'Zelle', 'PayPal', 'Binance', 'Otro'];
const CANALES = ['WhatsApp', 'Instagram', 'Correo', 'Llamada', 'En persona'];
const PRIORIDADES = ['Alta', 'Media', 'Baja'];
const REV_ESTADOS = { pendiente: 'Pendiente', en_proceso: 'En proceso', hecha: 'Hecha' };
const REV_NEXT = { pendiente: 'en_proceso', en_proceso: 'hecha', hecha: 'pendiente' };

/* ---------- Iconos (estilo Lucide, trazo uniforme) ---------- */
const ICONS = {
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  briefcase: '<path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M13 8H7"/><path d="M17 12H7"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  upload: '<path d="M12 3v12"/><path d="m17 8-5-5-5 5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  sliders: '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/>',
  play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  archive: '<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  trend: '<path d="M16 7h6v6"/><path d="m22 7-8.5 8.5-5-5L2 17"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  map: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  inbox: '<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  palette: '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  circle: '<circle cx="12" cy="12" r="10"/>',
  cloud: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>',
  cloudoff: '<path d="m2 2 20 20"/><path d="M5.782 5.782A7 7 0 0 0 9 19h8.5a4.5 4.5 0 0 0 1.307-.193"/><path d="M21.532 16.5A4.5 4.5 0 0 0 17.5 10h-1.79A7.008 7.008 0 0 0 10 5.07"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICONS[n] || ''}</svg>`;

/* ---------- Almacenamiento local (IndexedDB) ---------- */
const DB = (() => {
  let db = null;
  const open = () => new Promise((res, rej) => {
    if (!window.indexedDB) return rej(new Error('IndexedDB no disponible'));
    const r = indexedDB.open('enma-studio', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('img'); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const tx = (store, mode, fn) => new Promise((res, rej) => {
    const t = db.transaction(store, mode);
    const rq = fn(t.objectStore(store));
    t.oncomplete = () => res(rq ? rq.result : undefined);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
  return {
    ok: false,
    async init() { db = await open(); this.ok = true; },
    get: (s, k) => tx(s, 'readonly', o => o.get(k)),
    put: (s, k, v) => tx(s, 'readwrite', o => o.put(v, k)),
    del: (s, k) => tx(s, 'readwrite', o => o.delete(k)),
    keys: s => tx(s, 'readonly', o => o.getAllKeys()),
    clear: s => tx(s, 'readwrite', o => o.clear())
  };
})();

/* ---------- Estado de la app ---------- */
const DEFAULT_STATE = () => ({
  v: 1,
  settings: { nombre: '', tema: 'auto', tasa: null, tasaFecha: null, ultimoRespaldo: null, catTrabajo: CAT_TRABAJO.slice(), catGasto: CAT_GASTO.slice() },
  clients: [], jobs: [], revisions: [], payments: [], expenses: [], events: []
});
let S = DEFAULT_STATE();

function normalize(raw) {
  const d = DEFAULT_STATE();
  if (!raw || typeof raw !== 'object') return d;
  const out = { ...d, ...raw, settings: { ...d.settings, ...(raw.settings || {}) } };
  ['clients', 'jobs', 'revisions', 'payments', 'expenses', 'events'].forEach(k => { if (!Array.isArray(out[k])) out[k] = []; });
  if (!Array.isArray(out.settings.catTrabajo) || !out.settings.catTrabajo.length) out.settings.catTrabajo = CAT_TRABAJO.slice();
  if (!Array.isArray(out.settings.catGasto) || !out.settings.catGasto.length) out.settings.catGasto = CAT_GASTO.slice();
  out.jobs.forEach(j => { if (!Array.isArray(j.tareas)) j.tareas = []; });
  out.clients.forEach(c => { if (!Array.isArray(c.colores)) c.colores = []; if (!Array.isArray(c.refs)) c.refs = []; });
  return out;
}

let stateLoaded = false;   // true solo si se pudo leer lo guardado; la nube no arranca si no (para no tomar un estado vacío por “todo borrado”)
async function loadState() {
  try {
    await DB.init();
    const saved = await DB.get('kv', 'state');
    if (saved) S = normalize(saved);
    stateLoaded = true;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) {
    console.warn('No se pudo abrir el almacenamiento local:', e);
  }
}

let saveTimer = null, saveWarned = false;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 120); if (window.Sync) Sync.touch(); }
async function flush() {
  clearTimeout(saveTimer);
  if (!DB.ok) {
    if (!saveWarned) { saveWarned = true; toast('Este navegador no permite guardar datos. Lo que escribas se perderá al cerrar la página.', { type: 'err' }); }
    return;
  }
  try { await DB.put('kv', 'state', JSON.parse(JSON.stringify(S))); }
  catch (e) { toast('No se pudo guardar. Descarga un respaldo en Ajustes.', { type: 'err' }); }
}
window.addEventListener('pagehide', () => { if (DB.ok) flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });

/* ---------- Consultas y cálculos ---------- */
const byId = (arr, id) => arr.find(x => x.id === id);
const getClient = id => byId(S.clients, id);
const getJob = id => byId(S.jobs, id);
const clientName = id => (getClient(id) || {}).nombre || 'Sin cliente';
const jobPrecioUSD = j => toUSD(j.precio, j.moneda, j.tasa);
const payUSD = p => toUSD(p.monto, p.moneda, p.tasa);
const jobCobrado = id => S.payments.filter(p => p.jobId === id && p.estado === 'recibido').reduce((a, p) => a + payUSD(p), 0);
const jobPendiente = j => j.estado === 'Cancelado' ? 0 : Math.max(0, jobPrecioUSD(j) - jobCobrado(j.id));
const clientPendiente = id => S.jobs.filter(j => j.clienteId === id).reduce((a, j) => a + jobPendiente(j), 0);
const clientCobrado = id => S.payments.filter(p => p.clienteId === id && p.estado === 'recibido').reduce((a, p) => a + payUSD(p), 0);
const sumPay = (prefix) => S.payments.filter(p => p.estado === 'recibido' && (!prefix || String(p.fecha).startsWith(prefix))).reduce((a, p) => a + payUSD(p), 0);
const sumExp = (prefix) => S.expenses.filter(x => !prefix || String(x.fecha).startsWith(prefix)).reduce((a, x) => a + toUSD(x.monto, x.moneda, x.tasa), 0);
const revPendientes = () => S.revisions.filter(r => r.estado !== 'hecha');

/* Número de ronda de cada modificación: se calcula por orden de fecha dentro de su trabajo. */
function rondaOf(r) {
  const same = S.revisions.filter(x => x.jobId === r.jobId).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '') || (a.creado || 0) - (b.creado || 0));
  return same.findIndex(x => x.id === r.id) + 1;
}

/* Todo lo que aparece en el calendario y en "Lo que sigue" */
function allItems() {
  const out = [];
  S.jobs.forEach(j => {
    if (j.entrega && j.estado !== 'Cancelado') out.push({ fecha: j.entrega, tipo: 'entrega', titulo: j.nombre, sub: clientName(j.clienteId), done: ENTREGADO.includes(j.estado), go: '#/trabajo/' + j.id });
    if (j.inicio && j.estado !== 'Cancelado') out.push({ fecha: j.inicio, tipo: 'inicio', titulo: 'Inicio: ' + j.nombre, sub: clientName(j.clienteId), done: true, go: '#/trabajo/' + j.id });
  });
  S.revisions.forEach(r => {
    if (!r.limite || r.estado === 'hecha') return;
    const j = getJob(r.jobId); if (!j) return;
    out.push({ fecha: r.limite, tipo: 'cambio', titulo: 'Cambio: ' + clip(r.pedido, 48), sub: j.nombre + ' (' + clientName(j.clienteId) + ')', done: false, go: '#/trabajo/' + j.id });
  });
  S.events.forEach(e => out.push({ fecha: e.fecha, hora: e.hora || '', tipo: e.tipo || 'otro', titulo: e.titulo, sub: e.clienteId ? clientName(e.clienteId) : (e.notas ? clip(e.notas, 50) : ''), done: false, evId: e.id }));
  return out.filter(i => i.fecha);
}
const itemsByDate = () => { const m = new Map(); allItems().forEach(i => { if (!m.has(i.fecha)) m.set(i.fecha, []); m.get(i.fecha).push(i); }); m.forEach(a => a.sort((x, y) => (x.hora || '99').localeCompare(y.hora || '99'))); return m; };

/* ---------- Imágenes (se comprimen y se guardan en este dispositivo) ---------- */
const urlCache = new Map();
async function imgURL(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  try {
    let b = await DB.get('img', id);
    if (!b && window.Sync && await Sync.fetchImage(id)) b = await DB.get('img', id);   // viene de la nube
    if (!b) return null;
    const u = URL.createObjectURL(b); urlCache.set(id, u); return u;
  } catch (e) { return null; }
}
function hydrate(root) {
  $$('[data-img]', root).forEach(async el => {
    const u = await imgURL(el.dataset.img);
    if (!u) { el.classList.add('missing'); return; }
    if (el.tagName === 'IMG') { el.onload = () => el.classList.add('loaded'); el.src = u; if (el.complete) el.classList.add('loaded'); }
    else { el.style.backgroundImage = 'url("' + u + '")'; el.classList.add('loaded'); }
  });
}
const MAX_IMG_BYTES = 600 * 1024;
async function saveImage(file, { max = 1600, alpha = false } = {}) {
  if (!file || !/^image\//.test(file.type)) throw new Error('Elige un archivo de imagen (PNG, JPG o WEBP).');
  let bmp;
  try { bmp = await createImageBitmap(file); }
  catch (e) {
    bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen.')); i.src = URL.createObjectURL(file); });
  }
  /* Se optimiza hasta 600 KB para acelerar la carga en móvil y la sincronización de imágenes. */
  const w0 = bmp.width, h0 = bmp.height;
  const toBlob = (c, type, q) => new Promise(r => c.toBlob(r, type, q));
  let blob = null;
  for (const [scale, q] of [[1, 0.86], [0.8, 0.78], [0.62, 0.7], [0.46, 0.62]]) {
    const k = Math.min(1, max / Math.max(w0, h0)) * scale;
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const ctx = c.getContext('2d');
    if (!alpha) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    let b = alpha ? await toBlob(c, 'image/png') : await toBlob(c, 'image/webp', q);
    if (!alpha && b && b.type !== 'image/webp') b = await toBlob(c, 'image/jpeg', q);
    if (b) blob = b;
    if (blob && blob.size <= MAX_IMG_BYTES) break;
  }
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  if (blob.size > MAX_IMG_BYTES) throw new Error('La imagen es demasiado pesada. Prueba con una más pequeña.');
  const id = uid();
  await DB.put('img', id, blob);
  return id;
}
/* soloLocal = true cuando la imagen ya no hace falta en este dispositivo pero la nube no se toca */
async function dropImages(ids, soloLocal) {
  for (const id of ids.filter(Boolean)) {
    try { await DB.del('img', id); } catch (e) { /* ignorar */ }
    if (urlCache.has(id)) { URL.revokeObjectURL(urlCache.get(id)); urlCache.delete(id); }
    if (!soloLocal && window.Sync) Sync.noteImageDeleted(id);
  }
}

/* ---------- Borrados en cascada ---------- */
async function removeRevision(id) {
  const r = byId(S.revisions, id); if (!r) return;
  S.revisions = S.revisions.filter(x => x.id !== id);
  await dropImages([r.imgId, r.entregaImgId]);
}
async function removeJob(id) {
  const j = getJob(id); if (!j) return;
  if (window.Sync) Sync.allowMassDelete(6000);   // borrar un trabajo borra sus modificaciones: es a propósito
  for (const r of S.revisions.filter(x => x.jobId === id)) await removeRevision(r.id);
  S.payments.forEach(p => { if (p.jobId === id) p.jobId = null; });   // el dinero cobrado se conserva
  S.jobs = S.jobs.filter(x => x.id !== id);
  await dropImages([j.portadaId]);
}
async function removeClient(id) {
  const c = getClient(id); if (!c) return;
  if (window.Sync) Sync.allowMassDelete(6000);
  for (const j of S.jobs.filter(x => x.clienteId === id)) await removeJob(j.id);
  S.payments.forEach(p => { if (p.clienteId === id) p.clienteId = null; });
  S.events = S.events.filter(e => e.clienteId !== id);
  S.clients = S.clients.filter(x => x.id !== id);
  await dropImages([c.logoId, ...(c.refs || [])]);
}

/* ---------- Respaldo ---------- */
function downloadFile(name, text, mime) {
  const blob = new Blob([text], { type: mime || 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const blobToDataURL = b => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(b); });
async function exportBackup() {
  await flush();
  const imagenes = {};
  if (DB.ok) for (const k of await DB.keys('img')) { const b = await DB.get('img', k); if (b) imagenes[k] = await blobToDataURL(b); }
  const data = { app: 'enma-studio-manager', version: 1, exportado: new Date().toISOString(), state: S, imagenes };
  downloadFile('enma-studio-respaldo-' + todayStr() + '.json', JSON.stringify(data), 'application/json');
  S.settings.ultimoRespaldo = todayStr(); save();
}
async function importBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch (e) { throw new Error('El archivo no es un respaldo válido.'); }
  if (!data || data.app !== 'enma-studio-manager' || !data.state) throw new Error('Este archivo no es un respaldo de ENMA Studio Manager.');
  const next = normalize(data.state);
  if (DB.ok) {
    const viejas = await DB.keys('img');
    await DB.clear('img');
    for (const [k, v] of Object.entries(data.imagenes || {})) { const b = await (await fetch(v)).blob(); await DB.put('img', k, b); }
    if (window.Sync) viejas.filter(k => !(k in (data.imagenes || {}))).forEach(k => Sync.noteImageDeleted(k));   // las que ya no existen se quitan también de la nube
  }
  urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
  S = next; await flush();
  if (window.Sync) { Sync.allowMassDelete(); Sync.touch(); }   // si hay nube, se iguala al respaldo
}
async function wipeAll() {
  if (window.Sync) Sync.beforeWipe();
  if (DB.ok) { await DB.clear('img'); await DB.del('kv', 'state'); }   // el estado de sincronización se conserva
  urlCache.forEach(u => URL.revokeObjectURL(u)); urlCache.clear();
  S = DEFAULT_STATE();
  await flush();
  if (window.Sync) Sync.touch();
}

/* ---------- Exportar a CSV (se abre bien en Excel) ---------- */
function toCSV(rows) {
  return '﻿' + rows.map(r => r.map(v => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }).join(',')).join('\r\n');
}

/* ---------- Enlaces seguros ---------- */
function webURL(u) { u = String(u || '').trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { return new URL(u).href; } catch (e) { return ''; } }
function igURL(u) { u = String(u || '').trim().replace(/^@/, ''); if (!u) return ''; if (/^https?:\/\//i.test(u)) return webURL(u); return 'https://instagram.com/' + encodeURIComponent(u.replace(/[^\w.]/g, '')); }
function waURL(n) { const d = String(n || '').replace(/\D/g, ''); return d ? 'https://wa.me/' + d : ''; }
const hexOK = h => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(h).trim());
const hexFix = h => { h = String(h).trim().toUpperCase(); return h[0] === '#' ? h : '#' + h; };
const hue = s => { let h = 0; for (const ch of String(s || '?')) h = (h * 31 + ch.charCodeAt(0)) % 360; return h; };
const initials = s => String(s || '?').trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
