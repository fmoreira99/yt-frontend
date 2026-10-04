import { checkHealth, errorResponse, SERVICES, type Service } from '@/lib/server/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;

export async function GET(_req: Request, { params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  if (!SERVICES.includes(service as Service)) return errorResponse(404, 'UNKNOWN_SERVICE', 'Servicio desconocido');
  return Response.json(await checkHealth(service as Service), { headers: { 'cache-control': 'no-store' } });
}
