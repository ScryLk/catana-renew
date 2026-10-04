import type { ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef } from 'react';

export function MobileSheet({ open, onClose, title, children, side = 'bottom', theme }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode;
  side?: 'bottom' | 'left' | 'right'; theme?: 'dark' | 'light';
}) {
  const restoreFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/65" />
      <Dialog.Content aria-describedby={undefined} className={`mobile-sheet mobile-sheet-${side}`}
        style={theme ? { backgroundColor: theme === 'light' ? '#fff' : '#09090b', color: theme === 'light' ? '#18181b' : '#f4f4f5' } : undefined}
        onOpenAutoFocus={() => { restoreFocus.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={(event) => { event.preventDefault(); restoreFocus.current?.focus(); }}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-200 p-4 dark:border-zinc-800">
          <Dialog.Title className="font-semibold">{title}</Dialog.Title>
          <Dialog.Close className="touch-control rounded-lg" aria-label={`Fechar ${title}`}><X className="size-5" /></Dialog.Close>
        </div>
        <div className="min-h-0 overflow-y-auto p-4">{children}</div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
