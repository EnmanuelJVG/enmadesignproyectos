/* ENMA Studio Manager — formularios (ventanas para crear y editar). */
'use strict';

const MONEDAS = [['USD', 'Dólares (USD)'], ['VES', 'Bolívares (Bs)']];
const TIPOS_EVENTO = [['reunion', 'Reunión'], ['recordatorio', 'Recordatorio'], ['otro', 'Otro']];
const delBtn = (act, id) => `<button type="button" class="btn danger-ghost" data-act="${act}" data-id="${id}">${ic('trash')} Eliminar</button>`;
const tasaField = v => `<div class="w" data-tasa hidden>${F.num('tasa', 'Tasa de cambio (Bs por 1 USD)', v || S.settings.tasa || '', { w: 1 })}</div>`;
const nombresCat = (list, actual) => (actual && !list.includes(actual) ? [actual, ...list] : list);

/* ---------- Cliente ---------- */
function clientForm(id) {
  const c = id ? getClient(id) : {};
  openModal({
    title: id ? 'Editar cliente' : 'Nuevo cliente', submitLabel: id ? 'Guardar cambios' : 'Crear cliente',
    html: `<div class="fgrid">${F.text('nombre', 'Empresa o cliente', c.nombre, { req: 1, w: 1 })}${F.text('contacto', 'Persona de contacto', c.contacto)}${F.text('whatsapp', 'WhatsApp', c.whatsapp, { t: 'tel', ph: '+58 412 0000000' })}${F.text('email', 'Correo', c.email, { t: 'email' })}${F.text('ciudad', 'País y ciudad', c.ciudad)}${F.text('instagram', 'Instagram', c.instagram, { ph: '@usuario' })}${F.text('web', 'Página web', c.web, { ph: 'www.ejemplo.com' })}${F.area('notas', 'Notas', c.notas, { ph: 'Cómo le gusta trabajar, acuerdos, horarios…' })}</div>`,
    onSubmit: d => {
      if (!d.nombre) { toast('Escribe el nombre del cliente.', { type: 'err' }); return false; }
      if (S.clients.some(x => x.id !== id && x.nombre.toLowerCase() === d.nombre.toLowerCase())) { toast('Ya tienes un cliente con ese nombre.', { type: 'err' }); return false; }
      const f = { nombre: d.nombre, contacto: d.contacto, whatsapp: d.whatsapp, email: d.email, ciudad: d.ciudad, instagram: d.instagram, web: d.web, notas: d.notas };
      if (id) { Object.assign(c, f); toast('Cliente actualizado'); rerender(); }
      else { const n = { id: uid(), estado: 'activo', creado: Date.now(), colores: [], refs: [], ...f }; S.clients.push(n); U.clientTab = 'resumen'; U.clientTabId = n.id; toast('Cliente creado'); go('#/cliente/' + n.id); }
      save();
    }
  });
}

/* ---------- Marca del cliente ---------- */
function brandForm(id) {
  const c = getClient(id); if (!c) return;
  openModal({
    title: 'Identidad de ' + c.nombre, submitLabel: 'Guardar identidad',
    html: `<div class="fgrid">${F.img('logo', 'Logotipo', c.logoId, { alpha: true })}
      ${F.text('colores', 'Colores (códigos HEX separados por coma)', c.colores.join(', '), { w: 1, ph: '#65F4E4, #0B0C0D' })}
      <div class="w swatch-prev" data-prev></div>
      ${F.text('fuentes', 'Tipografías', c.fuentes, { w: 1, ph: 'Ej. Montserrat Bold para títulos, Open Sans para textos' })}
      ${F.area('marcaNotas', 'Personalidad de la marca', c.marcaNotas, { ph: 'Cómo se siente la marca: cercana, elegante, juvenil…' })}</div>`,
    onMount: el => {
      bindImgPreviews(el);
      const inp = $('[name=colores]', el), prev = $('[data-prev]', el);
      const draw = () => { prev.innerHTML = inp.value.split(/[\s,;]+/).filter(hexOK).map(h => `<i style="background:${esc(hexFix(h))}" title="${esc(hexFix(h))}"></i>`).join(''); };
      inp.addEventListener('input', draw); draw();
    },
    onSubmit: async (d, form) => {
      const cols = (d.colores || '').split(/[\s,;]+/).filter(Boolean), bad = cols.find(x => !hexOK(x));
      if (bad) { toast('“' + bad + '” no es un código de color válido (ejemplo: #65F4E4).', { type: 'err' }); return false; }
      c.logoId = await resolveImage(form, 'logo', c.logoId, { alpha: true, max: 900 });
      c.colores = [...new Set(cols.map(hexFix))];
      c.fuentes = d.fuentes; c.marcaNotas = d.marcaNotas;
      save(); toast('Identidad guardada'); rerender();
    }
  });
}

