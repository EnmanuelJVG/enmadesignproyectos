/* ENMA Studio Manager — pantallas: Hoy, Clientes, Trabajos y Modificaciones. */
'use strict';

/* Estado de la interfaz (filtros, pestañas). No se guarda, solo vive mientras la app está abierta. */
const U = {
  clientQ: '', clientF: 'activo', clientTab: 'resumen', clientTabId: null,
  jobQ: '', jobF: 'activos', jobE: '', jobCli: '', jobTab: 'cambios', jobTabId: null,
  revF: 'pendientes', revCli: '', revQ: '',
  calView: 'mes', calSel: todayStr(), calDir: '',
  finPer: 'mes', finTab: 'ingresos'
};
const CUR = { refresh: null };
const TYPE = { entrega: ['flag', 'Entrega'], inicio: ['play', 'Inicio'], cambio: ['chat', 'Cambio'], reunion: ['users', 'Reunión'], recordatorio: ['bell', 'Recordatorio'], otro: ['calendar', 'Evento'] };

/* ---------- Piezas compartidas ---------- */
const meta = (...p) => p.filter(Boolean).join(', ');
const badge = (t, c = '') => `<span class="badge ${c}">${esc(t)}</span>`;
const estadoBadge = e => badge(e, 'st-' + (ESTADO_G[e] || 'off'));
function avatar(c, size = '') {
  if (!c) return `<span class="avatar ${size}"><span>?</span></span>`;
  if (c.logoId) return `<span class="avatar ${size} logo"><img data-img="${c.logoId}" alt=""></span>`;
  return `<span class="avatar ${size}" style="--h:${hue(c.nombre)}"><span>${esc(initials(c.nombre))}</span></span>`;
}
const empty = (icon, title, text, action = '') => `<div class="empty"><span class="empty-ic">${ic(icon)}</span><h3>${esc(title)}</h3><p>${esc(text)}</p>${action}</div>`;
const head = (title, sub, actions = '') => `<div class="phead"><div><h1>${title}</h1>${sub ? `<p class="sub">${sub}</p>` : ''}</div><div class="pactions">${actions}</div></div>`;
const back = (href, label) => `<a class="back" href="${href}">${ic('left')} ${esc(label)}</a>`;
const notFound = (msg, href) => ({ html: `<div class="pad-top">${empty('alert', msg, 'Puede que ya no exista.', `<a class="btn primary" href="${href}">Volver</a>`)}</div>` });
const seg = (key, opts, val, list) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" class="${String(v) === String(val) ? 'on' : ''}" aria-pressed="${String(v) === String(val)}" data-act="set" data-key="${key}" data-val="${esc(v)}" ${list ? 'data-list="1"' : ''}>${esc(l)}</button>`).join('')}</div>`;
const searchBox = (key, ph) => `<label class="search">${ic('search')}<input type="search" placeholder="${esc(ph)}" value="${esc(U[key])}" data-input="${key}" aria-label="${esc(ph)}"></label>`;
const stats = list => `<div class="stats">${list.map(([l, v, f, tone]) => `<div class="stat ${tone || ''}"><span class="stat-l">${esc(l)}</span><span class="stat-v" data-count="${v}" data-fmt="${f}">${f === 'usd' ? usd(v) : v}</span></div>`).join('')}</div>`;
const tabsBar = (key, tabs, val) => `<div class="tabs" role="tablist">${tabs.map(([v, l, n]) => `<button role="tab" aria-selected="${v === val}" class="${v === val ? 'on' : ''}" data-act="set" data-key="${key}" data-val="${v}">${esc(l)}${n ? `<em>${esc(n)}</em>` : ''}</button>`).join('')}</div>`;
const progress = pct => `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${pct}%"></i></div>`;

function itemRow(i, t) {
  const overdue = !i.done && i.fecha < t && (i.tipo === 'entrega' || i.tipo === 'cambio');
  const attrs = i.go ? `data-act="go" data-arg="${esc(i.go)}"` : `data-act="editEvent" data-id="${esc(i.evId)}"`;
  return `<button class="row item ty-${i.tipo} ${overdue ? 'late' : ''} ${i.done && i.tipo === 'entrega' ? 'done' : ''}" ${attrs}>
    <span class="dotic">${ic(TYPE[i.tipo][0])}</span>
    <span class="row-main"><b>${esc(i.titulo)}</b><small>${esc(i.sub)}</small></span>
    <span class="row-end">${i.hora ? esc(i.hora) + ' ' : ''}${esc(rel(i.fecha))}</span></button>`;
}

