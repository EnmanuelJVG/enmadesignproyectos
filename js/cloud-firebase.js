/* ENMA Studio Manager — conexión con Firebase (Authentication + Firestore).
   Se carga el SDK solo si configuraste js/firebase-config.js; si no, la app funciona igual, solo en el dispositivo.
   Estructura en Firestore:   users/{tu id}/records/{colección__id}   → un documento por cliente, trabajo, pago, etc.
                              users/{tu id}/images/{id}              → cada imagen (en base64, máximo ~700 KB) */
'use strict';

window.CloudFirebase = (() => {
  const VER = '10.12.2';
  const BASE = 'https://www.gstatic.com/firebasejs/' + VER + '/';
  let fb = null, auth = null, db = null, uid = null, started = false;

  const cfg = () => window.ENMA_FIREBASE || {};
  const isConfigured = () => { const c = cfg(); return !!(c.apiKey && c.projectId && c.appId); };

  async function load() {
    if (fb) return fb;
    const [A, Au, Fs] = await Promise.all([import(BASE + 'firebase-app.js'), import(BASE + 'firebase-auth.js'), import(BASE + 'firebase-firestore.js')]);
    fb = { A, Au, Fs };
    return fb;
  }

  async function init(onUser) {
    const { A, Au, Fs } = await load();
    if (!started) {
      const app = A.getApps().length ? A.getApp() : A.initializeApp(cfg());
      auth = Au.getAuth(app);
      try { db = Fs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true }); }   // más estable en redes y navegadores del celular
      catch (e) { db = Fs.getFirestore(app); }
      started = true;
    }
    Au.onAuthStateChanged(auth, u => { uid = u ? u.uid : null; onUser(u ? { uid: u.uid, email: u.email || '' } : null); }, err => console.warn('Auth:', err));
  }

  const signIn = (email, pw) => fb.Au.signInWithEmailAndPassword(auth, email, pw);
  const signOut = () => fb.Au.signOut(auth);
  const docId = key => key.replace('/', '__');
  const recs = () => fb.Fs.collection(db, 'users', uid, 'records');

  /* Escucha los cambios nuevos (desde el cursor). Entrega la lista de documentos y el cursor más reciente. */
  function listen(cursor, onDocs, onErr) {
    const { Fs } = fb;
    const parts = [];
    if (cursor) parts.push(Fs.where('ts', '>=', new Fs.Timestamp(Math.max(0, cursor[0] - 1), cursor[1])));   // 1 s de margen; lo repetido se ignora
    parts.push(Fs.orderBy('ts'));
    return Fs.onSnapshot(Fs.query(recs(), ...parts), snap => {
      const list = []; let max = null;
      snap.docChanges().forEach(ch => {
        if (ch.type === 'removed') return;
        if (ch.doc.metadata.hasPendingWrites) return;          // son cambios propios que aún no confirma el servidor
        const x = ch.doc.data();
        if (!x || !x.key) return;
        list.push({ key: x.key, u: x.u || 0, del: !!x.del, data: x.data || '' });
        const t = x.ts;
        if (t && typeof t.seconds === 'number' && (!max || t.seconds > max[0] || (t.seconds === max[0] && t.nanoseconds > max[1]))) max = [t.seconds, t.nanoseconds];
      });
      onDocs(list, max, !!snap.metadata.fromCache);
    }, onErr);
  }

  async function putRecords(items) {
    const { Fs } = fb;
    for (let i = 0; i < items.length; i += 400) {
      const b = Fs.writeBatch(db);
      items.slice(i, i + 400).forEach(it => b.set(Fs.doc(db, 'users', uid, 'records', docId(it.key)),
        { key: it.key, col: it.col, id: it.id, u: it.u, del: it.del, data: it.data, ts: Fs.serverTimestamp() }));
      await b.commit();
    }
  }

  const blobToB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] || '');
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
  async function putImage(id, blob) {
    const { Fs } = fb;
    await Fs.setDoc(Fs.doc(db, 'users', uid, 'images', id), { type: blob.type || 'image/webp', size: blob.size, b64: await blobToB64(blob), ts: Fs.serverTimestamp() });
  }
  async function getImage(id) {
    const { Fs } = fb;
    const d = await Fs.getDoc(Fs.doc(db, 'users', uid, 'images', id));
    if (!d.exists()) return null;
    const x = d.data(), bin = atob(x.b64 || ''), arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: x.type || 'image/webp' });
  }
  async function delImage(id) { const { Fs } = fb; await Fs.deleteDoc(Fs.doc(db, 'users', uid, 'images', id)); }

  /* Traduce los errores de Firebase a mensajes que se entienden. offline: reintentar al volver internet. fatal: no tiene sentido reintentar solo. */
  function friendly(e) {
    const c = String((e && e.code) || '').replace(/^(auth|firestore)\//, ''), m = String((e && e.message) || e || '');
    if (c === 'timeout' || c === 'unavailable' || c === 'network-request-failed' || c === 'deadline-exceeded' || /network|offline/i.test(m) && !c)
      return { offline: true, msg: 'No hay conexión con la nube ahora mismo. Tus cambios se guardan aquí y se subirán solos.' };
    if (['invalid-credential', 'wrong-password', 'user-not-found', 'invalid-login-credentials'].includes(c)) return { msg: 'Correo o contraseña incorrectos.', fatal: true };
    if (c === 'invalid-email') return { msg: 'El correo no tiene un formato válido.', fatal: true };
    if (c === 'missing-password') return { msg: 'Escribe tu contraseña.', fatal: true };
    if (c === 'too-many-requests') return { msg: 'Demasiados intentos. Espera unos minutos y vuelve a probar.', fatal: true };
    if (c === 'user-disabled') return { msg: 'Esa cuenta está deshabilitada en Firebase.', fatal: true };
    if (c === 'operation-not-allowed' || c === 'configuration-not-found') return { msg: 'Falta activar el acceso con correo y contraseña: en Firebase ve a Authentication → Sign-in method → Email/Password → Enable.', fatal: true };
    if (c === 'invalid-api-key' || c === 'api-key-not-valid.-please-pass-a-valid-api-key.' || /api-key-not-valid|invalid-api-key/.test(m)) return { msg: 'La apiKey de js/firebase-config.js no es válida. Cópiala de nuevo desde Firebase.', fatal: true };
    if (c === 'permission-denied') return { msg: 'Firebase no te dejó entrar a los datos. Revisa que las reglas de Firestore estén publicadas y que usen exactamente el mismo correo con el que inicias sesión.', fatal: true };
    if (c === 'not-found' || /database .* does not exist|NOT_FOUND/i.test(m)) return { msg: 'No se encontró la base de datos. En Firebase entra a Firestore Database y pulsa “Crear base de datos”.', fatal: true };
    if (c === 'resource-exhausted' || c === 'quota-exceeded') return { msg: 'Se alcanzó el límite diario gratuito de Firebase. Los cambios siguen guardados aquí y se subirán mañana.' };
    return { msg: 'Error de sincronización: ' + (m || c || 'desconocido') };
  }

  return { isConfigured, init, signIn, signOut, listen, putRecords, putImage, getImage, delImage, friendly };
})();
