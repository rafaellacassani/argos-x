import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Copy,
  ChevronDown,
  HelpCircle,
  Phone,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

type Step = "form" | "saving" | "webhook" | "verifying" | "success" | "error";

interface CloudAPIConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CloudAPIConnectionModal({
  open,
  onOpenChange,
  onSuccess,
}: CloudAPIConnectionModalProps) {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState<Step>("form");

  const [inboxName, setInboxName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [wabaId, setWabaId] = useState("");
  const [accessToken, setAccessToken] = useState("");

  const [webhookVerifyToken, setWebhookVerifyToken] = useState("");
  const [savedConnectionId, setSavedConnectionId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const webhookUrl = `${supabaseUrl}/functions/v1/facebook-webhook`;

  const isFormValid =
    inboxName.trim() &&
    phoneNumber.trim() &&
    phoneNumberId.trim() &&
    wabaId.trim() &&
    accessToken.trim();

  const resetState = () => {
    setStep("form");
    setInboxName("");
    setPhoneNumber("");
    setPhoneNumberId("");
    setWabaId("");
    setAccessToken("");
    setWebhookVerifyToken("");
    setSavedConnectionId(null);
    setErrorMessage(null);
    setHelpOpen(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setTimeout(resetState, 300);
    }
    onOpenChange(open);
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    setStep("saving");

    try {
      // 1. Find or create a meta_account for this workspace
      let metaAccountId: string;
      const { data: existingAccounts } = await supabase
        .from("meta_accounts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .limit(1);

      if (existingAccounts && existingAccounts.length > 0) {
        metaAccountId = existingAccounts[0].id;
      } else {
        const { data: newAccount, error: accErr } = await supabase
          .from("meta_accounts")
          .insert({
            workspace_id: workspaceId,
            user_access_token: accessToken.trim(),
          })
          .select("id")
          .single();
        if (accErr || !newAccount) throw new Error("Erro ao criar conta Meta");
        metaAccountId = newAccount.id;
      }

      // 2. Create meta_page record
      const { data: metaPage, error: pageErr } = await supabase
        .from("meta_pages")
        .insert({
          workspace_id: workspaceId,
          meta_account_id: metaAccountId,
          page_id: phoneNumberId.trim(),
          page_name: inboxName.trim(),
          page_access_token: accessToken.trim(),
          platform: "whatsapp_business" as any,
        })
        .select("id")
        .single();
      if (pageErr || !metaPage) throw new Error("Erro ao criar página Meta");

      // 3. Create whatsapp_cloud_connection
      const { data: connection, error: connErr } = await supabase
        .from("whatsapp_cloud_connections")
        .insert({
          workspace_id: workspaceId,
          meta_page_id: metaPage.id,
          inbox_name: inboxName.trim(),
          phone_number: phoneNumber.trim(),
          phone_number_id: phoneNumberId.trim(),
          waba_id: wabaId.trim(),
          access_token: accessToken.trim(),
          status: "pending",
        })
        .select("id, webhook_verify_token")
        .single();
      if (connErr || !connection) throw new Error("Erro ao salvar conexão");

      setSavedConnectionId(connection.id);
      setWebhookVerifyToken(connection.webhook_verify_token);
      setStep("webhook");
    } catch (err) {
      console.error("Error saving cloud connection:", err);
      setErrorMessage(err instanceof Error ? err.message : "Erro ao salvar");
      setStep("error");
    }
  };

  const handleVerify = async () => {
    setStep("verifying");

    try {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}`,
        {
          headers: { Authorization: `Bearer ${accessToken.trim()}` },
        }
      );

      if (res.ok) {
        // Update status to active
        if (savedConnectionId) {
          await supabase
            .from("whatsapp_cloud_connections")
            .update({ status: "active" })
            .eq("id", savedConnectionId);
        }
        setStep("success");
        toast({
          title: "Conexão verificada!",
          description: "WhatsApp API está pronta para receber mensagens.",
        });
        setTimeout(() => {
          onSuccess?.();
          handleOpenChange(false);
        }, 2000);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data?.error?.message || "Token inválido ou Phone Number ID incorreto"
        );
      }
    } catch (err) {
      console.error("Verification error:", err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível verificar a conexão"
      );
      setStep("error");
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copiado!` });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            {step === "form" && "Conectar WhatsApp API Oficial"}
            {step === "saving" && "Salvando..."}
            {step === "webhook" && "Quase lá! Configure o webhook"}
            {step === "verifying" && "Verificando..."}
            {step === "success" && "Conectado!"}
            {step === "error" && "Erro na Conexão"}
          </DialogTitle>
          {step === "form" && (
            <DialogDescription className="text-center">
              Preencha os dados do seu aplicativo no Meta Business
            </DialogDescription>
          )}
          {step === "webhook" && (
            <DialogDescription className="text-center">
              Copie as informações abaixo e configure no seu aplicativo Meta
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="py-4">
          <AnimatePresence mode="wait">
            {/* STEP 1: Form */}
            {step === "form" && (
              <motion.div
                key="form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>Nome da caixa de entrada</Label>
                  <Input
                    placeholder="Ex: Atendimento Principal"
                    value={inboxName}
                    onChange={(e) => setInboxName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Número de telefone</Label>
                  <Input
                    placeholder="+55 11 99999-9999"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID do número de telefone</Label>
                  <Input
                    placeholder="Phone Number ID do Meta"
                    value={phoneNumberId}
                    onChange={(e) => setPhoneNumberId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID da conta WhatsApp Business</Label>
                  <Input
                    placeholder="WABA ID do Meta"
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Token de acesso permanente</Label>
                  <Textarea
                    placeholder="Cole aqui o token do Meta"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    rows={3}
                  />
                </div>

                <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full">
                    <HelpCircle className="w-4 h-4" />
                    Onde encontro essas informações?
                    <ChevronDown
                      className={`w-4 h-4 ml-auto transition-transform ${
                        helpOpen ? "rotate-180" : ""
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <ol className="text-sm text-muted-foreground space-y-1 bg-muted/50 p-4 rounded-lg mt-2">
                      <li>1. Acesse developers.facebook.com e abra seu aplicativo</li>
                      <li>2. Vá em WhatsApp {">"} Configuração da API</li>
                      <li>
                        3. O Phone Number ID e WABA ID aparecem na página principal
                      </li>
                      <li>
                        4. Para o token permanente, vá em Configurações {">"} Tokens
                        de acesso
                      </li>
                    </ol>
                  </CollapsibleContent>
                </Collapsible>

                <Button
                  className="w-full"
                  onClick={handleSave}
                  disabled={!isFormValid}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Conectar
                </Button>
              </motion.div>
            )}

            {/* Saving */}
            {step === "saving" && (
              <motion.div
                key="saving"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Salvando conexão...</p>
              </motion.div>
            )}

            {/* STEP 2: Webhook config */}
            {step === "webhook" && (
              <motion.div
                key="webhook"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {/* Callback URL */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    URL de Callback
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input value={webhookUrl} readOnly className="font-mono text-xs" />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(webhookUrl, "URL")}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Verify Token */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    Token de Verificação
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={webhookVerifyToken}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        copyToClipboard(webhookVerifyToken, "Token")
                      }
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Instruction cards */}
                <div className="space-y-3 mt-4">
                  {[
                    'Abra developers.facebook.com → seu app → WhatsApp → Configuração',
                    'Em "Webhook", clique em "Editar" e cole a URL de Callback e o Token',
                    'Em "Campos do webhook", ative: messages, message_deliveries, message_reads, messaging_postbacks',
                  ].map((text, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 border border-border"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <p className="text-sm">{text}</p>
                    </div>
                  ))}
                </div>

                <Button className="w-full" onClick={handleVerify}>
                  Já configurei, verificar conexão →
                </Button>
              </motion.div>
            )}

            {/* Verifying */}
            {step === "verifying" && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col items-center justify-center py-8"
              >
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <p className="text-muted-foreground">Verificando conexão...</p>
              </motion.div>
            )}

            {/* STEP 3: Success */}
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
                  Integração conectada!
                </h3>
                <p className="text-muted-foreground text-center mb-2">
                  Seu WhatsApp API está pronto para receber mensagens.
                </p>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4 text-success" />
                  {phoneNumber}
                </p>
              </motion.div>
            )}

            {/* Error */}
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
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  {errorMessage ||
                    "Não foi possível verificar a conexão. Verifique se o Token está correto e se o app no Meta está configurado."}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => handleOpenChange(false)}>
                    Configurar depois
                  </Button>
                  <Button onClick={() => { setErrorMessage(null); setStep("form"); }}>
                    Tentar novamente
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
