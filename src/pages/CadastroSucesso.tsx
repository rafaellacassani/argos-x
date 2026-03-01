import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import argosLogoDark from "@/assets/argos-logo-dark.png";

export default function CadastroSucesso() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const [resetSent, setResetSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    // Auto-send password reset email
    if (email && !resetSent) {
      sendPasswordReset();
    }
  }, [email]);

  const sendPasswordReset = async () => {
    if (!email || sending) return;
    setSending(true);
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
      );
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: "https://argosx.com.br/auth/reset-password",
      });
      setResetSent(true);
    } catch (err) {
      console.error("Error sending reset email:", err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <img src={argosLogoDark} alt="Argos X" className="h-8" />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="shadow-xl border-gray-100 overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-[#1a1a6e] to-[#3b3bce]" />
            <CardContent className="pt-8 pb-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>

              <div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">
                  Conta criada com sucesso! 🎉
                </h1>
                <p className="text-gray-500 text-sm">
                  Seu período de teste de 7 dias já começou.
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-3 text-left">
                <Mail className="w-5 h-5 text-[#1a1a6e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Defina sua senha
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {resetSent
                      ? `Enviamos um link para ${email}. Verifique sua caixa de entrada e spam.`
                      : sending
                      ? "Enviando email..."
                      : `Enviaremos um link para ${email}`}
                  </p>
                </div>
              </div>

              {!resetSent && !sending && (
                <Button
                  onClick={sendPasswordReset}
                  variant="outline"
                  size="sm"
                  className="text-[#1a1a6e] border-[#1a1a6e]/20"
                >
                  Reenviar email
                </Button>
              )}

              <Button
                asChild
                className="w-full h-12 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
              >
                <a href="/auth">
                  Acessar o Argos X
                  <ArrowRight className="w-5 h-5 ml-2" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}
