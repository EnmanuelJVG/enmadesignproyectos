/* ENMA Studio Manager — controlador: rutas, acciones y arranque. */
'use strict';

const ROUTES = {
  hoy: () => vHoy(), clientes: () => vClientes(), cliente: id => vCliente(id), trabajos: () => vTrabajos(), trabajo: id => vTrabajo(id),
  cambios: () => vCambios(), calendario: () => vCalendario(), finanzas: () => vFinanzas(), ajustes: () => vAjustes()
};
const NAV_OF = { hoy: 'hoy', clientes: 'clientes', cliente: 'clientes', trabajos: 'trabajos', trabajo: 'trabajos', cambios: 'cambios', calendario: 'calendario', finanzas: 'finanzas', ajustes: 'ajustes' };
const TITLES = { hoy: 'Hoy', clientes: 'Clientes', cliente: 'Cliente', trabajos: 'Trabajos', trabajo: 'Trabajo', cambios: 'Modificaciones', calendario: 'Calendario', finanzas: 'Finanzas', ajustes: 'Ajustes' };

function parseRoute() {
  const h = (location.hash || '#/hoy').replace(/^#\/?/, '');
  const [name, arg] = h.split('/');
  return { name: ROUTES[name] ? name : 'hoy', arg: arg ? decodeURIComponent(arg) : '' };
}
function go(href) { if (location.hash === href) render('still'); else location.hash = href; }

/* mode: 'route' = cambio de pantalla (con animación), 'still' = refresco sin animar, 'tab' = cambio de pestaña */
function render(mode = 'still') {
  const r = parseRoute(), main = $('#main');
  CUR.refresh = null;
  let v;
  try { v = ROUTES[r.name](r.arg); }
  catch (e) { console.error(e); v = { html: empty('alert', 'Algo salió mal al mostrar esta pantalla', 'Recarga la página. Tus datos siguen guardados.', '<button class="btn primary" data-act="reload">Recargar</button>') }; }
  main.className = 'main ' + (mode === 'route' ? 'enter' : mode === 'tab' ? 'tabswap' : 'still');
  main.innerHTML = v.html;
  if (v.mount) v.mount();
  hydrate(main);
  countUp(main, mode !== 'route');
  $$('[data-nav]').forEach(a => { const on = a.dataset.nav === NAV_OF[r.name]; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  const fab = $('#fab-root');
  fab.innerHTML = v.fab ? `<button class="fab" data-act="${v.fab.act}" ${v.fab.arg ? `data-arg="${esc(v.fab.arg)}"` : ''} ${v.fab.kind ? `data-kind="${v.fab.kind}"` : ''} aria-label="${esc(v.fab.label)}">${ic('plus')}</button>` : '';
  if (window.Sync && mode === 'route') updateSyncUI();
  if (mode === 'route') {
    window.scrollTo(0, 0);
    document.title = TITLES[r.name] + ' | ENMA Studio Manager';
    main.focus({ preventScroll: true });
  }
}
const rerender = () => render('still');
window.addEventListener('hashchange', () => render('route'));

/* ---------- Tema ---------- */
function applyTheme() {
  const t = S.settings.tema, root = document.documentElement;
  if (t === 'claro') root.dataset.theme = 'light'; else if (t === 'oscuro') root.dataset.theme = 'dark'; else delete root.dataset.theme;
  const dark = t === 'oscuro' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = $('meta[name=theme-color]'); if (m) m.content = dark ? '#0b0c0d' : '#f4f5f5';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

/* ---------- Acciones (clic) ---------- */
const BASE_TAREAS = ['Investigación de marca', 'Propuestas de diseño', 'Selección de propuesta', 'Variaciones', 'Preparación de archivos', 'Entrega final'];
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) { const i = document.createElement('input'); i.value = t; document.body.appendChild(i); i.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (_) { /* nada */ } i.remove(); return ok; }
}
function delayedConfirm(opts, fn) { confirmBox(opts).then(ok => { if (ok) fn(); }); }

const ACT = {
  go: (b, a) => go(a), reload: () => location.reload(),
  goEstado: (b, a) => { U.jobE = a; U.jobF = 'todos'; U.jobCli = ''; U.jobQ = ''; go('#/trabajos'); },
  closeModal: () => closeModal(),
  set: (b, a) => {
    const k = b.dataset.key, v = b.dataset.val;
    if (k === 'tema') { S.settings.tema = v; applyTheme(); save(); return rerender(); }
    U[k] = v;
    if (b.dataset.list) { $$('button', b.parentElement).forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); if (CUR.refresh) CUR.refresh(); else rerender(); }
    else render(k === 'clientTab' || k === 'jobTab' || k === 'finTab' ? 'tab' : 'still');
  },
  /* calendario */
  calSel: (b, a) => { U.calSel = a; if (b.dataset.view) U.calView = b.dataset.view; rerender(); },
  calMove: (b, a) => { calMove(parseInt(a, 10)); rerender(); },
  calToday: () => { U.calSel = todayStr(); rerender(); },
  chartPick: b => { const i = +b.dataset.i; const cap = $('#chartcap'); if (cap) cap.innerHTML = chartCap(i); $$('.bargrp').forEach(g => g.classList.toggle('pick', g === b)); },
  /* clientes */
  newClient: () => clientForm(), editClient: (b) => clientForm(b.dataset.id), editBrand: b => brandForm(b.dataset.id),
  archClient: b => { const c = getClient(b.dataset.id); c.estado = c.estado === 'archivado' ? 'activo' : 'archivado'; save(); toast(c.estado === 'archivado' ? 'Cliente archivado' : 'Cliente reactivado'); rerender(); },
  delClient: b => {
    const id = b.dataset.id, c = getClient(id), nj = S.jobs.filter(j => j.clienteId === id).length;
    delayedConfirm({ title: '¿Eliminar a ' + c.nombre + '?', text: nj ? `Se eliminarán también sus <b>${nj}</b> ${nj === 1 ? 'trabajo' : 'trabajos'} con todas sus modificaciones e imágenes. Los pagos se conservan en tus finanzas. No se puede deshacer.` : 'Se eliminará este cliente. No se puede deshacer.' },
      async () => { await removeClient(id); save(); toast('Cliente eliminado'); go('#/clientes'); });
  },
  /* trabajos */
  newJob: (b, a) => jobForm(null, a || ''), editJob: b => jobForm(b.dataset.id),
  delJob: b => {
    const id = b.dataset.id, j = getJob(id), nr = S.revisions.filter(r => r.jobId === id).length;
    delayedConfirm({ title: '¿Eliminar “' + j.nombre + '”?', text: nr ? `Se eliminarán también sus <b>${nr}</b> modificaciones e imágenes. Los pagos se conservan. No se puede deshacer.` : 'Se eliminará este trabajo. No se puede deshacer.' },
      async () => { const cid = j.clienteId; await removeJob(id); save(); toast('Trabajo eliminado'); go(getClient(cid) ? '#/cliente/' + cid : '#/trabajos'); });
  },
  taskToggle: (b, a) => { const t = getJob(b.dataset.id).tareas.find(x => x.id === a); t.done = !t.done; save(); rerender(); if (t.done) confetti(b.getBoundingClientRect().left + 14, b.getBoundingClientRect().top + 14); },
  taskDel: (b, a) => { const j = getJob(b.dataset.id); j.tareas = j.tareas.filter(x => x.id !== a); save(); rerender(); },
  taskTemplate: b => { const j = getJob(b.dataset.id); j.tareas = BASE_TAREAS.map(t => ({ id: uid(), t, done: false })); save(); rerender(); },
  /* modificaciones */
  newRev: (b, a) => b.dataset.kind === 'cliente' ? revForm(null, '', a) : revForm(null, a || ''),
  editRev: b => revForm(b.dataset.id),
  delRev: b => {
    const id = b.dataset.id; if (MODALS.length) closeModal();
    delayedConfirm({ title: '¿Eliminar esta modificación?', text: 'Se quitará el pedido y sus imágenes. No se puede deshacer.' }, async () => { const r = byId(S.revisions, id), jid = r && r.jobId; await removeRevision(id); if (jid) revAutoEstado(jid); save(); toast('Modificación eliminada'); rerender(); });
  },
  cycleRev: b => {
    const r = byId(S.revisions, b.dataset.id); r.estado = REV_NEXT[r.estado];
    r.hechaEn = r.estado === 'hecha' ? todayStr() : null;
    const rc = b.getBoundingClientRect();
    revAutoEstado(r.jobId); save(); rerender();
    if (r.estado === 'hecha') confetti(rc.left + rc.width / 2, rc.top + rc.height / 2);
  },
  openImg: b => openLightbox(b.dataset.id),
  openRef: (b, a) => { const c = getClient(b.dataset.id); openLightbox(a, () => { c.refs = c.refs.filter(x => x !== a); dropImages([a]); save(); rerender(); }); },
  copyHex: async (b, a) => { toast((await copyText(a)) ? 'Color ' + a + ' copiado' : 'No se pudo copiar ' + a, { type: 'ok' }); },
  /* dinero */
  newPay: (b, a) => b.dataset.kind === 'cliente' ? payForm(null, '', a) : payForm(null, a || ''),
  editPay: b => payForm(b.dataset.id),
  togglePay: b => { const p = byId(S.payments, b.dataset.id); p.estado = p.estado === 'recibido' ? 'pendiente' : 'recibido'; save(); toast(p.estado === 'recibido' ? 'Pago marcado como recibido' : 'Pago marcado como pendiente'); rerender(); },
  delPay: b => { const id = b.dataset.id; if (MODALS.length) closeModal(); delayedConfirm({ title: '¿Eliminar este pago?', text: 'Dejará de contarse como cobrado.' }, () => { S.payments = S.payments.filter(x => x.id !== id); save(); toast('Pago eliminado'); rerender(); }); },
  newExp: () => expForm(), editExp: b => expForm(b.dataset.id),
  delExp: b => { const id = b.dataset.id; if (MODALS.length) closeModal(); delayedConfirm({ title: '¿Eliminar este gasto?', text: 'Dejará de restarse de tu ganancia.' }, () => { S.expenses = S.expenses.filter(x => x.id !== id); save(); toast('Gasto eliminado'); rerender(); }); },
  setTasa: () => tasaForm(),
  csv: (b, a) => {
    const t = todayStr();
    if (a === 'ingresos') downloadFile('ingresos-' + t + '.csv', toCSV([['Fecha', 'Cliente', 'Trabajo', 'Concepto', 'Importe', 'Moneda', 'Tasa', 'Equivalente USD', 'Método', 'Estado']].concat(S.payments.filter(p => periodMatch(p.fecha, U.finPer)).sort((x, y) => x.fecha.localeCompare(y.fecha)).map(p => [p.fecha, clientName(p.clienteId), (getJob(p.jobId) || {}).nombre || '', p.concepto, p.monto, p.moneda, p.tasa || '', payUSD(p).toFixed(2), p.metodo, p.estado]))), 'text/csv');
    else if (a === 'gastos') downloadFile('gastos-' + t + '.csv', toCSV([['Fecha', 'Concepto', 'Categoría', 'Importe', 'Moneda', 'Tasa', 'Equivalente USD']].concat(S.expenses.filter(x => periodMatch(x.fecha, U.finPer)).sort((x, y) => x.fecha.localeCompare(y.fecha)).map(x => [x.fecha, x.concepto, x.categoria, x.monto, x.moneda, x.tasa || '', toUSD(x.monto, x.moneda, x.tasa).toFixed(2)]))), 'text/csv');
    else downloadFile('por-cobrar-' + t + '.csv', toCSV([['Cliente', 'Trabajo', 'Estado', 'Entrega', 'Precio USD', 'Cobrado USD', 'Pendiente USD']].concat(S.jobs.filter(j => jobPendiente(j) > 0).map(j => [clientName(j.clienteId), j.nombre, j.estado, j.entrega, jobPrecioUSD(j).toFixed(2), jobCobrado(j.id).toFixed(2), jobPendiente(j).toFixed(2)]))), 'text/csv');
    toast('Archivo CSV descargado');
  },
  /* calendario */
  newEvent: (b, a) => eventForm(null, a || U.calSel),
  editEvent: b => eventForm(b.dataset.id),
  delEvent: b => { const id = b.dataset.id; if (MODALS.length) closeModal(); delayedConfirm({ title: '¿Eliminar este evento?', text: 'Se quitará del calendario.' }, () => { S.events = S.events.filter(x => x.id !== id); save(); toast('Evento eliminado'); rerender(); }); },
  /* ajustes y datos */
  backup: async () => { try { await exportBackup(); toast('Respaldo descargado. Guárdalo en un lugar seguro.'); rerender(); } catch (e) { toast('No se pudo crear el respaldo.', { type: 'err' }); } },
  restoreBtn: () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = () => { const f = i.files[0]; if (f) restoreFlow(f); }; i.click(); },
  delCat: (b, a) => { const l = S.settings[b.dataset.key]; if (l.length <= 1) return toast('Debe quedar al menos una categoría.', { type: 'err' }); l.splice(+a, 1); save(); rerender(); },
  /* nube */
  syncNow: async () => {
    if (!window.Sync || !Sync.user()) return;
    await Sync.syncNow(true);
    const st = Sync.status();
    toast(st.state === 'ok' ? 'Todo está sincronizado' : (st.msg || SYNC_TXT[st.state] || 'No se pudo sincronizar'), { type: st.state === 'ok' ? 'ok' : 'err' });
  },
  syncLogout: () => delayedConfirm({ title: '¿Cerrar sesión de la nube?', ok: 'Cerrar sesión', danger: false, text: 'Este dispositivo dejará de sincronizar. Tus datos se quedan aquí y no se borra nada, ni aquí ni en la nube.' },
    async () => { await Sync.signOut(); toast('Sesión cerrada'); }),
  syncRecover: () => { Sync.recover(); toast('Recuperando lo que hay en la nube…'); },
  syncConfirm: () => { Sync.confirmDeletes(); toast('Listo: esos registros también se borrarán en la nube.'); },
  install: async () => { const e = window.__installEvt; if (!e) return; e.prompt(); await e.userChoice; window.__installEvt = null; rerender(); },
  wipe: () => openModal({
    title: 'Borrar todos los datos', danger: true, submitLabel: 'Borrar todo', noFocus: false,
    html: `<p class="m-text">Se eliminarán clientes, trabajos, modificaciones, pagos, eventos e imágenes de este dispositivo${cloudActive() ? ' <b>y también de la nube, así que desaparecerán de todos tus dispositivos</b>' : ''}. <b>No se puede deshacer.</b></p><div class="fgrid">${F.text('ok', 'Escribe BORRAR para confirmar', '', { w: 1, req: 1 })}</div>`,
    onSubmit: async d => { if ((d.ok || '').toUpperCase() !== 'BORRAR') { toast('Escribe la palabra BORRAR para confirmar.', { type: 'err' }); return false; } await wipeAll(); applyTheme(); toast('Datos borrados'); go('#/hoy'); }
  })
};
Object.assign(ACT, EXTRA_ACT);
function restoreFlow(file) {
  delayedConfirm({ title: '¿Restaurar este respaldo?', ok: 'Restaurar', danger: false, text: 'Reemplazará <b>todos los datos actuales</b> de este dispositivo por los del archivo.' + (cloudActive() ? ' Como la nube está conectada, <b>también reemplazará lo que hay en tus otros dispositivos</b>.' : '') }, async () => {
    try { await importBackup(file); applyTheme(); toast('Respaldo restaurado'); go('#/hoy'); } catch (e) { toast(e.message || 'No se pudo restaurar.', { type: 'err' }); }
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (!b || b.disabled) return;
  const fn = ACT[b.dataset.act]; if (!fn) return;
  if (b.tagName === 'A') e.preventDefault();
  fn(b, b.dataset.arg);
});
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.bargrp')) { e.preventDefault(); ACT.chartPick(e.target); }
});

