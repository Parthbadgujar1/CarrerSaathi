import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { queryClient } from './queryClient';
import { AppRoutes } from './routes';
import { useAuth } from '../store/auth.store';
import { captureUtm } from '../lib/utm';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { CookieBanner, CookieSettings } from '../components/common/CookieConsent';
import { CommandPalette } from '../components/common/CommandPalette';
import { OfflineBanner, SkipLink } from '../components/common/SiteChrome';

export function App() {
  const bootstrap = useAuth((s) => s.bootstrap);
  useEffect(() => {
    captureUtm();
    bootstrap();
  }, [bootstrap]);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <SkipLink />
          <AppRoutes />
          <CommandPalette />
          <CookieBanner />
          <CookieSettings />
          <OfflineBanner />
          <Toaster position="top-center" toastOptions={{ className: 'toast', duration: 4000 }} />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