/* ---------- Gráfico de ingresos y gastos ---------- */
function monthsBack(n) {
  const out = [], d = new Date();
  for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push({ key: x.getFullYear() + '-' + pad(x.getMonth() + 1), label: mesCorto(x.getMonth()), full: MESES[x.getMonth()] + ' ' + x.getFullYear() }); }
  return out;
}
function chartCap(i) {
  const m = monthsBack(6)[i], a = sumPay(m.key), g = sumExp(m.key);
  return `<b>${esc(m.full)}</b>: cobrado ${usd(a)}, gastos ${usd(g)}, ganancia ${usd(a - g)}`;
}
function chartHTML() {
  const M = monthsBack(6), I = M.map(m => sumPay(m.key)), X = M.map(m => sumExp(m.key)), mx = Math.max(1, ...I, ...X);
  const bars = M.map((m, i) => {
    const x = 18 + i * 94, h1 = I[i] / mx * 140, h2 = X[i] / mx * 140;
    return `<g class="bargrp" data-act="chartPick" data-i="${i}" tabindex="0" role="button" aria-label="${esc(m.full)}">
      <rect class="hit" x="${x - 8}" y="10" width="86" height="190"/>
      <rect class="bar inc" style="--i:${i}" x="${x}" y="${170 - h1}" width="30" height="${Math.max(h1, I[i] > 0 ? 3 : 0)}" rx="6"><title>Cobrado ${usd(I[i])}</title></rect>
      <rect class="bar exp" style="--i:${i}" x="${x + 34}" y="${170 - h2}" width="30" height="${Math.max(h2, X[i] > 0 ? 3 : 0)}" rx="6"><title>Gastos ${usd(X[i])}</title></rect>
      <text x="${x + 32}" y="192" text-anchor="middle">${m.label}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 580 204" role="group" aria-label="Cobrado y gastos de los últimos 6 meses"><line class="base" x1="8" x2="572" y1="170" y2="170"/>${bars}</svg>
    <div class="legend"><span><i class="inc"></i> Cobrado</span><span><i class="exp"></i> Gastos</span></div>
    <p class="chart-cap" id="chartcap" aria-live="polite">${chartCap(5)}</p>`;
}

/* ---------- HOY ---------- */
function vHoy() {
  const t = todayStr(), h = new Date().getHours();
  const saludo = h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
  const nom = S.settings.nombre ? ', ' + esc(S.settings.nombre) : '';
  const fecha = fmtDate(t, true), fechaCap = fecha[0].toUpperCase() + fecha.slice(1);
  const hayDatos = S.clients.length || S.jobs.length;
  const mk = t.slice(0, 7), ing = sumPay(mk), gas = sumExp(mk);
  const enCurso = S.jobs.filter(j => EN_CURSO.includes(j.estado)).length;
  const porCobrar = S.jobs.reduce((a, j) => a + jobPendiente(j), 0);
  const pend = revPendientes().filter(r => getJob(r.jobId));

  /* Lo que sigue: atrasado + próximos 7 días */
  const lim = addDays(t, 7);
  const prox = allItems().filter(i => {
    if (i.tipo === 'inicio' || i.done) return false;
    if (i.fecha < t) return i.tipo === 'entrega' || i.tipo === 'cambio';
    return i.fecha <= lim;
  }).sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora || '').localeCompare(b.hora || '')).slice(0, 7);

  const porEstado = ESTADOS.map(e => [e.n, S.jobs.filter(j => j.estado === e.n).length]).filter(x => x[1]);
  const maxE = Math.max(1, ...porEstado.map(x => x[1]));
  const dias = S.settings.ultimoRespaldo ? diffDays(t, S.settings.ultimoRespaldo) : null;
  const avisoRespaldo = hayDatos && (dias === null || dias >= 14)
    ? `<div class="notice">${ic('download')}<p>${dias === null ? 'Todavía no has descargado un respaldo. Tus datos viven solo en este dispositivo.' : 'Hace ' + dias + ' días que no descargas un respaldo.'}</p><button class="btn ghost sm" data-act="backup">Descargar respaldo</button></div>` : '';

  if (!hayDatos) {
    return {
      html: `${head(saludo + nom, fechaCap)}${syncNoticeHTML()}
      <section class="welcome card"><h2>Empieza por tu primer cliente</h2>
        <p>Este panel se llena solo con lo que registres. Sigue este orden y en cinco minutos tendrás tu estudio organizado.</p>
        <ol class="steps"><li><b>Crea un cliente</b><span>Sus datos de contacto, su marca y sus colores.</span></li><li><b>Añade un trabajo</b><span>Un logo, un flyer, un video: con fecha de entrega y precio.</span></li><li><b>Anota las modificaciones</b><span>Cada vez que pida un cambio, queda registrado por ronda.</span></li></ol>
        <div class="welcome-act"><button class="btn primary" data-act="newClient">${ic('plus')} Crear mi primer cliente</button><button class="btn ghost" data-act="restoreBtn">${ic('upload')} Ya tengo un respaldo</button></div></section>`
    };
  }

  return {
    html: `${head(saludo + nom, fechaCap)}
    <div class="quick stagger">
      <button class="pill" data-act="newClient" style="--i:0">${ic('plus')} Cliente</button>
      <button class="pill" data-act="newJob" style="--i:1">${ic('plus')} Trabajo</button>
      <button class="pill" data-act="newRev" style="--i:2">${ic('plus')} Modificación</button>
      <button class="pill" data-act="newPay" style="--i:3">${ic('plus')} Pago</button>
      <button class="pill" data-act="newEvent" style="--i:4">${ic('plus')} Evento</button>
    </div>
    ${syncNoticeHTML()}${avisoRespaldo}
    ${stats([['Clientes activos', S.clients.filter(c => c.estado !== 'archivado').length, 'int'], ['Trabajos en curso', enCurso, 'int'], ['Cambios pendientes', pend.length, 'int', pend.length ? 'hot' : ''], ['Por cobrar', porCobrar, 'usd'], ['Cobrado este mes', ing, 'usd']])}
    ${goalCardHTML(ing)}
    <div class="cols">
      <section class="card">
        <div class="card-h"><h2>Lo que sigue</h2><a class="link" href="#/calendario">Ver calendario</a></div>
        ${prox.length ? `<div class="list stagger">${prox.map((i, n) => itemRow(i, t).replace('class="row', `style="--i:${n}" class="row`)).join('')}</div>` : empty('check', 'Todo al día', 'No tienes entregas ni cambios atrasados, ni nada para los próximos 7 días.')}
      </section>
      <section class="card">
        <div class="card-h"><h2>Ingresos y gastos</h2><a class="link" href="#/finanzas">Ver finanzas</a></div>
        ${chartHTML()}
        <p class="net">Ganancia neta de ${MESES[new Date().getMonth()]}: <b>${usd(ing - gas)}</b></p>
      </section>
    </div>
    <div class="cols">
      <section class="card">
        <div class="card-h"><h2>Modificaciones pendientes</h2><a class="link" href="#/cambios">Ver todas</a></div>
        ${pend.length ? `<div class="list stagger">${pend.sort((a, b) => (a.limite || '9').localeCompare(b.limite || '9') || (a.fecha || '').localeCompare(b.fecha || '')).slice(0, 4).map((r, n) => {
          const j = getJob(r.jobId);
          return `<button class="row" style="--i:${n}" data-act="go" data-arg="#/trabajo/${j.id}"><span class="rnode">R${rondaOf(r)}</span><span class="row-main"><b>${esc(j.nombre)}</b><small>${esc(clientName(j.clienteId))}: ${esc(clip(r.pedido, 70))}</small></span><span class="row-end">${r.limite ? esc(rel(r.limite)) : ''}</span></button>`;
        }).join('')}</div>` : empty('chat', 'Sin cambios pendientes', 'Cuando un cliente pida una modificación, anótala y aparecerá aquí.')}
      </section>
      <section class="card">
        <div class="card-h"><h2>Trabajos por estado</h2><a class="link" href="#/trabajos">Ver trabajos</a></div>
        ${porEstado.length ? `<div class="bars">${porEstado.map(([n, c], k) => `<button class="hbar" style="--i:${k}" data-act="goEstado" data-arg="${esc(n)}"><span>${esc(n)}</span><i><u style="--p:${Math.round(c / maxE * 100)}%"></u></i><b>${c}</b></button>`).join('')}</div>` : empty('briefcase', 'Aún no hay trabajos', 'Crea el primero y verás aquí cómo se reparten.')}
      </section>
    </div>`
  };
}

