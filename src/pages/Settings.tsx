import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Phone,
  Instagram,
  Facebook,
  Calendar,
  Video,
  Globe,
  RefreshCw,
  Smartphone,
  QrCode,
  Link2,
  AlertCircle,
  Wifi,
  WifiOff,
  Trash2,
  Plus,
  Tag,
  Loader2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ConnectionModal } from "@/components/whatsapp/ConnectionModal";
import { AutoTagRules } from "@/components/settings/AutoTagRules";
import { useEvolutionAPI, type EvolutionInstance } from "@/hooks/useEvolutionAPI";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useUserRole } from "@/hooks/useUserRole";

type MetaPage = Tables<"meta_pages">;

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  available: boolean;
  connectedCount?: number;
  phoneNumber?: string | null;
  metaPages?: MetaPage[];
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "open":
    case "connected":
      return "bg-success/10 text-success border-success/20";
    case "close":
    case "disconnected":
      return "bg-warning/10 text-warning border-warning/20";
    case "connecting":
      return "bg-primary/10 text-primary border-primary/20";
    case "error":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "open":
    case "connected":
      return "Conectado";
    case "close":
    case "disconnected":
      return "Desconectado";
    case "connecting":
      return "Conectando...";
    case "error":
      return "Erro";
    default:
      return status;
  }
};

const formatPhoneNumber = (ownerJid: string | undefined) => {
  if (!ownerJid) return null;
  // ownerJid vem no formato: 5511999999999@s.whatsapp.net
  const number = ownerJid.replace(/@s\.whatsapp\.net$/, "");
  // Formatar: +55 (11) 99999-9999
  if (number.length === 13) {
    return `+${number.slice(0, 2)} (${number.slice(2, 4)}) ${number.slice(4, 9)}-${number.slice(9)}`;
  }
  if (number.length === 12) {
    return `+${number.slice(0, 2)} (${number.slice(2, 4)}) ${number.slice(4, 8)}-${number.slice(8)}`;
  }
  return `+${number}`;
};

