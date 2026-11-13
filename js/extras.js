/* ENMA Studio Manager — extras: búsqueda y acciones rápidas, mensajes de WhatsApp, cotizaciones y recibos,
   meta mensual, duplicar trabajos y "desliza para sincronizar". */
'use strict';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const isTyping = () => { const a = document.activeElement; return !!(a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)); };

/* =====================================================================
   1. Búsqueda y acciones rápidas (Ctrl/Cmd + K, o el icono de la lupa)
   ===================================================================== */
const QUICK = [
  ['newClient', 'users', 'Nuevo cliente'], ['newJob', 'briefcase', 'Nuevo trabajo'], ['newRev', 'chat', 'Nueva modificación'],
  ['newPay', 'wallet', 'Registrar pago'], ['newExp', 'trend', 'Registrar gasto'], ['newEvent', 'calendar', 'Nuevo evento']
];
const GO_TO = [['#/hoy', 'home', 'Hoy'], ['#/clientes', 'users', 'Clientes'], ['#/trabajos', 'briefcase', 'Trabajos'], ['#/cambios', 'chat', 'Modificaciones'], ['#/calendario', 'calendar', 'Calendario'], ['#/finanzas', 'wallet', 'Finanzas'], ['#/ajustes', 'sliders', 'Ajustes']];

function paletteGroups(q) {
  const n = norm(q).trim();
  if (!n) {
    return [
      { h: 'Crear', items: QUICK.map(([act, icon, t]) => ({ ic: icon, t, act })) },
      { h: 'Ir a', items: GO_TO.map(([href, icon, t]) => ({ ic: icon, t, href })) }
    ];
  }
  const has = (...f) => f.some(x => norm(x).includes(n));
  const g = [];
  const cl = S.clients.filter(c => has(c.nombre, c.contacto, c.ciudad, c.email, c.instagram, c.whatsapp)).slice(0, 6)
    .map(c => ({ ic: 'users', t: c.nombre, s: c.contacto || c.ciudad || 'Cliente', href: '#/cliente/' + c.id }));
  const jb = S.jobs.filter(j => has(j.nombre, j.categoria, clientName(j.clienteId), j.brief)).slice(0, 6)
    .map(j => ({ ic: 'briefcase', t: j.nombre, s: clientName(j.clienteId) + ', ' + j.estado, href: '#/trabajo/' + j.id }));
  const rv = S.revisions.filter(r => getJob(r.jobId) && has(r.pedido)).slice(0, 5)
    .map(r => { const j = getJob(r.jobId); return { ic: 'chat', t: clip(r.pedido, 70), s: j.nombre + ', ronda ' + rondaOf(r), href: '#/trabajo/' + j.id }; });
  const py = S.payments.filter(p => has(p.concepto, clientName(p.clienteId))).slice(0, 4)
    .map(p => ({ ic: 'wallet', t: p.concepto || 'Pago', s: clientName(p.clienteId) + ', ' + money(p.monto, p.moneda), href: p.jobId && getJob(p.jobId) ? '#/trabajo/' + p.jobId : '#/finanzas' }));
  const ev = S.events.filter(e => has(e.titulo, e.notas)).slice(0, 4)
    .map(e => ({ ic: 'calendar', t: e.titulo, s: fmtDate(e.fecha, false), href: '#/calendario', date: e.fecha }));
  if (cl.length) g.push({ h: 'Clientes', items: cl });
  if (jb.length) g.push({ h: 'Trabajos', items: jb });
  if (rv.length) g.push({ h: 'Modificaciones', items: rv });
  if (py.length) g.push({ h: 'Pagos', items: py });
  if (ev.length) g.push({ h: 'Eventos', items: ev });
  return g;
}
function paletteHTML(q) {
  const groups = paletteGroups(q);
  if (!groups.length) return `<div class="empty pal-empty"><span class="empty-ic">${ic('search')}</span><h3>Sin resultados</h3><p>Prueba con otra palabra: un cliente, un trabajo o parte de un pedido.</p></div>`;
  let k = 0;
  return groups.map(g => `<h3 class="sm-h pal-h">${esc(g.h)}</h3><div class="list">${g.items.map(i => {
    const at = i.act ? `data-act="palDo" data-arg="${i.act}"` : `data-act="palGo" data-arg="${esc(i.href)}" ${i.date ? `data-date="${esc(i.date)}"` : ''}`;
    return `<button type="button" class="row pal-i" style="--i:${Math.min(k++, 12)}" ${at}><span class="dotic">${ic(i.ic)}</span><span class="row-main"><b>${esc(i.t)}</b>${i.s ? `<small>${esc(i.s)}</small>` : ''}</span><span class="row-end">${ic('right')}</span></button>`;
  }).join('')}</div>`).join('');
}
function openPalette() {
  if (MODALS.some(m => m.o && m.o.palette)) return;
  openModal({
    title: 'Buscar y crear', palette: true, noSubmit: true, cancelLabel: 'Cerrar', noFocus: true,
    html: `<label class="search pal-search">${ic('search')}<input id="pal-q" type="search" placeholder="Busca un cliente, trabajo, pago…" autocomplete="off" autocapitalize="off" aria-label="Buscar"></label><div id="pal-list" class="pal-list stagger"></div>`,
    onMount: el => {
      const inp = $('#pal-q', el), list = $('#pal-list', el); let sel = 0;
      const items = () => $$('.pal-i', list);
      const mark = () => items().forEach((b, i) => b.classList.toggle('sel', i === sel));
      const draw = () => { list.innerHTML = paletteHTML(inp.value); sel = 0; mark(); };
      inp.addEventListener('input', draw);
      inp.addEventListener('keydown', e => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault(); const n = items().length; if (!n) return;
        sel = e.key === 'ArrowDown' ? Math.min(sel + 1, n - 1) : Math.max(sel - 1, 0); mark();
        items()[sel].scrollIntoView({ block: 'nearest' });
      });
      draw(); inp.focus({ preventScroll: true });          // enseguida (dentro del toque), para que el teclado del iPhone se abra y no se pierdan letras
      setTimeout(() => { if (document.activeElement !== inp) inp.focus({ preventScroll: true }); }, 120);
    },
    onSubmit: (d, form) => { const b = $('.pal-i.sel', form) || $('.pal-i', form); if (b) b.click(); return false; }
  });
}
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); }
  else if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping() && !MODALS.length) { e.preventDefault(); openPalette(); }
});

