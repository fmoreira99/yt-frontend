'use client';

import Link from 'next/link';
import { api } from '@/lib/api';
import { useQuery } from '@/lib/hooks';
import { formatMs } from '@/lib/format';
import { Button, Card, Empty, ErrorBox, PageHeader, Spinner, StatusBadge } from '@/components/ui';
import { VideoCard } from '@/components/VideoCard';

const SERVICES = [
  { id: 'extractor', name: 'yt-extractor-service', description: 'Extrae metadatos, guion y análisis IA de videos y canales.', href: '/extract' },
  { id: 'core', name: 'core-db-service', description: 'Persistencia de cuentas y registro de tareas.', href: '/core' },
  { id: 'media', name: 'ms-media-hub', description: 'Imágenes, video, GIFs, iconos e IA en un solo contrato.', href: '/media' },
  { id: 'youtube', name: 'ms-youtube', description: 'Subida de videos y analíticas con OAuth de YouTube.', href: '/youtube' },
] as const;

function ServiceCard({ id, name, description, href }: (typeof SERVICES)[number]) {
  const { data, loading } = useQuery(() => api.health(id));
  const label = loading ? 'Comprobando…' : data?.status === 'ok' ? 'Operativo' : data?.status === 'not_configured' ? 'Sin configurar' : 'Caído';

  return (
    <Card className="service-card">
      <div className="row-between">
        <h3>{name}</h3>
        {loading ? <span className="spinner" /> : <StatusBadge status={data?.status ?? 'down'} label={label} />}
      </div>
      <p className="muted">{description}</p>
      <div className="row-between">
        <span className="small muted">{data?.detail ?? formatMs(data?.latency_ms)}</span>
        <Link href={href}>Abrir →</Link>
      </div>
    </Card>
  );
}

export default function DashboardPage() {
  const recent = useQuery(() => api.listResults({ limit: 4 }));

  return (
    <>
      <PageHeader
        title="Panel"
        description="Estado de los microservicios y la actividad más reciente. Los servicios gratuitos de Render pueden tardar hasta un minuto en despertar."
      />

      <div className="grid">
        {SERVICES.map((service) => (
          <ServiceCard key={service.id} {...service} />
        ))}
      </div>

      <section className="stack">
        <div className="row-between">
          <h2>Últimos análisis</h2>
          <Link href="/results">Ver todos →</Link>
        </div>
        {recent.loading && <Spinner label="Cargando resultados…" />}
        <ErrorBox message={recent.error} onRetry={recent.reload} />
        {recent.data && recent.data.data.length === 0 && (
          <Card>
            <Empty icon="extract" title="Aún no hay extracciones">
              Pega la URL de un video o un canal para extraer su metadata, guion y análisis.
              <Link href="/extract">
                <Button variant="primary" style={{ marginTop: 12 }}>
                  Extraer ahora
                </Button>
              </Link>
            </Empty>
          </Card>
        )}
        {recent.data?.data.map((r) => (
          <VideoCard key={r.video_id} metadata={r.metadata} analysis={r.analysis} extractedAt={r.extracted_at} transcriptAvailable={r.transcript_available} />
        ))}
      </section>
    </>
  );
}
