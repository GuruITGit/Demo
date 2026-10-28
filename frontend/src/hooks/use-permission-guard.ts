import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';

/**
 * Redirects to /dashboard if user lacks the required permission.
 * Returns true if user has access, false otherwise.
 * Call at the top of a page component, before other state/queries.
 */
export function usePermissionGuard(permission: string): boolean {
  const router = useRouter();
  const { hasPermission, isAuthenticated } = useAuthStore();
  const allowed = hasPermission(permission);

  useEffect(() => {
    if (isAuthenticated && !allowed) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, allowed, router]);

  return allowed;
}