/* ---------- Trabajo ---------- */
function jobForm(id, preClient) {
  if (!S.clients.length) { toast('Primero crea un cliente para asignarle el trabajo.', { type: 'err' }); return clientForm(); }
  const j = id ? getJob(id) : {};
  const cli = S.clients.filter(c => c.estado !== 'archivado' || c.id === j.clienteId).map(c => [c.id, c.nombre]);
  openModal({
    title: id ? 'Editar trabajo' : 'Nuevo trabajo', submitLabel: id ? 'Guardar cambios' : 'Crear trabajo',
    html: `<div class="fgrid">${F.text('nombre', 'Nombre del trabajo', j.nombre, { req: 1, w: 1, ph: 'Ej. Flyer de apertura' })}
      ${F.sel('clienteId', 'Cliente', cli, j.clienteId || preClient || (cli.length === 1 ? cli[0][0] : ''), { req: 1, blank: 'Elige un cliente' })}
      ${F.sel('categoria', 'Categoría', nombresCat(S.settings.catTrabajo, j.categoria), j.categoria || '', { blank: 'Sin categoría' })}
      ${F.sel('estado', 'Estado', ESTADOS.map(e => e.n), j.estado || 'Solicitud recibida')}
      ${F.sel('prioridad', 'Prioridad', PRIORIDADES, j.prioridad || 'Media')}
      ${F.text('inicio', 'Inicio', j.inicio, { t: 'date' })}${F.text('entrega', 'Fecha de entrega', j.entrega, { t: 'date' })}
      ${F.num('precio', 'Precio acordado', j.precio || '', {})}${F.sel('moneda', 'Moneda', MONEDAS, j.moneda || 'USD')}
      ${tasaField(j.tasa)}
      ${F.area('brief', 'Brief (lo que pidió el cliente)', j.brief)}${F.area('notas', 'Notas', j.notas, { rows: 2 })}
      ${F.img('portada', 'Portada (opcional)', j.portadaId)}</div>`,
    onMount: el => { bindImgPreviews(el); bindMoneda(el); },
    onSubmit: async (d, form) => {
      const precio = d.precio ? parseNum(d.precio) : 0;
      if (Number.isNaN(precio)) { toast('El precio no es válido.', { type: 'err' }); return false; }
      let tasa = null;
      if (d.moneda === 'VES') { tasa = parseNum(d.tasa); if (!(tasa > 0)) { toast('Escribe la tasa de cambio (Bs por USD).', { type: 'err' }); return false; } }
      if (d.inicio && d.entrega && d.entrega < d.inicio) { toast('La entrega no puede ser antes del inicio.', { type: 'err' }); return false; }
      const f = { nombre: d.nombre, clienteId: d.clienteId, categoria: d.categoria, estado: d.estado, prioridad: d.prioridad, inicio: d.inicio, entrega: d.entrega, precio, moneda: d.moneda, tasa, brief: d.brief, notas: d.notas };
      f.portadaId = await resolveImage(form, 'portada', j.portadaId);
      if (id) { Object.assign(j, f); toast('Trabajo actualizado'); rerender(); }
      else { const n = { id: uid(), creado: Date.now(), tareas: [], ...f }; S.jobs.push(n); U.jobTab = 'cambios'; U.jobTabId = n.id; toast('Trabajo creado'); go('#/trabajo/' + n.id); }
      save();
    }
  });
}

