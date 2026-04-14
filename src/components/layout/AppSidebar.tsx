import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  LayoutDashboard,
  Users,
  MessageCircle,
  Bot,
  Workflow,
  Calendar,
  Contact,
  Mail,
  BarChart3,
  Megaphone,
  
  Plug,
  Settings,
  ChevronLeft,
  ChevronRight,
  Lock,
  Crown,
  Shield,
  GraduationCap,
  BookOpen,
  Map,
  X,
  Headset,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import argosIcon from "@/assets/argos-icon.png";
import argosLogoDarkHorizontal from "@/assets/argos-logo-dark-horizontal.png";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useUserRole } from "@/hooks/useUserRole";
import { useMemberPermissions } from "@/hooks/useMemberPermissions";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ChevronsUpDown } from "lucide-react";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  highlight?: boolean;
  requiredPermission?: 'canManageSalesBots' | 'canManageCampaigns' | 'canManageIntegrations' | 'canManageWorkspaceSettings';
  /** Plans where this item is locked */
  blockedPlans?: string[];
}

const menuItems: MenuItem[] = [
  { icon: Home, label: "Início", path: "/" },
  { icon: Plug, label: "Conexões", path: "/settings", highlight: true },
  { icon: Bot, label: "Agentes de IA", path: "/ai-agents" },
  { icon: MessageCircle, label: "Chats", path: "/chats" },
  { icon: LayoutDashboard, label: "Painel de Dados", path: "/dashboard" },
  { icon: Users, label: "Funil de Vendas", path: "/leads" },
  { icon: Contact, label: "Contatos", path: "/contacts" },
  { icon: Calendar, label: "Calendário", path: "/calendar", blockedPlans: ["essencial"] },
  { icon: Workflow, label: "SalesBots", path: "/salesbots", requiredPermission: 'canManageSalesBots' },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", requiredPermission: 'canManageCampaigns' },
  { icon: Mail, label: "Email", path: "/email", blockedPlans: ["essencial"] },
  { icon: BarChart3, label: "Estatísticas", path: "/statistics" },
  { icon: Crown, label: "Planos", path: "/planos" },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

function SidebarNavContent({
  visibleItems,
  collapsed,
  permissions,
  canAccessPage,
  planName,
  onNavigate,
}: {
  visibleItems: MenuItem[];
  collapsed: boolean;
  permissions: ReturnType<typeof useUserRole>;
  canAccessPage: (path: string) => boolean;
  planName: string;
  onNavigate?: () => void;
}) {
  const location = useLocation();

  return (
    <ul className="space-y-1">
      {visibleItems.filter((item) => canAccessPage(item.path)).map((item) => {
        const isActive = location.pathname === item.path;
        const isPermLocked = item.requiredPermission ? !permissions[item.requiredPermission] : false;
        const isPlanLocked = item.blockedPlans?.includes(planName) ?? false;
        const isLocked = isPermLocked || isPlanLocked;

        const linkContent = (
          <div
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
              isLocked
                ? "text-white/40 cursor-not-allowed"
                : isActive
                  ? "bg-sidebar-accent text-white"
                  : "text-white/80 hover:bg-sidebar-accent/50 hover:text-white",
              item.highlight && !isActive && !isLocked && "bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-600/40"
            )}
          >
            {isActive && !isLocked && (
              <motion.div
                layoutId="activeIndicator"
                className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-sidebar-primary rounded-r-full"
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            )}
            <item.icon
              className={cn(
                "w-5 h-5 flex-shrink-0 transition-colors",
                isLocked
                  ? "text-white/40"
                  : isActive ? "text-sidebar-primary" : "text-white/80 group-hover:text-white"
              )}
            />
            {!collapsed && (
              <span className="font-medium text-sm flex-1">{item.label}</span>
            )}
            {isLocked && !collapsed && (
              <Lock className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
            )}
          </div>
        );

        if (isLocked) {
          const tooltipMsg = isPlanLocked
            ? "Disponível a partir do plano Negócio"
            : "Disponível apenas para administradores";
          return (
            <li key={item.path}>
              <Tooltip>
                <TooltipTrigger asChild>{isPlanLocked ? <NavLink to={item.path}>{linkContent}</NavLink> : linkContent}</TooltipTrigger>
                <TooltipContent side="right">{tooltipMsg}</TooltipContent>
              </Tooltip>
            </li>
          );
        }

        return (
          <li key={item.path}>
            <NavLink to={item.path} onClick={onNavigate}>{linkContent}</NavLink>
          </li>
        );
      })}
    </ul>
  );
}

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

