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
} from "lucide-react";
import { useEvolutionAPI } from "@/hooks/useEvolutionAPI";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

type Step = "name" | "creating" | "qrcode" | "waiting" | "success" | "error";

interface ConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ConnectionModal({
  open,
  onOpenChange,
  onSuccess,
}: ConnectionModalProps) {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState<Step>("name");
  const [instanceName, setInstanceName] = useState("");
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { createInstance, getQRCode, getConnectionState, error } =
    useEvolutionAPI();

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clean up polling on unmount or close
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      // Delay reset to allow close animation
      setTimeout(() => {
        setStep("name");
        setInstanceName("");
        setQrCodeBase64(null);
        setErrorMessage(null);
        if (pollingRef.current) clearInterval(pollingRef.current);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }, 300);
    }
  }, [open]);

  const handleCreateConnection = async () => {
    if (!instanceName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Digite um nome para a conexão",
        variant: "destructive",
      });
      return;
    }

    // Sanitize instance name (remove spaces, special chars)
    const sanitizedName = instanceName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    if (!sanitizedName) {
      toast({
        title: "Nome inválido",
        description: "Use apenas letras e números",
        variant: "destructive",
      });
      return;
    }

    setStep("creating");

    try {
      const result = await createInstance(sanitizedName);

      if (!result) {
        throw new Error(error || "Erro ao criar conexão");
      }

      // Check if QR code is returned in the create response
      if (result.qrcode?.base64) {
        setQrCodeBase64(result.qrcode.base64);
        setStep("qrcode");
        startPolling(sanitizedName);
      } else {
        // Need to fetch QR code separately
        const qrResult = await getQRCode(sanitizedName);
        if (qrResult?.base64) {
          setQrCodeBase64(qrResult.base64);
          setStep("qrcode");
          startPolling(sanitizedName);
        } else {
          throw new Error("Não foi possível obter o QR Code");
        }
      }
    } catch (err) {
      console.error("Error creating connection:", err);
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao criar conexão"
      );
      setStep("error");
    }
  };

  const startPolling = (name: string) => {
    // Clear any existing polling
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    // Set a 2-minute timeout
    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setErrorMessage("Tempo esgotado. O QR Code expirou.");
      setStep("error");
    }, 120000);

    // Poll every 3 seconds
    pollingRef.current = setInterval(async () => {
      try {
        const state = await getConnectionState(name);
        console.log("[ConnectionModal] Polling state:", state);

        if (state?.instance?.state === "open") {
          if (pollingRef.current) clearInterval(pollingRef.current);
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          
          // Salvar instância no banco de dados local
          const sanitizedName = instanceName
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
          
          await supabase.from('whatsapp_instances').upsert({
            instance_name: sanitizedName,
            display_name: instanceName.trim(),
            workspace_id: workspaceId!
          }, { onConflict: 'instance_name' });
          
          setStep("success");

          toast({
            title: "Conexão estabelecida!",
            description: "Seu WhatsApp foi conectado com sucesso.",
          });

          // Call onSuccess after a brief delay
          setTimeout(() => {
            onSuccess?.();
            onOpenChange(false);
          }, 2000);
        }
      } catch (err) {
        console.error("[ConnectionModal] Polling error:", err);
      }
    }, 3000);
  };

  const handleRefreshQR = async () => {
    const sanitizedName = instanceName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    setStep("creating");

    try {
      const qrResult = await getQRCode(sanitizedName);
      if (qrResult?.base64) {
        setQrCodeBase64(qrResult.base64);
        setStep("qrcode");
        startPolling(sanitizedName);
      } else {
        throw new Error("Não foi possível obter o QR Code");
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Erro ao atualizar QR Code"
      );
      setStep("error");
    }
  };

  const handleTryAgain = () => {
    setStep("name");
    setErrorMessage(null);
    setQrCodeBase64(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "name" && "Criar Nova Conexão"}
            {step === "creating" && "Criando Conexão..."}
            {step === "qrcode" && "Escaneie o QR Code"}
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
                <p className="text-muted-foreground">Criando conexão...</p>
              </motion.div>
            )}

            {/* Step 3: QR Code */}
            {step === "qrcode" && qrCodeBase64 && (
              <motion.div
                key="qrcode"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex justify-center">
                  <div className="bg-white p-4 rounded-xl shadow-inner">
                    <img
                      src={qrCodeBase64}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64"
                    />
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

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={handleRefreshQR}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Atualizar QR Code
                </Button>
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
                <h3 className="text-xl font-semibold mb-2">
                  Conexão Estabelecida!
                </h3>
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
                <h3 className="text-xl font-semibold mb-2">
                  Erro na Conexão
                </h3>
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
