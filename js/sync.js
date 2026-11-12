/* ENMA Studio Manager — sincronización en la nube.
   La app siempre guarda primero en tu dispositivo (funciona sin internet). Este módulo compara cada registro con lo
   último que se sincronizó y sube solo lo que cambió. Si dos dispositivos editan lo mismo, gana el cambio más reciente.
   Los borrados viajan como "lápidas" para que desaparezcan también en tus otros dispositivos.
   La persistencia remota vive en Vercel Blob: este módulo habla con js/cloud-vercel.js. */
'use strict';

window.Sync = (() => {
  const COLS = ['clients', 'jobs', 'revisions', 'payments', 'expenses', 'events'];
  const SKEYS = ['nombre', 'tasa', 'tasaFecha', 'catTrabajo', 'catGasto'];   // lo demás de Ajustes es de cada dispositivo (tema, último respaldo)
  const IMG_FIELDS = { clients: r => [r.logoId, ...(r.refs || [])], jobs: r => [r.portadaId], revisions: r => [r.imgId, r.entregaImgId] };
  const imgIdsOf = (col, r) => (IMG_FIELDS[col] ? IMG_FIELDS[col](r) : []).filter(Boolean);
  const cloud = () => window.CloudVercel;
  const fresh = () => ({ v: 1, uid: null, cursor: null, rec: {}, imgs: {}, imgDel: [] });

  let meta = null, user = null, unsub = null, busy = false, again = false, tPush = null, tMeta = null;
  let tRetry = null, autoTimer = null, retryAttempt = 0, writeBlocked = false;
  let repush = false, massUntil = 0, prefetching = false, adapterReady = false, adapterTrying = false, guardCount = 0, listenDead = false, hiddenAt = 0, chain = Promise.resolve();
  const st = { state: 'off', msg: '', last: null, pending: 0, email: '' };
  const subs = new Set();
  const inflight = new Map();

  /* ---------- utilidades ---------- */
  function hash(s) { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + '.' + s.length.toString(36); }
  const withTimeout = (p, ms) => new Promise((res, rej) => { const t = setTimeout(() => { const e = new Error('timeout'); e.code = 'timeout'; rej(e); }, ms); p.then(v => { clearTimeout(t); res(v); }, e => { clearTimeout(t); rej(e); }); });
  const countDirty = () => meta ? Object.values(meta.rec).filter(m => m.dirty).length : 0;
  function setStatus(state, msg) {
    st.state = state; if (msg !== undefined) st.msg = msg;
    st.pending = countDirty(); st.email = user ? user.email : '';
    subs.forEach(f => { try { f(st); } catch (e) { console.error(e); } });
  }
  function persistMeta(now) {
    clearTimeout(tMeta);
    const w = () => { if (meta && DB.ok) DB.put('kv', 'sync', JSON.parse(JSON.stringify(meta))).catch(() => {}); };
    if (now) w(); else tMeta = setTimeout(w, 250);
  }
  const settingsSubset = () => { const o = {}; SKEYS.forEach(k => { o[k] = S.settings[k]; }); return o; };
  const isDefaultSettings = () => { const d = DEFAULT_STATE().settings, o = {}; SKEYS.forEach(k => { o[k] = d[k]; }); return JSON.stringify(o) === JSON.stringify(settingsSubset()); };
  function current() {
    const m = new Map();
    COLS.forEach(c => S[c].forEach(r => { if (r && r.id) m.set(c + '/' + r.id, r); }));
    m.set('settings/main', settingsSubset());
    return m;
  }
  const splitKey = key => { const i = key.indexOf('/'); return [key.slice(0, i), key.slice(i + 1)]; };

  /* ---------- detectar cambios locales ---------- */
  /* Devuelve cuántos registros cambiaron, o -1 si desaparecieron tantos que es sospechoso (protege la nube). */
  function scan() {
    if (!meta) return 0;
    const now = Date.now(), cur = current();
    const tombs = [];
    for (const key of Object.keys(meta.rec)) { if (!meta.rec[key].del && !cur.has(key)) tombs.push(key); }
    const live = Object.values(meta.rec).filter(m => !m.del).length;
    if (Date.now() > massUntil && tombs.length >= 8 && tombs.length >= live * 0.6) { guardCount = tombs.length; return -1; }
    let n = 0;
    for (const [key, rec] of cur) {
      const h = hash(JSON.stringify(rec)), m = meta.rec[key];
      if (!m) {
        if (key === 'settings/main' && isDefaultSettings()) { meta.rec[key] = { h, u: 0 }; continue; }   // ajustes sin tocar: no pisan los de otro dispositivo
        meta.rec[key] = { h, u: now, dirty: true }; n++;
      } else if (m.del || m.h !== h) { meta.rec[key] = { h, u: Math.max(now, (m.u || 0) + 1), dirty: true }; n++; }
    }
    for (const key of tombs) { const m = meta.rec[key]; meta.rec[key] = { h: '', u: Math.max(now, (m.u || 0) + 1), del: true, dirty: true }; n++; }
    guardCount = 0;
    return n;
  }

  /* ---------- aplicar cambios que vienen de la nube ---------- */
  function fixRecord(col, r) {
    if (col === 'jobs' && !Array.isArray(r.tareas)) r.tareas = [];
    if (col === 'clients') { if (!Array.isArray(r.colores)) r.colores = []; if (!Array.isArray(r.refs)) r.refs = []; }
    return r;
  }
  function applyRemote(list) {
    let changed = false;
    for (const d of list) {
      const m = meta.rec[d.key];
      if (m && m.u >= d.u) {                               // lo que tengo es igual o más nuevo
        if (m.u > d.u && !m.dirty) { m.dirty = true; repush = true; }   // la nube quedó con una versión vieja (otro dispositivo subió tarde): se vuelve a subir la mía
        continue;
      }
      const [col, id] = splitKey(d.key);
      if (col === 'settings') {
        if (d.del) continue;
        let o; try { o = JSON.parse(d.data); } catch (e) { continue; }
        SKEYS.forEach(k => { if (k in o) S.settings[k] = o[k]; });
        meta.rec[d.key] = { h: hash(JSON.stringify(settingsSubset())), u: d.u }; changed = true; continue;
      }
      if (!COLS.includes(col)) continue;
      const arr = S[col], idx = arr.findIndex(x => x.id === id);
      if (d.del) {
        if (idx >= 0) { const old = arr[idx]; arr.splice(idx, 1); dropImages(imgIdsOf(col, old), true); }
        meta.rec[d.key] = { h: '', u: d.u, del: true }; changed = true; continue;
      }
      let rec; try { rec = JSON.parse(d.data); } catch (e) { continue; }
      if (!rec || rec.id !== id) continue;
      let live;
      if (idx >= 0) {            // se edita el mismo objeto para que cualquier formulario abierto no quede desconectado
        live = arr[idx]; const before = imgIdsOf(col, live);
        Object.keys(live).forEach(k => delete live[k]); Object.assign(live, rec); fixRecord(col, live);
        const after = imgIdsOf(col, live); dropImages(before.filter(x => !after.includes(x)), true);
      } else { live = fixRecord(col, rec); arr.push(live); }
      meta.rec[d.key] = { h: hash(JSON.stringify(live)), u: d.u }; changed = true;
    }
    return changed;
  }

  /* ---------- subir ---------- */
  async function pushDirty() {
    const cur = current(), items = [];
    for (const [key, m] of Object.entries(meta.rec)) {
      if (!m.dirty) continue;
      const [col, id] = splitKey(key);
      if (!m.del && !cur.has(key)) continue;
      items.push({ key, col, id, u: m.u, del: !!m.del, data: m.del ? '' : JSON.stringify(cur.get(key)) });
    }
    for (let i = 0; i < items.length; i += 30) {
      const chunk = items.slice(i, i + 30);
      await withTimeout(cloud().putRecords(chunk), 30000);
      chunk.forEach(it => { const m = meta.rec[it.key]; if (m && m.u === it.u) delete m.dirty; });   // si cambió mientras subía, sigue pendiente
      persistMeta();
    }
  }
  /* Las imágenes se guardan como archivos privados en Vercel Blob, no dentro de documentos JSON. */
  const CLOUD_IMG_MAX = 2500 * 1024;
  async function shrinkBlob(blob) {
    try {
      const bmp = await createImageBitmap(blob), toBlob = (c, t, q) => new Promise(r => c.toBlob(r, t, q));
      for (const k of [0.8, 0.6, 0.45, 0.32]) {
        const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
        c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
        const b = await toBlob(c, 'image/webp', 0.8);
        if (b && b.size <= CLOUD_IMG_MAX) return b;
      }
    } catch (e) { /* sin cambios */ }
    return null;
  }
  async function pushImages() {
    const ids = await DB.keys('img');
    for (const id of ids) {
      if (meta.imgs[id]) continue;
      let b = await DB.get('img', id); if (!b) continue;
      if (b.size > CLOUD_IMG_MAX) {
        const small = await shrinkBlob(b);
        if (!small) { meta.imgs[id] = 2; persistMeta(); continue; }   // demasiado pesada: se queda solo en este dispositivo
        b = small; await DB.put('img', id, b);
      }
      await withTimeout(cloud().putImage(id, b), 60000);
      meta.imgs[id] = 1; persistMeta();
    }
    for (const id of meta.imgDel.slice()) {
      await withTimeout(cloud().delImage(id), 30000);
      meta.imgDel = meta.imgDel.filter(x => x !== id); delete meta.imgs[id]; persistMeta();
    }
  }
  function friendlyErr(e) { return cloud() && cloud().friendly ? cloud().friendly(e) : { offline: false, msg: String((e && e.message) || e) }; }
  function scheduleRetry() {
    if (!user || tRetry) return; // los errores de lectura no deben aplazar una subida ya programada
    const delay = Math.min(60000, 10000 * Math.pow(2, Math.min(retryAttempt, 3)));
    retryAttempt++;
    tRetry = setTimeout(() => {
      tRetry = null;
      if (user && navigator.onLine) {
        restartListen();
        syncNow(false);
      }
    }, delay);
  }
  function clearRetry() {
    clearTimeout(tRetry);
    tRetry = null;
    retryAttempt = 0;
  }
  function startAutoSync() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (user && navigator.onLine && document.visibilityState !== 'hidden') syncNow(false);
    }, 20000);
  }
  function handleErr(e, isWriteFailure = false) {
    console.warn('Sync:', e);
    if (isWriteFailure) writeBlocked = true;
    const f = friendlyErr(e);
    listenDead = true;
    setStatus(f.offline ? 'offline' : 'error', f.msg);
    if (!f.offline && !f.fatal) scheduleRetry();
  }
  async function performSync(manual) {
    if (busy) { again = true; return; }
    if (!navigator.onLine) { setStatus('offline', 'Sin conexión. Se subirá cuando vuelvas a tener internet.'); return; }
    busy = true;
    try {
      const n = scan();
      if (n < 0) { setStatus('guard', ''); return; }
      if (n > 0 || countDirty() > 0 || manual) setStatus('syncing', '');
      await pushImages();      // primero las imágenes, para que otro dispositivo las encuentre cuando llegue el registro
      await pushDirty();
      persistMeta();
      clearRetry();
      writeBlocked = false;
      st.last = Date.now(); setStatus('ok', '');
      if (manual || listenDead) restartListen();
    } catch (e) { handleErr(e, true); }
    finally { busy = false; if (again) { again = false; schedule(900); } }
  }

  /*
   * Web Locks coordina Safari y la app instalada cuando ambos contextos del
   * mismo origen están abiertos. El bloqueo dura toda la sincronización, no
   * solo el POST, para evitar que dos copias del iPhone compitan por el mismo
   * índice de Blob. Si el navegador no ofrece Web Locks, se conserva el
   * bloqueo local `busy` como alternativa.
   */
  async function syncNow(manual) {
    if (!user || !meta || !cloud()) return;
    if (busy) { again = true; return; }
    if (!navigator.onLine) { setStatus('offline', 'Sin conexión. Se subirá cuando vuelvas a tener internet.'); return; }
    if (!navigator.locks || typeof navigator.locks.request !== 'function') {
      return performSync(manual);
    }
    let acquired = false;
    try {
      await navigator.locks.request('enma-studio-cloud-sync', { mode: 'exclusive', ifAvailable: true }, async lock => {
        if (!lock) return;
        acquired = true;
        await performSync(manual);
      });
      if (!acquired && user && navigator.onLine) schedule(1600);
    } catch (error) {
      console.warn('ENMA Web Lock no disponible; se usa bloqueo local:', error);
      await performSync(manual);
    }
  }
  const schedule = ms => { clearTimeout(tPush); tPush = setTimeout(() => syncNow(false), ms); };

  /* ---------- consultar periódicamente los cambios de Vercel ---------- */
  async function onDocs(list, max, fromCache) {
    try {
      const n = scan();                                  // primero lo local, para no pisar ediciones sin sincronizar
      if (n < 0) { setStatus('guard', ''); return; }
      const changed = applyRemote(list);
      if (max) meta.cursor = max;
      persistMeta();
      if (changed) { await flush(); if (api.onRemote) api.onRemote(); prefetchImages(); }
      if (n > 0 || repush) { repush = false; schedule(200); }
      if (!fromCache) {
        st.last = Date.now();
        // Una lectura correcta no debe ocultar una escritura que sigue pendiente.
        if (!writeBlocked && st.state !== 'syncing' && st.state !== 'guard') setStatus('ok', '');
      }
    } catch (e) { console.error(e); setStatus('error', 'No se pudo aplicar un cambio que llegó de la nube.'); }
  }
  function startListen() {
    stopListen();
    listenDead = false;
    try { unsub = cloud().listen(meta.cursor, (l, m, c) => { chain = chain.then(() => onDocs(l, m, c)); }, e => handleErr(e)); }
    catch (e) { handleErr(e); }
  }
  function stopListen() { if (unsub) { try { unsub(); } catch (e) { /* nada */ } unsub = null; } }
  const restartListen = () => { if (user) startListen(); };

  function start(u) {
    if (!meta) meta = fresh();
    if (meta.uid && meta.uid !== u.uid) meta = fresh();   // otra cuenta: se vuelve a empezar
    meta.uid = u.uid; user = u;
    setStatus('connecting', '');
    startListen();
    startAutoSync();
    schedule(300);
  }
  function stop() {
    stopListen(); user = null;
    clearTimeout(tPush); clearTimeout(tRetry); clearInterval(autoTimer);
    tPush = null; tRetry = null; autoTimer = null; retryAttempt = 0; writeBlocked = false;
    setStatus(cloud() && cloud().isConfigured() ? 'signedout' : 'off', '');
  }

  /* ---------- imágenes de la nube ---------- */
  function fetchImage(id) {
    if (!user || !cloud() || !navigator.onLine || !id) return Promise.resolve(false);
    if (inflight.has(id)) return inflight.get(id);
    const p = (async () => {
      try {
        const b = await withTimeout(cloud().getImage(id), 30000);
        if (!b) return false;
        await DB.put('img', id, b);
        if (meta) { meta.imgs[id] = 1; persistMeta(); }
        return true;
      } catch (e) { return false; } finally { inflight.delete(id); }
    })();
    inflight.set(id, p); return p;
  }
  async function prefetchImages() {
    if (prefetching || !user) return;
    prefetching = true;
    try {
      const need = new Set(); COLS.forEach(c => S[c].forEach(r => imgIdsOf(c, r).forEach(id => need.add(id))));
      const have = new Set(await DB.keys('img')); let got = 0;
      for (const id of need) { if (have.has(id)) continue; if (await fetchImage(id)) got++; }
      if (got) { hydrate($('#main')); hydrate($('#modal-root')); }
    } catch (e) { /* ignorar */ } finally { prefetching = false; }
  }

  /* ---------- conexión inicial ---------- */
  async function initAdapter() {
    if (adapterReady || adapterTrying) return;
    adapterTrying = true;
    try { await cloud().init(u => { if (u) start(u); else stop(); }); adapterReady = true; }
    catch (e) { handleErr(e); }
    finally { adapterTrying = false; }
  }
  async function init() {
    if (!cloud() || !cloud().isConfigured() || !DB.ok || !stateLoaded) { setStatus('off', ''); return; }
    try { meta = (await DB.get('kv', 'sync')) || fresh(); } catch (e) { meta = fresh(); }
    if (!Array.isArray(meta.imgDel)) meta.imgDel = [];
    setStatus('signedout', '');
    scan(); persistMeta();
    await initAdapter();
    window.addEventListener('online', () => { if (user) { restartListen(); schedule(400); } else initAdapter(); });
    window.addEventListener('offline', () => { if (user) setStatus('offline', 'Sin conexión. Tus cambios se guardan aquí y se subirán después.'); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
        persistMeta(true);
        // Intenta vaciar los cambios pendientes antes de que el móvil suspenda la pestaña.
        if (user && navigator.onLine) syncNow(false);
        return;
      }
      if (!user) return;
      if (hiddenAt && Date.now() - hiddenAt > 30000) restartListen();   // el sistema pudo cortar la conexión mientras estaba en segundo plano
      schedule(300);
    });
    window.addEventListener('pagehide', () => {
      persistMeta(true);
      if (user && navigator.onLine) syncNow(false);
    });
  }

  /* ---------- API pública ---------- */
  const api = {
    init, onRemote: null,
    status: () => st,
    user: () => user,
    configured: () => !!(cloud() && cloud().isConfigured()),
    onStatus: f => { subs.add(f); return () => subs.delete(f); },
    guardCount: () => guardCount,
    /* se llama cada vez que la app guarda algo */
    touch() {
      if (!meta) return;
      const n = scan();
      if (n < 0) { setStatus('guard', ''); return; }
      if (n > 0) { persistMeta(); setStatus(st.state === 'off' ? 'off' : st.state); if (user) schedule(1200); }
    },
    async signIn(email, pw) {
      if (!meta) throw new Error('Este navegador no permite guardar datos aquí, así que la nube no se puede activar.');
      await initAdapter(); if (!adapterReady) throw new Error('No se pudo cargar la conexión con Vercel. Revisa tu conexión a internet y la configuración del proyecto.');
      await cloud().signIn(email, pw);
    },
    async signOut() { if (cloud()) await cloud().signOut(); },
    syncNow: manual => syncNow(manual),
    fetchImage,
    noteImageDeleted(id) { if (meta && id && !meta.imgDel.includes(id)) { meta.imgDel.push(id); persistMeta(); if (user) schedule(1500); } },
    allowMassDelete(ms) { massUntil = Date.now() + (ms || 20000); },
    beforeWipe() { massUntil = Date.now() + 20000; if (meta) { Object.keys(meta.imgs).forEach(id => { if (!meta.imgDel.includes(id)) meta.imgDel.push(id); }); } },
    /* "Recuperar desde la nube": olvida los borrados sospechosos y vuelve a traer todo */
    recover() {
      if (!meta) return;
      const cur = current();
      for (const key of Object.keys(meta.rec)) { if (!cur.has(key) && !meta.rec[key].del) delete meta.rec[key]; }
      meta.cursor = null; persistMeta(); setStatus('connecting', ''); restartListen();
    },
    /* "Sí, fue a propósito": se borran también en la nube */
    confirmDeletes() { massUntil = Date.now() + 30000; schedule(100); }
  };
  return api;
})();