/* ---------- Modificación (ronda de cambios) ---------- */
function revForm(id, preJob, preClient) {
  if (!S.jobs.length) { toast('Primero crea un trabajo para anotarle modificaciones.', { type: 'err' }); return S.clients.length ? jobForm() : clientForm(); }
  const r = id ? byId(S.revisions, id) : {};
  let jobs = S.jobs.slice();
  if (preClient) {
    jobs = jobs.filter(j => j.clienteId === preClient);
    if (!jobs.length) { toast('Este cliente todavía no tiene trabajos.', { type: 'err' }); return jobForm(null, preClient); }
  }
  jobs.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const sel = r.jobId || preJob || (jobs.length === 1 ? jobs[0].id : '');
  openModal({
    title: id ? 'Editar modificación' : 'Nueva modificación', submitLabel: id ? 'Guardar cambios' : 'Anotar modificación',
    extra: id ? delBtn('delRev', id) : '',
    html: `<div class="fgrid">${F.sel('jobId', 'Diseño o trabajo', jobs.map(j => [j.id, j.nombre + ' (' + clientName(j.clienteId) + ')']), sel, { req: 1, blank: 'Elige el trabajo', w: 1 })}
      ${F.area('pedido', '¿Qué pidió el cliente?', r.pedido, { req: 1, ph: 'Ej. Cambiar el fondo a azul y subir un poco el logo', rows: 3 })}
      ${F.img('imgId', 'Captura o imagen del pedido (opcional)', r.imgId)}
      ${F.sel('canal', 'Por dónde lo pidió', CANALES, r.canal || '', { blank: 'No especificado' })}${F.sel('estado', 'Estado', Object.entries(REV_ESTADOS), r.estado || 'pendiente')}
      ${F.text('fecha', 'Fecha del pedido', r.fecha || todayStr(), { t: 'date', req: 1 })}${F.text('limite', 'Fecha límite (opcional)', r.limite, { t: 'date' })}
      ${F.area('respuesta', 'Lo que cambié (opcional)', r.respuesta, { rows: 2, ph: 'Ej. Fondo azul #1E3A8A, logo 10% más grande' })}
      ${F.img('entregaImgId', 'Mi nueva versión (opcional)', r.entregaImgId)}</div>`,
    onMount: el => bindImgPreviews(el),
    onSubmit: async (d, form) => {
      const j = getJob(d.jobId); if (!j) { toast('Elige el trabajo.', { type: 'err' }); return false; }
      if (!d.pedido) { toast('Cuéntame qué pidió el cliente.', { type: 'err' }); return false; }
      if (d.limite && d.limite < d.fecha) { toast('La fecha límite no puede ser anterior al pedido.', { type: 'err' }); return false; }
      const f = { jobId: d.jobId, pedido: d.pedido, canal: d.canal, estado: d.estado, fecha: d.fecha, limite: d.limite, respuesta: d.respuesta };
      f.imgId = await resolveImage(form, 'imgId', r.imgId);
      f.entregaImgId = await resolveImage(form, 'entregaImgId', r.entregaImgId);
      if (f.estado === 'hecha') f.hechaEn = r.estado === 'hecha' && r.hechaEn ? r.hechaEn : todayStr(); else f.hechaEn = null;
      if (id) { const old = r.jobId; Object.assign(r, f); if (old !== f.jobId) revAutoEstado(old); }
      else S.revisions.push({ id: uid(), creado: Date.now(), ...f });
      revAutoEstado(f.jobId);
      save(); toast(id ? 'Modificación actualizada' : 'Modificación anotada'); rerender();
    }
  });
}
/* Mantiene el estado del trabajo coherente con sus modificaciones */
function revAutoEstado(jobId) {
  const j = getJob(jobId); if (!j) return;
  const pend = S.revisions.some(r => r.jobId === jobId && r.estado !== 'hecha');
  if (pend && ['En revisión del cliente', 'Aprobado para entrega', 'Entregado'].includes(j.estado)) { j.estado = 'Requiere modificaciones'; toast('El trabajo pasó a “Requiere modificaciones”.'); }
  else if (!pend && j.estado === 'Requiere modificaciones' && S.revisions.some(r => r.jobId === jobId)) { j.estado = 'En revisión del cliente'; toast('Sin cambios pendientes: pasó a “En revisión del cliente”.'); }
}

