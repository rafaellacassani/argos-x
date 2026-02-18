import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { supabase } from '@/integrations/supabase/client';

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
}

export function useUserRole(): UserRoleData {
  const { user } = useAuth();
  const { membership } = useWorkspace();
  const [userProfileId, setUserProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const role: AppRole = (membership?.role as AppRole) || 'seller';

  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user) {
        setUserProfileId(null);
        setLoading(false);
        return;
      }
      
      const { data } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      setUserProfileId(data?.id || null);
      setLoading(false);
    };

    fetchProfileId();
  }, [user]);

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
    canDeleteLeads: isAdminOrManager,
    canDeleteContacts: isAdminOrManager,
    canManageIntegrations: isAdmin,
    canManageWhatsApp: true, // all roles can manage WhatsApp
  };
}
