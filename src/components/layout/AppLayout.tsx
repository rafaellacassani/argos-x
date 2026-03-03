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

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { allowed, reason, daysRemaining, loading } = useWorkspaceAccess();
  const { workspace, refreshWorkspace } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const [tourActive, setTourActive] = useState(false);

  // Activate tour if onboarding not completed
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

  // Non-blocking: show layout immediately, only block if explicitly not allowed
  if (!loading && !allowed) {
    return <WorkspaceBlockedScreen reason={reason as "blocked" | "canceled" | "past_due"} />;
  }

  const showTrialBanner =
    !loading &&
    (reason === "trialing" || reason === "trial_manual") &&
    daysRemaining !== null &&
    daysRemaining <= 3;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        {showTrialBanner && <TrialBanner daysRemaining={daysRemaining} />}
        <LeadLimitBanner />
        <main className="flex-1 overflow-auto p-6">
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