/* ---------- Pago ---------- */
function payForm(id, preJob, preClient) {
  if (!S.clients.length) { toast('Primero crea un cliente.', { type: 'err' }); return clientForm(); }
  const p = id ? byId(S.payments, id) : {};
  const jobs = S.jobs.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).filter(j => !preClient || j.clienteId === preClient || j.id === p.jobId);
  openModal({
    title: id ? 'Editar pago' : 'Registrar pago', submitLabel: id ? 'Guardar cambios' : 'Registrar pago',
    extra: id ? delBtn('delPay', id) : '',
    html: `<div class="fgrid">${F.sel('jobId', 'Trabajo', jobs.map(j => [j.id, j.nombre + ' (' + clientName(j.clienteId) + ')']), p.jobId || preJob || '', { blank: 'Sin trabajo (pago suelto)', w: 1 })}
      <div class="w" data-clirow>${F.sel('clienteId', 'Cliente', S.clients.map(c => [c.id, c.nombre]), p.clienteId || preClient || '', { blank: 'Elige un cliente', w: 1 })}</div>
      <p class="w hint" data-saldo hidden></p>
      ${F.text('concepto', 'Concepto', p.concepto, { req: 1, w: 1, ph: 'Anticipo, pago final…' })}
      ${F.num('monto', 'Importe', p.monto || '', { req: 1 })}${F.sel('moneda', 'Moneda', MONEDAS, p.moneda || 'USD')}${tasaField(p.tasa)}
      ${F.text('fecha', 'Fecha', p.fecha || todayStr(), { t: 'date', req: 1 })}${F.sel('metodo', 'Método de pago', METODOS, p.metodo || '', { blank: 'No especificado' })}
      ${F.sel('estado', 'Estado del pago', [['recibido', 'Recibido'], ['pendiente', 'Pendiente (aún no me pagan)']], p.estado || 'recibido', { w: 1 })}</div>`,
    onMount: el => {
      bindMoneda(el);
      const jobSel = $('[name=jobId]', el), cliRow = $('[data-clirow]', el), cliSel = $('[name=clienteId]', el), hint = $('[data-saldo]', el), conc = $('[name=concepto]', el);
      const upd = () => {
        const j = getJob(jobSel.value);
        cliRow.hidden = !!j; cliSel.required = !j;
        if (j) {
          const pend = jobPendiente(j);
          hint.hidden = pend <= 0;
          hint.innerHTML = `Saldo por cobrar de este trabajo: <b>${usd(pend)}</b> <button type="button" class="link" data-fill="${pend.toFixed(2)}">Usar este monto</button>`;
          if (!conc.value) conc.value = S.payments.some(x => x.jobId === j.id) ? 'Pago' : 'Anticipo';
        } else hint.hidden = true;
      };
      jobSel.addEventListener('change', upd); upd();
      hint.addEventListener('click', e => { const b = e.target.closest('[data-fill]'); if (!b) return; $('[name=monto]', el).value = String(b.dataset.fill).replace('.', ','); const m = $('[name=moneda]', el); m.value = 'USD'; m.dispatchEvent(new Event('change')); });
    },
    onSubmit: d => {
      const monto = parseNum(d.monto); if (!(monto > 0)) { toast('Escribe un importe mayor que cero.', { type: 'err' }); return false; }
      let tasa = null; if (d.moneda === 'VES') { tasa = parseNum(d.tasa); if (!(tasa > 0)) { toast('Escribe la tasa de cambio (Bs por USD).', { type: 'err' }); return false; } }
      const j = getJob(d.jobId), clienteId = j ? j.clienteId : d.clienteId;
      if (!clienteId) { toast('Elige el cliente.', { type: 'err' }); return false; }
      const f = { jobId: j ? j.id : null, clienteId, concepto: d.concepto, monto, moneda: d.moneda, tasa, fecha: d.fecha, metodo: d.metodo, estado: d.estado };
      if (id) Object.assign(p, f); else S.payments.push({ id: uid(), creado: Date.now(), ...f });
      save(); toast(id ? 'Pago actualizado' : 'Pago registrado'); rerender();
    }
  });
}

