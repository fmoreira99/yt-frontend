import { createHmac } from 'node:crypto';
import { env } from './env';

export type Service = 'extractor' | 'core' | 'media' | 'youtube';
export const SERVICES: Service[] = ['extractor', 'core', 'media', 'youtube'];

interface Rule {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: RegExp;
}

/**
 * Lista blanca de lo que el navegador puede pedir. Deliberadamente NO incluye
 * `GET core/accounts/:id` (devuelve tokens descifrados) ni escrituras al core salvo los vínculos entre canales.
 */
const RULES: Record<Service, Rule[]> = {
  extractor: [
    { method: 'POST', path: /^extract\/videos$/ },
    { method: 'POST', path: /^extract\/channel$/ },
    { method: 'GET', path: /^results$/ },
    { method: 'GET', path: /^results\/[\w-]{11}$/ },
    { method: 'POST', path: /^results\/analyze$/ },
    { method: 'GET', path: /^sensor\/status$/ },
    { method: 'POST', path: /^sensor\/schedule$/ },
    { method: 'POST', path: /^sensor\/trigger-now$/ },
    { method: 'DELETE', path: /^sensor\/schedule\/[^/]+$/ },
    { method: 'DELETE', path: /^sensor\/channels\/[^/]+$/ },
    { method: 'DELETE', path: /^results\/[\w-]{11}$/ },
    { method: 'GET', path: /^inspiration$/ },
    { method: 'POST', path: /^inspiration\/used$/ },
  ],
  core: [
    { method: 'GET', path: /^accounts$/ },
    { method: 'GET', path: /^jobs\/logs\/[\w.-]+$/ },
    { method: 'GET', path: /^links$/ },
    { method: 'PUT', path: /^links$/ },
    { method: 'DELETE', path: /^links$/ },
  ],
  media: [
    { method: 'GET', path: /^providers$/ },
    { method: 'GET', path: /^search$/ },
    { method: 'POST', path: /^generate$/ },
  ],
  youtube: [
    { method: 'GET', path: /^auth\/url$/ },
    { method: 'GET', path: /^auth\/accounts$/ },
    { method: 'DELETE', path: /^auth\/accounts\/[\w-]+$/ },
    { method: 'POST', path: /^videos\/upload$/ },
    { method: 'DELETE', path: /^videos\/[\w-]+$/ },
    { method: 'GET', path: /^analytics\/videos\/[\w-]+\/stats$/ },
    { method: 'GET', path: /^analytics\/channel$/ },
    { method: 'GET', path: /^analytics\/reports$/ },
    { method: 'GET', path: /^analytics\/reports\/[\w-]+$/ },
    { method: 'GET', path: /^analytics\/bundle$/ },
    { method: 'GET', path: /^reports\/types$/ },
    { method: 'GET', path: /^reports\/jobs$/ },
    { method: 'POST', path: /^reports\/jobs$/ },
    { method: 'GET', path: /^reports\/jobs\/[\w.-]+\/reports$/ },
    { method: 'GET', path: /^reports\/jobs\/[\w.-]+\/reports\/[\w.-]+\/download$/ },
  ],
};

const CREDENTIAL_VARS: Record<Service, string> = {
  extractor: 'INTERNAL_API_KEY',
  core: 'INTERNAL_API_KEY',
  media: 'MEDIA_HUB_API_KEY',
  youtube: 'YOUTUBE_JWT_SECRET',
};

const REQUEST_TIMEOUT_MS = 120_000; // Render free tarda 15-60 s en despertar
const UPLOAD_TIMEOUT_MS = 30 * 60_000;

// Render (plan gratuito) duerme el servicio tras 15 min sin uso y responde 502/503/504 mientras despierta (20-60 s).
const WAKING_STATUSES = new Set([502, 503, 504]);
const WAKE_RETRY_DELAY_MS = 6_000;
// Cadena de arranque en frío: frontend -> extractor -> core (~25 s cada uno).
const MAX_WAKE_RETRIES = 14;
const HEALTH_DEADLINE_MS = 75_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const isJson = (res: Response) => (res.headers.get('content-type') ?? '').includes('json');

