import { NextResponse, type NextRequest } from 'next/server';
import { callUpstream } from '@/lib/server/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Destino del redirect de Google OAuth (GOOGLE_REDIRECT_URI de ms-youtube debe apuntar aquí).
 * Reenvía el `code` a ms-youtube desde el servidor y vuelve a /youtube.
 */
export async function GET(req: NextRequest) {
  const back = (params: Record<string, string>) => {
    const url = req.nextUrl.clone();
    url.pathname = '/youtube';
    url.search = new URLSearchParams(params).toString();
    return NextResponse.redirect(url);
  };

  const { searchParams } = req.nextUrl;
  const denied = searchParams.get('error');
  const code = searchParams.get('code');
  if (denied) return back({ error: `Acceso denegado: ${denied}` });
  if (!code) return back({ error: 'Falta el parámetro "code" en el callback de Google' });

  const res = await callUpstream('youtube', 'auth/callback', { search: `?${new URLSearchParams({ code })}` });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return back({ error: body?.error?.message ?? 'No se pudo conectar la cuenta' });
  return back({ connected: body?.data?.account?.channelTitle ?? 'cuenta' });
}
