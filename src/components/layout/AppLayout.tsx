import { ReactNode, useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { useWorkspace } from "@/hooks/useWorkspace";
import { WorkspaceBlockedScreen } from "./WorkspaceBlockedScreen";
import { TrialBanner } from "./TrialBanner";
import { LeadLimitBanner } from "./LeadLimitBanner";
import { GuidedTourOverlay } from "@/components/tour/GuidedTourOverlay";
import { SupportChatWidget } from "@/components/support/SupportChatWidget";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { allowed, reason, daysRemaining, loading } = useWorkspaceAccess();
  const { workspace, refreshWorkspace, isAdminViewing } = useWorkspace();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [tourActive, setTourActive] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!loading && workspace && workspace.onboarding_completed === false) {
      setTourActive(true);
    }
  }, [loading, workspace]);

  const handleTourComplete = useCallback(() => {
    setTourActive(false);
    refreshWorkspace();
    navigate("/dashboard", { replace: true });
  }, [refreshWorkspace, navigate]);

  if (!loading && !allowed && !isAdminViewing) {
    return <WorkspaceBlockedScreen reason={reason as "blocked" | "canceled" | "past_due"} />;
  }

  const showTrialBanner =
    !loading &&
    (reason === "trialing" || reason === "trial_manual") &&
    daysRemaining !== null &&
    daysRemaining <= 3;

  const mobileMenuSlot = isMobile ? (
    <button
      onClick={() => setMobileOpen(true)}
      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex-shrink-0"
      aria-label="Abrir menu"
    >
      <Menu className="w-5 h-5" />
    </button>
  ) : undefined;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar mobileMenuSlot={mobileMenuSlot} />
        {isAdminViewing && (
          <div className="bg-amber-500/10 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-amber-700">
              👁️ Visualizando workspace: <strong>{workspace?.name}</strong> (modo leitura)
            </span>
            <a
              href="/admin/clients"
              className="text-xs text-amber-600 hover:text-amber-800 underline"
            >
              Voltar ao painel
            </a>
          </div>
        )}
        {showTrialBanner && !isAdminViewing && <TrialBanner daysRemaining={daysRemaining} />}
        {!isAdminViewing && <LeadLimitBanner />}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {children}
        </main>
      </div>

      <GuidedTourOverlay
        isActive={tourActive}
        initialStep={workspace?.onboarding_step || 0}
        onComplete={handleTourComplete}
      />
    </div>
  );
}
