'use client';
import { useAuthStore } from '@/stores/auth.store';

interface Props {
  permission: string;
  children: React.ReactNode;
}

export function PermissionGate({ permission, children }: Props) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  if (!hasPermission(permission)) return null;
  return <>{children}</>;
}
