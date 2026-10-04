import { useRef, type HTMLAttributes } from 'react';
import * as Dialog from '@radix-ui/react-dialog';

/** Retrofit existing editorial panels without duplicating their workflows. */
export function ResponsiveModal({ label, onDismiss, dismissible = true, children, className, onClick, ...props }: HTMLAttributes<HTMLDivElement> & {
  label: string; onDismiss: () => void; dismissible?: boolean;
}) {
  const previousFocus = useRef<HTMLElement | null>(null);
  return <Dialog.Root open onOpenChange={(open) => { if (!open && dismissible) onDismiss(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/65" />
      <Dialog.Content {...props} aria-describedby={undefined} aria-labelledby={undefined} aria-label={label}
        className={`responsive-modal ${className ?? ''}`}
        onClick={(event) => { if (event.target === event.currentTarget && dismissible) onDismiss(); onClick?.(event); }}
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement; }}
        onCloseAutoFocus={(event) => { event.preventDefault(); previousFocus.current?.focus(); }}
        onEscapeKeyDown={(event) => { if (!dismissible) event.preventDefault(); }}
        onPointerDownOutside={(event) => { if (!dismissible) event.preventDefault(); }}>
        <Dialog.Title className="sr-only">{label}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
