import { useState } from "react";
import { motion } from "framer-motion";
import {
  MessageCircle,
  Phone,
  Instagram,
  Facebook,
  Calendar,
  Video,
  Globe,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings2,
  Smartphone,
  QrCode,
  Link2,
  AlertCircle,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Integration {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connected: boolean;
  available: boolean;
}

interface WhatsAppNumber {
  id: string;
  number: string;
  name: string;
  status: "connected" | "disconnected" | "error";
  type: "business" | "api";
  lastSeen: string;
  messagesQueued: number;
}

const integrations: Integration[] = [
  { id: "whatsapp-business", name: "WhatsApp Business", description: "Conecte via QR Code", icon: <MessageCircle className="w-6 h-6 text-green-500" />, connected: false, available: true },
  { id: "whatsapp-api", name: "WhatsApp API", description: "API oficial da Meta", icon: <Phone className="w-6 h-6 text-green-600" />, connected: false, available: true },
  { id: "instagram", name: "Instagram", description: "Mensagens diretas", icon: <Instagram className="w-6 h-6 text-pink-500" />, connected: false, available: false },
  { id: "facebook", name: "Facebook", description: "Messenger", icon: <Facebook className="w-6 h-6 text-blue-600" />, connected: false, available: false },
  { id: "tiktok", name: "TikTok", description: "Mensagens e leads", icon: <Globe className="w-6 h-6" />, connected: false, available: false },
  { id: "google-business", name: "Google Business", description: "Chat e reviews", icon: <Globe className="w-6 h-6 text-blue-500" />, connected: false, available: false },
  { id: "zoom", name: "Zoom", description: "Videochamadas", icon: <Video className="w-6 h-6 text-blue-500" />, connected: false, available: false },
  { id: "google-calendar", name: "Google Calendar", description: "Sincronize eventos", icon: <Calendar className="w-6 h-6 text-red-500" />, connected: false, available: false },
  { id: "calendly", name: "Calendly", description: "Agendamentos", icon: <Calendar className="w-6 h-6 text-blue-500" />, connected: false, available: false },
];

const whatsappNumbers: WhatsAppNumber[] = [
  { id: "1", number: "+55 11 99999-0001", name: "Vendas Principal", status: "connected", type: "business", lastSeen: "Agora", messagesQueued: 0 },
  { id: "2", number: "+55 11 99999-0002", name: "Suporte", status: "disconnected", type: "business", lastSeen: "Há 2 horas", messagesQueued: 15 },
  { id: "3", number: "+55 11 99999-0003", name: "API Oficial", status: "connected", type: "api", lastSeen: "Agora", messagesQueued: 3 },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "connected":
      return "bg-success/10 text-success border-success/20";
    case "disconnected":
      return "bg-warning/10 text-warning border-warning/20";
    case "error":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "connected":
      return "Conectado";
    case "disconnected":
      return "Desconectado";
    case "error":
      return "Erro";
    default:
      return status;
  }
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("integrations");
  const [showQRModal, setShowQRModal] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Gerencie integrações e configurações do sistema</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="team">Equipe</TabsTrigger>
          <TabsTrigger value="billing">Plano & Faturamento</TabsTrigger>
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
                className={`inboxia-card p-5 ${!integration.available && "opacity-60"}`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                    {integration.icon}
                  </div>
                  {integration.connected ? (
                    <Badge variant="outline" className="bg-success/10 text-success border-success/20">
                      Conectado
                    </Badge>
                  ) : integration.available ? (
                    <Badge variant="outline">Disponível</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-muted text-muted-foreground">
                      Em breve
                    </Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg mb-1">{integration.name}</h3>
                <p className="text-sm text-muted-foreground mb-4">{integration.description}</p>
                {integration.available ? (
                  <Button
                    className="w-full"
                    variant={integration.connected ? "outline" : "default"}
                    onClick={() => {
                      if (integration.id === "whatsapp-business") {
                        setShowQRModal(true);
                      }
                    }}
                  >
                    {integration.connected ? (
                      <>
                        <Settings2 className="w-4 h-4 mr-2" />
                        Configurar
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-2" />
                        Conectar
                      </>
                    )}
                  </Button>
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
            <h2 className="font-display font-semibold text-lg">Números Conectados</h2>
            <Button className="gap-2">
              <Smartphone className="w-4 h-4" />
              Adicionar Número
            </Button>
          </div>

          <div className="space-y-4">
            {whatsappNumbers.map((number, index) => (
              <motion.div
                key={number.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="inboxia-card p-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      number.status === "connected" ? "bg-success/10" : "bg-warning/10"
                    }`}>
                      {number.status === "connected" ? (
                        <Wifi className="w-6 h-6 text-success" />
                      ) : (
                        <WifiOff className="w-6 h-6 text-warning" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{number.name}</h3>
                        <Badge variant="outline" className="text-xs">
                          {number.type === "business" ? "Business" : "API"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{number.number}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Última atividade</p>
                      <p className="text-sm font-medium">{number.lastSeen}</p>
                    </div>
                    {number.messagesQueued > 0 && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">Na fila</p>
                        <p className="text-sm font-medium text-warning">{number.messagesQueued} msgs</p>
                      </div>
                    )}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(number.status)}`}>
                      {getStatusLabel(number.status)}
                    </span>
                    <div className="flex items-center gap-2">
                      {number.status === "disconnected" && (
                        <Button size="sm" className="gap-2">
                          <QrCode className="w-4 h-4" />
                          Reconectar
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <RefreshCw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="sm">
                        <Settings2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {number.status === "disconnected" && (
                  <div className="mt-4 p-3 rounded-lg bg-warning/5 border border-warning/20 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-warning" />
                    <p className="text-sm text-warning">
                      Este número está desconectado. Clique em "Reconectar" para escanear o QR Code novamente.
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="inboxia-card p-6 bg-secondary/5 border-secondary/20"
          >
            <h3 className="font-semibold mb-3">💡 Dicas para manter seus números conectados</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Mantenha o WhatsApp Business aberto no celular pelo menos uma vez por semana</li>
              <li>• Evite usar o mesmo número em múltiplos dispositivos</li>
              <li>• Configure notificações para ser avisado em caso de desconexão</li>
              <li>• Para alta disponibilidade, considere usar a API oficial do WhatsApp</li>
            </ul>
          </motion.div>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <div className="inboxia-card p-6">
            <h3 className="font-display font-semibold text-lg mb-4">Configurações Gerais</h3>
            <div className="space-y-4">
              {[
                { label: "Notificações por email", description: "Receba alertas importantes por email", enabled: true },
                { label: "Som de notificação", description: "Tocar som ao receber novas mensagens", enabled: true },
                { label: "Modo escuro automático", description: "Alternar com base no sistema", enabled: false },
                { label: "Resposta automática", description: "Enviar mensagem quando ausente", enabled: false },
              ].map((setting) => (
                <div key={setting.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                  <div>
                    <p className="font-medium">{setting.label}</p>
                    <p className="text-sm text-muted-foreground">{setting.description}</p>
                  </div>
                  <Switch defaultChecked={setting.enabled} />
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Team Tab */}
        <TabsContent value="team">
          <div className="inboxia-card p-12 text-center">
            <h3 className="font-display font-semibold text-lg mb-2">Gestão de Equipe</h3>
            <p className="text-muted-foreground">Em breve você poderá gerenciar sua equipe aqui</p>
          </div>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing">
          <div className="inboxia-card p-12 text-center">
            <h3 className="font-display font-semibold text-lg mb-2">Plano & Faturamento</h3>
            <p className="text-muted-foreground">Gerencie seu plano e informações de pagamento</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Modal - Simulated */}
      {showQRModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowQRModal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-card p-8 rounded-2xl shadow-xl max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-display font-bold text-xl text-center mb-2">
              Conectar WhatsApp Business
            </h3>
            <p className="text-center text-muted-foreground mb-6">
              Escaneie o QR Code com o WhatsApp Business
            </p>
            <div className="w-64 h-64 bg-muted rounded-xl mx-auto flex items-center justify-center mb-6">
              <QrCode className="w-32 h-32 text-muted-foreground" />
            </div>
            <ol className="text-sm text-muted-foreground space-y-2 mb-6">
              <li>1. Abra o WhatsApp Business no seu celular</li>
              <li>2. Toque em Menu (⋮) ou Configurações</li>
              <li>3. Selecione "Aparelhos conectados"</li>
              <li>4. Toque em "Conectar um aparelho"</li>
              <li>5. Escaneie este QR Code</li>
            </ol>
            <Button className="w-full" variant="outline" onClick={() => setShowQRModal(false)}>
              Fechar
            </Button>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