/* =====================================================================
   2. Mensajes para el cliente (WhatsApp)
   ===================================================================== */
function saludoCliente(c) { const n = String((c && (c.contacto || c.nombre)) || '').trim().split(/\s+/)[0]; return n ? 'Hola ' + n : 'Hola'; }
function msgTemplates(c, j) {
  const hi = saludoCliente(c), t = j ? '«' + j.nombre + '»' : 'tu proyecto';
  const pend = j ? jobPendiente(j) : (c ? clientPendiente(c.id) : 0);
  const last = j ? S.revisions.filter(r => r.jobId === j.id).sort((a, b) => rondaOf(b) - rondaOf(a))[0] : null;
  const montoPend = j && j.moneda === 'VES' && j.tasa ? usd(pend) + ' (aprox. Bs ' + n2(pend * j.tasa) + ' a tasa ' + n2(j.tasa) + ')' : usd(pend);
  return [
    ['propuesta', 'Propuesta lista', `${hi}, ¡buenas! Ya tengo lista la propuesta de ${t}. Te la envío por aquí para que me cuentes qué te parece 🙌`],
    ['revision', 'Nueva versión para revisar', `${hi}, te comparto la nueva versión de ${t}${last ? ' (ronda ' + rondaOf(last) + ')' : ''}. ¿Me confirmas si está todo bien o qué ajustamos?`],
    ['cambios', 'Cambios recibidos', `${hi}, ya recibí tus cambios de ${t}${last && last.pedido ? ': ' + clip(last.pedido, 120) : ''}. Te aviso apenas estén listos 🙌`],
    ['pago', 'Recordatorio de pago', `${hi}, te escribo para recordarte el saldo pendiente de ${t}: ${montoPend}. ¿Me confirmas cuando lo realices? ¡Gracias!`],
    ['entrega', 'Entrega final', `${hi}, ¡listo! Te dejo los archivos finales de ${t}. Fue un gusto trabajar contigo; cualquier ajuste me avisas 💫`],
    ['cotizacion', 'Enviar cotización', `${hi}, te envío la cotización de ${t}${j ? ' por ' + money(j.precio, j.moneda) : ''}. Si estás de acuerdo, coordinamos el anticipo para empezar. ¡Quedo atento!`]
  ];
}
function msgForm(clientId, jobId) {
  const c = getClient(clientId); if (!c) return;
  const jobs = S.jobs.filter(j => j.clienteId === clientId).sort((a, b) => (b.creado || 0) - (a.creado || 0));
  const jid = jobId || (jobs.find(j => !cerrado(j.estado)) || {}).id || '';
  const wa = waURL(c.whatsapp);
  const first = () => msgTemplates(c, getJob(jid))[0];
  openModal({
    title: 'Mensaje para ' + c.nombre, noSubmit: true, cancelLabel: 'Cerrar',
    extra: `<button type="button" class="btn ghost" data-act="msgCopy">${ic('copy')} Copiar</button>${wa ? `<a class="btn primary" id="msg-wa" href="${wa}" target="_blank" rel="noopener">${ic('send')} Abrir WhatsApp</a>` : ''}`,
    html: `<div class="fgrid">${F.sel('tpl', 'Plantilla', msgTemplates(c, getJob(jid)).map(x => [x[0], x[1]]), 'propuesta', { w: 1 })}
      ${jobs.length ? F.sel('jid', 'Trabajo', jobs.map(j => [j.id, j.nombre]), jid, { w: 1, blank: 'Sin un trabajo específico' }) : ''}
      ${F.area('texto', 'Mensaje (puedes editarlo)', first()[2], { rows: 6 })}</div>
      <p class="muted tiny">${wa ? 'Se abrirá WhatsApp con el mensaje ya escrito; solo tienes que enviarlo.' : 'Este cliente no tiene WhatsApp guardado: copia el mensaje y pégalo donde le escribas. Puedes añadirlo en Editar cliente.'}</p>`,
    onMount: el => {
      const tpl = $('[name=tpl]', el), sj = $('[name=jid]', el), tx = $('[name=texto]', el), a = $('#msg-wa', el);
      const link = () => { if (a) a.href = wa + '?text=' + encodeURIComponent(tx.value); };
      const fill = () => { const list = msgTemplates(c, sj && sj.value ? getJob(sj.value) : null); tx.value = (list.find(x => x[0] === tpl.value) || list[0])[2]; link(); };
      tpl.addEventListener('change', fill); if (sj) sj.addEventListener('change', fill); tx.addEventListener('input', link); fill();
    }
  });
}