export function AppSidebar({ mobileOpen = false, onMobileOpenChange }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const location = useLocation();
  const { workspace, allWorkspaces, switchWorkspace } = useWorkspace();
  const { user } = useAuth();
  const permissions = useUserRole();
  const { canAccessPage } = useMemberPermissions();
  const { planName } = usePlanLimits();
  const isMobile = useIsMobile();

  // Close mobile drawer on navigation
  useEffect(() => {
    onMobileOpenChange?.(false);
  }, [location.pathname]);

  useEffect(() => {
    const checkSuperAdmin = async () => {
      if (!user) { setIsSuperAdmin(false); return; }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin");
      setIsSuperAdmin(!!(data && data.length > 0));
    };
    checkSuperAdmin();
  }, [user]);

  const visibleItems: MenuItem[] = [
    ...menuItems,
    // Available for all admins
    { icon: GraduationCap, label: "Treinamento", path: "/treinamento" } as MenuItem,
    ...(permissions.isAdmin ? [
      { icon: Headset, label: "Suporte", path: "/suporte" } as MenuItem,
      { icon: Map, label: "Tour Guiado", path: "/tour-guiado" } as MenuItem,
    ] : []),
    // Super admin only
    ...(isSuperAdmin ? [
      { icon: Shield, label: "Admin Clientes", path: "/admin/clients" } as MenuItem,
      { icon: Building2, label: "Clientes ECX", path: "/clients" } as MenuItem,
      { icon: BookOpen, label: "Doc Agente IA", path: "/agent-training" } as MenuItem,
    ] : []),
  ];

  const canSwitch = isSuperAdmin && allWorkspaces.length > 1;

  const workspaceBlock = (showLabel: boolean) => {
    if (!workspace) return null;

    const wsContent = (
      <div className={cn("flex items-center", showLabel ? "gap-3 w-full" : "justify-center")}>
        {workspace.logo_url ? (
          <img src={workspace.logo_url} alt={workspace.name} className="w-8 h-8 rounded-lg object-contain bg-white/10 border border-white/10 flex-shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-sidebar-primary">{workspace.name.charAt(0).toUpperCase()}</span>
          </div>
        )}
        {showLabel && (
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-white/50 leading-tight">Workspace</p>
            <p className="text-sm font-semibold text-white truncate leading-tight">{workspace.name}</p>
          </div>
        )}
        {showLabel && canSwitch && (
          <ChevronsUpDown className="w-4 h-4 text-white/40 flex-shrink-0" />
        )}
      </div>
    );

    if (!canSwitch) {
      return (
        <div className={cn("border-b border-sidebar-border flex-shrink-0", showLabel ? "px-4 py-3" : "flex justify-center py-3")}>
          {wsContent}
        </div>
      );
    }

    return (
      <div className={cn("border-b border-sidebar-border flex-shrink-0", showLabel ? "" : "flex justify-center py-3")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(
              "w-full text-left transition-colors hover:bg-white/5",
              showLabel ? "px-4 py-3" : ""
            )}>
              {wsContent}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="start" className="w-[248px]">
            {allWorkspaces.map((ws) => (
              <DropdownMenuItem
                key={ws.id}
                onClick={() => switchWorkspace(ws.id)}
                className={cn(
                  "flex items-center gap-3 cursor-pointer",
                  ws.id === workspace.id && "bg-accent"
                )}
              >
                {ws.logo_url ? (
                  <img src={ws.logo_url} alt={ws.name} className="w-6 h-6 rounded object-contain bg-muted flex-shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-primary">{ws.name.charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <span className="truncate text-sm">{ws.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  };

  // ─── MOBILE: Sheet drawer ───
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
        <SheetContent side="left" className="w-[280px] p-0 bg-sidebar border-sidebar-border [&>button]:hidden flex flex-col h-full">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <div className="flex items-center justify-between h-14 px-4 border-b border-sidebar-border flex-shrink-0">
            <img src={argosLogoDarkHorizontal} alt="Argos X" className="h-8 object-contain" />
            <button onClick={() => onMobileOpenChange?.(false)} className="p-1 rounded-lg text-white/60 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          {workspaceBlock(true)}
          <nav className="flex-1 py-4 px-3 overflow-y-auto min-h-0 scrollbar-thin">
            <SidebarNavContent visibleItems={visibleItems} collapsed={false} permissions={permissions} canAccessPage={canAccessPage} planName={planName} onNavigate={() => onMobileOpenChange?.(false)} />
          </nav>
        </SheetContent>
      </Sheet>
    );
  }

  // ─── DESKTOP: Normal sidebar ───
  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 h-screen bg-sidebar flex flex-col border-r border-sidebar-border flex-shrink-0"
    >
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <motion.div initial={false} animate={{ opacity: 1 }} className="flex items-center gap-3">
          {collapsed ? (
            <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
              <img src={argosIcon} alt="Argos X" className="w-10 h-10 object-contain" />
            </div>
          ) : (
            <img src={argosLogoDarkHorizontal} alt="Argos X" className="h-9 object-contain" />
          )}
        </motion.div>
      </div>
      {workspaceBlock(!collapsed)}
      <nav className="flex-1 py-6 px-3 overflow-y-auto scrollbar-thin">
        <SidebarNavContent visibleItems={visibleItems} collapsed={collapsed} permissions={permissions} canAccessPage={canAccessPage} planName={planName} />
      </nav>
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Recolher</span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
