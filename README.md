# YT Studio (yt-frontend)

Frontend en Next.js para usar los microservicios desplegados:

| Servicio | Qué hace en el frontend | Auth hacia el servicio |
|---|---|---|
| `yt-extractor-service` (Render) | Extraer videos/canales, resultados, análisis IA, sensor (cron) | `x-service-api-key` |
| `core-db-service` (Render) | Cuentas guardadas y registro de tareas (solo lectura) | `x-service-api-key` |
| `ms-media-hub` (Supabase Edge Function) | Búsqueda de media, generación con IA, estado de proveedores | `Authorization: Bearer` |
| `ms-youtube` | Conectar canal (OAuth), subir/eliminar videos, estadísticas y analíticas | JWT HS256 firmado por el servidor |

## Módulos

- **Canales**: un solo lugar para añadir, monitorear y administrar canales. Une los canales monitoreados (extractor + core)
  con los conectados a Google (ms-youtube). Cada canal muestra su estado; al abrirlo hay resumen con estadísticas diarias,
  videos, automatización (frecuencia, pausar/reanudar, escanear ahora, historial) y descargas en CSV/JSON.
- **Extraer / Resultados**: extracción puntual de videos y consulta de lo guardado.
- **Media Hub**, **Publicar** (subir videos) y **Base de datos** (cuentas y registro de tareas).

## Arquitectura

Los servicios usan claves internas y no tienen CORS, así que **el navegador nunca los llama directamente**.
Las páginas hablan con `/api/<servicio>/...` (Next.js) y ese proxy, en el servidor:

- añade la credencial de cada servicio (los secretos no llegan al navegador),
- solo permite rutas de una **lista blanca** (`src/lib/server/upstream.ts`); p. ej. `GET core/accounts/:id`
  (tokens descifrados) no está expuesto,
- normaliza los errores a `{ error: { code, message } }`.

El acceso a la app se protege con una contraseña (`APP_PASSWORD`) y una cookie de sesión firmada (`src/proxy.ts`).

## Configuración

```bash
cp .env.example .env.local   # completar
npm install
npm run dev                  # http://localhost:3000
npm run build && npm start   # producción
```

Variables (ver `.env.example`): `APP_PASSWORD`, `INTERNAL_API_KEY`, `MEDIA_HUB_API_KEY`, `MS_YOUTUBE_URL`,
`YOUTUBE_JWT_SECRET` y, opcionalmente, las URLs de los demás servicios (por defecto apuntan a los desplegados).

## ms-youtube: OAuth

El redirect de Google debe volver al frontend, que reenvía el `code` a ms-youtube:

1. En ms-youtube: `GOOGLE_REDIRECT_URI=https://<tu-frontend>/auth/youtube/callback`
2. Registrar esa misma URI en Google Cloud Console (credenciales OAuth).

Nota: ms-youtube guarda las cuentas en memoria; se pierden al reiniciar el servicio y hay que reconectar.

## Notas

- Render free tarda 15–60 s en despertar: el proxy espera hasta 120 s y el panel muestra el estado de cada servicio.
- La subida de videos pasa por el proxy en streaming. En plataformas serverless con límite de body (p. ej. Vercel, 4,5 MB)
  no funcionará: despliega en un host Node (Render, Railway, VPS).
