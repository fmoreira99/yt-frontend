'use client';

import { useEffect } from 'react';
import { wakeServices } from '@/lib/wake';

const TTL_MS = 10 * 60_000; // Render duerme los servicios a los 15 min sin uso

/** Al entrar despierta, en paralelo, los servicios que estén dormidos (extractor, core y ms-youtube). */
export function WarmUp() {
  useEffect(() => {
    try {
      const last = Number(sessionStorage.getItem('warmedAt') ?? 0);
      if (Date.now() - last < TTL_MS) return;
      sessionStorage.setItem('warmedAt', String(Date.now()));
    } catch {
      /* sessionStorage no disponible: se despierta igualmente */
    }
    void wakeServices();
  }, []);
  return null;
}
