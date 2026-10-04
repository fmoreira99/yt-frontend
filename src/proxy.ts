import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/server/session';

// Protege páginas y /api/* con la cookie de sesión. /login y sus endpoints quedan fuera (ver matcher).
export async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/');

  if (!process.env.APP_PASSWORD?.trim()) {
    if (process.env.NODE_ENV !== 'production') return NextResponse.next();
    const message = 'Falta configurar APP_PASSWORD en el servidor';
    return isApi
      ? NextResponse.json({ error: { code: 'NOT_CONFIGURED', message } }, { status: 503 })
      : new NextResponse(message, { status: 503 });
  }

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();

  if (isApi) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sesión requerida' } }, { status: 401 });
  }
  const login = new URL('/login', request.url);
  login.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ['/((?!_next/|favicon\\.ico|login$|api/login$|api/logout$).*)'],
};