export const SERVICE_LABELS: Record<Service, string> = {
  extractor: 'yt-extractor-service',
  core: 'core-db-service',
  media: 'ms-media-hub',
  youtube: 'ms-youtube',
};

export function errorResponse(status: number, code: string, message: string, headers?: HeadersInit): Response {
  return Response.json({ error: { code, message } }, { status, headers: { 'cache-control': 'no-store', ...headers } });
}

function signJwt(secret: string, ttlSeconds = 300): string {
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'yt-frontend', iat: now, exp: now + ttlSeconds })}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

interface Target {
  origin: string;
  apiBase: string;
  healthPath: string;
  headers: Record<string, string>;
}

/** Devuelve el destino o la respuesta de error si falta configuración. */
function resolveTarget(service: Service): Target | Response {
  const missing = (what: string) =>
    errorResponse(503, 'NOT_CONFIGURED', `${SERVICE_LABELS[service]}: falta configurar ${what} en el servidor`);

  switch (service) {
    case 'extractor':
    case 'core': {
      if (!env.internalApiKey) return missing('INTERNAL_API_KEY');
      const origin = service === 'extractor' ? env.extractorUrl : env.coreDbUrl;
      return {
        origin,
        apiBase: `${origin}/api/v1`,
        healthPath: service === 'extractor' ? '/health' : '/api/v1/health',
        headers: { 'x-service-api-key': env.internalApiKey },
      };
    }
    case 'media': {
      if (!env.mediaHubApiKey) return missing('MEDIA_HUB_API_KEY');
      return {
        origin: env.mediaHubUrl,
        apiBase: env.mediaHubUrl,
        healthPath: '/health',
        headers: { authorization: `Bearer ${env.mediaHubApiKey}` },
      };
    }
    case 'youtube': {
      if (!env.youtubeUrl) return missing('MS_YOUTUBE_URL');
      if (!env.youtubeJwtSecret) return missing('YOUTUBE_JWT_SECRET');
      return {
        origin: env.youtubeUrl,
        apiBase: `${env.youtubeUrl}/api/v1`,
        healthPath: '/health',
        headers: { authorization: `Bearer ${signJwt(env.youtubeJwtSecret)}` },
      };
    }
  }
}

/** Normaliza los distintos formatos de error de los 4 servicios a { code, message }. */
function describeError(text: string, status: number, label: string): { code: string; message: string } {
  if (/^\s*</.test(text)) {
    // HTML (página de error del proxy de Render): no se muestra tal cual.
    return {
      code: `HTTP_${status}`,
      message: `${label} no está disponible (HTTP ${status}). Si estaba dormido, reintenta en unos segundos.`,
    };
  }
  try {
    const body = JSON.parse(text) as { error?: unknown; message?: unknown };
    const { error } = body;
    if (typeof error === 'string') return { code: error, message: typeof body.message === 'string' ? body.message : error };
    if (error && typeof error === 'object') {
      const { code, message } = error as { code?: string; message?: string };
      return { code: code ?? `HTTP_${status}`, message: message ?? `Error ${status}` };
    }
    if (typeof body.message === 'string') return { code: `HTTP_${status}`, message: body.message };
  } catch {
    // respuesta no JSON (p. ej. HTML del proxy de Render)
  }
  return { code: `HTTP_${status}`, message: text.slice(0, 200) || `Error ${status}` };
}

interface CallOptions {
  method?: string;
  search?: string;
  body?: BodyInit | null;
  contentType?: string | null;
  timeoutMs?: number;
}

