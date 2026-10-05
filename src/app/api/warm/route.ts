import { env } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

/**
 * URLs públicas (sin credenciales) que el navegador debe pedir para despertar los servicios dormidos.
 * Render solo despierta un servicio con peticiones que llegan desde internet: las llamadas entre
 * servicios (frontend -> extractor, extractor -> core) reciben 502 y no lo despiertan.
 */
export async function GET() {
  const targets = [
    `${env.extractorUrl}/health`,
    `${env.coreDbUrl}/api/v1/health`,
    env.youtubeUrl ? `${env.youtubeUrl}/health` : null,
  ].filter((url): url is string => Boolean(url));
  return Response.json({ targets }, { headers: { 'cache-control': 'no-store' } });
}
