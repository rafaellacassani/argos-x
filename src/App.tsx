import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { PermissionGuard } from "@/components/layout/PermissionGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const Index = lazy(() => import("./pages/Index"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Leads = lazy(() => import("./pages/Leads"));
const Chats = lazy(() => import("./pages/Chats"));
const AIAgents = lazy(() => import("./pages/AIAgents"));
const SalesBots = lazy(() => import("./pages/SalesBots"));
const SalesBotBuilder = lazy(() => import("./pages/SalesBotBuilder"));
const CalendarPage = lazy(() => import("./pages/CalendarPage"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Email = lazy(() => import("./pages/Email"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Settings = lazy(() => import("./pages/Settings"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CreateWorkspace = lazy(() => import("./pages/CreateWorkspace"));
const AdminMindMap = lazy(() => import("./pages/AdminMindMap"));
const ProjectDocs = lazy(() => import("./pages/ProjectDocs"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Planos = lazy(() => import("./pages/Planos"));
const AdminClients = lazy(() => import("./pages/AdminClients"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000,   // 10 minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <WorkspaceProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public pages */}
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/auth/reset-password" element={<ResetPassword />} />
                  <Route path="/admin/mindmap" element={
                    <ProtectedRoute skipWorkspaceCheck>
                      <AdminMindMap />
                    </ProtectedRoute>
                  } />
                  <Route path="/project-docs" element={
                    <ProtectedRoute skipWorkspaceCheck>
                      <ProjectDocs />
                    </ProtectedRoute>
                  } />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/admin/panel" element={
                    <ProtectedRoute skipWorkspaceCheck>
                      <AdminPanel />
                    </ProtectedRoute>
                  } />
                  <Route path="/create-workspace" element={
                    <ProtectedRoute skipWorkspaceCheck>
                      <CreateWorkspace />
                    </ProtectedRoute>
                  } />
                  
                  {/* Protected app pages with layout */}
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/" element={<Index />} />
                            <Route path="/dashboard" element={<Dashboard />} />
                            <Route path="/leads" element={<Leads />} />
                            <Route path="/chats" element={<Chats />} />
                            <Route path="/ai-agents" element={<AIAgents />} />
                            <Route path="/salesbots" element={<PermissionGuard permission="canManageSalesBots"><SalesBots /></PermissionGuard>} />
                            <Route path="/salesbots/builder" element={<PermissionGuard permission="canManageSalesBots"><SalesBotBuilder /></PermissionGuard>} />
                            <Route path="/salesbots/builder/:id" element={<PermissionGuard permission="canManageSalesBots"><SalesBotBuilder /></PermissionGuard>} />
                            <Route path="/calendar" element={<CalendarPage />} />
                            <Route path="/contacts" element={<Contacts />} />
                            <Route path="/email" element={<Email />} />
                            <Route path="/statistics" element={<Statistics />} />
                            <Route path="/campaigns" element={<PermissionGuard permission="canManageCampaigns"><Campaigns /></PermissionGuard>} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/configuracoes" element={<Configuracoes />} />
                            <Route path="/planos" element={<Planos />} />
                            <Route path="/admin/clients" element={<AdminClients />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </Suspense>
                      </AppLayout>
                    </ProtectedRoute>
                  } />
                </Routes>
              </Suspense>
            </WorkspaceProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
