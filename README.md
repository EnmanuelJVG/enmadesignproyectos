# ENMA DESIGNS — Studio Manager

Panel administrativo para gestionar clientes, marcas, proyectos, tareas, calendario, finanzas e historial de correcciones de Enma Designs. Esta versión no utiliza Supabase y **no muestra una pantalla de contraseña**: abre directamente el panel.

## Qué incluye

- Resumen del estudio, clientes, marcas, proyectos, tareas, calendario y finanzas.
- Historial de correcciones por proyecto: fecha y descripción del trabajo realizado.
- Exportación de la vista actual a CSV compatible con Excel, documento Word (.doc), PDF mediante impresión, imagen PNG y copia de texto.
- Datos guardados en `data/enma-studio-data.json` dentro de tu repositorio privado de GitHub.
- API en Vercel; el token de GitHub permanece en el servidor y no se envía al navegador.
- Diseño adaptable a computadora y móvil. No se incluyen registros ficticios.

## IMPORTANTE: acceso sin contraseña

Esta versión quita por completo el inicio de sesión. Por eso, **cualquier persona que conozca o encuentre la dirección pública de tu sitio de Vercel podrá abrir el panel y consultar, crear, modificar o borrar sus registros**. Que el repositorio de GitHub sea privado no vuelve privada la página publicada en Vercel.

El token de GitHub sigue protegido como variable de entorno del servidor; no aparece en el código del navegador. Sin embargo, la API permite operar los datos sin pedir contraseña. No guardes aquí datos personales delicados de clientes (por ejemplo, teléfonos, direcciones o información confidencial) mientras el sitio esté publicado sin protección. Para volver a tener privacidad, habría que activar una protección de acceso en Vercel o restaurar un mecanismo de inicio de sesión.

## Arquitectura

- **GitHub privado:** conserva el código y el archivo JSON con los datos.
- **Vercel:** publica la web y ejecuta la API `api/data.js`.
- **Supabase:** no se utiliza.

La solución está pensada para un solo administrador y un volumen pequeño de información. Cada guardado actualiza un único archivo JSON en GitHub; no está diseñada para varias personas editando simultáneamente. No guardes archivos grandes de diseño dentro del JSON: conserva los originales en tu almacenamiento habitual y registra sus enlaces en la ficha correspondiente.

## Configuración en Vercel

En el proyecto de Vercel conectado a este repositorio, abre **Settings → Environment Variables** y configura estas tres variables para **Production**:

| Variable | Valor |
|---|---|
| `GITHUB_TOKEN` | Token fine-grained de GitHub con acceso únicamente a este repositorio y permiso **Contents: Read and write**. |
| `GITHUB_OWNER` | `EnmanuelJVG` |
| `GITHUB_REPO` | `enmadesignproyectos` |

Ya **no hace falta** crear `ENMA_ADMIN_PASSWORD`. Si existe en Vercel de una configuración anterior, puedes eliminarla; esta versión no la utiliza.

Después de guardar o modificar variables, haz un nuevo **Redeploy** desde Vercel → Deployments. La primera conexión crea automáticamente `data/enma-studio-data.json` en el repositorio. Mantén el repositorio de GitHub en privado y no pongas el token en `index.html`, en archivos públicos ni en mensajes.

### Crear o renovar el token de GitHub

1. En GitHub abre **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Crea un token cuyo propietario sea `EnmanuelJVG`.
3. En **Repository access**, selecciona únicamente `enmadesignproyectos`.
4. En **Repository permissions**, asigna **Contents: Read and write**. `Metadata: Read-only` se agrega automáticamente.
5. Crea el token y cópialo directamente a la variable `GITHUB_TOKEN` en Vercel. No lo compartas ni lo pegues en el código del sitio.

## Actualizar el proyecto existente

Para aplicar esta versión en un repositorio ya conectado a Vercel, reemplaza en GitHub los archivos del proyecto por los de este ZIP, respetando las rutas:

- `index.html`
- `api/data.js`
- `README.md`

No borres la carpeta `assets/` ni los archivos de identidad visual. Al confirmar los cambios en GitHub, Vercel iniciará un nuevo despliegue automáticamente si la integración está activa. Si no ocurre, ve a **Deployments** y pulsa **Redeploy**.

## Uso local

La API necesita las variables de entorno del servidor. Para probar el panel completo localmente, instala Vercel CLI y ejecuta desde esta carpeta:

```bash
npm i -g vercel
vercel dev
```

No abras `index.html` con doble clic ni uses un servidor estático simple: la ruta `/api/data` no funcionaría.

## Exportaciones

Los botones exportan los datos de la sección que estés viendo:

- **Excel / CSV:** descarga un CSV que Excel puede abrir.
- **Word:** descarga un documento `.doc` compatible con Word.
- **PDF:** abre el diálogo de impresión; selecciona “Guardar como PDF”.
- **Imagen:** genera un PNG de la vista actual.
- **Copiar texto:** copia los datos tabulados para pegarlos en otra aplicación.

## Copias de seguridad y límites

El historial de cambios del repositorio conserva versiones anteriores de `data/enma-studio-data.json`. También puedes descargar ese archivo desde GitHub como respaldo. No hagas público el repositorio.

Los enlaces de logotipos y manuales se guardan como texto; esta versión no sube archivos adjuntos. La exportación PDF usa el diálogo de impresión del navegador. Si en el futuro necesitas varios usuarios, privacidad real en el panel, archivos adjuntos o ediciones simultáneas, habrá que incorporar control de acceso y/o una base de datos adecuada.
