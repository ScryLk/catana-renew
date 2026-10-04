import { StudioResponsiveContext } from '../../hooks/useStudioResponsive';
import { useState, type ReactNode } from 'react';
import { useStudioStore } from '../../store/studioStore';

export function StudioResponsiveProvider({ children }: { children: ReactNode }) {
  const [pane, setPane] = useState<'assistant' | 'catalog'>('assistant');
  const [phoneZoom, setPhoneZoom] = useState(100);
  const currentSpread = useStudioStore((state) => state.currentSpread);
  const [selection, setSelection] = useState<{ spread: typeof currentSpread; number: number } | null>(null);
  const pageNumber = selection?.spread === currentSpread ? selection.number : currentSpread[0];
  const selectPage = (number: number) => setSelection({ spread: currentSpread, number });
  return <StudioResponsiveContext.Provider value={{ pane, setPane, pageNumber, selectPage, phoneZoom, setPhoneZoom }}>{children}</StudioResponsiveContext.Provider>;
}