/* ---------- Búsqueda, filtros y formularios en línea ---------- */
document.addEventListener('input', e => {
  const k = e.target.dataset && e.target.dataset.input;
  if (k) { U[k] = e.target.value; if (CUR.refresh) CUR.refresh(); }
});
document.addEventListener('change', async e => {
  const t = e.target, ch = t.dataset && t.dataset.change; if (!ch) return;
  if (ch === 'filter') {
    U[t.dataset.key] = t.value;
    if (t.dataset.key === 'jobE' && t.value) { U.jobF = 'todos'; return rerender(); }
    if (CUR.refresh) CUR.refresh(); else rerender();
  } else if (ch === 'setEstado') {
    const j = getJob(t.dataset.id), old = j.estado; j.estado = t.value;
    if (ENTREGADO.includes(j.estado) && !ENTREGADO.includes(old)) {
      const pend = jobPendiente(j);
      toast(pend > 0 ? 'Entregado. Todavía te deben ' + usd(pend) + '.' : 'Trabajo entregado');
      if (pend <= 0) { const r = t.getBoundingClientRect(); confetti(r.left + r.width / 2, r.top); }
    } else toast('Estado actualizado');
    save(); rerender();
  } else if (ch === 'setNombre') { S.settings.nombre = t.value.trim(); save(); toast('Nombre guardado'); }
  else if (ch === 'addRefs') {
    const c = getClient(t.dataset.id), files = Array.from(t.files || []); t.value = '';
    let n = 0; for (const f of files) { try { c.refs.push(await saveImage(f, { max: 1600 })); n++; } catch (err) { toast(err.message, { type: 'err' }); } }
    if (n) { save(); toast(n === 1 ? 'Referencia agregada' : n + ' referencias agregadas'); rerender(); }
  }
});
document.addEventListener('submit', e => {
  const f = e.target, k = f.dataset && f.dataset.submit; if (!k) return;
  e.preventDefault();
  if (k === 'syncLogin') return syncLogin(f);
  const v = (new FormData(f).get(k === 'addTask' ? 't' : 'v') || '').toString().trim(); if (!v) return;
  if (k === 'addTask') { getJob(f.dataset.id).tareas.push({ id: uid(), t: v, done: false }); }
  else if (k === 'addCat') { const l = S.settings[f.dataset.key]; if (l.some(x => x.toLowerCase() === v.toLowerCase())) return toast('Esa categoría ya existe.', { type: 'err' }); l.push(v); }
  save(); rerender();
  const again = $(k === 'addTask' ? '.addrow input' : `[data-key="${f.dataset.key}"] input`); if (again) again.focus();
});


