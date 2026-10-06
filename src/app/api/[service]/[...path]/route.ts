import { errorResponse, forward, SERVICES, type Service } from '@/lib/server/upstream';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type Ctx = { params: Promise<{ service: string; path: string[] }> };

async function handle(req: Request, { params }: Ctx): Promise<Response> {
  const { service, path } = await params;
  if (!SERVICES.includes(service as Service)) return errorResponse(404, 'UNKNOWN_SERVICE', 'Servicio desconocido');
  return forward(service as Service, path, req);
}

export { handle as GET, handle as POST, handle as PUT, handle as DELETE };
