'use client';

import { useEffect } from 'react';

/**
 * Los servicios gratuitos de Render duermen tras 15 min y tardan ~25 s en despertar (y el extractor
 * depende del core). Al entrar, se despiertan en paralelo para que las pantallas no esperen en cadena.
 */
export function WarmUp() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('warmed')) return;
      sessionStorage.setItem('warmed', '1');
    } catch {
      /* sessionStorage no disponible */
    }
    for (const service of ['extractor', 'core']) void fetch(`/api/health/${service}`).catch(() => undefined);
  }, []);
  return null;
}