/* ---------- CLIENTES ---------- */
function clientCard(c, n) {
  const act = S.jobs.filter(j => j.clienteId === c.id && !cerrado(j.estado)).length;
  const cambios = revPendientes().filter(r => (getJob(r.jobId) || {}).clienteId === c.id).length;
  const pend = clientPendiente(c.id);
  return `<button class="card ccard" style="--i:${n}" data-act="go" data-arg="#/cliente/${c.id}">
    ${avatar(c)}
    <span class="cc-main"><b>${esc(c.nombre)}</b><small>${esc(meta(c.contacto, c.ciudad) || 'Sin datos de contacto')}</small>
      <span class="cc-tags">${act ? badge(act + (act === 1 ? ' trabajo activo' : ' trabajos activos'), 'muted') : ''}${cambios ? badge(cambios + (cambios === 1 ? ' cambio pendiente' : ' cambios pendientes'), 'acc') : ''}${pend > 0 ? badge('Por cobrar ' + usd(pend), 'warn') : ''}${c.estado === 'archivado' ? badge('Archivado', 'muted') : ''}</span></span></button>`;
}
function listClientes() {
  const q = U.clientQ.toLowerCase();
  const arr = S.clients.filter(c => U.clientF === 'todos' || (U.clientF === 'activo' ? c.estado !== 'archivado' : c.estado === 'archivado'))
    .filter(c => !q || [c.nombre, c.contacto, c.ciudad, c.instagram].join(' ').toLowerCase().includes(q))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  $('#list').innerHTML = arr.length ? arr.map(clientCard).join('') : (S.clients.length
    ? empty('search', 'Sin resultados', 'Prueba con otro nombre o cambia el filtro.')
    : empty('users', 'Aún no tienes clientes', 'Crea el primero para empezar a registrar sus trabajos.', `<button class="btn primary" data-act="newClient">${ic('plus')} Nuevo cliente</button>`));
  hydrate($('#list'));
}
function vClientes() {
  return {
    html: `${head('Clientes', S.clients.length + (S.clients.length === 1 ? ' cliente registrado' : ' clientes registrados'), `<button class="btn primary hide-m" data-act="newClient">${ic('plus')} Nuevo cliente</button>`)}
    <div class="filters">${searchBox('clientQ', 'Buscar cliente')}${seg('clientF', [['activo', 'Activos'], ['archivado', 'Archivados'], ['todos', 'Todos']], U.clientF, true)}</div>
    <div class="cgrid stagger" id="list"></div>`,
    mount: () => { CUR.refresh = listClientes; listClientes(); },
    fab: { label: 'Nuevo cliente', act: 'newClient' }
  };
}

