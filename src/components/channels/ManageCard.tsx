'use client';

import { api } from '@/lib/api';
import { useAction } from '@/lib/hooks';
import { Button, Card, ErrorBox } from '../ui';
import { useToast } from '../Toast';
import type { TabProps } from './ChannelDrawer';

/** Acciones destructivas, separadas del resto y siempre con confirmación. */
export function ManageCard({ channel, onChanged, onClose }: TabProps) {
  const toast = useToast();
  const { connection, monitor } = channel;

  const disconnect = useAction(async () => {
    const ok = window.confirm(
      `¿Desconectar «${channel.name}» de Google?\n\nSe revoca el permiso: dejarás de ver sus estadísticas y de poder subir videos hasta volver a conectarlo. Los videos del canal en YouTube no se tocan.`,
    );
    if (!ok || !connection) return;
    const { data } = await api.youtubeDisconnect(connection.accountId);
    toast.success(data.revoked ? 'Cuenta desconectada y permiso revocado en Google' : 'Cuenta desconectada');
    onChanged();
    if (!monitor) onClose(); // sin monitoreo ya no queda nada que mostrar
  });

  const remove = useAction(async () => {
    const ok = window.confirm(
      `¿Eliminar «${channel.name}»?\n\nSe detiene el monitoreo y el canal desaparece de la lista. Los videos ya extraídos se conservan en Resultados.`,
    );
    if (!ok) return;
    await api.deleteChannel(channel.id);
    toast.success('Canal eliminado');
    onChanged();
    if (!connection) onClose();
  });

  if (!connection && !monitor) return null;
  return (
    <Card title="Gestión del canal">
      <div className="stack">
        {connection && (
          <div className="row-between" style={{ flexWrap: 'nowrap', gap: 16 }}>
            <p className="small muted" style={{ flex: 1 }}>
              <strong style={{ color: 'var(--text)' }}>Conectado con Google.</strong> Desconectar revoca el acceso.
            </p>
            <Button variant="danger" style={{ flex: 'none' }} loading={disconnect.loading} onClick={() => void disconnect.run()}>
              Desconectar
            </Button>
          </div>
        )}
        {monitor && (
          <div className="row-between" style={{ flexWrap: 'nowrap', gap: 16 }}>
            <p className="small muted" style={{ flex: 1 }}>
              <strong style={{ color: 'var(--text)' }}>Eliminar de la lista.</strong> Para solo detener los escaneos, usa el
              interruptor de arriba.
            </p>
            <Button variant="danger" icon="trash" style={{ flex: 'none' }} loading={remove.loading} onClick={() => void remove.run()}>
              Eliminar canal
            </Button>
          </div>
        )}
        <ErrorBox message={disconnect.error ?? remove.error} />
      </div>
    </Card>
  );
}
