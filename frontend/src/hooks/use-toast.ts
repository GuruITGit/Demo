'use client';
import { useState, useCallback } from 'react';
import type { ToastVariant } from '@/components/ui/toast';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  open: boolean;
}

let globalToast: ((title: string, opts?: { description?: string; variant?: ToastVariant }) => void) | null = null;

export function registerToast(fn: typeof globalToast) {
  globalToast = fn;
}

export function toast(title: string, opts?: { description?: string; variant?: ToastVariant }) {
  if (globalToast) globalToast(title, opts);
}
toast.success = (title: string, description?: string) => toast(title, { variant: 'success', description });
toast.error = (title: string, description?: string) => toast(title, { variant: 'error', description });
toast.info = (title: string, description?: string) => toast(title, { variant: 'default', description });

export function useToastState() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((title: string, opts?: { description?: string; variant?: ToastVariant }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, title, description: opts?.description, variant: opts?.variant || 'default', open: true }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => t.id === id ? { ...t, open: false } : t));
  }, []);

  return { toasts, addToast, dismissToast };
}