function swatches(c) {
  return c.colores.length ? `<div class="swatches">${c.colores.map(h => `<button class="swatch" data-act="copyHex" data-arg="${esc(h)}" style="--c:${esc(h)}" title="Copiar ${esc(h)}"><i></i><span>${esc(h)}</span></button>`).join('')}</div>` : '<p class="muted">Aún no hay colores guardados.</p>';
}
function vCliente(id) {
  const c = getClient(id); if (!c) return notFound('Cliente no encontrado', '#/clientes');
  if (U.clientTabId !== id) { U.clientTab = 'resumen'; U.clientTabId = id; }
  const jobs = S.jobs.filter(j => j.clienteId === id), revs = S.revisions.filter(r => (getJob(r.jobId) || {}).clienteId === id);
  const pays = S.payments.filter(p => p.clienteId === id);
  const pendR = revs.filter(r => r.estado !== 'hecha').length;
  const act = jobs.filter(j => !cerrado(j.estado)).length;
  const links = [
    waURL(c.whatsapp) && `<a class="iconbtn lg" href="${waURL(c.whatsapp)}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp">${ic('phone')}</a>`,
    c.email && `<a class="iconbtn lg" href="mailto:${esc(c.email)}" aria-label="Enviar correo">${ic('mail')}</a>`,
    igURL(c.instagram) && `<a class="iconbtn lg" href="${igURL(c.instagram)}" target="_blank" rel="noopener" aria-label="Abrir Instagram">${ic('image')}</a>`,
    webURL(c.web) && `<a class="iconbtn lg" href="${webURL(c.web)}" target="_blank" rel="noopener" aria-label="Abrir sitio web">${ic('globe')}</a>`
  ].filter(Boolean).join('');
  const tabs = [['resumen', 'Resumen'], ['trabajos', 'Trabajos', jobs.length || ''], ['cambios', 'Modificaciones', revs.length || ''], ['marca', 'Marca'], ['pagos', 'Pagos', pays.length || '']];
  let body = '';
  if (U.clientTab === 'resumen') {
    const rows = [['Contacto', c.contacto], ['WhatsApp', c.whatsapp], ['Correo', c.email], ['Ciudad', c.ciudad], ['Instagram', c.instagram], ['Web', c.web], ['Cliente desde', c.creado ? fmtDate(ymd(new Date(c.creado)), false) : '']].filter(r => r[1]);
    body = `${stats([['Trabajos', jobs.length, 'int'], ['Activos', act, 'int'], ['Cambios pendientes', pendR, 'int', pendR ? 'hot' : ''], ['Cobrado', clientCobrado(id), 'usd'], ['Por cobrar', clientPendiente(id), 'usd']])}
      <div class="cols">
        <section class="card"><div class="card-h"><h2>Datos</h2></div>${rows.length ? `<dl class="dl">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl>` : '<p class="muted">Sin datos todavía. Usa Editar para completarlos.</p>'}</section>
        <section class="card"><div class="card-h"><h2>Notas</h2></div>${c.notas ? `<p class="prose">${esc(c.notas)}</p>` : '<p class="muted">Sin notas. Aquí puedes anotar cómo le gusta trabajar, horarios, acuerdos…</p>'}</section>
      </div>`;
  } else if (U.clientTab === 'trabajos') {
    body = `<div class="bar-act"><button class="btn primary" data-act="newJob" data-arg="${id}">${ic('plus')} Nuevo trabajo</button></div>` +
      (jobs.length ? `<div class="jgrid stagger">${jobs.sort((a, b) => (b.creado || 0) - (a.creado || 0)).map(jobCard).join('')}</div>` : empty('briefcase', 'Sin trabajos', 'Registra el primer trabajo de este cliente.'));
  } else if (U.clientTab === 'cambios') {
    body = `<div class="bar-act"><button class="btn primary" data-act="newRev" data-arg="${id}" data-kind="cliente">${ic('plus')} Nueva modificación</button></div>` +
      (revs.length ? revGroupsHTML(revs) : empty('chat', 'Sin modificaciones', 'Aquí verás, por diseño, todo lo que este cliente ha pedido cambiar.'));
  } else if (U.clientTab === 'marca') {
    body = `<div class="cols">
      <section class="card"><div class="card-h"><h2>Identidad</h2><button class="btn ghost sm" data-act="editBrand" data-id="${id}">${ic('pencil')} Editar</button></div>
        ${c.logoId ? `<button class="logo-box" data-act="openImg" data-id="${c.logoId}" aria-label="Ver logotipo"><img data-img="${c.logoId}" alt="Logotipo de ${esc(c.nombre)}"></button>` : '<p class="muted">Aún no hay logotipo.</p>'}
        <h3 class="sm-h">Colores</h3>${swatches(c)}
        <h3 class="sm-h">Tipografías</h3>${c.fuentes ? `<p class="prose">${esc(c.fuentes)}</p>` : '<p class="muted">Sin tipografías anotadas.</p>'}
        <h3 class="sm-h">Personalidad de la marca</h3>${c.marcaNotas ? `<p class="prose">${esc(c.marcaNotas)}</p>` : '<p class="muted">Sin descripción.</p>'}
      </section>
      <section class="card"><div class="card-h"><h2>Referencias y recursos</h2><label class="btn ghost sm">${ic('plus')} Agregar<input type="file" accept="image/*" multiple hidden data-change="addRefs" data-id="${id}"></label></div>
        ${c.refs.length ? `<div class="refgrid">${c.refs.map(r => `<button class="thumb sq" data-act="openRef" data-id="${id}" data-arg="${r}" aria-label="Ver referencia"><img data-img="${r}" alt=""></button>`).join('')}</div>` : '<p class="muted">Sube fotos, moodboards o capturas que el cliente te haya enviado.</p>'}
      </section></div>`;
  } else {
    body = `<div class="bar-act"><button class="btn primary" data-act="newPay" data-kind="cliente" data-arg="${id}">${ic('plus')} Registrar pago</button></div>` +
      (pays.length ? `<div class="card flush list">${pays.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => payRow(p, { showJob: true })).join('')}</div>` : empty('wallet', 'Sin pagos', 'Los pagos y anticipos de este cliente aparecerán aquí.'));
  }
  return {
    html: `${back('#/clientes', 'Clientes')}
    <section class="chead"><div class="chead-id">${avatar(c, 'xl')}<div><h1>${esc(c.nombre)}</h1><p class="sub">${esc(meta(c.contacto, c.ciudad)) || 'Sin datos de contacto'}${c.estado === 'archivado' ? ' ' + badge('Archivado', 'muted') : ''}</p></div></div>
      <div class="chead-act">${links}<button class="iconbtn lg" data-act="msgClient" data-id="${id}" aria-label="Preparar un mensaje para el cliente">${ic('send')}</button><button class="iconbtn lg" data-act="editClient" data-id="${id}" aria-label="Editar cliente">${ic('pencil')}</button><button class="iconbtn lg" data-act="archClient" data-id="${id}" aria-label="${c.estado === 'archivado' ? 'Reactivar' : 'Archivar'} cliente">${ic('archive')}</button><button class="iconbtn lg danger" data-act="delClient" data-id="${id}" aria-label="Eliminar cliente">${ic('trash')}</button></div></section>
    ${tabsBar('clientTab', tabs, U.clientTab)}
    <div class="tabbody">${body}</div>`,
    fab: U.clientTab === 'trabajos' ? { label: 'Nuevo trabajo', act: 'newJob', arg: id } : U.clientTab === 'cambios' ? { label: 'Nueva modificación', act: 'newRev', arg: id, kind: 'cliente' } : null
  };
}