export default function Settings() {
  const { canManageIntegrations, canManageWhatsApp, isSeller } = useUserRole();
  const [activeTab, setActiveTab] = useState("integrations");
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [metaPages, setMetaPages] = useState<MetaPage[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [connectingMeta, setConnectingMeta] = useState(false);

  const {
    loading,
    listInstances,
    deleteInstance,
    getConnectionState,
  } = useEvolutionAPI();

  // Fetch meta pages on mount
  const fetchMetaPages = async () => {
    setLoadingMeta(true);
    try {
      const { data, error } = await supabase
        .from("meta_pages")
        .select("*")
        .eq("is_active", true);
      
      if (error) throw error;
      setMetaPages(data || []);
    } catch (err) {
      console.error("Error fetching meta pages:", err);
    } finally {
      setLoadingMeta(false);
    }
  };

  // Handle Meta OAuth connection
  const handleConnectMeta = async () => {
    setConnectingMeta(true);
    try {
      const { data, error } = await supabase.functions.invoke("facebook-oauth/url", {
        method: "POST",
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL não recebida");
      }
    } catch (err) {
      console.error("Error connecting to Meta:", err);
      toast({
        title: "Erro ao conectar",
        description: "Não foi possível iniciar a conexão com a Meta.",
        variant: "destructive",
      });
    } finally {
      setConnectingMeta(false);
    }
  };

  // Detect OAuth callback success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const metaConnected = params.get("meta_connected");
    const pagesCount = params.get("pages");
    const errorParam = params.get("error");

    if (metaConnected === "true") {
      toast({
        title: "Conta conectada!",
        description: `${pagesCount || "Suas"} página(s) conectada(s) com sucesso.`,
      });
      // Clear URL params
      window.history.replaceState({}, "", "/settings");
      fetchMetaPages();
    } else if (errorParam) {
      toast({
        title: "Erro na conexão",
        description: decodeURIComponent(errorParam),
        variant: "destructive",
      });
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  useEffect(() => {
    fetchMetaPages();
  }, []);

  // Fetch instances on mount and when tab changes
  const fetchInstances = async () => {
    setLoadingInstances(true);
    try {
      const data = await listInstances();
      // Fetch connection state for each instance
      const instancesWithState = await Promise.all(
        data.map(async (instance) => {
          const state = await getConnectionState(instance.instanceName);
          return {
            ...instance,
            connectionStatus: state?.instance?.state || "close",
          };
        })
      );
      setInstances(instancesWithState);
    } catch (err) {
      console.error("Error fetching instances:", err);
    } finally {
      setLoadingInstances(false);
    }
  };

  useEffect(() => {
    if (activeTab === "whatsapp" || activeTab === "integrations") {
      fetchInstances();
    }
  }, [activeTab]);

  const handleDeleteInstance = async (instanceName: string) => {
    if (!confirm(`Tem certeza que deseja deletar a conexão "${instanceName}"?`)) {
      return;
    }

    const success = await deleteInstance(instanceName);
    if (success) {
      toast({
        title: "Conexão removida",
        description: `A conexão "${instanceName}" foi removida com sucesso.`,
      });
      fetchInstances();
    } else {
      toast({
        title: "Erro ao remover",
        description: "Não foi possível remover a conexão.",
        variant: "destructive",
      });
    }
  };

  const handleRefreshInstance = async (instanceName: string) => {
    const state = await getConnectionState(instanceName);
    setInstances((prev) =>
      prev.map((inst) =>
        inst.instanceName === instanceName
          ? { ...inst, connectionStatus: state?.instance?.state || "close" }
          : inst
      )
    );
    toast({
      title: "Status atualizado",
      description: `Status da conexão "${instanceName}" atualizado.`,
    });
  };

  const connectedInstances = instances.filter(
    (i) => i.connectionStatus === "open"
  );
  const connectedCount = connectedInstances.length;
  const connectedPhone = formatPhoneNumber(connectedInstances[0]?.ownerJid);

  const integrations: Integration[] = [
    {
      id: "whatsapp-business",
      name: "WhatsApp Business",
      description: "Conecte via QR Code",
      icon: <MessageCircle className="w-6 h-6 text-green-500" />,
      connected: connectedCount > 0,
      phoneNumber: connectedPhone,
      available: true,
      connectedCount,
    },
    {
      id: "whatsapp-api",
      name: "WhatsApp API",
      description: "API oficial da Meta",
      icon: <Phone className="w-6 h-6 text-green-600" />,
      connected: connectedCount > 0,
      phoneNumber: connectedPhone,
      available: true,
      connectedCount,
    },
    {
      id: "instagram",
      name: "Instagram",
      description: "Mensagens diretas",
      icon: <Instagram className="w-6 h-6 text-pink-500" />,
      connected: metaPages.some((p) => p.platform === "instagram" || p.platform === "both"),
      available: true,
      connectedCount: metaPages.filter((p) => p.platform === "instagram" || p.platform === "both").length,
      metaPages: metaPages.filter((p) => p.platform === "instagram" || p.platform === "both"),
    },
    {
      id: "facebook",
      name: "Facebook",
      description: "Messenger",
      icon: <Facebook className="w-6 h-6 text-blue-600" />,
      connected: metaPages.some((p) => p.platform === "facebook" || p.platform === "both"),
      available: true,
      connectedCount: metaPages.filter((p) => p.platform === "facebook" || p.platform === "both").length,
      metaPages: metaPages.filter((p) => p.platform === "facebook" || p.platform === "both"),
    },
    {
      id: "tiktok",
      name: "TikTok",
      description: "Mensagens e leads",
      icon: <Globe className="w-6 h-6" />,
      connected: false,
      available: false,
    },
    {
      id: "google-business",
      name: "Google Business",
      description: "Chat e reviews",
      icon: <Globe className="w-6 h-6 text-blue-500" />,
      connected: false,
      available: false,
    },
    {
      id: "zoom",
      name: "Zoom",
      description: "Videochamadas",
      icon: <Video className="w-6 h-6 text-blue-500" />,
      connected: false,
      available: false,
    },
    {
      id: "google-calendar",
      name: "Google Calendar",
      description: "Sincronize eventos",
      icon: <Calendar className="w-6 h-6 text-red-500" />,
      connected: false,
      available: false,
    },
    {
      id: "calendly",
      name: "Calendly",
      description: "Agendamentos",
      icon: <Calendar className="w-6 h-6 text-blue-500" />,
      connected: false,
      available: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Integrações
        </h1>
        <p className="text-muted-foreground">
          Gerencie integrações e configurações do sistema
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="auto-tags" disabled={isSeller}>
            <Tag className="w-4 h-4 mr-1" />
            Tags Automáticas
            {isSeller && <Lock className="w-3 h-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="general" disabled={isSeller}>
            Geral
            {isSeller && <Lock className="w-3 h-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="team" disabled={isSeller}>
            Equipe
            {isSeller && <Lock className="w-3 h-3 ml-1" />}
          </TabsTrigger>
          <TabsTrigger value="billing" disabled={isSeller}>
            Plano & Faturamento
            {isSeller && <Lock className="w-3 h-3 ml-1" />}
          </TabsTrigger>
        </TabsList>

        {/* Integrations Tab */}
        <TabsContent value="integrations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {integrations.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`inboxia-card p-5 ${
                  !integration.available && "opacity-60"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    {integration.icon}
                  </div>
                  {integration.connected ? (
                    <Badge
                      variant="outline"
                      className="bg-success/10 text-success border-success/20"
                    >
                      {integration.connectedCount} conectado
                      {(integration.connectedCount || 0) > 1 ? "s" : ""}
                    </Badge>
                  ) : integration.available ? (
                    <Badge variant="outline">Disponível</Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-muted text-muted-foreground"
                    >
                      Em breve
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1">{integration.name}</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {integration.description}
                </p>
                {integration.phoneNumber && (
                  <p className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-success" />
                    {integration.phoneNumber}
                  </p>
                )}
                {/* Show connected Meta pages */}
                {integration.metaPages && integration.metaPages.length > 0 && (
                  <div className="mb-4 space-y-1">
                    {integration.metaPages.slice(0, 2).map((page) => (
                      <p key={page.id} className="text-sm font-medium text-foreground flex items-center gap-2">
                        {integration.id === "instagram" ? (
                          <>
                            <Instagram className="w-4 h-4 text-pink-500" />
                            @{page.instagram_username || page.page_name}
                          </>
                        ) : (
                          <>
                            <Facebook className="w-4 h-4 text-blue-600" />
                            {page.page_name}
                          </>
                        )}
                      </p>
                    ))}
                    {integration.metaPages.length > 2 && (
                      <p className="text-xs text-muted-foreground">
                        +{integration.metaPages.length - 2} mais
                      </p>
                    )}
                  </div>
                )}
                {!integration.phoneNumber && !integration.metaPages?.length && <div className="mb-2" />}
                {integration.available ? (
                  (() => {
                    const isWhatsApp = integration.id === "whatsapp-business" || integration.id === "whatsapp-api";
                    const isLocked = isSeller && !isWhatsApp;
                    return (
                      <Button
                        className="w-full"
                        variant={integration.connected ? "outline" : "default"}
                        disabled={isLocked || ((integration.id === "instagram" || integration.id === "facebook") && connectingMeta)}
                        onClick={() => {
                          if (isLocked) return;
                          if (isWhatsApp) {
                            setShowConnectionModal(true);
                          } else if (integration.id === "instagram" || integration.id === "facebook") {
                            handleConnectMeta();
                          }
                        }}
                      >
                        {isLocked ? (
                          <>
                            <Lock className="w-4 h-4 mr-2" />
                            Somente Admin
                          </>
                        ) : (integration.id === "instagram" || integration.id === "facebook") && connectingMeta ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Conectando...
                          </>
                        ) : integration.connected ? (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Adicionar Conexão
                          </>
                        ) : (
                          <>
                            <Link2 className="w-4 h-4 mr-2" />
                            Conectar
                          </>
                        )}
                      </Button>
                    );
                  })()
                ) : (
                  <Button className="w-full" variant="outline" disabled>
                    Em breve
                  </Button>
                )}
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* WhatsApp Tab */}
        <TabsContent value="whatsapp" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-lg">
              Conexões WhatsApp
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchInstances}
                disabled={loadingInstances}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loadingInstances ? "animate-spin" : ""}`}
                />
              </Button>
              <Button className="gap-2" onClick={() => setShowConnectionModal(true)}>
                <Smartphone className="w-4 h-4" />
                Adicionar Número
              </Button>
            </div>
          </div>

          {loadingInstances ? (
            <div className="inboxia-card p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Carregando conexões...</p>
            </div>
          ) : instances.length === 0 ? (
            <div className="inboxia-card p-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold text-lg mb-2">
                Nenhuma conexão encontrada
              </h3>
              <p className="text-muted-foreground mb-4">
                Conecte seu primeiro número WhatsApp Business
              </p>
              <Button onClick={() => setShowConnectionModal(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Criar Conexão
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {instances.map((instance, index) => (
                <motion.div
                  key={instance.instanceName}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="inboxia-card p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          instance.connectionStatus === "open"
                            ? "bg-success/10"
                            : "bg-warning/10"
                        }`}
                      >
                        {instance.connectionStatus === "open" ? (
                          <Wifi className="w-6 h-6 text-success" />
                        ) : (
                          <WifiOff className="w-6 h-6 text-warning" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">{instance.instanceName}</h3>
                          <Badge variant="outline" className="text-xs">
                            Business
                          </Badge>
                        </div>
                        {instance.owner && (
                          <p className="text-sm text-muted-foreground">
                            {instance.owner}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {instance.profileName && (
                        <div className="text-right">
                          <p className="text-sm text-muted-foreground">Perfil</p>
                          <p className="text-sm font-medium">
                            {instance.profileName}
                          </p>
                        </div>
                      )}
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(
                          instance.connectionStatus || "close"
                        )}`}
                      >
                        {getStatusLabel(instance.connectionStatus || "close")}
                      </span>
                      <div className="flex items-center gap-2">
                        {instance.connectionStatus !== "open" && (
                          <Button
                            size="sm"
                            className="gap-2"
                            onClick={() => setShowConnectionModal(true)}
                          >
                            <QrCode className="w-4 h-4" />
                            Reconectar
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleRefreshInstance(instance.instanceName)
                          }
                          disabled={loading}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() =>
                            handleDeleteInstance(instance.instanceName)
                          }
                          disabled={loading}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {instance.connectionStatus === "close" && (
                    <div className="mt-4 p-3 rounded-lg bg-warning/5 border border-warning/20 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-warning" />
                      <p className="text-sm text-warning">
                        Esta conexão está desconectada. Clique em "Reconectar"
                        para escanear o QR Code novamente.
                      </p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inboxia-card p-6 bg-secondary/5 border-secondary/20"
          >
            <h3 className="font-semibold mb-3">
              💡 Dicas para manter seus números conectados
            </h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                • Mantenha o WhatsApp Business aberto no celular pelo menos uma
                vez por semana
              </li>
              <li>• Evite usar o mesmo número em múltiplos dispositivos</li>
              <li>
                • Configure notificações para ser avisado em caso de desconexão
              </li>
              <li>
                • Para alta disponibilidade, considere usar a API oficial do
                WhatsApp
              </li>
            </ul>
          </motion.div>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="inboxia-card p-6">
            <h3 className="font-display font-semibold text-lg mb-4">
              Configurações Gerais
            </h3>
            <div className="space-y-4">
              {[
                {
                  label: "Notificações por email",
                  description: "Receba alertas importantes por email",
                  enabled: true,
                },
                {
                  label: "Som de notificação",
                  description: "Tocar som ao receber novas mensagens",
                  enabled: true,
                },
                {
                  label: "Modo escuro automático",
                  description: "Alternar com base no sistema",
                  enabled: false,
                },
                {
                  label: "Resposta automática",
                  description: "Enviar mensagem quando ausente",
                  enabled: false,
                },
              ].map((setting) => (
                <div
                  key={setting.label}
                  className="flex items-center justify-between py-3 border-b border-border last:border-0"
                >
                  <div>
                    <p className="font-medium">{setting.label}</p>
                    <p className="text-sm text-muted-foreground">
                      {setting.description}
                    </p>
                  </div>
                  <Switch defaultChecked={setting.enabled} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Auto Tags Tab */}
        <TabsContent value="auto-tags">
          <AutoTagRules />
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="inboxia-card p-12 text-center">
            <h3 className="font-display font-semibold text-lg mb-2">
              Gestão de Equipe
            </h3>
            <p className="text-muted-foreground">
              Em breve você poderá gerenciar sua equipe aqui
            </p>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <div className="inboxia-card p-12 text-center">
            <h3 className="font-display font-semibold text-lg mb-2">
              Plano & Faturamento
            </h3>
            <p className="text-muted-foreground">
              Gerencie seu plano e informações de pagamento
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {/* Connection Modal */}
      <ConnectionModal
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
        onSuccess={fetchInstances}
      />
    </div>
  );
}
