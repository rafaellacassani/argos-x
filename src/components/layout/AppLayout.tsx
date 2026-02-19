import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { TopBar } from "./TopBar";
import { useWorkspaceAccess } from "@/hooks/useWorkspaceAccess";
import { WorkspaceBlockedScreen } from "./WorkspaceBlockedScreen";
import { TrialBanner } from "./TrialBanner";
import { Loader2 } from "lucide-react";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { allowed, reason, daysRemaining, loading } = useWorkspaceAccess();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!allowed) {
    return <WorkspaceBlockedScreen reason={reason as "blocked" | "canceled" | "past_due"} />;
  }

  const showTrialBanner =
    (reason === "trialing" || reason === "trial_manual") &&
    daysRemaining !== null &&
    daysRemaining <= 3;

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar />
        {showTrialBanner && <TrialBanner daysRemaining={daysRemaining} />}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
