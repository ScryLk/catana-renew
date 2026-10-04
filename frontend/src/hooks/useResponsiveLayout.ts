import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (notify) => {
      const media = window.matchMedia(query);
      media.addEventListener('change', notify);
      return () => media.removeEventListener('change', notify);
    },
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
    () => false,
  );
}

export function useResponsiveLayout() {
  const isPhone = useMediaQuery('(max-width: 767px)');
  const isCompact = useMediaQuery('(max-width: 1023px)');
  return { isPhone, isTablet: isCompact && !isPhone, isCompact };
}