/* ---------- Gasto ---------- */
function expForm(id) {
  const x = id ? byId(S.expenses, id) : {};
  openModal({
    title: id ? 'Editar gasto' : 'Registrar gasto', submitLabel: id ? 'Guardar cambios' : 'Registrar gasto',
    extra: id ? delBtn('delExp', id) : '',
    html: `<div class="fgrid">${F.text('concepto', 'Concepto', x.concepto, { req: 1, w: 1, ph: 'Suscripción de Adobe, fuentes, publicidad…' })}
      ${F.sel('categoria', 'Categoría', nombresCat(S.settings.catGasto, x.categoria), x.categoria || '', { blank: 'Sin categoría', w: 1 })}
      ${F.num('monto', 'Importe', x.monto || '', { req: 1 })}${F.sel('moneda', 'Moneda', MONEDAS, x.moneda || 'USD')}${tasaField(x.tasa)}
      ${F.text('fecha', 'Fecha', x.fecha || todayStr(), { t: 'date', req: 1, w: 1 })}</div>`,
    onMount: el => bindMoneda(el),
    onSubmit: d => {
      const monto = parseNum(d.monto); if (!(monto > 0)) { toast('Escribe un importe mayor que cero.', { type: 'err' }); return false; }
      let tasa = null; if (d.moneda === 'VES') { tasa = parseNum(d.tasa); if (!(tasa > 0)) { toast('Escribe la tasa de cambio (Bs por USD).', { type: 'err' }); return false; } }
      const f = { concepto: d.concepto, categoria: d.categoria, monto, moneda: d.moneda, tasa, fecha: d.fecha };
      if (id) Object.assign(x, f); else S.expenses.push({ id: uid(), creado: Date.now(), ...f });
      save(); toast(id ? 'Gasto actualizado' : 'Gasto registrado'); rerender();
    }
  });
}

/* ---------- Evento de calendario ---------- */
function eventForm(id, fecha) {
  const e = id ? byId(S.events, id) : {};
  openModal({
    title: id ? 'Editar evento' : 'Nuevo evento', submitLabel: id ? 'Guardar cambios' : 'Crear evento',
    extra: id ? delBtn('delEvent', id) : '',
    html: `<div class="fgrid">${F.text('titulo', 'Título', e.titulo, { req: 1, w: 1, ph: 'Reunión con el cliente, entregar archivos…' })}
      ${F.text('fecha', 'Fecha', e.fecha || fecha || todayStr(), { t: 'date', req: 1 })}${F.text('hora', 'Hora (opcional)', e.hora, { t: 'time' })}
      ${F.sel('tipo', 'Tipo', TIPOS_EVENTO, e.tipo || 'reunion')}${F.sel('clienteId', 'Cliente (opcional)', S.clients.map(c => [c.id, c.nombre]), e.clienteId || '', { blank: 'Ninguno' })}
      ${F.area('notas', 'Notas', e.notas, { rows: 2 })}</div>`,
    onSubmit: d => {
      const f = { titulo: d.titulo, fecha: d.fecha, hora: d.hora, tipo: d.tipo, clienteId: d.clienteId || null, notas: d.notas };
      if (id) Object.assign(e, f); else S.events.push({ id: uid(), creado: Date.now(), ...f });
      if (d.fecha) U.calSel = d.fecha;
      save(); toast(id ? 'Evento actualizado' : 'Evento creado'); rerender();
    }
  });
}

/* ---------- Tasa de cambio ---------- */
function tasaForm() {
  openModal({
    title: 'Tasa de cambio', small: true, submitLabel: 'Guardar tasa',
    html: `<p class="m-text">Escribe cuántos bolívares equivalen a 1 dólar hoy. La app no la inventa ni la busca sola: tú decides qué tasa usar.</p><div class="fgrid">${F.num('tasa', 'Bs por 1 USD', S.settings.tasa || '', { req: 1, w: 1 })}</div>`,
    onSubmit: d => {
      const t = parseNum(d.tasa); if (!(t > 0)) { toast('Escribe una tasa mayor que cero.', { type: 'err' }); return false; }
      S.settings.tasa = t; S.settings.tasaFecha = todayStr(); save(); toast('Tasa guardada'); rerender();
    }
  });
}
