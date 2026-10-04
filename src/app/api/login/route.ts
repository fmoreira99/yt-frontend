import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { env } from '@/lib/server/env';
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/server/session';

export const runtime = 'nodejs';

const sha256 = (value: string) => createHash('sha256').update(value).digest();

export async function POST(req: Request) {
  const expected = env.appPassword;
  if (!expected) {
    return NextResponse.json({ error: { code: 'NOT_CONFIGURED', message: 'Falta configurar APP_PASSWORD' } }, { status: 503 });
  }

  const { password } = (await req.json().catch(() => ({}))) as { password?: unknown };
  const ok = typeof password === 'string' && timingSafeEqual(sha256(password), sha256(expected));
  if (!ok) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // frena la fuerza bruta
    return NextResponse.json({ error: { code: 'INVALID_PASSWORD', message: 'Contraseña incorrecta' } }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
