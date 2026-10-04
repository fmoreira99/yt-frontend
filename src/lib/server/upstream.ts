import { createHmac } from 'node:crypto';
import { env } from './env';

export type Service = 'extractor' | 'core' | 'media' | 'youtube';
export const SERVICES: Service[] = ['extractor', 'core', 'media', 'youtube'];

interface Rule {
  method: 'GET' | 'POST' | 'DELETE';
  path: RegExp;
}

/**
 * Lista blanca de lo que el navegador puede pedir. Deliberadamente NO incluye
 * `GET core/accounts/:id` (devuelve tokens descifrados) ni las escrituras directas al core.
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
  ],
  core: [
    { method: 'GET', path: /^accounts$/ },
    { method: 'GET', path: /^jobs\/logs\/[\w.-]+$/ },
  ],
  media: [
    { method: 'GET', path: /^providers$/ },
    { method: 'GET', path: /^search$/ },
    { method: 'POST', path: /^generate$/ },
  ],
  youtube: [
    { method: 'GET', path: /^auth\/url$/ },
    { method: 'GET', path: /^auth\/accounts$/ },
    { method: 'POST', path: /^videos\/upload$/ },
    { method: 'DELETE', path: /^videos\/[\w-]+$/ },
    { method: 'GET', path: /^analytics\/videos\/[\w-]+\/stats$/ },
    { method: 'GET', path: /^analytics\/channel$/ },
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
function describeError(text: string, status: number): { code: string; message: string } {
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

  const init: RequestInit & { duplex?: 'half' } = {
    method: options.method ?? 'GET',
    headers,
    body: options.body ?? undefined,
    signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
    cache: 'no-store',
  };
  if (options.body && typeof options.body !== 'string') init.duplex = 'half'; // body en streaming (subida de video)

  let upstream: Response;
  try {
    upstream = await fetch(`${target.apiBase}/${path}${options.search ?? ''}`, init);
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

  const text = await upstream.text();
  if (upstream.status === 401 || upstream.status === 403) {
    // No propagar 401: el cliente lo interpretaría como "sesión caducada" y redirigiría al login.
    return errorResponse(
      502,
      'UPSTREAM_AUTH_FAILED',
      `${SERVICE_LABELS[service]} rechazó la credencial del servidor: revisa la clave configurada (${CREDENTIAL_VARS[service]})`,
    );
  }
  if (!upstream.ok) {
    const { code, message } = describeError(text, upstream.status);
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
  const hasBody = req.method === 'POST';
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
    const notConfigured = service === 'youtube' && !env.youtubeUrl;
    return { status: notConfigured ? 'not_configured' : 'down', detail: (await target.json()).error.message };
  }
  const started = Date.now();
  try {
    const res = await fetch(`${target.origin}${target.healthPath}`, {
      signal: AbortSignal.timeout(75_000),
      cache: 'no-store',
    });
    const latency_ms = Date.now() - started;
    return res.ok ? { status: 'ok', latency_ms } : { status: 'down', latency_ms, detail: `HTTP ${res.status}` };
  } catch {
    return { status: 'down', latency_ms: Date.now() - started, detail: 'Sin respuesta' };
  }
}
