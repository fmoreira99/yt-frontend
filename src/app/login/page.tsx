'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button, ErrorBox, Field } from '@/components/ui';

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    }).catch(() => null);

    if (res?.ok) {
      const next = params.get('next');
      // Solo rutas internas: evita redirecciones abiertas.
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
      return;
    }
    const body = await res?.json().catch(() => null);
    setError(body?.error?.message ?? 'No se pudo iniciar sesión');
    setLoading(false);
  }

  return (
    <form className="card login-card stack-lg" onSubmit={submit}>
      <div className="stack-sm">
        <h1>YT Studio</h1>
        <p className="muted">Ingresa la contraseña para continuar.</p>
      </div>
      <Field label="Contraseña">
        <input className="input" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <ErrorBox message={error} />
      <Button type="submit" variant="primary" loading={loading} disabled={!password}>
        Entrar
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="login-wrap">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
