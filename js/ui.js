/* ENMA Studio Manager — piezas de interfaz: ventanas, avisos, formularios y animaciones. */
'use strict';

/* ---------- Avisos ---------- */
function toast(msg, o = {}) {
  const root = $('#toast-root'); if (!root) return;
  while (root.children.length >= 3) root.firstChild.remove();
  const el = document.createElement('div');
  el.className = 'toast ' + (o.type === 'err' ? 'err' : 'ok');
  el.setAttribute('role', o.type === 'err' ? 'alert' : 'status');
  el.innerHTML = `<span class="toast-ic">${ic(o.type === 'err' ? 'alert' : 'check')}</span><span>${esc(msg)}</span>`;
  root.appendChild(el);
  const kill = () => { el.classList.add('out'); setTimeout(() => el.remove(), 220); };
  setTimeout(kill, o.type === 'err' ? 6000 : 3200);
  el.addEventListener('click', kill);
}

/* ---------- Ventanas (en el celular suben desde abajo) ---------- */
const MODALS = [];
function openModal(o) {
  const root = $('#modal-root');
  const el = document.createElement('div');
  el.className = 'overlay';
  const prevFocus = document.activeElement;
  el.innerHTML = `
    <div class="modal ${o.small ? 'small' : ''} ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}">
      <div class="m-grab" aria-hidden="true"></div>
      <header class="m-head"><h2>${esc(o.title)}</h2><button type="button" class="iconbtn" data-act="closeModal" aria-label="Cerrar">${ic('x')}</button></header>
      <form class="m-form" novalidate>
        <div class="m-body">${o.html || ''}</div>
        <footer class="m-foot">
          ${o.extra ? `<span class="m-extra">${o.extra}</span>` : ''}
          <button type="button" class="btn ghost" data-act="closeModal">${esc(o.cancelLabel || 'Cancelar')}</button>
          ${o.noSubmit ? '' : `<button type="submit" class="btn ${o.danger ? 'danger' : 'primary'}">${esc(o.submitLabel || 'Guardar')}</button>`}
        </footer>
      </form>
    </div>`;
  const ctl = { el, o, prevFocus, closed: false };
  MODALS.push(ctl);
  root.appendChild(el);
  document.body.classList.add('lock');
  requestAnimationFrame(() => el.classList.add('in'));
  const form = $('form', el);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const btn = $('button[type=submit]', form);
    if (btn) btn.disabled = true;
    try {
      const r = o.onSubmit ? await o.onSubmit(readForm(form), form) : true;
      if (r === false) { if (btn) btn.disabled = false; return; }
      o._submitted = true;
      closeModal(ctl);
    } catch (e) {
      console.error(e);
      toast(e && e.message ? e.message : 'No se pudo guardar.', { type: 'err' });
      if (btn) btn.disabled = false;
    }
  });
  if (o.onMount) o.onMount(el, form);
  hydrate(el);
  setTimeout(() => { const f = $('input:not([type=hidden]):not([type=file]), textarea, select', form); if (f && !o.noFocus && matchMedia('(min-width: 900px)').matches) f.focus(); }, 60);
  return ctl;
}
function closeModal(ctl) {
  ctl = ctl || MODALS[MODALS.length - 1];
  if (!ctl || ctl.closed) return;
  ctl.closed = true;
  const i = MODALS.indexOf(ctl); if (i >= 0) MODALS.splice(i, 1);
  ctl.el.classList.remove('in'); ctl.el.classList.add('out');
  setTimeout(() => {
    ctl.el.remove();
    if (!MODALS.length) document.body.classList.remove('lock');
    if (ctl.prevFocus && ctl.prevFocus.focus && document.contains(ctl.prevFocus)) { try { ctl.prevFocus.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
    if (ctl.o.onClose) ctl.o.onClose(!!ctl.o._submitted);
  }, REDUCED ? 0 : 200);
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && MODALS.length) { e.preventDefault(); closeModal(); }
  if (e.key === 'Tab' && MODALS.length) {
    const top = MODALS[MODALS.length - 1].el;
    const f = $$('button:not([disabled]), input:not([type=hidden]):not([disabled]), select, textarea, a[href]', top).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
function confirmBox({ title, text, ok = 'Eliminar', danger = true }) {
  return new Promise(res => openModal({
    title, small: true, danger, submitLabel: ok, noFocus: true,
    html: `<p class="m-text">${text}</p>`,
    onSubmit: () => { res(true); },
    onClose: submitted => { if (!submitted) res(false); }
  }));
}

/* ---------- Visor de imágenes ---------- */
async function openLightbox(imgId, onDelete) {
  const u = await imgURL(imgId); if (!u) return toast('No se encontró la imagen.', { type: 'err' });
  const el = document.createElement('div');
  el.className = 'overlay lightbox';
  el.innerHTML = `<div class="lb-bar">
      <a class="btn ghost-w" href="${u}" download="enma-imagen.webp">${ic('download')} Descargar</a>
      ${onDelete ? `<button class="btn ghost-w" data-lb="del">${ic('trash')} Quitar</button>` : ''}
      <button class="iconbtn w" data-lb="x" aria-label="Cerrar">${ic('x')}</button></div>
    <img src="${u}" alt="Imagen ampliada">`;
  const ctl = { el, o: {}, closed: false, prevFocus: document.activeElement };
  MODALS.push(ctl);
  $('#modal-root').appendChild(el);
  document.body.classList.add('lock');
  requestAnimationFrame(() => el.classList.add('in'));
  el.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-lb]');
    if (b && b.dataset.lb === 'del') { closeModal(ctl); if (await confirmBox({ title: '¿Quitar esta imagen?', text: 'Se eliminará de este dispositivo.', ok: 'Quitar' })) onDelete(); return; }
    if (!b || b.dataset.lb === 'x' || ev.target === el || ev.target.tagName === 'IMG') closeModal(ctl);
  });
}

