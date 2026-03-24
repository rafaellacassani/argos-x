import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useMemberPermissions } from '@/hooks/useMemberPermissions';
import { Loader2 } from 'lucide-react';

interface PageAccessGuardProps {
  children: ReactNode;
  path: string;
}

export function PageAccessGuard({ children, path }: PageAccessGuardProps) {
  const { canAccessPage, loading, isAdmin } = useMemberPermissions();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin && !canAccessPage(path)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
