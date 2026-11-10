# ENMA DESIGNS — Studio Manager

Panel administrativo privado para gestionar clientes, marcas, proyectos, tareas, calendario y finanzas de Enma Designs. Esta versión elimina por completo la dependencia de Supabase.

## Qué incluye esta versión

- Panel de resumen, clientes, marcas, proyectos, tareas, calendario y finanzas.
- Historial de correcciones por proyecto: fecha, descripción del cambio y registro acumulado.
- Exportación de la vista actual a CSV compatible con Excel, documento Word (.doc), PDF mediante impresión del navegador, imagen PNG y copia de texto.
- Datos guardados en un archivo JSON dentro de un repositorio **privado** de GitHub.
- Aplicación estática y API privada desplegadas en Vercel.
- Contraseña de administrador validada en el servidor. El token de GitHub nunca se entrega al navegador.
- Diseño adaptable a computadora y móvil. No se incluyen registros ficticios.

## Arquitectura y una aclaración importante

GitHub guarda el archivo de datos y el código; Vercel publica la web y ejecuta la pequeña API (`/api/data`). No se utiliza Supabase ni hace falta contratar una base de datos adicional para este uso individual y de bajo volumen.

Esta solución está pensada para **un solo administrador y pocos cambios simultáneos**. Cada guardado actualiza un archivo JSON en GitHub. No es una base de datos multiusuario ni está diseñada para muchas personas editando al mismo tiempo. No guardes archivos grandes de diseño dentro del JSON; conserva los originales en tu almacenamiento habitual y registra sus enlaces en la ficha de marca/proyecto.

## Configuración inicial (una sola vez)

### 1. Crear un repositorio privado en GitHub

1. En GitHub crea un repositorio nuevo, por ejemplo `enma-studio-manager`.
2. Selecciona **Private** (privado).
3. Sube el contenido de esta carpeta al nivel principal del repositorio: `index.html`, `api/`, `assets/`, etc.

### 2. Crear un token de GitHub

1. En GitHub abre **Settings → Developer settings → Personal access tokens → Fine-grained tokens**.
2. Crea un token con acceso únicamente al repositorio privado que acabas de crear.
3. En Repository permissions, concede **Contents: Read and write**. No necesita permisos de administración.
4. Copia el token. GitHub solo lo muestra al crearlo.

### 3. Conectar con Vercel

1. En Vercel selecciona **Add New → Project** e importa el repositorio privado.
2. Framework Preset: **Other**. No configures Build Command ni Output Directory; Vercel servirá `index.html` y reconocerá la función de `api/`.
3. Antes de desplegar, abre **Environment Variables** y añade estas cuatro variables:

| Variable | Valor |
|---|---|
| `GITHUB_TOKEN` | El token fine-grained que acabas de crear |
| `GITHUB_OWNER` | Tu usuario u organización de GitHub (propietario del repositorio) |
| `GITHUB_REPO` | Nombre exacto del repositorio, por ejemplo `enma-studio-manager` |
| `ENMA_ADMIN_PASSWORD` | Una contraseña larga y exclusiva para entrar al panel |

4. Guarda las variables y pulsa **Deploy**. Si cambias una variable más adelante, vuelve a desplegar para aplicar el cambio.
5. Abre el dominio que te asigne Vercel. Ingresa con `ENMA_ADMIN_PASSWORD`.

La primera conexión crea automáticamente `data/enma-studio-data.json` dentro del repositorio. Ese archivo contiene tus registros; por eso el repositorio debe permanecer privado. El token y la contraseña se configuran solo en Vercel, nunca en `index.html` ni en GitHub.

## Uso local

La API necesita ejecutarse en Vercel porque utiliza variables privadas del servidor. Para probar el panel completo localmente, instala Vercel CLI, inicia sesión y ejecuta desde esta carpeta:

```bash
npm i -g vercel
vercel dev
```

Configura las mismas cuatro variables en el entorno local de Vercel. No abras `index.html` con doble clic ni uses un servidor estático simple: las rutas `/api/data` no funcionarían.

## Exportaciones

Los botones de exportación trabajan con la sección que estás viendo:

- **Excel / CSV:** descarga un CSV que Excel puede abrir.
- **Word:** descarga un documento `.doc` compatible con Word.
- **PDF:** abre el diálogo de impresión; selecciona “Guardar como PDF”.
- **Imagen:** genera un PNG de la vista actual.
- **Copiar texto:** copia los datos tabulados para pegarlos en otra aplicación.

## Copias de seguridad

El historial de cambios del repositorio GitHub conserva versiones anteriores del archivo `data/enma-studio-data.json`. También puedes descargar ese archivo desde GitHub como respaldo. No borres ni hagas público el repositorio.

## Límites conocidos

- La persistencia está diseñada para un administrador y un volumen pequeño de datos. Si en el futuro necesitas varios usuarios, archivos adjuntos, permisos por rol, búsquedas complejas o ediciones simultáneas, conviene migrar a una base de datos administrada (por ejemplo Neon o Turso), sin necesidad de Supabase.
- Los enlaces de logotipos/manuales se guardan como texto en la ficha de marca. Esta versión no sube archivos al servidor.
- La exportación PDF utiliza el diálogo de impresión del navegador; la apariencia final depende de sus opciones de impresión.
- La contraseña se valida en cada solicitud al servidor y se conserva durante la sesión de la pestaña. Usa una contraseña única y no la compartas.
