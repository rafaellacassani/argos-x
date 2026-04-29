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
import { WorkspaceAssistantWidget } from "@/components/assistant/WorkspaceAssistantWidget";
import { DisconnectedInstanceBanner } from "./DisconnectedInstanceBanner";
import { PaymentPendingBanner } from "./PaymentPendingBanner";
import { useInstanceHealth } from "@/hooks/useInstanceHealth";
import { useIsMobile } from "@/hooks/use-mobile";
import { Menu } from "lucide-react";
import { usePlanExcess, isExcessResolvePath } from "@/hooks/usePlanExcess";
import { PlanExcessBlockScreen } from "./PlanExcessBlockScreen";
import { PlanExcessBanner } from "./PlanExcessBanner";
import { AnnualPromoBanner } from "@/components/promo/AnnualPromoBanner";
import { AnnualPromoDialog } from "@/components/promo/AnnualPromoDialog";
import { isPromoActive } from "@/components/promo/promoConfig";

const PROMO_PROTECTED_WORKSPACES = new Set([
  "41efdc6d-d4ba-4589-9761-7438a5911d57", // Argos X
  "6a8540c9-6eb5-42ce-8d20-960002d85bac", // ECX Company
]);

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { allowed, reason, daysRemaining, loading } = useWorkspaceAccess();
  const { workspace, refreshWorkspace, isAdminViewing } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const { disconnected: disconnectedInstances } = useInstanceHealth();
  const { hasExcess, items: excessItems, planName: excessPlanName, loading: excessLoading, refetch: refetchExcess } = usePlanExcess();

  // Re-check excess whenever the route changes — keeps the block in sync after the user
  // removes leads / agents / connections / users from a resolve page.
  useEffect(() => {
    refetchExcess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const [tourActive, setTourActive] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [promoOpen, setPromoOpen] = useState(false);

  // ANNUAL PROMO 2026 — eligibility (frontend gate; server re-validates)
  const promoEligible =
    !!workspace &&
    !isAdminViewing &&
    isPromoActive() &&
    !PROMO_PROTECTED_WORKSPACES.has(workspace.id) &&
    !workspace.blocked_at &&
    !(workspace.annual_promo_expires_at && new Date(workspace.annual_promo_expires_at) > new Date());

  // Auto-open dialog once per session, 3s after eligibility settles
  useEffect(() => {
    if (!promoEligible || loading) return;
    const KEY = "annual_promo_2026_shown";
    if (sessionStorage.getItem(KEY)) return;
    const t = setTimeout(() => {
      sessionStorage.setItem(KEY, "1");
      setPromoOpen(true);
    }, 3000);
    return () => clearTimeout(t);
  }, [promoEligible, loading]);

  useEffect(() => {
    if (!loading && workspace) {
      const neverStarted = !workspace.onboarding_step || workspace.onboarding_step === 0;
      const notCompleted = workspace.onboarding_completed === false;
      const isAllowed = allowed !== false;
      
      if (notCompleted && neverStarted && isAllowed) {
        setTourActive(true);
      } else if (notCompleted && !neverStarted) {
        import("@/integrations/supabase/client").then(({ supabase }) => {
          supabase
            .from("workspaces")
            .update({ onboarding_completed: true })
            .eq("id", workspace.id)
            .then(() => refreshWorkspace());
        });
      }
    }
  }, [loading, workspace, allowed, refreshWorkspace]);

  const handleTourComplete = useCallback(() => {
    setTourActive(false);
    refreshWorkspace();
    navigate("/dashboard", { replace: true });
  }, [refreshWorkspace, navigate]);

  const isPlansPage = location.pathname === "/planos";
  if (!loading && !allowed && !isAdminViewing && !isPlansPage) {
    return <WorkspaceBlockedScreen reason={reason as "blocked" | "canceled" | "past_due"} />;
  }

  // Plan-excess soft block: allow only resolve pages; block everything else with the excess screen.
  const allowResolvePage = isExcessResolvePath(location.pathname);
  const showExcessBlock =
    !loading &&
    !excessLoading &&
    hasExcess &&
    !isAdminViewing &&
    !allowResolvePage;

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
      <AppSidebar
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        onOpenAssistant={() => { setAssistantOpen(true); setSupportOpen(false); }}
        onOpenSupport={() => { setSupportOpen(true); setAssistantOpen(false); }}
      />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar mobileMenuSlot={mobileMenuSlot} />
        {promoEligible && <AnnualPromoBanner onClick={() => setPromoOpen(true)} />}
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
        {hasExcess && !isAdminViewing && (
          <PlanExcessBanner items={excessItems} planName={excessPlanName} />
        )}
        {!isAdminViewing && <LeadLimitBanner />}
        {!isAdminViewing && <DisconnectedInstanceBanner instances={disconnectedInstances} />}
        {!isAdminViewing && <PaymentPendingBanner />}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          {showExcessBlock ? (
            <PlanExcessBlockScreen items={excessItems} planName={excessPlanName} />
          ) : (
            children
          )}
        </main>
      </div>

      <GuidedTourOverlay
        isActive={tourActive}
        initialStep={workspace?.onboarding_step || 0}
        onComplete={handleTourComplete}
      />
      <WorkspaceAssistantWidget open={assistantOpen} onOpenChange={setAssistantOpen} />
      <SupportChatWidget open={supportOpen} onOpenChange={setSupportOpen} />
      {promoEligible && workspace && (
        <AnnualPromoDialog
          open={promoOpen}
          onOpenChange={setPromoOpen}
          workspaceId={workspace.id}
          planName={workspace.plan_name}
        />
      )}
    </div>
  );
}
