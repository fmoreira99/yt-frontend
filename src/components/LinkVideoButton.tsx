'use client';

import { useState } from 'react';
import { useAction } from '@/lib/hooks';
import { linkAll } from '@/lib/links';
import { Button, ErrorBox } from './ui';
import { LinkPicker } from './LinkPicker';
import { useToast } from './Toast';

/** "Vincular a canal": abre un panel para elegir uno o varios canales propios a los que inspira este video. */
export function LinkVideoButton({ videoId }: { videoId: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [targets, setTargets] = useState<string[]>([]);
  const link = useAction(async () => {
    await linkAll(targets, 'video', [videoId]);
    toast.success(targets.length === 1 ? 'Video vinculado al canal' : `Video vinculado a ${targets.length} canales`);
    setOpen(false);
    setTargets([]);
  });

  return (
    <>
      <Button size="sm" variant="ghost" icon="play" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Vincular a canal
      </Button>
      {open && (
        <div className="stack-sm" style={{ flexBasis: '100%' }}>
          <LinkPicker value={targets} onChange={setTargets} label="¿A qué canales propios inspira?" hint="Aparecerá en su cola de inspiración." />
          <div className="row">
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
    </>
  );
}