/** Llamada al servicio ya autenticada. Devuelve una Response lista para el cliente (errores normalizados). */
export async function callUpstream(service: Service, path: string, options: CallOptions = {}): Promise<Response> {
  const target = resolveTarget(service);
  if (target instanceof Response) return target;

  const headers = new Headers(target.headers);
  if (options.contentType) headers.set('content-type', options.contentType);

  const method = options.method ?? 'GET';
  const deadline = Date.now() + (options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const url = `${target.apiBase}/${path}${options.search ?? ''}`;

  let upstream!: Response;
  let text!: string;
  for (let attempt = 0; ; attempt++) {
    const init: RequestInit & { duplex?: 'half' } = {
      method,
      headers,
      body: options.body ?? undefined,
      signal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      cache: 'no-store',
    };
    if (options.body && typeof options.body !== 'string') init.duplex = 'half'; // body en streaming (subida de video)

    try {
      upstream = await fetch(url, init);
      text = await upstream.text();
    } catch (err) {
      const timedOut = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
      return errorResponse(
        timedOut ? 504 : 502,
        timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_UNREACHABLE',
        timedOut
          ? `${SERVICE_LABELS[service]} no respondió a tiempo (puede estar despertando; reintenta)`
          : `No se pudo conectar con ${SERVICE_LABELS[service]}`,
      );
    }

    // Solo GET (idempotente): si el servicio está despertando (502/503/504 sin JSON), esperar y reintentar.
    const waking = method === 'GET' && WAKING_STATUSES.has(upstream.status) && !isJson(upstream);
    if (!waking || attempt >= MAX_WAKE_RETRIES || Date.now() + WAKE_RETRY_DELAY_MS >= deadline) break;
    await sleep(WAKE_RETRY_DELAY_MS);
  }

  if (upstream.status === 401 || upstream.status === 403) {
    // No propagar 401: el cliente lo interpretaría como "sesión caducada" y redirigiría al login.
    return errorResponse(
      502,
      'UPSTREAM_AUTH_FAILED',
      `${SERVICE_LABELS[service]} rechazó la credencial del servidor: revisa la clave configurada (${CREDENTIAL_VARS[service]})`,
    );
  }
  if (!upstream.ok) {
    const { code, message } = describeError(text, upstream.status, SERVICE_LABELS[service]);
    const retryAfter = upstream.headers.get('retry-after');
    return errorResponse(upstream.status, code, message, retryAfter ? { 'retry-after': retryAfter } : undefined);
  }
  return new Response(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json', 'cache-control': 'no-store' },
  });
}

/** Proxy genérico para /api/[service]/[...path] respetando la lista blanca. */
export async function forward(service: Service, segments: string[], req: Request): Promise<Response> {
  const path = segments.join('/');
  const allowed =
    segments.every((s) => s && s !== '.' && s !== '..') &&
    RULES[service].some((rule) => rule.method === req.method && rule.path.test(path));
  if (!allowed) return errorResponse(404, 'NOT_ALLOWED', 'Ruta no permitida');

  const isUpload = service === 'youtube' && path === 'videos/upload';
  const hasBody = req.method === 'POST' || req.method === 'PUT';
  return callUpstream(service, segments.map(encodeURIComponent).join('/'), {
    method: req.method,
    search: new URL(req.url).search,
    contentType: req.headers.get('content-type'),
    body: hasBody ? (isUpload ? req.body : await req.text()) : undefined,
    timeoutMs: isUpload ? UPLOAD_TIMEOUT_MS : REQUEST_TIMEOUT_MS,
  });
}

/** Estado de salud (sin auth) con latencia. */
export async function checkHealth(service: Service): Promise<{ status: 'ok' | 'down' | 'not_configured'; latency_ms?: number; detail?: string }> {
  const target = resolveTarget(service);
  if (target instanceof Response) {
    return { status: 'not_configured', detail: (await target.json()).error.message };
  }

  // Un servicio dormido responde 502/503/504 al principio: se reintenta hasta que despierte o venza el plazo.
  const started = Date.now();
  const deadline = started + HEALTH_DEADLINE_MS;
  let detail = 'Sin respuesta';
  for (;;) {
    try {
      const res = await fetch(`${target.origin}${target.healthPath}`, {
        signal: AbortSignal.timeout(Math.max(1_000, Math.min(25_000, deadline - Date.now()))),
        cache: 'no-store',
      });
      if (res.ok) return { status: 'ok', latency_ms: Date.now() - started };
      detail = `HTTP ${res.status}`;
      if (!WAKING_STATUSES.has(res.status)) break;
    } catch {
      detail = 'Sin respuesta';
    }
    if (Date.now() + WAKE_RETRY_DELAY_MS >= deadline) break;
    await sleep(WAKE_RETRY_DELAY_MS);
  }
  return { status: 'down', latency_ms: Date.now() - started, detail: `${detail} tras reintentar` };
}