/* ---------- Formularios ---------- */
const F = {
  text: (k, l, v = '', o = {}) => `<label class="fld ${o.w ? 'w' : ''}"><span>${l}</span><input name="${k}" type="${o.t || 'text'}" value="${esc(v)}" ${o.req ? 'required' : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} ${o.inputmode ? `inputmode="${o.inputmode}"` : ''} ${o.attr || ''} autocomplete="off"></label>`,
  num: (k, l, v = '', o = {}) => F.text(k, l, v === '' || v == null ? '' : String(v).replace('.', ','), { ...o, inputmode: 'decimal', ph: o.ph || '0,00' }),
  area: (k, l, v = '', o = {}) => `<label class="fld ${o.w !== false ? 'w' : ''}"><span>${l}</span><textarea name="${k}" rows="${o.rows || 3}" ${o.req ? 'required' : ''} ${o.ph ? `placeholder="${esc(o.ph)}"` : ''}>${esc(v)}</textarea></label>`,
  sel: (k, l, opts, v = '', o = {}) => `<label class="fld ${o.w ? 'w' : ''}"><span>${l}</span><select name="${k}" ${o.req ? 'required' : ''} ${o.attr || ''}>${o.blank != null ? `<option value="">${esc(o.blank)}</option>` : ''}${opts.map(x => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select></label>`,
  img: (k, l, id, o = {}) => `<div class="fld w imgfld" data-imgfld="${k}" data-alpha="${o.alpha ? 1 : 0}">
      <span>${l}</span>
      <div class="imgpick">
        <div class="imgprev ${id ? '' : 'empty'}">${id ? `<img data-img="${id}" alt="">` : ic('image')}</div>
        <div class="imgbtns">
          <label class="btn ghost sm">${ic('upload')} <span>${id ? 'Cambiar' : 'Elegir imagen'}</span><input type="file" name="${k}" accept="image/*" hidden></label>
          ${id ? `<label class="chk sm"><input type="checkbox" name="${k}__quitar"> Quitar</label>` : ''}
        </div>
      </div>
    </div>`
};
function readForm(form) {
  const o = {};
  new FormData(form).forEach((v, k) => { if (!(v instanceof File)) o[k] = typeof v === 'string' ? v.trim() : v; });
  return o;
}
/* Imágenes de un formulario: guarda la nueva, o borra la anterior si se marcó "Quitar". Devuelve el id final. */
async function resolveImage(form, key, currentId, opts) {
  const input = form.elements[key];
  const file = input && input.files && input.files[0];
  const quitar = form.elements[key + '__quitar'] && form.elements[key + '__quitar'].checked;
  if (file) { const id = await saveImage(file, opts); if (currentId) dropImages([currentId]); return id; }
  if (quitar && currentId) { dropImages([currentId]); return null; }
  return currentId || null;
}
function bindImgPreviews(root) {
  $$('.imgfld', root).forEach(f => {
    const inp = $('input[type=file]', f);
    inp.addEventListener('change', () => {
      const file = inp.files[0]; if (!file) return;
      const prev = $('.imgprev', f); prev.classList.remove('empty');
      prev.innerHTML = '<img alt="" class="loaded">';
      $('img', prev).src = URL.createObjectURL(file);
      const q = $('input[type=checkbox]', f); if (q) q.checked = false;
      $('.btn span', f).textContent = file.name.length > 22 ? file.name.slice(0, 20) + '…' : file.name;
    });
  });
}
/* Muestra el campo "tasa" solo cuando la moneda es VES */
function bindMoneda(root) {
  const sel = $('select[name=moneda]', root), tasa = $('[data-tasa]', root);
  if (!sel || !tasa) return;
  const upd = () => { const v = sel.value === 'VES'; tasa.hidden = !v; const i = $('input', tasa); if (i) i.required = v; };
  sel.addEventListener('change', upd); upd();
}

/* ---------- Movimiento ---------- */
function countUp(root, instant) {
  $$('[data-count]', root).forEach(el => {
    const end = parseFloat(el.dataset.count) || 0, fmt = el.dataset.fmt;
    const show = v => { el.textContent = fmt === 'usd' ? usd(v) : String(Math.round(v)); };
    if (REDUCED || instant || end === 0) return show(end);
    const t0 = performance.now(), dur = 750;
    const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); show(end * e); if (p < 1) requestAnimationFrame(step); else show(end); };
    requestAnimationFrame(step);
  });
}
function confetti(x, y) {
  if (REDUCED) return;
  const cols = ['#65F4E4', '#0b0c0d', '#bff9f3', '#8b9293', '#ffffff'];
  for (let i = 0; i < 22; i++) {
    const s = document.createElement('i');
    s.className = 'conf';
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 110;
    s.style.cssText = `left:${x}px;top:${y}px;background:${cols[i % cols.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 50}px;--r:${Math.random() * 540 - 270}deg;`;
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 1000);
  }
}