/* ---------- Nube: estado en pantalla y actualización segura ---------- */
const cloudActive = () => !!(window.Sync && Sync.configured() && Sync.user());
const SYNC_CHIP = { off: 'Nube no disponible', signedout: 'Iniciar sesión', connecting: 'Conectando…', syncing: 'Sincronizando…', ok: 'Sincronizado', offline: 'Sin conexión', error: 'Error de nube', guard: 'Revisa borrados' };
let pendingRerender = false, noticeKey = null;
/* Cuando llegan cambios de otro dispositivo se refresca la pantalla, pero sin interrumpir lo que estás escribiendo. */
function safeRerender() {
  const a = document.activeElement;
  const typing = a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.closest('#main');
  if (MODALS.length || typing) { pendingRerender = true; return; }
  pendingRerender = false; render('still');
}
setInterval(() => { if (pendingRerender) safeRerender(); }, 1500);
function updateSyncUI() {
  const on = !!(window.Sync && Sync.configured()), st = on ? Sync.status() : { state: 'off' };
  const side = $('#sync-side'), top = $('#sync-top');
  if (side) { side.hidden = !on; if (on) { side.className = 'sync-chip s-' + st.state; side.innerHTML = '<i></i>' + (SYNC_CHIP[st.state] || '') + (st.pending && st.state !== 'ok' && st.state !== 'signedout' ? ' · ' + st.pending : ''); side.title = st.msg || ''; } }
  if (top) { top.hidden = !on; if (on) { top.className = 'sync-top s-' + st.state; top.innerHTML = ic(st.state === 'offline' ? 'cloudoff' : 'cloud') + '<i></i>'; top.setAttribute('aria-label', 'Nube: ' + (SYNC_CHIP[st.state] || '')); } }
  const card = $('#sync-card'), act = document.activeElement;
  if (card && !(act && card.contains(act) && act.tagName === 'INPUT')) card.innerHTML = syncCardInner();
  if (on && parseRoute().name === 'hoy') {           // el aviso de “inicia sesión” aparece o desaparece solo
    const k = syncNoticeHTML();
    if (noticeKey !== null && k !== noticeKey) safeRerender();
    noticeKey = k;
  } else noticeKey = null;
}
function syncLogin(f) {
  const fd = new FormData(f), email = (fd.get('email') || '').toString().trim(), pw = (fd.get('pw') || '').toString();
  const btn = f.querySelector('button'), err = $('#sync-login-err'), old = btn.innerHTML;
  btn.disabled = true; btn.textContent = 'Entrando…'; if (err) err.textContent = '';
  Sync.signIn(email, pw).then(() => toast('Sesión iniciada. Sincronizando…', { type: 'ok' })).catch(e => {
    const m = e && e.code ? CloudFirebase.friendly(e).msg : ((e && e.message) || 'No se pudo iniciar sesión.');
    const el = $('#sync-login-err'); if (el) el.textContent = m;
    btn.disabled = false; btn.innerHTML = old;
  });
}

