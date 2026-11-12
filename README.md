# ENMA Studio Manager

Panel privado para organizar el estudio: **clientes, trabajos, modificaciones por ronda, calendario y finanzas**. Funciona en móvil y computadora, se puede instalar como una app y sincroniza la misma información entre dispositivos.

## Dónde se guarda cada cosa

- **Aplicación:** publicada en Vercel desde este repositorio de GitHub.
- **Datos en la nube:** Vercel Blob en un almacén **privado** conectado al proyecto. Guarda clientes, trabajos, modificaciones, pagos, gastos, eventos, ajustes compartidos e imágenes.
- **Sesión:** protegida por una cuenta de acceso configurada con variables privadas de Vercel. La contraseña nunca se escribe en los archivos del proyecto ni se envía al navegador.
- **Copia del dispositivo:** IndexedDB conserva una copia local para que puedas consultar y seguir trabajando si se cae internet. Los cambios se envían automáticamente al guardarlos y, mientras la app está abierta, se vuelven a revisar cada 20 segundos. Si falla una petición, se reintenta con esperas progresivas; al volver internet o al regresar a la app, se intenta de nuevo.

No se utiliza Firebase ni Supabase. Vercel Blob privado se consulta exclusivamente desde funciones API del propio proyecto y requiere autenticación. Documentación: https://vercel.com/docs/vercel-blob/private-storage

## Qué incluye

| Sección | Para qué sirve |
|---|---|
| **Hoy** | Resumen del día: entregas próximas, modificaciones pendientes, cuentas por cobrar e ingresos del mes. |
| **Clientes** | Contacto, WhatsApp/Instagram, notas, marca, logotipo, colores, tipografías e imágenes de referencia. |
| **Trabajos** | Logos, flyers, videos o webs, con estado, prioridad, entrega, precio, tareas y portada. |
| **Modificaciones** | Solicitudes por trabajo, rondas numeradas, capturas del cliente, fecha límite y nueva versión. |
| **Calendario** | Vistas de mes, semana y día con entregas, cambios, reuniones y recordatorios. |
| **Finanzas** | Pagos, anticipos, gastos, saldo por cobrar, tasa de cambio, gráfico y exportación CSV. |
| **Ajustes** | Estado de la nube, perfil, apariencia, categorías, tasa, respaldos e instalación. |

Reglas de dinero:

- **Por cobrar** = precio acordado − pagos marcados como *Recibido*.
- Un pago *Pendiente* o una cotización no cuenta como dinero recibido.
- Marcar un trabajo como *Entregado* o *Finalizado* no lo marca como pagado.
- **Ganancia neta** = cobrado − gastos.
- Cada pago o gasto en bolívares guarda la tasa del momento.
- La app no inventa ni consulta tasas: se introduce manualmente.

---

# Puesta en marcha en Vercel

Haz esta configuración una sola vez. No tienes que crear una base de datos en Supabase ni un proyecto en Firebase.

## Paso 1. Subir el proyecto a GitHub

1. Descarga y descomprime este ZIP.
2. Entra a GitHub y abre el repositorio donde tienes el administrador. Si todavía no existe, crea uno nuevo y ponlo en **Private**.
3. Sube el contenido de la carpeta `enma-studio-manager` al nivel principal del repositorio. No subas una carpeta duplicada dentro de otra: `index.html`, `api`, `lib`, `js`, `css` y `package.json` deben quedar en la raíz.
4. Si el repositorio ya está conectado a Vercel, pulsa **Commit changes**. Vercel iniciará una nueva publicación automáticamente.

## Paso 2. Crear el almacén privado de Vercel

1. Entra a https://vercel.com/dashboard y abre el proyecto que publica ENMA Studio Manager.
2. Abre la pestaña **Storage**.
3. Selecciona **Create Storage** y luego **Blob**.
4. Ponle un nombre, por ejemplo `enma-studio-private`.
5. En el acceso selecciona **Private**. No elijas Public: aquí se guardan datos de clientes y finanzas.
6. Abre la pestaña **Projects** del almacén y conecta el proyecto exacto que publica ENMA Studio Manager.
7. Confirma que la conexión incluye el entorno **Production**. Activa **Preview** solo si también vas a probar despliegues preliminares.
8. Si el menú del proyecto ofrece **Upgrade to OIDC**, selecciónalo para usar la autenticación OIDC recomendada por Vercel.

