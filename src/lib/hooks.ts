'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : 'Error desconocido';
}

/** Carga datos al montar (y al cambiar `deps`). `reload()` vuelve a pedirlos. */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === requestId.current) setData(result);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);
  return { data, error, loading, reload };
}

/** Envuelve una acción (submit/click) con estado de carga, error y resultado. */
export function useAction<A extends unknown[], R>(action: (...args: A) => Promise<R>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<R | null>(null);
  const actionRef = useRef(action);
  actionRef.current = action;

  const run = useCallback(
    async (...args: A) => {
      setLoading(true);
      setError(null);
      try {
        const value = await actionRef.current(...args);
        setResult(value);
        return value;
      } catch (err) {
        setError(errorMessage(err));
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [],
  );
  return { run, loading, error, result, reset: () => (setResult(null), setError(null)) };
}
