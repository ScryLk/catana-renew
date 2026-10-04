import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { dark } from '@clerk/themes';
import './index.css';
import App from './App.tsx';

const CLERK_PUBLISHABLE_KEY =
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  import.meta.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const isClerkConfigured =
  Boolean(CLERK_PUBLISHABLE_KEY) &&
  (CLERK_PUBLISHABLE_KEY.startsWith('pk_test_') || CLERK_PUBLISHABLE_KEY.startsWith('pk_live_')) &&
  !CLERK_PUBLISHABLE_KEY.includes('placeholder');

// Salvaguarda de Interface: Remocao ativa de marcadores e badges de desenvolvimento injetados por SDKs
if (typeof window !== 'undefined') {
  const devBadgeSelectors = [
    '.clerk-internal-development-badge',
    '[data-clerk-dev-badge]',
    '#clerk-dev-badge',
    '.clerk-dev-mode-badge',
    'cl-development-badge',
    '.cl-development-badge',
    '.cl-internal-development-badge',
    '.cl-developmentBadge',
    '[data-localization-key="developmentMode"]',
  ];

  const purgeDevMarkers = () => {
    try {
      devBadgeSelectors.forEach((selector) => {
        document.querySelectorAll(selector).forEach((el) => {
          (el as HTMLElement).style.setProperty('display', 'none', 'important');
          (el as HTMLElement).style.setProperty('visibility', 'hidden', 'important');
          (el as HTMLElement).style.setProperty('opacity', '0', 'important');
          el.remove();
        });
      });
    } catch {
      // Ignora eventuais restricoes de seletores
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', purgeDevMarkers);
  } else {
    purgeDevMarkers();
  }

  const observer = new MutationObserver(purgeDevMarkers);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isClerkConfigured ? (
      <ClerkProvider
        publishableKey={CLERK_PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: '#FFFFFF',
            colorBackground: '#121214',
            colorText: '#F5F1EA',
          },
        }}
      >
        <App />
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>
);

