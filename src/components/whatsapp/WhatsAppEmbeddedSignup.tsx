import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, MessageSquare, AlertCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

interface WhatsAppEmbeddedSignupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// Facebook App ID — public/publishable key
const FACEBOOK_APP_ID = "1267221375471921";

type Step = "ready" | "loading" | "processing" | "success" | "error";

export function WhatsAppEmbeddedSignup({
  open,
  onOpenChange,
  onSuccess,
}: WhatsAppEmbeddedSignupProps) {
  const { workspaceId } = useWorkspace();
  const [step, setStep] = useState<Step>("ready");
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<{ phone_number: string; inbox_name: string } | null>(null);

  // Store embedded signup data received via window.message
  const [embeddedData, setEmbeddedData] = useState<{
    phone_number_id?: string;
    waba_id?: string;
  } | null>(null);

  // Load Facebook SDK
  useEffect(() => {
    if (sdkLoaded) return;

    // Check if already loaded
    if (window.FB) {
      setSdkLoaded(true);
      return;
    }

    window.fbAsyncInit = function () {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: true,
        version: "v21.0",
      });
      setSdkLoaded(true);
    };

    // Load SDK script
    if (!document.getElementById("facebook-jssdk")) {
      const script = document.createElement("script");
      script.id = "facebook-jssdk";
      script.src = "https://connect.facebook.net/en_US/sdk.js";
      script.async = true;
      script.defer = true;
      script.crossOrigin = "anonymous";
      document.head.appendChild(script);
    }
  }, [sdkLoaded]);

  // Listen for WA_EMBEDDED_SIGNUP message events
  const handleMessage = useCallback((event: MessageEvent) => {
    if (
      event.origin !== "https://www.facebook.com" &&
      event.origin !== "https://web.facebook.com"
    ) {
      return;
    }

    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;

      if (data.type === "WA_EMBEDDED_SIGNUP") {
        console.log("[Embedded Signup] Received WA_EMBEDDED_SIGNUP event:", data);
        const signupData = data.data || {};
        setEmbeddedData({
          phone_number_id: signupData.phone_number_id,
          waba_id: signupData.waba_id,
        });
      }
    } catch {
      // Ignore non-JSON messages
    }
  }, []);

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  const processSignup = async (code: string) => {
    setStep("processing");

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-embedded-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
        },
        body: JSON.stringify({
          code,
          phone_number_id: embeddedData?.phone_number_id || null,
          waba_id: embeddedData?.waba_id || null,
          workspace_id: workspaceId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar conexão");
      }

      setResult({ phone_number: data.phone_number, inbox_name: data.inbox_name });
      setStep("success");
      toast({
        title: "WhatsApp conectado!",
        description: `Número ${data.phone_number} conectado com sucesso.`,
      });

      setTimeout(() => {
        onSuccess?.();
        onOpenChange(false);
      }, 2500);
    } catch (err) {
      console.error("[Embedded Signup] Error:", err);
      setErrorMessage(err instanceof Error ? err.message : "Erro inesperado");
      setStep("error");
    }
  };

  const launchSignup = () => {
    if (!window.FB) {
      toast({
        title: "SDK não carregado",
        description: "Aguarde o carregamento do Facebook SDK e tente novamente.",
        variant: "destructive",
      });
      return;
    }

    setStep("loading");
    setEmbeddedData(null);

    window.FB.login(
      (response: any) => {
        if (response.authResponse) {
          const code = response.authResponse.code;
          if (code) {
            console.log("[Embedded Signup] Got authorization code");
            processSignup(code);
          } else {
            console.error("[Embedded Signup] No code in authResponse");
            setErrorMessage("Nenhum código de autorização recebido. Tente novamente.");
            setStep("error");
          }
        } else {
          console.log("[Embedded Signup] User cancelled or no auth");
          setStep("ready");
        }
      },
      {
        config_id: "1720617639391234",
        response_type: "code",
        override_default_response_type: true,
        extras: {
          feature: "whatsapp_embedded_signup",
          version: 2,
          sessionInfoVersion: "3",
        },
      }
    );
  };

  const resetState = () => {
    setStep("ready");
    setErrorMessage(null);
    setResult(null);
    setEmbeddedData(null);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(resetState, 300);
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-500" />
            Conectar WhatsApp Business
          </DialogTitle>
          <DialogDescription>
            Conecte sua conta WhatsApp Business em poucos cliques
          </DialogDescription>
        </DialogHeader>

        <div className="py-6">
          {step === "ready" && (
            <div className="space-y-4 text-center">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  Ao clicar no botão abaixo, uma janela do Facebook será aberta para você
                  autenticar e selecionar sua conta WhatsApp Business. Todo o processo é
                  automático.
                </p>
              </div>

              <ul className="text-sm text-left space-y-2 text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  Login seguro via Facebook
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  Selecione a conta de negócio e número
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  Webhook configurado automaticamente
                </li>
              </ul>

              <Button
                onClick={launchSignup}
                disabled={!sdkLoaded}
                className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white"
                size="lg"
              >
                {!sdkLoaded ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Carregando SDK...
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Conectar WhatsApp
                  </>
                )}
              </Button>
            </div>
          )}

          {step === "loading" && (
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-green-500" />
              <p className="text-sm text-muted-foreground">
                Aguardando autenticação no Facebook...
              </p>
            </div>
          )}

          {step === "processing" && (
            <div className="text-center space-y-3">
              <Loader2 className="w-10 h-10 mx-auto animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Configurando sua conexão WhatsApp...
              </p>
              <p className="text-xs text-muted-foreground">
                Trocando token, inscrevendo webhook e salvando dados
              </p>
            </div>
          )}

          {step === "success" && result && (
            <div className="text-center space-y-3">
              <CheckCircle2 className="w-12 h-12 mx-auto text-green-500" />
              <div>
                <p className="font-semibold">{result.inbox_name}</p>
                <p className="text-sm text-muted-foreground">{result.phone_number}</p>
              </div>
              <p className="text-sm text-green-600">
                Conexão ativa! Mensagens serão recebidas automaticamente.
              </p>
            </div>
          )}

          {step === "error" && (
            <div className="text-center space-y-3">
              <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              <p className="text-sm text-destructive">{errorMessage}</p>
              <Button variant="outline" onClick={resetState}>
                Tentar novamente
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Extend window for Facebook SDK types
declare global {
  interface Window {
    FB: any;
    fbAsyncInit: () => void;
  }
}
