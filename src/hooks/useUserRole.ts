import { useWorkspace } from './useWorkspace';

export type AppRole = 'admin' | 'manager' | 'seller';

interface UserRoleData {
  role: AppRole;
  userProfileId: string | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSeller: boolean;
  isAdminOrManager: boolean;
  canDeleteLeads: boolean;
  canDeleteContacts: boolean;
  canManageIntegrations: boolean;
  canManageWhatsApp: boolean;
  canManageSalesBots: boolean;
  canManageAutoTags: boolean;
  canManageCampaigns: boolean;
  canManageTeam: boolean;
  canManageWorkspaceSettings: boolean;
  canViewAllLeads: boolean;
  canReassignLeads: boolean;
}

export function useUserRole(): UserRoleData {
  const { membership, userProfileId, loading } = useWorkspace();

  const role: AppRole = (membership?.role as AppRole) || 'seller';

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isSeller = role === 'seller';
  const isAdminOrManager = isAdmin || isManager;

  return {
    role,
    userProfileId,
    loading,
    isAdmin,
    isManager,
    isSeller,
    isAdminOrManager,
    canDeleteLeads: isAdmin,
    canDeleteContacts: isAdmin,
    canManageIntegrations: isAdmin,
    canManageWhatsApp: true,
    canManageSalesBots: isAdminOrManager,
    canManageAutoTags: isAdminOrManager,
    canManageCampaigns: isAdminOrManager,
    canManageTeam: isAdmin,
    canManageWorkspaceSettings: isAdmin,
    canViewAllLeads: isAdminOrManager,
    canReassignLeads: isAdminOrManager,
  };
}
