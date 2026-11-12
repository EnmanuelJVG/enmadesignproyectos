/* ENMA Studio Manager — pantallas: Calendario, Finanzas y Ajustes. */
'use strict';

/* ---------- CALENDARIO ---------- */
function itemChip(i) {
  const attrs = i.go ? `data-act="go" data-arg="${esc(i.go)}"` : `data-act="editEvent" data-id="${esc(i.evId)}"`;
  const overdue = !i.done && i.fecha < todayStr() && (i.tipo === 'entrega' || i.tipo === 'cambio');
  return `<button class="ichip ty-${i.tipo} ${overdue ? 'late' : ''}" ${attrs}>${i.hora ? `<small>${esc(i.hora)}</small>` : ''}<span>${esc(i.titulo)}</span></button>`;
}
function calTitle() {
  const d = parseD(U.calSel);
  if (U.calView === 'mes') return MESES[d.getMonth()] + ' ' + d.getFullYear();
  if (U.calView === 'semana') { const a = parseD(weekStart(U.calSel)), b = parseD(addDays(weekStart(U.calSel), 6)); return a.getDate() + ' ' + mesCorto(a.getMonth()) + ' al ' + b.getDate() + ' ' + mesCorto(b.getMonth()); }
  return fmtDate(U.calSel, true);
}
function calMove(dir) {
  const d = parseD(U.calSel);
  if (U.calView === 'mes') {
    const n = new Date(d.getFullYear(), d.getMonth() + dir, 1), t = new Date();
    U.calSel = (n.getFullYear() === t.getFullYear() && n.getMonth() === t.getMonth()) ? todayStr() : ymd(n);
  } else U.calSel = addDays(U.calSel, dir * (U.calView === 'semana' ? 7 : 1));
  U.calDir = dir > 0 ? 'to-l' : 'to-r';
}
function monthGrid(map, t) {
  const d = parseD(U.calSel), y = d.getFullYear(), m = d.getMonth();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7, dim = new Date(y, m + 1, 0).getDate(), total = Math.ceil((lead + dim) / 7) * 7;
  let cells = '';
  for (let i = 0; i < total; i++) {
    const dt = new Date(y, m, 1 - lead + i), s = ymd(dt), items = map.get(s) || [];
    const types = [...new Set(items.map(x => x.tipo))].slice(0, 4);
    const late = items.some(x => !x.done && s < t && (x.tipo === 'entrega' || x.tipo === 'cambio'));
    cells += `<button class="cell ${dt.getMonth() !== m ? 'out' : ''} ${s === t ? 'today' : ''} ${s === U.calSel ? 'sel' : ''} ${late ? 'late' : ''}" data-act="calSel" data-arg="${s}" aria-label="${esc(fmtDate(s, true))}${items.length ? ', ' + items.length + ' pendientes' : ''}" aria-pressed="${s === U.calSel}">
      <span class="cn">${dt.getDate()}</span><span class="dots">${types.map(x => `<i class="d ty-${x}"></i>`).join('')}</span>
      <span class="cl">${items.slice(0, 2).map(x => `<em class="ty-${x.tipo}">${esc(clip(x.titulo, 20))}</em>`).join('')}${items.length > 2 ? `<em class="more">+${items.length - 2} más</em>` : ''}</span></button>`;
  }
  return `<div class="cal ${U.calDir}"><div class="cal-dow">${['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div></div>`;
}
function weekView(map, t) {
  const a = weekStart(U.calSel);
  return `<div class="weekgrid ${U.calDir}">${[0, 1, 2, 3, 4, 5, 6].map(k => {
    const s = addDays(a, k), pd = parseD(s), items = map.get(s) || [];
    return `<section class="wday ${s === t ? 'today' : ''} ${s === U.calSel ? 'sel' : ''}"><button class="wday-h" data-act="calSel" data-arg="${s}" data-view="dia"><span>${DIAS[pd.getDay()].slice(0, 3)}</span><b>${pd.getDate()}</b></button>
      ${items.length ? items.map(itemChip).join('') : '<p class="muted tiny">Libre</p>'}</section>`;
  }).join('')}</div>`;
}
function agendaCard(map, t) {
  const items = map.get(U.calSel) || [];
  return `<section class="card agenda"><div class="card-h"><h2>${esc(fmtDate(U.calSel, true))}</h2><button class="btn ghost sm" data-act="newEvent" data-arg="${U.calSel}">${ic('plus')} Evento</button></div>
    ${items.length ? `<div class="list">${items.map(i => itemRow(i, t)).join('')}</div>` : empty('calendar', 'Día libre', 'No hay entregas, cambios ni eventos para esta fecha.')}</section>`;
}
function vCalendario() {
  const map = itemsByDate(), t = todayStr();
  const body = U.calView === 'mes' ? monthGrid(map, t) + agendaCard(map, t) : U.calView === 'semana' ? weekView(map, t) : agendaCard(map, t);
  const PLURAL = { entrega: 'Entregas', cambio: 'Cambios', reunion: 'Reuniones', recordatorio: 'Recordatorios' };
  const legend = Object.keys(PLURAL).map(k => `<span><i class="d ty-${k}"></i>${PLURAL[k]}</span>`).join('');
  const out = {
    html: `${head('Calendario', 'Entregas, cambios y reuniones en un solo lugar', `<button class="btn primary hide-m" data-act="newEvent" data-arg="${U.calSel}">${ic('plus')} Nuevo evento</button>`)}
    <div class="cal-bar"><div class="cal-nav"><button class="iconbtn lg" data-act="calMove" data-arg="-1" aria-label="Anterior">${ic('left')}</button><button class="iconbtn lg" data-act="calMove" data-arg="1" aria-label="Siguiente">${ic('right')}</button><button class="btn ghost sm" data-act="calToday">Hoy</button></div>
      <h2 class="cal-title" aria-live="polite">${esc(calTitle())}</h2>${seg('calView', [['mes', 'Mes'], ['semana', 'Semana'], ['dia', 'Día']], U.calView)}</div>
    ${body}<p class="legend cal-legend">${legend}</p>`,
    fab: { label: 'Nuevo evento', act: 'newEvent', arg: U.calSel }
  };
  U.calDir = '';
  return out;
}

