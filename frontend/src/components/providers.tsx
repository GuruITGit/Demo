'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { ToastProvider, ToastViewport, Toast, ToastTitle, ToastDescription } from '@/components/ui/toast';
import { useToastState, registerToast } from '@/hooks/use-toast';
import { AccessibilityProvider } from '@/contexts/accessibility.context';

function ToastContainer() {
  const { toasts, addToast, dismissToast } = useToastState();

  useEffect(() => {
    registerToast(addToast);
  }, [addToast]);

  return (
    <ToastProvider>
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant} open={t.open} onOpenChange={(open) => !open && dismissToast(t.id)}>
          <ToastTitle>{t.title}</ToastTitle>
          {t.description && <ToastDescription>{t.description}</ToastDescription>}
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { retry: 1, staleTime: 30000, refetchOnWindowFocus: false },
    },
  }));

  return (
    <AccessibilityProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <ToastContainer />
      </QueryClientProvider>
    </AccessibilityProvider>
  );
}