/* =====================================================================
   3. Cotización, recibo y estado de cuenta (se guardan como PDF desde "Imprimir")
   ===================================================================== */
function docMenu(jobId) {
  const j = getJob(jobId); if (!j) return;
  const recs = S.payments.filter(p => p.jobId === jobId && p.estado === 'recibido').sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const row = (act, icon, t, s, arg = '') => `<button type="button" class="row" data-act="${act}" data-id="${jobId}" ${arg}><span class="dotic">${ic(icon)}</span><span class="row-main"><b>${esc(t)}</b><small>${esc(s)}</small></span><span class="row-end">${ic('right')}</span></button>`;
  openModal({
    title: 'Documentos de ' + j.nombre, noSubmit: true, cancelLabel: 'Cerrar',
    html: `<div class="list">${row('docOpen', 'file', 'Cotización', 'Para enviarle el precio al cliente', 'data-arg="cotizacion"')}${row('docOpen', 'file', 'Estado de cuenta', 'Precio, pagos recibidos y saldo', 'data-arg="cuenta"')}
      ${recs.map(p => row('docOpen', 'wallet', 'Recibo del ' + fmtDate(p.fecha, false), (p.concepto || 'Pago') + ', ' + money(p.monto, p.moneda), `data-arg="recibo" data-pay="${p.id}"`)).join('')}</div>
      ${recs.length ? '' : '<p class="muted tiny pad">Cuando registres un pago como recibido podrás generar su recibo aquí.</p>'}`
  });
}
const docRef = (pre, j, p) => pre + '-' + ymd(new Date((p && p.fecha) ? p.fecha + 'T12:00:00' : (j.creado || Date.now()))).replace(/-/g, '') + '-' + String(j.id).slice(-3).toUpperCase();
function docHTML(kind, j, c, p) {
  const prec = jobPrecioUSD(j), cob = jobCobrado(j.id), pend = jobPendiente(j);
  const isVES = j.moneda === 'VES';
  const studio = S.settings.nombre ? esc(S.settings.nombre) : 'Enma Design';
  const title = kind === 'cotizacion' ? 'Cotización' : kind === 'recibo' ? 'Recibo de pago' : 'Estado de cuenta';
  const ref = docRef(kind === 'cotizacion' ? 'COT' : kind === 'recibo' ? 'REC' : 'EDC', j, p);
  const eqv = isVES ? `<small>≈ ${usd(prec)} a Bs ${n2(j.tasa)} por USD</small>` : '';
  let table = '', totals = '', notes = '';
  if (kind === 'cotizacion') {
    table = `<tr><td><b>${esc(j.nombre)}</b>${j.categoria ? `<small>${esc(j.categoria)}</small>` : ''}${j.brief ? `<small>${esc(clip(j.brief, 220))}</small>` : ''}</td><td class="r">${money(j.precio, j.moneda)}${eqv}</td></tr>`;
    totals = `<div class="doc-tot big"><span>Total</span><b>${money(j.precio, j.moneda)}</b></div>`;
    notes = `Validez de la cotización: 15 días. Para iniciar el trabajo se solicita un anticipo del 50% (${money((Number(j.precio) || 0) / 2, j.moneda)}).`;
  } else if (kind === 'recibo' && p) {
    const eqp = p.moneda === 'VES' && p.tasa ? `<small>≈ ${usd(payUSD(p))} a Bs ${n2(p.tasa)} por USD</small>` : '';
    table = `<tr><td><b>${esc(p.concepto || 'Pago de ' + j.nombre)}</b><small>${esc(j.nombre)}${p.metodo ? ', ' + esc(p.metodo) : ''}, ${esc(fmtDate(p.fecha, false))}</small></td><td class="r">${money(p.monto, p.moneda)}${eqp}</td></tr>`;
    totals = `<div class="doc-tot"><span>Precio acordado</span><b>${money(j.precio, j.moneda)}</b></div><div class="doc-tot"><span>Pagado a la fecha</span><b>${usd(cob)}</b></div><div class="doc-tot big"><span>Saldo pendiente</span><b>${usd(pend)}</b></div>`;
    notes = 'Recibimos conforme el pago indicado. ¡Gracias por tu confianza!';
  } else {
    const pays = S.payments.filter(x => x.jobId === j.id).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));
    table = `<tr><td><b>${esc(j.nombre)}</b><small>Precio acordado</small></td><td class="r">${money(j.precio, j.moneda)}${eqv}</td></tr>` +
      pays.map(x => `<tr><td>${esc(fmtDate(x.fecha, false))}, ${esc(x.concepto || 'Pago')}${x.metodo ? `<small>${esc(x.metodo)}${x.estado === 'recibido' ? '' : ', pendiente (no cuenta todavía)'}</small>` : ''}</td><td class="r ${x.estado === 'recibido' ? '' : 'dim'}">${money(x.monto, x.moneda)}</td></tr>`).join('');
    totals = `<div class="doc-tot"><span>Precio acordado</span><b>${usd(prec)}</b></div><div class="doc-tot"><span>Cobrado</span><b>${usd(cob)}</b></div><div class="doc-tot big"><span>Por cobrar</span><b>${usd(pend)}</b></div>`;
    notes = '';
  }
  const pie = String(S.settings.docPie || '').trim();
  return `<div class="doc-sheet" id="doc-sheet">
    <header class="doc-head"><img src="assets/logo-negro.png" alt="${studio}"><div class="doc-meta"><h2>${title}</h2><span>N.º ${esc(ref)}</span><span>${esc(fmtDate(p && p.fecha ? p.fecha : todayStr(), true))}</span></div></header>
    <section class="doc-to"><span>Para</span><b>${esc(c ? c.nombre : 'Cliente')}</b>${c && c.contacto ? `<small>${esc(c.contacto)}</small>` : ''}${c && c.email ? `<small>${esc(c.email)}</small>` : ''}${c && c.whatsapp ? `<small>${esc(c.whatsapp)}</small>` : ''}</section>
    <table class="doc-table"><thead><tr><th>Concepto</th><th class="r">Importe</th></tr></thead><tbody>${table}</tbody></table>
    <div class="doc-totals">${totals}</div>
    ${notes ? `<p class="doc-notes" contenteditable="true" spellcheck="false">${esc(notes)}</p>` : ''}
    ${pie ? `<footer class="doc-foot"><span>Datos de pago y contacto</span><p>${esc(pie).replace(/\n/g, '<br>')}</p></footer>` : ''}
    <p class="doc-by">${studio}</p></div>`;
}
function openDoc(kind, jobId, payId) {
  const j = getJob(jobId); if (!j) return;
  const p = payId ? byId(S.payments, payId) : null;
  closeDoc();
  const el = document.createElement('div');
  el.className = 'docview'; el.id = 'docview'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Documento');
  el.innerHTML = `<div class="doc-bar"><button type="button" class="btn ghost sm" data-act="docClose">${ic('left')} Volver</button><span class="doc-hint">Toca el texto de abajo para editarlo antes de guardar.</span><button type="button" class="btn primary sm" data-act="docPrint">${ic('download')} Guardar PDF / Imprimir</button></div>${docHTML(kind, j, getClient(j.clienteId), p)}`;
  document.body.appendChild(el); document.body.classList.add('doc-open', 'lock');
  requestAnimationFrame(() => el.classList.add('in'));
  window.scrollTo(0, 0);
}
function closeDoc() { const el = $('#docview'); if (el) el.remove(); document.body.classList.remove('doc-open'); if (!MODALS.length) document.body.classList.remove('lock'); }

