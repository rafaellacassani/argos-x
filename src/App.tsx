import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AppLayout } from "@/components/layout/AppLayout";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Chats from "./pages/Chats";
import AIAgents from "./pages/AIAgents";
import SalesBots from "./pages/SalesBots";
import SalesBotBuilder from "./pages/SalesBotBuilder";
import CalendarPage from "./pages/CalendarPage";
import Contacts from "./pages/Contacts";
import Email from "./pages/Email";
import Statistics from "./pages/Statistics";
import Campaigns from "./pages/Campaigns";
import Settings from "./pages/Settings";
import Configuracoes from "./pages/Configuracoes";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";

const queryClient = new QueryClient();

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public page - no layout */}
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            
            {/* App pages with layout */}
            <Route path="/*" element={
              <AppLayout>
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/leads" element={<Leads />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/ai-agents" element={<AIAgents />} />
                  <Route path="/salesbots" element={<SalesBots />} />
                  <Route path="/salesbots/builder" element={<SalesBotBuilder />} />
                  <Route path="/salesbots/builder/:id" element={<SalesBotBuilder />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/contacts" element={<Contacts />} />
                  <Route path="/email" element={<Email />} />
                  <Route path="/statistics" element={<Statistics />} />
                  <Route path="/campaigns" element={<Campaigns />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/configuracoes" element={<Configuracoes />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </AppLayout>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;
