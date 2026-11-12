/* ENMA Studio Manager — almacenamiento privado en Vercel Blob.
   La autenticación y el acceso al almacenamiento ocurren únicamente en las funciones /api de Vercel. */
'use strict';

window.CloudVercel = (() => {
  let activeUser = null;
  let onUserChange = null;
  let initialized = false;

  async function request(url, options = {}) {
    const response = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options,
      headers: {
        ...(options.body instanceof Blob ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      }
    });
    const type = response.headers.get('content-type') || '';
    if (!response.ok) {
      let payload = {};
      if (type.includes('application/json')) payload = await response.json().catch(() => ({}));
      const err = new Error(payload.error || `La nube respondió con el error ${response.status}.`);
      err.status = response.status;
      err.code = payload.code || (response.status === 401 ? 'unauthorized' : 'api_error');
      throw err;
    }
    return response;
  }

  async function init(onChange) {
    onUserChange = onChange;
    const response = await request('/api/auth/session', { method: 'GET' });
    const data = await response.json();
    activeUser = data.authenticated ? {
      uid: 'enma-' + data.user.email.toLowerCase(),
      email: data.user.email
    } : null;
    initialized = true;
    onUserChange(activeUser);
  }

  async function signIn(email, password) {
    const response = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    activeUser = {
      uid: 'enma-' + data.user.email.toLowerCase(),
      email: data.user.email
    };
    if (onUserChange) onUserChange(activeUser);
  }

  async function signOut() {
    await request('/api/auth/logout', { method: 'POST', body: '{}' });
    activeUser = null;
    if (onUserChange) onUserChange(null);
  }

  function listen(cursor, onDocs, onErr) {
    let stopped = false;
    let polling = false;
    let currentCursor = cursor || null;
    let timer = null;

    const poll = async () => {
      if (stopped || polling || !activeUser || !navigator.onLine) return;
      polling = true;
      try {
        let since = 0;
        if (Array.isArray(currentCursor) && currentCursor.length >= 2) {
          since = Number(currentCursor[0]) * 1000 + Math.floor(Number(currentCursor[1]) / 1000000);
        }
        const response = await request('/api/cloud/records?since=' + encodeURIComponent(String(since)), { method: 'GET' });
        const data = await response.json();
        if (data.cursor) currentCursor = data.cursor;
        if (!stopped) onDocs(Array.isArray(data.records) ? data.records : [], data.cursor || null, false);
      } catch (error) {
        if (!stopped && onErr) onErr(error);
      } finally {
        polling = false;
      }
    };

    poll();
    timer = setInterval(poll, 7000);
    return () => { stopped = true; if (timer) clearInterval(timer); };
  }

  async function putRecords(items) {
    await request('/api/cloud/records', {
      method: 'POST',
      body: JSON.stringify({ items })
    });
  }

  async function putImage(id, blob) {
    const response = await fetch('/api/cloud/image?id=' + encodeURIComponent(id), {
      method: 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      const error = new Error(data.error || 'No se pudo subir la imagen a Vercel.');
      error.status = response.status;
      error.code = data.code || 'image_upload_error';
      throw error;
    }
  }

  async function getImage(id) {
    const response = await request('/api/cloud/image?id=' + encodeURIComponent(id), { method: 'GET' });
    return response.blob();
  }

  async function delImage(id) {
    await request('/api/cloud/image?id=' + encodeURIComponent(id), { method: 'DELETE', body: '{}' });
  }

  function friendly(error) {
    const status = Number(error?.status || 0);
    if (!navigator.onLine || error?.code === 'timeout' || error?.name === 'TypeError') {
      return { offline: true, msg: 'No hay conexión con Vercel ahora mismo. Tus cambios siguen guardados en este dispositivo y se volverán a subir cuando regrese internet.' };
    }
    if (status === 401) return { msg: 'Tu sesión expiró. Vuelve a iniciar sesión en Ajustes → Nube.', fatal: true };
    if (status === 403) return { msg: 'Vercel rechazó la solicitud por seguridad. Abre de nuevo la aplicación desde su dominio de Vercel.', fatal: true };
    if (status === 503 || error?.code === 'not_configured') return { msg: error.message || 'Falta configurar Vercel Blob y las variables privadas. Sigue el README.', fatal: true };
    if (status === 413) return { msg: 'La imagen supera el tamaño permitido. Vuelve a cargarla para que la app la comprima.', fatal: true };
    if (status === 429) return { msg: 'Se alcanzó un límite temporal de Vercel. La app volverá a intentarlo.' };
    return { msg: error?.message || 'No se pudo sincronizar con Vercel.' };
  }

  return {
    isConfigured: () => true,
    init,
    signIn,
    signOut,
    listen,
    putRecords,
    putImage,
    getImage,
    delImage,
    friendly
  };
})();