/* =====================================================================
   4. Meta mensual
   ===================================================================== */
function goalCardHTML(ingMes) {
  const meta = Number(S.settings.metaMes) || 0, mes = MESES[new Date().getMonth()];
  if (!meta) return `<section class="card goal goal-empty"><span class="goal-ic">${ic('target')}</span><div class="goal-t"><h2>Meta de ${mes}</h2><p class="muted">Fija cuánto quieres cobrar este mes y mira cómo avanzas.</p></div><button class="btn ghost" data-act="setMeta">Fijar meta</button></section>`;
  const pct = Math.max(0, ingMes / meta * 100), shown = Math.min(100, pct), C = 2 * Math.PI * 42, off = C * (1 - shown / 100), done = pct >= 100;
  return `<section class="card goal ${done ? 'done' : ''}"><div class="ring" role="img" aria-label="${Math.round(pct)}% de la meta"><svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="42"/><circle class="ring-v" cx="50" cy="50" r="42" style="--c:${C.toFixed(1)};--off:${off.toFixed(1)}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/></svg><b data-count="${Math.round(pct)}" data-fmt="int">${Math.round(pct)}</b></div>
    <div class="goal-t"><h2>${done ? '¡Meta de ' + mes + ' cumplida!' : 'Meta de ' + mes}</h2><p><b>${usd(ingMes)}</b> de ${usd(meta)}</p><p class="muted">${done ? 'Superaste la meta por ' + usd(ingMes - meta) + '.' : 'Faltan ' + usd(meta - ingMes) + ' para llegar.'}</p></div>
    <button class="iconbtn" data-act="setMeta" aria-label="Cambiar meta">${ic('pencil')}</button></section>`;
}
function metaForm() {
  openModal({
    title: 'Meta mensual', small: true, submitLabel: 'Guardar meta',
    html: `<p class="m-text">¿Cuánto quieres cobrar cada mes? Se compara con lo que marcas como <b>Recibido</b>. Déjalo vacío para quitar la meta.</p><div class="fgrid">${F.num('meta', 'Meta en dólares (USD)', S.settings.metaMes || '', { w: 1 })}</div>`,
    onSubmit: d => {
      const raw = String(d.meta || '').trim();
      if (!raw) { S.settings.metaMes = null; save(); toast('Meta quitada'); return rerender(); }
      const v = parseNum(raw); if (!(v > 0)) { toast('Escribe una meta mayor que cero.', { type: 'err' }); return false; }
      S.settings.metaMes = v; save(); toast('Meta guardada'); rerender();
    }
  });
}