/* ---------- Instalación y funcionamiento sin internet ---------- */
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); window.__installEvt = e; if (parseRoute().name === 'ajustes') rerender(); });
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  /* Aviso de versión nueva: el service worker avisa qué versión quedó activa; si no es la que está corriendo esta pantalla, se ofrece recargar. */
  navigator.serviceWorker.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === 'sw-activated' && d.version && d.version !== APP_BUILD && !window.__updateShown) {
      window.__updateShown = true;
      toast('Hay una versión nueva de ENMA', { sticky: true, action: { label: 'Actualizar', fn: () => location.reload() } });
    }
  });
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      reg.update().catch(() => {});                                   // comprueba si hay versión nueva al abrir
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
    } catch (e) { console.warn('ENMA: no se pudo activar el modo sin conexión:', e); }
  });
}

/* ---------- Arranque ---------- */
function icons() {
  $$('[data-ic]').forEach(el => { el.innerHTML = ic(el.dataset.ic); });
}
(async function boot() {
  icons();
  await loadState();
  applyTheme();
  if (!location.hash) history.replaceState(null, '', '#/hoy');
  render('route');
  let first = true; try { first = !sessionStorage.getItem('enma-splash'); sessionStorage.setItem('enma-splash', '1'); } catch (e) { /* nada */ }
  const sp = $('#splash');
  if (sp) {
    if (!first || REDUCED) sp.remove();
    else setTimeout(() => { sp.classList.add('out'); setTimeout(() => sp.remove(), 520); }, 1050);
  }
  document.body.classList.add('ready');
  initPullToRefresh();
  if (window.Sync) { Sync.onRemote = safeRerender; Sync.onStatus(updateSyncUI); updateSyncUI(); Sync.init().then(updateSyncUI); }
  if (!DB.ok) toast('Este navegador no permite guardar datos (¿modo privado?). Usa una ventana normal para no perder tu trabajo.', { type: 'err' });
})();
