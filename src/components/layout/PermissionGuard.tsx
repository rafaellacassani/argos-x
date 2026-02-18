import { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

interface PermissionGuardProps {
  children: ReactNode;
  permission: 'canManageSalesBots' | 'canManageCampaigns' | 'canManageIntegrations' | 'canManageWorkspaceSettings' | 'canManageTeam';
}

export function PermissionGuard({ children, permission }: PermissionGuardProps) {
  const permissions = useUserRole();

  if (!permissions[permission]) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-muted-foreground">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Acesso restrito</h2>
        <p className="text-sm">Disponível apenas para administradores</p>
      </div>
    );
  }

  return <>{children}</>;
}