/* ---------- FINANZAS ---------- */
function periodMatch(f, per) {
  if (!f) return false;
  const t = todayStr();
  if (per === 'todo') return true;
  if (per === 'mes') return f.startsWith(t.slice(0, 7));
  if (per === 'anio') return f.startsWith(t.slice(0, 4));
  const d = parseD(t); return f >= ymd(new Date(d.getFullYear(), d.getMonth() - 2, 1));
}
const PER_LABEL = { mes: 'este mes', '3m': 'los últimos 3 meses', anio: 'este año', todo: 'todo el tiempo' };
function expRow(x) {
  return `<div class="row"><span class="dotic ty-gasto">${ic('wallet')}</span><button class="row-main" data-act="editExp" data-id="${x.id}"><b>${esc(x.concepto)}</b><small>${esc(meta(fmtDate(x.fecha), x.categoria))}</small></button>
    <span class="row-end money"><b>${money(x.monto, x.moneda)}</b>${x.moneda === 'VES' ? `<small>${usd(toUSD(x.monto, x.moneda, x.tasa))}</small>` : ''}</span></div>`;
}
function vFinanzas() {
  const per = U.finPer;
  const pays = S.payments.filter(p => periodMatch(p.fecha, per)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const exps = S.expenses.filter(x => periodMatch(x.fecha, per)).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  const cob = pays.filter(p => p.estado === 'recibido').reduce((a, p) => a + payUSD(p), 0);
  const gas = exps.reduce((a, x) => a + toUSD(x.monto, x.moneda, x.tasa), 0);
  const porCobrar = S.jobs.reduce((a, j) => a + jobPendiente(j), 0);
  const cotizado = S.jobs.filter(j => ['Cotización pendiente', 'Esperando aprobación'].includes(j.estado)).reduce((a, j) => a + jobPrecioUSD(j), 0);
  const tasa = S.settings.tasa;
  const deben = S.jobs.filter(j => jobPendiente(j) > 0).sort((a, b) => (a.entrega || '9999').localeCompare(b.entrega || '9999'));
  let body = '';
  if (U.finTab === 'ingresos') {
    body = `<div class="bar-act"><button class="btn primary" data-act="newPay">${ic('plus')} Registrar pago</button><button class="btn ghost" data-act="csv" data-arg="ingresos">${ic('download')} Exportar CSV</button></div>` +
      (pays.length ? `<div class="card flush list">${pays.map(p => payRow(p, { showJob: true })).join('')}</div>` : empty('wallet', 'Sin pagos en ' + PER_LABEL[per], 'Registra anticipos y pagos para ver cuánto estás cobrando.'));
  } else if (U.finTab === 'gastos') {
    body = `<div class="bar-act"><button class="btn primary" data-act="newExp">${ic('plus')} Registrar gasto</button><button class="btn ghost" data-act="csv" data-arg="gastos">${ic('download')} Exportar CSV</button></div>` +
      (exps.length ? `<div class="card flush list">${exps.map(expRow).join('')}</div>` : empty('wallet', 'Sin gastos en ' + PER_LABEL[per], 'Suscripciones, software, recursos: anótalos para conocer tu ganancia real.'));
  } else {
    body = `<div class="bar-act"><button class="btn ghost" data-act="csv" data-arg="cobrar">${ic('download')} Exportar CSV</button></div>` +
      (deben.length ? `<div class="card flush list">${deben.map(j => {
        const prec = jobPrecioUSD(j), cob2 = jobCobrado(j.id), pct = prec > 0 ? Math.min(100, Math.round(cob2 / prec * 100)) : 0;
        return `<button class="row owe" data-act="go" data-arg="#/trabajo/${j.id}"><span class="row-main"><b>${esc(j.nombre)}</b><small>${esc(meta(clientName(j.clienteId), j.entrega ? 'entrega ' + rel(j.entrega) : '', ESTADO_G[j.estado] === 'done' ? 'ya entregado' : ''))}</small>${progress(pct)}</span><span class="row-end money"><b>${usd(jobPendiente(j))}</b><small>de ${usd(prec)}</small></span></button>`;
      }).join('')}</div>` : empty('check', 'Nada por cobrar', 'Cuando un trabajo tenga saldo pendiente aparecerá aquí.'));
  }
  return {
    html: `${head('Finanzas', 'Lo que cobras, lo que gastas y lo que te deben', `<button class="btn primary hide-m" data-act="newPay">${ic('plus')} Registrar pago</button>`)}
    <div class="filters">${seg('finPer', [['mes', 'Este mes'], ['3m', '3 meses'], ['anio', 'Este año'], ['todo', 'Todo']], per)}</div>
    ${stats([['Cobrado', cob, 'usd'], ['Gastos', gas, 'usd'], ['Ganancia neta', cob - gas, 'usd', cob - gas < 0 ? 'neg' : ''], ['Por cobrar', porCobrar, 'usd'], ['Cotizado en espera', cotizado, 'usd']])}
    <div class="ratebar"><span>${tasa ? `Tasa de cambio: <b>Bs ${n2(tasa)}</b> por USD${S.settings.tasaFecha ? ', actualizada ' + esc(rel(S.settings.tasaFecha)) : ''}` : 'No hay tasa de cambio configurada. La necesitas para registrar montos en bolívares.'}</span><button class="btn ghost sm" data-act="setTasa">${tasa ? 'Cambiar tasa' : 'Configurar tasa'}</button></div>
    <section class="card"><div class="card-h"><h2>Últimos 6 meses</h2></div>${chartHTML()}</section>
    ${tabsBar('finTab', [['ingresos', 'Ingresos', pays.length || ''], ['gastos', 'Gastos', exps.length || ''], ['cobrar', 'Por cobrar', deben.length || '']], U.finTab)}
    <div class="tabbody">${body}</div>`,
    fab: U.finTab === 'gastos' ? { label: 'Registrar gasto', act: 'newExp' } : { label: 'Registrar pago', act: 'newPay' }
  };
}

/* ---------- AJUSTES ---------- */
function chipEditor(key, label, list) {
  return `<div class="chips-ed"><h3 class="sm-h">${label}</h3>
    <div class="chips">${list.map((c, i) => `<span class="chip">${esc(c)}<button data-act="delCat" data-key="${key}" data-arg="${i}" aria-label="Quitar ${esc(c)}">${ic('x')}</button></span>`).join('')}</div>
    <form class="addrow" data-submit="addCat" data-key="${key}"><input name="v" placeholder="Nueva categoría" aria-label="Nueva categoría" required autocomplete="off"><button class="btn ghost">Añadir</button></form></div>`;
}

/* ---------- Nube (sincronización) ---------- */
const SYNC_TXT = { off: 'Solo en este dispositivo', signedout: 'Sin iniciar sesión', connecting: 'Conectando…', syncing: 'Sincronizando…', ok: 'Sincronizado', offline: 'Sin conexión', error: 'No se pudo sincronizar', guard: 'Revisa los borrados' };
function agoText(ms) {
  if (!ms) return '';
  const m = Math.floor((Date.now() - ms) / 60000);
  return m < 1 ? 'hace un momento' : m < 60 ? 'hace ' + m + ' min' : m < 1440 ? 'hace ' + Math.floor(m / 60) + ' h' : 'hace ' + Math.floor(m / 1440) + ' d';
}
const syncOn = () => !!(window.Sync && Sync.configured());
function syncCardInner() {
  if (!syncOn()) {
    return `<div class="card-h"><h2>Nube</h2></div>
      <p class="prose">La nube aún no está conectada, así que tus datos viven solo en este dispositivo. Cuando la conectes, lo que hagas en el iPhone aparecerá solo en tus otros dispositivos.</p>
      <p class="muted tiny">Sigue el paso “Conectar la nube” del README (son unos 10 minutos, una sola vez).</p>`;
  }
  const st = Sync.status(), u = Sync.user();
  if (!u) {
    const msg = st.state === 'error' || st.state === 'offline' ? `<p class="sync-err" role="alert">${esc(st.msg)}</p>` : '';
    return `<div class="card-h"><h2>Nube</h2><span class="sync-state s-${st.state}"><i></i>${SYNC_TXT[st.state] || ''}</span></div>
      <p class="prose">Inicia sesión con el correo y la contraseña que creaste en Firebase. Hazlo una vez en cada dispositivo y tus cambios aparecerán en todos.</p>
      <form class="sync-form" data-submit="syncLogin" autocomplete="on">
        <label class="fld"><span>Correo</span><input name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="off" spellcheck="false" required></label>
        <label class="fld"><span>Contraseña</span><input name="pw" type="password" autocomplete="current-password" required></label>
        <p class="sync-err" id="sync-login-err" role="alert"></p>${msg}
        <button class="btn primary">${ic('lock')} Iniciar sesión</button>
      </form>`;
  }
  const guard = st.state === 'guard' ? `<div class="sync-guard" role="alert">${ic('alert')}<div><b>Ojo: faltan ${Sync.guardCount()} registros en este dispositivo.</b><p>Si los borraste a propósito, confirma para borrarlos también en la nube. Si no, recupéralos desde la nube y no se pierde nada.</p>
      <div class="bar-act"><button class="btn primary sm" data-act="syncRecover">Recuperar desde la nube</button><button class="btn ghost sm" data-act="syncConfirm">Sí, fue a propósito</button></div></div></div>` : '';
  const err = (st.state === 'error' || st.state === 'offline') && st.msg ? `<p class="sync-err${st.state === 'offline' ? ' off' : ''}" role="alert">${esc(st.msg)}</p>` : '';
  const det = [st.last ? 'Última sincronización: ' + agoText(st.last) + '.' : '', st.pending ? st.pending + (st.pending === 1 ? ' cambio' : ' cambios') + ' por subir.' : ''].filter(Boolean).join(' ');
  return `<div class="card-h"><h2>Nube</h2><span class="sync-state s-${st.state}"><i></i>${SYNC_TXT[st.state] || ''}</span></div>
    <p class="prose">Conectado como <b>${esc(u.email)}</b>. Tus cambios se guardan aquí primero y se copian a la nube; lo que cambies en otro dispositivo llega solo.</p>
    ${det ? `<p class="muted tiny">${esc(det)}</p>` : ''}${err}${guard}
    <div class="bar-act"><button class="btn ghost" data-act="syncNow">${ic('refresh')} Sincronizar ahora</button><button class="btn ghost" data-act="syncLogout">Cerrar sesión</button></div>`;
}
/* Aviso para la pantalla Hoy cuando la nube está configurada pero este dispositivo aún no inició sesión */
function syncNoticeHTML() {
  if (!syncOn()) return '';
  const st = Sync.status();
  if (st.state === 'guard') return `<div class="notice warn">${ic('alert')}<p>Faltan datos en este dispositivo respecto a la nube. Revísalo antes de que se borren allá.</p><button class="btn ghost sm" data-act="go" data-arg="#/ajustes">Revisar</button></div>`;
  if (!Sync.user() && st.state !== 'connecting') return `<div class="notice">${ic('cloud')}<p>Inicia sesión para ver aquí lo que tienes en tus otros dispositivos.</p><button class="btn ghost sm" data-act="go" data-arg="#/ajustes">Iniciar sesión</button></div>`;
  return '';
}
function vAjustes() {
  const s = S.settings, dias = s.ultimoRespaldo ? diffDays(todayStr(), s.ultimoRespaldo) : null;
  return {
    html: `${head('Ajustes', 'Tu estudio, tus datos y tu forma de verlo')}
    <div class="cols">
      <div class="stack">
        <section class="card" id="sync-card">${syncCardInner()}</section>
        <section class="card"><div class="card-h"><h2>Perfil</h2></div>
          <label class="fld"><span>Tu nombre (para el saludo)</span><input value="${esc(s.nombre)}" data-change="setNombre" placeholder="Enma" autocomplete="off"></label></section>
        <section class="card"><div class="card-h"><h2>Apariencia</h2></div>
          ${seg('tema', [['auto', 'Automático'], ['claro', 'Claro'], ['oscuro', 'Oscuro']], s.tema)}</section>
        <section class="card"><div class="card-h"><h2>Tasa de cambio</h2></div>
          <p class="prose">${s.tasa ? `Bs ${n2(s.tasa)} por USD${s.tasaFecha ? ', actualizada ' + esc(rel(s.tasaFecha)) : ''}.` : 'Sin configurar.'} Cada pago o gasto en bolívares guarda la tasa del momento, así que cambiarla después no altera tus cuentas anteriores.</p>
          <button class="btn ghost" data-act="setTasa">${s.tasa ? 'Cambiar tasa' : 'Configurar tasa'}</button></section>
        <section class="card"><div class="card-h"><h2>Instalar en el celular</h2></div>
          <p class="prose">Instálala para abrirla como una app, a pantalla completa y sin internet.</p>
          <ul class="tips"><li><b>iPhone:</b> abre esta página en Safari, toca Compartir y elige “Añadir a pantalla de inicio”.</li><li><b>Android:</b> en Chrome toca los tres puntos y elige “Instalar app”.</li><li><b>Computadora:</b> en Chrome o Edge usa el icono de instalar en la barra de direcciones.</li></ul>
          ${window.__installEvt ? `<button class="btn primary" data-act="install">${ic('download')} Instalar ahora</button>` : ''}</section>
      </div>
      <div class="stack">
        <section class="card"><div class="card-h"><h2>Tus datos</h2></div>
          <p class="prose">${syncOn() ? 'Los respaldos son una copia extra en un archivo, por si algún día pierdes el acceso a la nube. Restaurar un respaldo también reemplaza lo que hay en la nube.' : 'Todo lo que registras se guarda <b>solo en este dispositivo</b>. Para tenerlo en el celular y en la computadora, o para no perderlo, descarga un respaldo y restáuralo en el otro equipo.'}</p>
          <p class="muted">${dias === null ? 'Todavía no has descargado ningún respaldo.' : dias === 0 ? 'Último respaldo: hoy.' : 'Último respaldo: hace ' + dias + (dias === 1 ? ' día.' : ' días.')}</p>
          <div class="bar-act"><button class="btn primary" data-act="backup">${ic('download')} Descargar respaldo</button><button class="btn ghost" data-act="restoreBtn">${ic('upload')} Restaurar respaldo</button></div>
          <p class="muted tiny">Resumen guardado: ${S.clients.length} clientes, ${S.jobs.length} trabajos, ${S.revisions.length} modificaciones, ${S.payments.length} pagos.</p></section>
        <section class="card"><div class="card-h"><h2>Categorías</h2></div>${chipEditor('catTrabajo', 'De trabajos', s.catTrabajo)}${chipEditor('catGasto', 'De gastos', s.catGasto)}</section>
        <section class="card danger-zone"><div class="card-h"><h2>Borrar todo</h2></div>
          <p class="prose">Elimina clientes, trabajos, modificaciones, pagos e imágenes de este dispositivo. No se puede deshacer; descarga un respaldo antes.</p>
          <button class="btn danger" data-act="wipe">${ic('trash')} Borrar todos los datos</button></section>
      </div>
    </div>`
  };
}
