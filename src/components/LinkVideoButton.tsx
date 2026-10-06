'use client';

import { useEffect, useRef, useState } from 'react';
import { useAction } from '@/lib/hooks';
import { linkAll } from '@/lib/links';
import { Button, ErrorBox } from './ui';
import { LinkPicker } from './LinkPicker';
import { useToast } from './Toast';

/** "Vincular a canal": globo anclado al botón para elegir uno o varios canales propios a los que inspiran estos videos. */
export function LinkVideoButton({
  videoIds,
  label = 'Vincular',
  variant = 'secondary',
  onLinked,
}: {
  videoIds: string[];
  label?: string;
  variant?: 'secondary' | 'ghost';
  onLinked?: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), setOpen(false));
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const link = useAction(async () => {
    await linkAll(targets, 'video', videoIds);
    const what = videoIds.length === 1 ? 'Video vinculado' : `${videoIds.length} videos vinculados`;
    toast.success(targets.length === 1 ? `${what} al canal` : `${what} a ${targets.length} canales`);
    setOpen(false);
    setTargets([]);
    onLinked?.();
  });

  return (
    <div className="popover-anchor" ref={ref}>
      <Button size="sm" variant={variant} icon="link" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog">
        {label}
      </Button>
      {open && (
        <div className="popover" role="dialog" aria-label="Vincular a canal">
          <LinkPicker
            value={targets}
            onChange={setTargets}
            layout="column"
            label={videoIds.length === 1 ? '¿A qué canales tuyos inspira este video?' : `¿A qué canales tuyos inspiran estos ${videoIds.length} videos?`}
            hint="Aparecerá en la cola de inspiración de cada uno."
          />
          <div className="row" style={{ marginTop: 12 }}>
            <Button size="sm" variant="primary" loading={link.loading} disabled={targets.length === 0} onClick={() => void link.run()}>
              Vincular
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
          <ErrorBox message={link.error} />
        </div>
      )}
    </div>
  );
}