Al conectar el almacén, Vercel añade `BLOB_STORE_ID` y entrega el token OIDC de forma automática a las funciones. En las funciones de Vercel, ese token puede llegar en la cabecera de la petición; no tienes que crear manualmente una variable `VERCEL_OIDC_TOKEN`. La app usa el SDK `@vercel/blob` desde el servidor y no expone credenciales en el navegador.

Documentación oficial: https://vercel.com/docs/vercel-blob/private-storage y https://vercel.com/docs/vercel-blob/using-blob-sdk. Vercel Blob puede aplicar cuotas o cargos según el plan y el uso; revisa el panel **Storage → Usage** y la página de precios de tu cuenta.

## Paso 3. Crear tus datos privados de acceso

En el proyecto de Vercel:

1. Abre **Settings → Environment Variables**.
2. Crea estas tres variables. Sus valores son privados y no debes subirlos a GitHub.

| Variable | Qué debes colocar |
|---|---|
| `ENMA_ADMIN_EMAIL` | El correo con el que iniciarás sesión en el administrador. |
| `ENMA_ADMIN_PASSWORD` | Una contraseña larga y exclusiva para ENMA Studio Manager. |
| `ENMA_SESSION_SECRET` | Una cadena aleatoria de al menos 32 caracteres. Puedes generarla desde un administrador de contraseñas. |

3. Selecciona **Production**. Activa también **Preview** si vas a probar versiones preliminares.
4. Guarda las variables.
5. No crees variables `BLOB_STORE_ID` ni `VERCEL_OIDC_TOKEN` a mano: Vercel las administra al conectar el almacén. Si el proyecto usa autenticación clásica en vez de OIDC, comprueba que `BLOB_READ_WRITE_TOKEN` esté disponible para Production.
6. Ve a **Deployments** y vuelve a publicar la última versión con **Redeploy** (o realiza un nuevo commit en GitHub).

**Importante:** el correo y la contraseña de estos pasos son los que introducirás en Ajustes → Nube. No son necesariamente tu correo/contraseña de Vercel.

## Paso 4. Confirmar que la publicación terminó

1. Abre la URL de ENMA Studio Manager en Vercel.
2. Entra en **Ajustes → Nube**.
3. Debe aparecer el formulario para iniciar sesión. Si ves un aviso de configuración incompleta, revisa las tres variables privadas y la conexión del Blob.
4. Introduce el correo y la contraseña creados en el paso 3.
5. Debes ver el estado **Sincronizado**.

## Paso 5. Pasar tus datos del dispositivo principal a la nube

Este paso evita que empieces con una cuenta vacía.

1. Antes de cambiar nada, abre ENMA en el dispositivo donde tienes más clientes y trabajos.
2. Entra a **Ajustes → Tus datos → Descargar respaldo**. Guarda ese archivo en un lugar seguro.
3. Inicia sesión en **Ajustes → Nube** con el correo y contraseña nuevos.
4. Deja ese dispositivo abierto con internet hasta que el estado diga **Sincronizado** y ya no muestre cambios pendientes.
5. No borres los datos ni desinstales la app de ese dispositivo durante la primera sincronización.

La primera sesión del dispositivo principal sube los registros e imágenes que ya tenía guardados localmente. La app no elimina los datos locales al conectarse.

### Si antes ya usabas Firebase

Esta versión ya no consulta Firebase. Si tenías información guardada únicamente en una base de Firebase, primero abre una copia de la versión antigua, descarga el respaldo desde Ajustes y después impórtalo en la versión nueva desde **Ajustes → Restaurar respaldo** en el dispositivo principal. Hazlo antes de iniciar la primera sincronización con Vercel y conserva el archivo original.

## Paso 6. Conectar el celular y la computadora

1. Abre la misma URL de Vercel en el otro dispositivo.
2. Entra a **Ajustes → Nube** e inicia sesión con exactamente el mismo correo y contraseña.
3. La app descargará los registros e imágenes que ya estén en la nube.
4. Comprueba que aparecen tus clientes y trabajos. Desde ese momento, los cambios se reflejan en los demás dispositivos cuando haya conexión.

