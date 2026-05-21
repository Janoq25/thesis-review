'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useTheme } from 'next-themes';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import { useState } from 'react';
import { I18nProvider } from '@/lib/i18n/context';

function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Toaster
      position="top-right"
      richColors
      closeButton
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            retry: (failureCount, error: unknown) => {
              const status = (error as { response?: { status?: number } })?.response?.status;
              if (status && [401, 403, 404].includes(status)) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          {children}
          <ThemedToaster />
          <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