/* =====================================================================
   5. Duplicar un trabajo
   ===================================================================== */
function duplicateJob(id) {
  const j = getJob(id); if (!j) return;
  const n = { id: uid(), creado: Date.now(), clienteId: j.clienteId, nombre: j.nombre + ' (copia)', categoria: j.categoria, estado: ESTADOS[0].n, prioridad: j.prioridad,
    inicio: todayStr(), entrega: '', precio: j.precio, moneda: j.moneda, tasa: j.tasa, brief: j.brief, notas: j.notas, tareas: (j.tareas || []).map(t => ({ id: uid(), t: t.t, done: false })) };
  S.jobs.push(n); U.jobTab = 'detalles'; U.jobTabId = n.id; save();
  toast('Trabajo duplicado. Ajusta el nombre y la fecha.'); go('#/trabajo/' + n.id);
}

/* =====================================================================
   6. Desliza hacia abajo para sincronizar (iPhone y Android)
   ===================================================================== */
const settle = async ms => { const t0 = Date.now(); while (Date.now() - t0 < ms && window.Sync && ['syncing', 'connecting'].includes(Sync.status().state)) await sleep(150); };
async function refreshNow() {
  if (window.Sync && Sync.user()) {
    await Sync.syncNow(true); await settle(9000);
    const st = Sync.status();
    toast(st.state === 'ok' ? 'Todo está sincronizado' : (st.msg || 'No se pudo sincronizar todavía'), { type: st.state === 'ok' ? 'ok' : 'err' });
  } else { rerender(); toast('Pantalla actualizada'); }
}
function initPullToRefresh() {
  if (!('ontouchstart' in window)) return;
  const el = document.createElement('div'); el.id = 'ptr'; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `<span class="ptr-c">${ic('refresh')}</span><span class="ptr-t">Desliza para sincronizar</span>`;
  document.body.appendChild(el);
  const txt = $('.ptr-t', el), circ = $('.ptr-c', el);
  const GO = 64, MAX = 96;
  let y0 = 0, pull = 0, active = false, busy = false;
  const set = (p, label) => {
    el.style.setProperty('--p', p + 'px'); el.classList.toggle('show', p > 6 || busy); el.classList.toggle('ready', p >= GO);
    circ.style.setProperty('--r', Math.min(360, p / GO * 360) + 'deg'); if (label) txt.textContent = label;
  };
  document.addEventListener('touchstart', e => {
    active = false;
    if (busy || MODALS.length || document.body.classList.contains('doc-open') || e.touches.length !== 1 || window.scrollY > 0) return;
    if (e.target.closest && e.target.closest('input, textarea, select, .tabs, .seg, .calgrid, [data-noptr]')) return;
    y0 = e.touches[0].clientY; pull = 0; active = true;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!active) return;
    const dy = e.touches[0].clientY - y0;
    if (window.scrollY > 0 || dy <= 0) { if (pull) { pull = 0; set(0); } return; }
    pull = Math.min(MAX, dy * 0.5); set(pull, pull >= GO ? 'Suelta para sincronizar' : 'Desliza para sincronizar');
  }, { passive: true });
  document.addEventListener('touchend', async () => {
    if (!active) return; active = false;
    if (pull >= GO) { busy = true; el.classList.add('spin'); set(GO, 'Sincronizando…'); const t0 = Date.now(); try { await refreshNow(); } finally { const rest = 800 - (Date.now() - t0); if (rest > 0) await sleep(rest); busy = false; el.classList.remove('spin'); } }   // el indicador se queda un instante para que se note
    pull = 0; set(0);
  });
  document.addEventListener('touchcancel', () => { active = false; pull = 0; set(0); });
}

