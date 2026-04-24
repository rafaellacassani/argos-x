import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Smartphone,
  Hash,
  QrCode,
} from "lucide-react";
import { useEvolutionAPI } from "@/hooks/useEvolutionAPI";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

type Step = "name" | "creating" | "qrcode" | "waiting" | "success" | "error";
type ConnectMode = "qrcode" | "pairing";

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  instanceType?: "commercial" | "alerts";
  instanceToReconnect?: string;
}

export function ConnectionModal({
  open,
  onOpenChange,
  onSuccess,
  instanceType = "commercial",
  instanceToReconnect,
}: ConnectionModalProps) {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState<Step>("name");
  const [instanceName, setInstanceName] = useState("");
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [connectMode, setConnectMode] = useState<ConnectMode>("qrcode");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoHealAttempted, setAutoHealAttempted] = useState(false);
  const connectingCountRef = useRef(0);

  const { createInstance, getQRCode, getPairingCode, getConnectionState, restartInstance, error } =
    useEvolutionAPI();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingInFlightRef = useRef(false);
  // Store the unique Evolution API instance name for use across methods
  const currentUniqueNameRef = useRef<string>("");

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      pollingInFlightRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep("name");
        setInstanceName("");
        setQrCodeBase64(null);
        setPairingCode(null);
        setConnectMode("qrcode");
        setPhoneNumber("");
        setErrorMessage(null);
        setAutoHealAttempted(false);
        connectingCountRef.current = 0;
        currentUniqueNameRef.current = "";
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        pollingInFlightRef.current = false;
      }, 300);
    } else if (open && instanceToReconnect) {
      setInstanceName(instanceToReconnect);
      currentUniqueNameRef.current = instanceToReconnect;
      setStep("creating");
      (async () => {
        try {
          // Force fresh QR — bypass server cache. Old reconnect attempts may
          // have left a stale (already-expired) QR code cached.
          const qrResult = await getQRCode(instanceToReconnect, true);
          if (qrResult?.instance?.state === "open") {
            setStep("success");
            toast({ title: "WhatsApp já conectado", description: "Essa conexão já estava ativa." });
            onSuccess?.();
            setTimeout(() => onOpenChange(false), 1200);
            return;
          }
          if (qrResult?.base64) {
            setQrCodeBase64(qrResult.base64);
            setStep("qrcode");
            startPolling(instanceToReconnect);
          } else {
            throw new Error("Não foi possível obter o QR Code");
          }
        } catch (err) {
          setErrorMessage(err instanceof Error ? err.message : "Erro ao reconectar");
          setStep("error");
        }
      })();
    }
  }, [open]);

  const buildUniqueInstanceName = (displayName: string) => {
    const sanitized = displayName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const wsPrefix = workspaceId ? workspaceId.substring(0, 8) : "default";
    return `${wsPrefix}-${sanitized}`;
  };

  const handleCreateConnection = async () => {
    if (!instanceName.trim()) {
      toast({ title: "Nome obrigatório", description: "Digite um nome para a conexão", variant: "destructive" });
      return;
    }

    const sanitizedName = instanceName.trim().toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!sanitizedName) {
      toast({ title: "Nome inválido", description: "Use apenas letras e números", variant: "destructive" });
      return;
    }

    const uniqueName = buildUniqueInstanceName(instanceName);
    currentUniqueNameRef.current = uniqueName;
    setStep("creating");

    try {
      const result = await createInstance(uniqueName);
      if (!result) throw new Error(error || "Erro ao criar conexão");

      if ((result as any)?.instance?.state === "open") {
        setStep("success");
        toast({ title: "WhatsApp já conectado", description: "A conexão foi criada e já está ativa." });
        onSuccess?.();
        setTimeout(() => onOpenChange(false), 1200);
        return;
      }

      if (result.qrcode?.base64) {
        setQrCodeBase64(result.qrcode.base64);
        setStep("qrcode");
        startPolling(uniqueName);
      } else {
        const qrResult = await getQRCode(uniqueName);
        if (qrResult?.instance?.state === "open") {
          setStep("success");
          toast({ title: "WhatsApp já conectado", description: "A conexão já está ativa." });
          onSuccess?.();
          setTimeout(() => onOpenChange(false), 1200);
          return;
        }
        if (qrResult?.base64) {
          setQrCodeBase64(qrResult.base64);
          setStep("qrcode");
          startPolling(uniqueName);
        } else {
          throw new Error("Não foi possível obter o QR Code");
        }
      }
    } catch (err) {
      console.error("Error creating connection:", err);
      const errMsg = err instanceof Error ? err.message : "Erro ao criar conexão";
      setErrorMessage(errMsg.includes("Forbidden") ? "Nome de conexão já existe. Tente outro nome." : errMsg);
      setStep("error");
    }
  };

  const handleSwitchToPairing = async () => {
    if (!phoneNumber.trim()) {
      toast({ title: "Número obrigatório", description: "Digite o número do WhatsApp com DDD e código do país", variant: "destructive" });
      return;
    }

    const targetName = instanceToReconnect || currentUniqueNameRef.current;
    if (!targetName) {
      toast({ title: "Erro", description: "Nome da instância não encontrado", variant: "destructive" });
      return;
    }

    setStep("creating");
    try {
      const result = await getPairingCode(targetName, phoneNumber);
      if (result?.pairingCode) {
        setPairingCode(result.pairingCode);
        setConnectMode("pairing");
        setStep("qrcode"); // reuse the same step to show pairing code
        startPolling(targetName);
      } else {
        throw new Error("Código de pareamento indisponível. Use o QR Code para conectar.");
      }
    } catch (err) {
      console.error("Error getting pairing code:", err);
      const msg = err instanceof Error ? err.message : "Erro ao obter código de pareamento";
      toast({ title: "Pareamento indisponível", description: msg, variant: "destructive" });
      // Go back to QR code view instead of error screen
      setStep("qrcode");
    }
  };

  const handleSwitchToQR = async () => {
    const targetName = instanceToReconnect || currentUniqueNameRef.current;
    if (!targetName) return;

    setStep("creating");
    setPairingCode(null);
    setConnectMode("qrcode");

    try {
      const qrResult = await getQRCode(targetName);
      if (qrResult?.base64) {
        setQrCodeBase64(qrResult.base64);
        setStep("qrcode");
        startPolling(targetName);
      } else {
        throw new Error("Não foi possível obter o QR Code");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao obter QR Code");
      setStep("error");
    }
  };

  const startPolling = (name: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      void handleAutoHeal(name, "O código expirou antes da conexão ser concluída.");
    }, 120000);

    pollingRef.current = setInterval(async () => {
      if (pollingInFlightRef.current) return;
      pollingInFlightRef.current = true;

      try {
        const state = await getConnectionState(name);
        console.log("[ConnectionModal] Polling state:", state);

        if (state?.instance?.state === "open") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          pollingInFlightRef.current = false;
          
          if (!instanceToReconnect) {
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from('whatsapp_instances').upsert({
              instance_name: name,
              display_name: instanceName.trim(),
              workspace_id: workspaceId!,
              created_by: user?.id,
              instance_type: instanceType,
            } as any, { onConflict: 'instance_name' });
            
            try {
              await supabase.functions.invoke(`evolution-api/setup-webhook/${name}`, { method: "POST" });
              console.log("[ConnectionModal] Webhook configured for", name);
              toast({ title: "Webhook configurado ✓", description: "Automações serão disparadas automaticamente." });
            } catch (webhookErr) {
              console.error("[ConnectionModal] Webhook setup error:", webhookErr);
            }
          }
          
          try {
            toast({ title: "Sincronizando histórico...", description: "Importando mensagens do WhatsApp para o banco local." });
            supabase.functions.invoke('sync-whatsapp-messages', {
              body: { instanceName: instanceToReconnect || name, workspaceId },
            }).then((res) => {
              if (res.data && !res.error) {
                toast({ title: "Histórico sincronizado ✓", description: `${res.data.synced || 0} mensagens de ${res.data.chats || 0} conversas importadas.` });
              }
            }).catch((err) => console.error("[ConnectionModal] Sync error:", err));
          } catch (syncErr) {
            console.error("[ConnectionModal] Sync trigger error:", syncErr);
          }
          
          setStep("success");
          toast({ title: "Conexão estabelecida!", description: "Seu WhatsApp foi conectado com sucesso." });

          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
          }, 2000);
          return;
        }

        if (state?.instance?.state === "connecting") {
          connectingCountRef.current += 1;
          if (connectingCountRef.current >= 3) {
            await handleAutoHeal(name, "A conexão ficou presa em reconexão.");
          }
          return;
        }

        connectingCountRef.current = 0;
      } catch (err) {
        console.error("[ConnectionModal] Polling error:", err);
      } finally {
        pollingInFlightRef.current = false;
      }
    }, 5000);
  };

  const handleRefreshQR = async () => {
    const targetName = instanceToReconnect || currentUniqueNameRef.current;
    setStep("creating");
    setErrorMessage(null);

    try {
      const restarted = await restartInstance(targetName);

      if (connectMode === "pairing" && phoneNumber) {
        const result = await getPairingCode(targetName, phoneNumber);
        if (result?.pairingCode) {
          setPairingCode(result.pairingCode);
          setStep("qrcode");
          startPolling(targetName);
        } else {
          throw new Error("Não foi possível obter o código");
        }
      } else {
        const qrResult = restarted?.qrcode?.base64 ? restarted.qrcode : await getQRCode(targetName, true);
        if (qrResult?.instance?.state === "open") {
          setStep("success");
          toast({ title: "WhatsApp já conectado", description: "A conexão já está ativa." });
          onSuccess?.();
          setTimeout(() => onOpenChange(false), 1200);
          return;
        }
        if (qrResult?.base64) {
          setQrCodeBase64(qrResult.base64);
          setAutoHealAttempted(false);
          connectingCountRef.current = 0;
          setStep("qrcode");
          startPolling(targetName);
        } else {
          throw new Error("Não foi possível obter o QR Code");
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Erro ao atualizar");
      setStep("error");
    }
  };

  const handleTryAgain = () => {
    setStep("name");
    setErrorMessage(null);
    setQrCodeBase64(null);
    setPairingCode(null);
    setConnectMode("qrcode");
    setAutoHealAttempted(false);
    connectingCountRef.current = 0;
  };

  const handleAutoHeal = async (instanceName: string, fallbackMessage: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (autoHealAttempted) {
      setErrorMessage(fallbackMessage);
      setStep("error");
      return;
    }

    setAutoHealAttempted(true);
    connectingCountRef.current = 0;
    setStep("creating");

    try {
      const restarted = await restartInstance(instanceName);
      const qrResult = restarted?.qrcode?.base64 ? restarted.qrcode : await getQRCode(instanceName, true);

      if (qrResult?.instance?.state === "open") {
        setStep("success");
        toast({ title: "WhatsApp reconectado", description: "A conexão voltou sem precisar de novo QR Code." });
        onSuccess?.();
        setTimeout(() => onOpenChange(false), 1200);
        return;
      }

      if (qrResult?.base64) {
        setQrCodeBase64(qrResult.base64);
        setPairingCode(null);
        setConnectMode("qrcode");
        toast({ title: "Conexão reiniciada", description: "Geramos um novo QR Code para destravar a conexão." });
        setStep("qrcode");
        startPolling(instanceName);
        return;
      }

      throw new Error("Não foi possível gerar um novo QR Code");
    } catch (err) {
      console.error("[ConnectionModal] Auto-heal error:", err);
      setErrorMessage(err instanceof Error ? err.message : fallbackMessage);
      setStep("error");
    }
  };

  const formatPairingCode = (code: string) => {
    // Format as XXXX-XXXX for readability
    const clean = code.replace(/[^A-Z0-9]/gi, "");
    if (clean.length <= 4) return clean;
    return clean.slice(0, 4) + "-" + clean.slice(4);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "name" && "Criar Nova Conexão"}
            {step === "creating" && (instanceToReconnect ? `Reconectando ${instanceToReconnect}...` : "Criando Conexão...")}
            {step === "qrcode" && connectMode === "pairing" && "Código de Pareamento"}
            {step === "qrcode" && connectMode === "qrcode" && (instanceToReconnect ? `Reconectar ${instanceToReconnect}` : "Escaneie o QR Code")}
            {step === "waiting" && "Aguardando..."}
            {step === "success" && "Conectado!"}
            {step === "error" && "Erro na Conexão"}
          </DialogTitle>
        </DialogHeader>

        <div className="py-6">
          <AnimatePresence mode="wait">
            {/* Step 1: Name Input */}
            {step === "name" && (
              <motion.div
                key="name"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="instanceName">Nome da conexão</Label>
                  <Input
                    id="instanceName"
                    placeholder="Ex: Vendas, Suporte, Atendimento..."
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateConnection();
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Use um nome que identifique o propósito deste número
                  </p>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreateConnection}
                  disabled={!instanceName.trim()}
                >
                  <Smartphone className="w-4 h-4 mr-2" />
                  Gerar QR Code
                </Button>
              </motion.div>
            )}

            {/* Step 2: Creating */}
            {step === "creating" && (
              <motion.div
                key="creating"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">
                  {connectMode === "pairing" ? "Obtendo código de pareamento..." : "Criando conexão..."}
                </p>
              </motion.div>
            )}

            {/* Step 3: QR Code or Pairing Code */}
            {step === "qrcode" && connectMode === "qrcode" && qrCodeBase64 && (
              <motion.div
                key="qrcode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl shadow-inner">
                    <img src={qrCodeBase64} alt="QR Code WhatsApp" className="w-64 h-64" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aguardando leitura do QR Code...</span>
                </div>

                <ol className="text-sm text-muted-foreground space-y-1 bg-muted/50 p-4 rounded-lg">
                  <li>1. Abra o WhatsApp Business no celular</li>
                  <li>2. Toque em Menu (⋮) ou Configurações</li>
                  <li>3. Selecione "Aparelhos conectados"</li>
                  <li>4. Toque em "Conectar um aparelho"</li>
                  <li>5. Escaneie este QR Code</li>
                </ol>

                {/* Switch to Pairing Code */}
                <div className="border border-border rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Hash className="w-4 h-4 text-primary" />
                    <span>Prefere usar código numérico?</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Se está configurando pelo mesmo celular, use o código de pareamento — não precisa de câmera.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Ex: 5511999999999"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="secondary"
                      onClick={handleSwitchToPairing}
                      disabled={!phoneNumber.trim()}
                      size="sm"
                    >
                      Gerar código
                    </Button>
                  </div>
                </div>

                <Button variant="outline" className="w-full" onClick={handleRefreshQR}>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR Code
                </Button>
              </motion.div>
            )}

            {/* Pairing Code View */}
            {step === "qrcode" && connectMode === "pairing" && pairingCode && (
              <motion.div
                key="pairing"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <div className="bg-primary/5 border-2 border-primary/20 rounded-2xl p-8 text-center">
                    <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wider font-medium">
                      Código de pareamento
                    </p>
                    <p className="text-4xl font-mono font-bold tracking-[0.3em] text-foreground">
                      {formatPairingCode(pairingCode)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Aguardando pareamento...</span>
                </div>

                <ol className="text-sm text-muted-foreground space-y-1 bg-muted/50 p-4 rounded-lg">
                  <li>1. Abra o WhatsApp Business no celular</li>
                  <li>2. Toque em Menu (⋮) ou Configurações</li>
                  <li>3. Selecione "Aparelhos conectados"</li>
                  <li>4. Toque em "Conectar um aparelho"</li>
                  <li>5. Toque em <strong>"Conectar com número de telefone"</strong></li>
                  <li>6. Digite o código acima</li>
                </ol>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={handleSwitchToQR}>
                    <QrCode className="w-4 h-4 mr-2" />
                    Usar QR Code
                  </Button>
                  <Button variant="outline" className="flex-1" onClick={handleRefreshQR}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Novo código
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Success */}
            {step === "success" && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-success mb-4" />
                </motion.div>
                <h3 className="text-xl font-semibold mb-2">Conexão Estabelecida!</h3>
                <p className="text-muted-foreground text-center">
                  Seu WhatsApp foi conectado com sucesso.
                </p>
              </motion.div>
            )}

            {/* Step 5: Error */}
            {step === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <XCircle className="w-16 h-16 text-destructive mb-4" />
                <h3 className="text-xl font-semibold mb-2">Erro na Conexão</h3>
                <p className="text-muted-foreground text-center mb-4">
                  {errorMessage || "Ocorreu um erro inesperado"}
                </p>
                <Button onClick={handleTryAgain}>Tentar Novamente</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
