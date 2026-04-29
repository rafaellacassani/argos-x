import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider } from "@/hooks/useAuth";
import { WorkspaceProvider } from "@/hooks/useWorkspace";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { PermissionGuard } from "@/components/layout/PermissionGuard";
import { PlanGate } from "@/components/layout/PlanGate";
import { PageAccessGuard } from "@/components/layout/PageAccessGuard";
import { AppLayout } from "@/components/layout/AppLayout";
import { MetaPixelLoader } from "@/components/settings/MetaPixelLoader";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Auth = lazy(() => import("./pages/Auth"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
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
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CreateWorkspace = lazy(() => import("./pages/CreateWorkspace"));
const AguardandoAtivacao = lazy(() => import("./pages/AguardandoAtivacao"));
const AdminMindMap = lazy(() => import("./pages/AdminMindMap"));
const ProjectDocs = lazy(() => import("./pages/ProjectDocs"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const Planos = lazy(() => import("./pages/Planos"));
const AdminClients = lazy(() => import("./pages/AdminClients"));
const Treinamento = lazy(() => import("./pages/Treinamento"));
const AgentTrainingDoc = lazy(() => import("./pages/AgentTrainingDoc"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const CadastroSucesso = lazy(() => import("./pages/CadastroSucesso"));
const CadastroEscala47 = lazy(() => import("./pages/CadastroEscala47"));
const TourGuiado = lazy(() => import("./pages/TourGuiado"));
const WhatsAppTemplates = lazy(() => import("./pages/WhatsAppTemplates"));
const SupportAdmin = lazy(() => import("./pages/SupportAdmin"));
const ClientsPage = lazy(() => import("./pages/ClientsPage"));
const TeamChat = lazy(() => import("./pages/TeamChat"));
const Departments = lazy(() => import("./pages/Departments"));
const Campanhas = lazy(() => import("./pages/Campanhas"));

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
              <MetaPixelLoader />
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public pages */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/login" element={<Auth />} />
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
                  <Route path="/terms" element={<TermsOfService />} />
                  <Route path="/cadastro" element={<Cadastro />} />
                  <Route path="/cadastro/sucesso" element={<CadastroSucesso />} />
                  <Route path="/escala-47" element={<CadastroEscala47 />} />
                  {/* Página oculta — kit de campanhas Meta Ads (sem layout, não indexada) */}
                  <Route path="/campanhas" element={<Campanhas />} />
                  {/* Rota antiga consolidada — redireciona para a nova área unificada */}
                  <Route path="/admin/panel" element={<Navigate to="/admin/clients" replace />} />
                  <Route path="/create-workspace" element={
                    <ProtectedRoute skipWorkspaceCheck>
                      <CreateWorkspace />
                    </ProtectedRoute>
                  } />
                  <Route path="/aguardando-ativacao" element={
                    <ProtectedRoute skipWorkspaceCheck>
                      <AguardandoAtivacao />
                    </ProtectedRoute>
                  } />
                  
                  {/* Protected app pages with layout */}
                  <Route path="/home" element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Index />
                        </Suspense>
                      </AppLayout>
                    </ProtectedRoute>
                  } />
                  <Route path="/*" element={
                    <ProtectedRoute>
                      <AppLayout>
                        <Suspense fallback={<PageLoader />}>
                          <Routes>
                            <Route path="/dashboard" element={<PageAccessGuard path="/dashboard"><Dashboard /></PageAccessGuard>} />
                            <Route path="/leads" element={<PageAccessGuard path="/leads"><Leads /></PageAccessGuard>} />
                            <Route path="/chats" element={<PageAccessGuard path="/chats"><Chats /></PageAccessGuard>} />
                            <Route path="/ai-agents" element={<PageAccessGuard path="/ai-agents"><AIAgents /></PageAccessGuard>} />
                            <Route path="/salesbots" element={<PageAccessGuard path="/salesbots"><PermissionGuard permission="canManageSalesBots"><SalesBots /></PermissionGuard></PageAccessGuard>} />
                            <Route path="/salesbots/builder" element={<PageAccessGuard path="/salesbots"><PermissionGuard permission="canManageSalesBots"><SalesBotBuilder /></PermissionGuard></PageAccessGuard>} />
                            <Route path="/salesbots/builder/:id" element={<PageAccessGuard path="/salesbots"><PermissionGuard permission="canManageSalesBots"><SalesBotBuilder /></PermissionGuard></PageAccessGuard>} />
                            <Route path="/calendar" element={<PageAccessGuard path="/calendar"><PlanGate blockedPlans={["essencial"]} feature="Calendário" minPlan="Negócio"><CalendarPage /></PlanGate></PageAccessGuard>} />
                            <Route path="/contacts" element={<PageAccessGuard path="/contacts"><Contacts /></PageAccessGuard>} />
                            <Route path="/email" element={<PageAccessGuard path="/email"><PlanGate blockedPlans={["essencial"]} feature="Email" minPlan="Negócio"><Email /></PlanGate></PageAccessGuard>} />
                            <Route path="/statistics" element={<PageAccessGuard path="/statistics"><Statistics /></PageAccessGuard>} />
                            <Route path="/campaigns" element={<PageAccessGuard path="/campaigns"><PermissionGuard permission="canManageCampaigns"><Campaigns /></PermissionGuard></PageAccessGuard>} />
                            <Route path="/templates" element={<PageAccessGuard path="/campaigns"><PermissionGuard permission="canManageCampaigns"><WhatsAppTemplates /></PermissionGuard></PageAccessGuard>} />
                            <Route path="/settings" element={<PageAccessGuard path="/settings"><Settings /></PageAccessGuard>} />
                            <Route path="/configuracoes" element={<PageAccessGuard path="/configuracoes"><Configuracoes /></PageAccessGuard>} />
                            <Route path="/planos" element={<PageAccessGuard path="/planos"><Planos /></PageAccessGuard>} />
                            <Route path="/admin/clients" element={<AdminClients />} />
                            <Route path="/perfil" element={<ProfileSettings />} />
                            <Route path="/treinamento" element={<PageAccessGuard path="/treinamento"><Treinamento /></PageAccessGuard>} />
                            <Route path="/agent-training" element={<AgentTrainingDoc />} />
                            <Route path="/tour-guiado" element={<TourGuiado />} />
                            <Route path="/suporte" element={<SupportAdmin />} />
                            <Route path="/clients" element={<ClientsPage />} />
                            <Route path="/equipe" element={<TeamChat />} />
                            <Route path="/departamentos" element={<PageAccessGuard path="/ai-agents"><Departments /></PageAccessGuard>} />
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