/* =====================================================================
   Acciones (se unen a ACT en app.js) y ajustes
   ===================================================================== */
const EXTRA_ACT = {
  palette: () => openPalette(),
  palGo: (b, a) => { const d = b.dataset.date; closeModal(); if (d) U.calSel = d; go(a); },
  palDo: (b, a) => { closeModal(); setTimeout(() => { if (typeof ACT !== 'undefined' && ACT[a]) ACT[a](b); }, 80); },
  msgClient: b => msgForm(b.dataset.id),
  msgJob: b => { const j = getJob(b.dataset.id); if (j) msgForm(j.clienteId, j.id); },
  msgCopy: async b => { const t = $('[name=texto]', b.closest('.modal')); toast((t && await copyText(t.value)) ? 'Mensaje copiado' : 'No se pudo copiar', { type: 'ok' }); },
  docMenu: b => docMenu(b.dataset.id),
  docOpen: (b, a) => { closeModal(); openDoc(a, b.dataset.id, b.dataset.pay); },
  docClose: () => closeDoc(),
  docPrint: () => window.print(),
  setMeta: () => metaForm(),
  dupJob: b => duplicateJob(b.dataset.id)
};
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset && t.dataset.change === 'setDocPie') { S.settings.docPie = t.value.trim(); save(); toast('Datos guardados'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#docview') && !MODALS.length) closeDoc(); });
