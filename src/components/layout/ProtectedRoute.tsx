import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  skipWorkspaceCheck?: boolean;
}

export function ProtectedRoute({ children, skipWorkspaceCheck }: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { hasWorkspace, loading: wsLoading } = useWorkspace();

  if (authLoading || wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!skipWorkspaceCheck && !hasWorkspace) {
    return <Navigate to="/create-workspace" replace />;
  }

  return <>{children}</>;
}
