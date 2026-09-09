import { useEffect } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
}

interface UseKeyboardShortcutsProps {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export const useKeyboardShortcuts = ({
  shortcuts,
  enabled = true,
}: UseKeyboardShortcutsProps) => {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, enabled]);
};

/**
 * Hook para atalhos de editor
 */
export const useEditorShortcuts = (callbacks: {
  onCopy?: () => void;
  onCut?: () => void;
  onPaste?: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onSelectAll?: () => void;
  onGroup?: () => void;
  onUngroup?: () => void;
  onBringForward?: () => void;
  onSendBackward?: () => void;
  onBringToFront?: () => void;
  onSendToBack?: () => void;
  onAlignLeft?: () => void;
  onAlignCenter?: () => void;
  onAlignRight?: () => void;
  onAlignTop?: () => void;
  onAlignMiddle?: () => void;
  onAlignBottom?: () => void;
  onToggleGrid?: () => void;
  onToggleSnap?: () => void;
  onToggleElements?: () => void;
  onSave?: () => void;
}) => {
  const shortcuts: KeyboardShortcut[] = [
    // Basic editing
    {
      key: 'c',
      ctrl: true,
      description: 'Copiar',
      action: () => callbacks.onCopy?.(),
    },
    {
      key: 'x',
      ctrl: true,
      description: 'Cortar',
      action: () => callbacks.onCut?.(),
    },
    {
      key: 'v',
      ctrl: true,
      description: 'Colar',
      action: () => callbacks.onPaste?.(),
    },
    {
      key: 'd',
      ctrl: true,
      description: 'Duplicar',
      action: () => callbacks.onDuplicate?.(),
    },
    {
      key: 'Delete',
      description: 'Deletar',
      action: () => callbacks.onDelete?.(),
    },
    {
      key: 'Backspace',
      description: 'Deletar',
      action: () => callbacks.onDelete?.(),
    },

    // History
    {
      key: 'z',
      ctrl: true,
      description: 'Desfazer',
      action: () => callbacks.onUndo?.(),
    },
    {
      key: 'z',
      ctrl: true,
      shift: true,
      description: 'Refazer',
      action: () => callbacks.onRedo?.(),
    },
    {
      key: 'y',
      ctrl: true,
      description: 'Refazer',
      action: () => callbacks.onRedo?.(),
    },

    // Selection
    {
      key: 'a',
      ctrl: true,
      description: 'Selecionar tudo',
      action: () => callbacks.onSelectAll?.(),
    },

    // Grouping
    {
      key: 'g',
      ctrl: true,
      description: 'Agrupar',
      action: () => callbacks.onGroup?.(),
    },
    {
      key: 'g',
      ctrl: true,
      shift: true,
      description: 'Desagrupar',
      action: () => callbacks.onUngroup?.(),
    },

    // Layer ordering
    {
      key: ']',
      ctrl: true,
      description: 'Trazer para frente',
      action: () => callbacks.onBringForward?.(),
    },
    {
      key: '[',
      ctrl: true,
      description: 'Enviar para trás',
      action: () => callbacks.onSendBackward?.(),
    },
    {
      key: ']',
      ctrl: true,
      shift: true,
      description: 'Trazer para a frente',
      action: () => callbacks.onBringToFront?.(),
    },
    {
      key: '[',
      ctrl: true,
      shift: true,
      description: 'Enviar para o fundo',
      action: () => callbacks.onSendToBack?.(),
    },

    // Alignment
    {
      key: 'l',
      ctrl: true,
      shift: true,
      description: 'Alinhar à esquerda',
      action: () => callbacks.onAlignLeft?.(),
    },
    {
      key: 'c',
      ctrl: true,
      shift: true,
      description: 'Centralizar horizontalmente',
      action: () => callbacks.onAlignCenter?.(),
    },
    {
      key: 'r',
      ctrl: true,
      shift: true,
      description: 'Alinhar à direita',
      action: () => callbacks.onAlignRight?.(),
    },
    {
      key: 't',
      ctrl: true,
      shift: true,
      description: 'Alinhar ao topo',
      action: () => callbacks.onAlignTop?.(),
    },
    {
      key: 'm',
      ctrl: true,
      shift: true,
      description: 'Centralizar verticalmente',
      action: () => callbacks.onAlignMiddle?.(),
    },
    {
      key: 'b',
      ctrl: true,
      shift: true,
      description: 'Alinhar à base',
      action: () => callbacks.onAlignBottom?.(),
    },

    // Grid and snapping
    {
      key: "'",
      ctrl: true,
      description: 'Alternar grade',
      action: () => callbacks.onToggleGrid?.(),
    },
    {
      key: ';',
      ctrl: true,
      description: 'Alternar snap',
      action: () => callbacks.onToggleSnap?.(),
    },

    // UI Panels
    {
      key: 'e',
      ctrl: true,
      description: 'Alternar painel de elementos',
      action: () => callbacks.onToggleElements?.(),
    },

    // Save
    {
      key: 's',
      ctrl: true,
      description: 'Salvar',
      action: () => callbacks.onSave?.(),
    },
  ];

  useKeyboardShortcuts({ shortcuts });
};

/**
 * Formata atalho para exibição
 */
export const formatShortcut = (shortcut: KeyboardShortcut): string => {
  const parts: string[] = [];

  if (shortcut.ctrl || shortcut.meta) {
    parts.push('⌘'); // or 'Ctrl' for Windows
  }
  if (shortcut.shift) {
    parts.push('⇧');
  }
  if (shortcut.alt) {
    parts.push('⌥');
  }
  parts.push(shortcut.key.toUpperCase());

  return parts.join(' + ');
};
