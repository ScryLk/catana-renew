import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useResponsiveLayout } from './useResponsiveLayout';
import { usePublicationFit } from './usePublicationFit';
import { MobileSheet } from '../components/mobile/MobileSheet';

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); vi.restoreAllMocks(); });

describe('responsive presentation', () => {
  it('reacts to breakpoint crossings and removes matchMedia listeners', () => {
    const subscriptions = new Map<string, Set<() => void>>();
    let width = 390;
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() { return width <= (query.includes('767') ? 767 : 1023); },
      addEventListener: (_: string, listener: () => void) => {
        if (!subscriptions.has(query)) subscriptions.set(query, new Set());
        subscriptions.get(query)!.add(listener);
      },
      removeEventListener: (_: string, listener: () => void) => subscriptions.get(query)?.delete(listener),
    }));
    function Probe() { const layout = useResponsiveLayout(); return <output>{layout.isPhone ? 'phone' : layout.isTablet ? 'tablet' : 'desktop'}</output>; }
    act(() => root.render(<Probe />)); expect(container.textContent).toBe('phone');
    act(() => { width = 820; subscriptions.forEach((listeners) => listeners.forEach((listener) => listener())); });
    expect(container.textContent).toBe('tablet');
    act(() => { width = 1440; subscriptions.forEach((listeners) => listeners.forEach((listener) => listener())); });
    expect(container.textContent).toBe('desktop');
    act(() => root.unmount());
    expect([...subscriptions.values()].every((listeners) => listeners.size === 0)).toBe(true);
    root = createRoot(container);
    vi.unstubAllGlobals();
  });

  it('fits late-mounted and rotated viewports without changing source geometry', () => {
    let measure = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { measure = callback; } observe() {} disconnect = disconnect; });
    let width = 320, height = 500;
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => width);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(() => height);
    function Probe({ mounted }: { mounted: boolean }) {
      const { ref, fit } = usePublicationFit(490, 693);
      return mounted ? <div ref={ref}><output>{fit}</output><div data-source style={{ width: 490, height: 693 }} /></div> : null;
    }
    act(() => root.render(<Probe mounted={false} />));
    act(() => root.render(<Probe mounted />));
    expect(Number(container.querySelector('output')?.textContent)).toBeCloseTo(296 / 490);
    act(() => { width = 844; height = 270; measure(); });
    expect(Number(container.querySelector('output')?.textContent)).toBeCloseTo(246 / 693);
    expect((container.querySelector('[data-source]') as HTMLElement).style.width).toBe('490px');
    act(() => root.unmount()); expect(disconnect).toHaveBeenCalled(); root = createRoot(container);
    vi.unstubAllGlobals();
  });

  it('sheet locks background, has a named dialog and closes with Escape', async () => {
    function Probe() { const [open, setOpen] = useState(true); return <MobileSheet title="Navegação" open={open} onClose={() => setOpen(false)}><button>Destino</button></MobileSheet>; }
    await act(async () => root.render(<Probe />));
    expect(document.querySelector('[role=dialog]')?.getAttribute('aria-labelledby')).toBeTruthy();
    expect(document.body.getAttribute('data-scroll-locked')).toBeTruthy();
    await act(async () => document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(document.querySelector('[role=dialog]')).toBeNull();
  });
});
