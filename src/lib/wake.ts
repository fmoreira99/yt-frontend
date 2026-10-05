/**
 * Despierta los servicios gratuitos de Render desde el navegador. Se usa `no-cors`: la respuesta es
 * opaca (no hace falta leerla, solo que la petición llegue) y no depende de CORS en los servicios.
 * La promesa termina cuando el servicio ya respondió, es decir, cuando está despierto.
 */
export async function wakeServices(): Promise<void> {
  try {
    const res = await fetch('/api/warm');
    if (!res.ok) return;
    const { targets } = (await res.json()) as { targets: string[] };
    await Promise.allSettled(
      targets.map((url) => fetch(url, { mode: 'no-cors', cache: 'no-store', signal: AbortSignal.timeout(100_000) })),
    );
  } catch {
    /* sin red: no hay nada que hacer */
  }
}
