import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import argosIcon from "@/assets/argos-icon.png";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  highlight?: boolean;
  requiredPermission?: 'canManageSalesBots' | 'canManageCampaigns' | 'canManageIntegrations' | 'canManageWorkspaceSettings';
}

const menuItems: MenuItem[] = [
  { icon: Home, label: "Início", path: "/" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Users, label: "Funil de Vendas", path: "/leads" },
  { icon: MessageCircle, label: "Chats", path: "/chats" },
  { icon: Bot, label: "Agentes de IA", path: "/ai-agents" },
  { icon: Workflow, label: "SalesBots", path: "/salesbots", requiredPermission: 'canManageSalesBots' },
  { icon: Calendar, label: "Calendário", path: "/calendar" },
  { icon: Contact, label: "Contatos", path: "/contacts" },
  { icon: Mail, label: "Email", path: "/email" },
  { icon: BarChart3, label: "Estatísticas", path: "/statistics" },
  { icon: Megaphone, label: "Campanhas", path: "/campaigns", requiredPermission: 'canManageCampaigns' },
  { icon: Plug, label: "Integrações", path: "/settings", highlight: true },
  { icon: Settings, label: "Configurações", path: "/configuracoes" },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { workspace } = useWorkspace();
  const permissions = useUserRole();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="sticky top-0 h-screen bg-sidebar flex flex-col border-r border-sidebar-border flex-shrink-0"
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-sidebar-border">
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center">
            <img src={argosIcon} alt="Argos X" className="w-10 h-10 object-contain" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col"
              >
                <span className="font-display font-bold text-lg text-sidebar-foreground leading-tight">
                  {workspace?.name || "Argos X"}
                </span>
                <span className="text-[10px] font-medium tracking-wide" style={{ color: '#07C3E8' }}>
                  by Mkt Boost
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6 px-3 overflow-y-auto scrollbar-thin">
        <ul className="space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            const isLocked = item.requiredPermission ? !permissions[item.requiredPermission] : false;

            const linkContent = (
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative",
                  isLocked
                    ? "text-white/40 cursor-not-allowed"
                    : isActive
                      ? "bg-sidebar-accent text-white"
                      : "text-white/80 hover:bg-sidebar-accent/50 hover:text-white",
                  item.highlight && !isActive && !isLocked && "bg-sidebar-primary/20 border border-sidebar-primary/30"
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
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.2 }}
                      className="font-medium text-sm flex-1"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
                {isLocked && !collapsed && (
                  <Lock className="w-3.5 h-3.5 text-white/40 flex-shrink-0" />
                )}
              </div>
            );

            if (isLocked) {
              return (
                <li key={item.path}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      {linkContent}
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      Disponível apenas para administradores
                    </TooltipContent>
                  </Tooltip>
                </li>
              );
            }

            return (
              <li key={item.path}>
                <NavLink to={item.path}>
                  {linkContent}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Collapse Button */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sidebar-muted hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-all duration-200"
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-sm font-medium"
              >
                Recolher
              </motion.span>
            </>
          )}
        </button>
      </div>
    </motion.aside>
  );
}