**Para instalarla:**

- **iPhone:** abre el enlace en Safari → Compartir → Añadir a pantalla de inicio.
- **Android:** abre el enlace en Chrome → menú de tres puntos → Instalar app.
- **Computadora:** en Chrome o Edge utiliza el icono Instalar de la barra de direcciones.

---

# Cómo funciona la sincronización

- Cada cambio se guarda primero en el dispositivo y se envía a Vercel pocos segundos después.
- Los otros dispositivos consultan los cambios automáticamente cada 7 segundos mientras la app está abierta.
- Sin internet puedes continuar trabajando: los cambios quedan pendientes y se suben cuando vuelva la conexión.
- Si dos dispositivos modifican el mismo registro, se utiliza la versión con la marca de actualización más reciente. Mantén la fecha y hora de los dispositivos en automático.
- Los borrados también se sincronizan. Si la app detecta que faltan muchos registros inesperadamente en un dispositivo, detiene la propagación del borrado y pide elegir entre **Recuperar desde la nube** o **Sí, fue a propósito**.
- Las imágenes se guardan como archivos privados separados de los registros.
- Cerrar sesión detiene la sincronización en ese dispositivo, pero no borra tus datos de la nube ni de ese equipo.
- El inicio de sesión utiliza una cookie protegida `HttpOnly`; la contraseña y las claves de almacenamiento no están en el JavaScript público.
- Descargar un respaldo JSON periódicamente sigue siendo recomendable. El respaldo es una copia independiente de tu nube.

## Qué hacer si algo falla

| Mensaje o problema | Qué revisar |
|---|---|
| “Falta terminar la configuración privada de Vercel” | Comprueba `ENMA_ADMIN_EMAIL`, `ENMA_ADMIN_PASSWORD` y `ENMA_SESSION_SECRET`. Después abre Storage → tu Blob → Projects y confirma que el proyecto ENMA está conectado a Production. No crees manualmente `VERCEL_OIDC_TOKEN`. |
| “Correo o contraseña incorrectos” | Comprueba las variables de correo y contraseña, respetando lo que configuraste. |
| “Tu sesión expiró” | Inicia sesión otra vez en Ajustes → Nube. |
| “No se pudo acceder a Vercel Blob (código…)” | La app ahora muestra el código técnico de la operación. Abre Vercel → proyecto → Logs y busca `ENMA cloud records`; comprueba también Storage → Blob → Projects y que el almacén privado esté conectado a Production. |
| El celular no muestra los cambios | Revisa que ambos dispositivos tengan internet y estén usando la misma URL y la misma cuenta. En Ajustes pulsa **Sincronizar ahora**. |
| Una imagen no aparece | Comprueba que el primer dispositivo haya terminado de sincronizar y vuelve a abrir el registro. |

---

# Estructura del proyecto

```text
index.html              Aplicación principal
css/styles.css          Estilos
js/                      Lógica, vistas, formularios y sincronización
  cloud-vercel.js        Cliente de la API privada de Vercel
  sync.js                Sincronización local/nube
api/auth/                Inicio y cierre de sesión
api/cloud/               Lectura y escritura de datos e imágenes
lib/server-auth.js       Sesiones y comprobaciones de seguridad
assets/                  Logos e isotipos originales
icons/                   Iconos PWA
package.json             Dependencia @vercel/blob
vercel.json              Encabezados de seguridad y caché
```

## Privacidad y respaldos

El almacén debe mantenerse **Private**. No publiques los valores de `ENMA_ADMIN_PASSWORD`, `ENMA_SESSION_SECRET` ni ningún token. No agregues secretos a `js/` ni a `index.html`. Si cambias la contraseña o el secreto de sesión, actualiza sus variables en Vercel y vuelve a publicar; las sesiones anteriores dejarán de funcionar.

Se recomienda descargar un respaldo desde Ajustes al menos una vez por semana y guardarlo fuera del dispositivo. La sincronización en la nube no sustituye a una copia de seguridad independiente.