/* ---------- TRABAJOS ---------- */
function jobCard(j, n = 0) {
  const c = getClient(j.clienteId), pend = jobPendiente(j);
  const rp = S.revisions.filter(r => r.jobId === j.id && r.estado !== 'hecha').length;
  const late = j.entrega && !cerrado(j.estado) && j.entrega < todayStr();
  const cover = j.portadaId ? `<span class="jcover"><img data-img="${j.portadaId}" alt=""></span>` : `<span class="jcover ph" style="--h:${hue(c ? c.nombre : j.nombre)}"><span>${esc(initials(j.nombre))}</span></span>`;
  return `<button class="card jcard" style="--i:${n}" data-act="go" data-arg="#/trabajo/${j.id}">${cover}
    <span class="jc-main"><b>${esc(j.nombre)}</b><small>${esc(meta(c ? c.nombre : 'Sin cliente', j.categoria))}</small>
      <span class="cc-tags">${estadoBadge(j.estado)}${j.entrega ? badge((late ? 'Venció ' : 'Entrega ') + rel(j.entrega), late ? 'late' : 'muted') : ''}${rp ? badge(rp + (rp === 1 ? ' cambio' : ' cambios'), 'acc') : ''}${pend > 0 ? badge('Debe ' + usd(pend), 'warn') : ''}</span></span></button>`;
}
const JOB_GROUPS = { activos: j => !cerrado(j.estado), entregados: j => ENTREGADO.includes(j.estado), cancelados: j => j.estado === 'Cancelado', todos: () => true };
function listTrabajos() {
  const q = U.jobQ.toLowerCase();
  let arr = S.jobs.filter(JOB_GROUPS[U.jobF] || JOB_GROUPS.todos);
  if (U.jobE) arr = S.jobs.filter(j => j.estado === U.jobE);
  if (U.jobCli) arr = arr.filter(j => j.clienteId === U.jobCli);
  if (q) arr = arr.filter(j => [j.nombre, j.categoria, clientName(j.clienteId)].join(' ').toLowerCase().includes(q));
  arr.sort((a, b) => cerrado(a.estado) === cerrado(b.estado) ? ((a.entrega || '9999').localeCompare(b.entrega || '9999') || (b.creado || 0) - (a.creado || 0)) : cerrado(a.estado) ? 1 : -1);
  $('#list').innerHTML = arr.length ? arr.map(jobCard).join('') : (S.jobs.length
    ? empty('search', 'Sin resultados', 'Prueba con otro filtro o búsqueda.')
    : empty('briefcase', 'Aún no hay trabajos', 'Registra cada logo, flyer o video con su fecha de entrega y su precio.', `<button class="btn primary" data-act="newJob">${ic('plus')} Nuevo trabajo</button>`));
  hydrate($('#list'));
}
function vTrabajos() {
  return {
    html: `${head('Trabajos', 'Cada diseño que haces, con su estado y su entrega', `<button class="btn primary hide-m" data-act="newJob">${ic('plus')} Nuevo trabajo</button>`)}
    <div class="filters">${searchBox('jobQ', 'Buscar trabajo')}
      ${seg('jobF', [['activos', 'En curso'], ['entregados', 'Entregados'], ['cancelados', 'Cancelados'], ['todos', 'Todos']], U.jobF, true)}
      <select class="sel" data-change="filter" data-key="jobCli" aria-label="Filtrar por cliente"><option value="">Todos los clientes</option>${S.clients.map(c => `<option value="${c.id}" ${U.jobCli === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select>
      <select class="sel" data-change="filter" data-key="jobE" aria-label="Filtrar por estado"><option value="">Cualquier estado</option>${ESTADOS.map(e => `<option ${U.jobE === e.n ? 'selected' : ''}>${e.n}</option>`).join('')}</select></div>
    <div class="jgrid stagger" id="list"></div>`,
    mount: () => { CUR.refresh = listTrabajos; listTrabajos(); },
    fab: { label: 'Nuevo trabajo', act: 'newJob' }
  };
}

function payRow(p, o = {}) {
  const j = getJob(p.jobId), ok = p.estado === 'recibido';
  return `<div class="row pay ${p.estado}">
    <button class="check ${ok ? 'on' : ''}" role="checkbox" aria-checked="${ok}" data-act="togglePay" data-id="${p.id}" aria-label="${ok ? 'Marcar como pendiente' : 'Marcar como recibido'}">${ic('check')}</button>
    <button class="row-main" data-act="editPay" data-id="${p.id}"><b>${esc(p.concepto)}</b><small>${esc(meta(fmtDate(p.fecha), p.metodo, o.showJob && j ? j.nombre : '', ok ? '' : 'Pendiente'))}</small></button>
    <span class="row-end money"><b>${money(p.monto, p.moneda)}</b>${p.moneda === 'VES' ? `<small>${usd(payUSD(p))}</small>` : ''}</span></div>`;
}

function vTrabajo(id) {
  const j = getJob(id); if (!j) return notFound('Trabajo no encontrado', '#/trabajos');
  if (U.jobTabId !== id) { U.jobTab = 'cambios'; U.jobTabId = id; }
  const c = getClient(j.clienteId), cob = jobCobrado(id), prec = jobPrecioUSD(j), pend = jobPendiente(j);
  const pct = prec > 0 ? Math.min(100, Math.round(cob / prec * 100)) : 0;
  const revs = S.revisions.filter(r => r.jobId === id), pendR = revs.filter(r => r.estado !== 'hecha').length;
  const tareas = j.tareas, tdone = tareas.filter(t => t.done).length;
  const pays = S.payments.filter(p => p.jobId === id);
  const late = j.entrega && !cerrado(j.estado) && j.entrega < todayStr();
  const tabs = [['cambios', 'Modificaciones', revs.length || ''], ['tareas', 'Tareas', tareas.length ? tdone + '/' + tareas.length : ''], ['detalles', 'Detalles'], ['pagos', 'Pagos', pays.length || '']];
  let body = '';
  if (U.jobTab === 'cambios') {
    const sorted = revs.slice().sort((a, b) => rondaOf(b) - rondaOf(a));
    body = `<div class="rev-bar"><p class="rev-sum">${revs.length ? `<b>${revs.length}</b> ${revs.length === 1 ? 'ronda' : 'rondas'}${pendR ? `, <b>${pendR}</b> por hacer` : ', todas hechas'}` : 'Aún no hay rondas de cambios'}</p><button class="btn primary" data-act="newRev" data-arg="${id}">${ic('plus')} Nueva modificación</button></div>` +
      (sorted.length ? `<div class="timeline stagger">${sorted.map((r, n) => revCard(r, { n })).join('')}</div>` : empty('chat', 'Sin modificaciones todavía', 'Cuando el cliente pida un cambio, anótalo aquí con su captura. Cada pedido será una ronda numerada.'));
  } else if (U.jobTab === 'tareas') {
    body = `<section class="card"><form class="addrow" data-submit="addTask" data-id="${id}"><input name="t" placeholder="Añadir tarea, por ejemplo: Diseñar propuestas" aria-label="Nueva tarea" required autocomplete="off"><button class="btn primary">Añadir</button></form>
      ${tareas.length ? `<div class="list tasks">${tareas.map(t => `<div class="row task ${t.done ? 'done' : ''}"><button class="check ${t.done ? 'on' : ''}" role="checkbox" aria-checked="${t.done}" data-act="taskToggle" data-id="${id}" data-arg="${t.id}" aria-label="Marcar tarea">${ic('check')}</button><span class="row-main"><b>${esc(t.t)}</b></span><button class="iconbtn" data-act="taskDel" data-id="${id}" data-arg="${t.id}" aria-label="Quitar tarea">${ic('x')}</button></div>`).join('')}</div>${progress(Math.round(tdone / tareas.length * 100))}`
      : `<p class="muted pad">Sin tareas. Puedes añadir las tuyas o empezar con una lista base.</p><button class="btn ghost sm" data-act="taskTemplate" data-id="${id}">Usar lista de identidad visual</button>`}</section>`;
  } else if (U.jobTab === 'detalles') {
    const rows = [['Categoría', j.categoria], ['Prioridad', j.prioridad], ['Inicio', j.inicio && fmtDate(j.inicio, true)], ['Entrega', j.entrega && fmtDate(j.entrega, true)], ['Creado', j.creado && fmtDate(ymd(new Date(j.creado)))]].filter(r => r[1]);
    body = `<div class="cols"><section class="card"><div class="card-h"><h2>Datos</h2><button class="btn ghost sm" data-act="editJob" data-id="${id}">${ic('pencil')} Editar</button></div><dl class="dl">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl></section>
      <section class="card"><div class="card-h"><h2>Brief</h2></div>${j.brief ? `<p class="prose">${esc(j.brief)}</p>` : '<p class="muted">Sin brief. Anota aquí lo que pidió el cliente al empezar.</p>'}<h3 class="sm-h">Notas</h3>${j.notas ? `<p class="prose">${esc(j.notas)}</p>` : '<p class="muted">Sin notas.</p>'}</section></div>`;
  } else {
    body = `<div class="bar-act"><button class="btn primary" data-act="newPay" data-arg="${id}">${ic('plus')} Registrar pago</button></div>` +
      (pays.length ? `<div class="card flush list">${pays.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).map(p => payRow(p)).join('')}</div>` : empty('wallet', 'Sin pagos', 'Registra el anticipo y cada pago para ver cuánto falta por cobrar.'));
  }
  const cover = j.portadaId ? `<div class="jcoverbig"><img data-img="${j.portadaId}" alt=""></div>` : '';
  return {
    html: `${back('#/trabajos', 'Trabajos')}
    <section class="jhead ${j.portadaId ? 'has-cover' : ''}">${cover}
      <div class="jh-body">
        <div class="jh-top"><div><h1>${esc(j.nombre)}</h1><p class="sub">${c ? `<a class="clink" href="#/cliente/${c.id}">${avatar(c, 'xs')} ${esc(c.nombre)}</a>` : 'Sin cliente'}${j.categoria ? ', ' + esc(j.categoria) : ''}</p></div>
          <div class="chead-act"><button class="iconbtn lg" data-act="editJob" data-id="${id}" aria-label="Editar trabajo">${ic('pencil')}</button><button class="iconbtn lg danger" data-act="delJob" data-id="${id}" aria-label="Eliminar trabajo">${ic('trash')}</button></div></div>
        <div class="jh-meta"><label class="estado-sel st-${ESTADO_G[j.estado]}"><span class="sr">Estado</span><select data-change="setEstado" data-id="${id}" aria-label="Estado del trabajo">${ESTADOS.map(e => `<option ${e.n === j.estado ? 'selected' : ''}>${e.n}</option>`).join('')}</select></label>
          ${j.prioridad ? badge('Prioridad ' + j.prioridad.toLowerCase(), j.prioridad === 'Alta' ? 'late' : 'muted') : ''}
          ${j.entrega ? badge((late ? 'Venció ' : 'Entrega ') + rel(j.entrega), late ? 'late' : 'muted') : badge('Sin fecha de entrega', 'muted')}</div>
        <div class="jh-tools">${c ? `<button class="btn ghost sm" data-act="msgJob" data-id="${id}">${ic('send')} Mensaje</button>` : ''}<button class="btn ghost sm" data-act="docMenu" data-id="${id}">${ic('file')} Cotización y recibos</button><button class="btn ghost sm" data-act="dupJob" data-id="${id}">${ic('copy')} Duplicar</button></div>
      </div></section>
    <section class="card money"><div class="money-nums">
      <div><span>Precio</span><b>${money(j.precio, j.moneda)}</b>${j.moneda === 'VES' ? `<small>${usd(prec)} a Bs ${n2(j.tasa)}</small>` : ''}</div>
      <div><span>Cobrado</span><b>${usd(cob)}</b></div>
      <div><span>Por cobrar</span><b class="${pend > 0 ? 'warn-t' : ''}">${usd(pend)}</b></div>
      <button class="btn ghost" data-act="newPay" data-arg="${id}">${ic('plus')} Registrar pago</button></div>${progress(pct)}</section>
    ${tabsBar('jobTab', tabs, U.jobTab)}
    <div class="tabbody">${body}</div>`,
    fab: U.jobTab === 'cambios' ? { label: 'Nueva modificación', act: 'newRev', arg: id } : U.jobTab === 'pagos' ? { label: 'Registrar pago', act: 'newPay', arg: id } : null
  };
}

/* ---------- MODIFICACIONES ---------- */
function revCard(r, o = {}) {
  const j = getJob(r.jobId), n = rondaOf(r), t = todayStr();
  const late = r.limite && r.estado !== 'hecha' && r.limite < t;
  const stIc = r.estado === 'hecha' ? 'check' : r.estado === 'en_proceso' ? 'refresh' : 'clock';
  const thumbs = (r.imgId || r.entregaImgId) ? `<div class="rev-imgs">${r.imgId ? `<button class="thumb" data-act="openImg" data-id="${r.imgId}" aria-label="Ver pedido del cliente"><img data-img="${r.imgId}" alt=""><small>Pedido</small></button>` : ''}${r.entregaImgId ? `<button class="thumb" data-act="openImg" data-id="${r.entregaImgId}" aria-label="Ver mi versión"><img data-img="${r.entregaImgId}" alt=""><small>Mi versión</small></button>` : ''}</div>` : '';
  return `<article class="rev st-${r.estado}" style="--i:${o.n || 0}">
    <div class="rev-node"><span>R${n}</span></div>
    <div class="rev-card">
      <div class="rev-top"><div class="rev-meta"><b>Ronda ${n}</b>${r.canal ? badge(r.canal, 'muted') : ''}<span class="muted">${esc(fmtDate(r.fecha))}</span></div>
        <button class="stbtn st-${r.estado}" data-act="cycleRev" data-id="${r.id}" aria-label="Estado: ${REV_ESTADOS[r.estado]}. Toca para cambiarlo">${ic(stIc)} ${REV_ESTADOS[r.estado]}</button></div>
      ${o.showJob && j ? `<a class="rev-job" href="#/trabajo/${j.id}">${esc(j.nombre)} <small>${esc(clientName(j.clienteId))}</small></a>` : ''}
      <p class="rev-text">${esc(r.pedido)}</p>${thumbs}
      ${r.respuesta ? `<div class="rev-resp"><b>Lo que cambié</b><p>${esc(r.respuesta)}</p></div>` : ''}
      <div class="rev-foot"><span class="due ${late ? 'late' : ''}">${r.estado === 'hecha' && r.hechaEn ? `${ic('check')} Hecha ${esc(rel(r.hechaEn))}` : r.limite ? `${ic('clock')} Para ${esc(rel(r.limite))}` : ''}</span>
        <span class="acts"><button class="iconbtn" data-act="editRev" data-id="${r.id}" aria-label="Editar modificación">${ic('pencil')}</button><button class="iconbtn" data-act="delRev" data-id="${r.id}" aria-label="Eliminar modificación">${ic('trash')}</button></span></div>
    </div></article>`;
}
/* Agrupa por trabajo: cada diseño con sus rondas */
function revGroupsHTML(list) {
  const m = new Map();
  list.forEach(r => { if (getJob(r.jobId)) { if (!m.has(r.jobId)) m.set(r.jobId, []); m.get(r.jobId).push(r); } });
  const groups = [...m.entries()].map(([jid, arr]) => ({ j: getJob(jid), arr: arr.sort((a, b) => rondaOf(b) - rondaOf(a)) }))
    .sort((a, b) => (b.arr[0].fecha || '').localeCompare(a.arr[0].fecha || '') || (b.arr[0].creado || 0) - (a.arr[0].creado || 0));
  return groups.map(g => `<section class="rgroup"><h3 class="grp"><a href="#/trabajo/${g.j.id}">${esc(g.j.nombre)}</a><small>${esc(clientName(g.j.clienteId))}</small><em>${g.arr.length}</em></h3>
    <div class="timeline">${g.arr.map((r, n) => revCard(r, { n })).join('')}</div></section>`).join('');
}
function listCambios() {
  const q = U.revQ.toLowerCase();
  let arr = S.revisions.filter(r => getJob(r.jobId));
  if (U.revF === 'pendientes') arr = arr.filter(r => r.estado !== 'hecha');
  else if (U.revF === 'hechas') arr = arr.filter(r => r.estado === 'hecha');
  if (U.revCli) arr = arr.filter(r => getJob(r.jobId).clienteId === U.revCli);
  if (q) arr = arr.filter(r => [r.pedido, r.respuesta, getJob(r.jobId).nombre, clientName(getJob(r.jobId).clienteId)].join(' ').toLowerCase().includes(q));
  $('#list').innerHTML = arr.length ? revGroupsHTML(arr) : (S.revisions.length
    ? empty(U.revF === 'pendientes' ? 'check' : 'search', U.revF === 'pendientes' && !q && !U.revCli ? 'Sin cambios pendientes' : 'Sin resultados', U.revF === 'pendientes' && !q && !U.revCli ? 'Todas las modificaciones están hechas.' : 'Prueba con otro filtro o búsqueda.')
    : empty('chat', 'Aún no hay modificaciones', 'Aquí se junta todo lo que tus clientes piden cambiar, ordenado por diseño y por ronda.', `<button class="btn primary" data-act="newRev">${ic('plus')} Nueva modificación</button>`));
  hydrate($('#list'));
}
function vCambios() {
  const pend = revPendientes().length;
  return {
    html: `${head('Modificaciones', pend ? pend + (pend === 1 ? ' cambio por hacer' : ' cambios por hacer') : 'Lo que cada cliente pide cambiar en cada diseño', `<button class="btn primary hide-m" data-act="newRev">${ic('plus')} Nueva modificación</button>`)}
    <div class="filters">${searchBox('revQ', 'Buscar en las modificaciones')}
      ${seg('revF', [['pendientes', 'Por hacer'], ['hechas', 'Hechas'], ['todas', 'Todas']], U.revF, true)}
      <select class="sel" data-change="filter" data-key="revCli" aria-label="Filtrar por cliente"><option value="">Todos los clientes</option>${S.clients.map(c => `<option value="${c.id}" ${U.revCli === c.id ? 'selected' : ''}>${esc(c.nombre)}</option>`).join('')}</select></div>
    <div id="list"></div>`,
    mount: () => { CUR.refresh = listCambios; listCambios(); },
    fab: { label: 'Nueva modificación', act: 'newRev' }
  };
}
