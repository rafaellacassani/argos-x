import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, LogIn, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSearchParams } from "react-router-dom";
import argosLogoDark from "@/assets/argos-logo-dark.png";

export default function CadastroSucesso() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";

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
                  Conta ativada com sucesso! 🎉
                </h1>
                <p className="text-gray-500 text-sm">
                  Seu teste grátis de 7 dias já está ativo.
                </p>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 flex items-start gap-3 text-left">
                <Clock className="w-5 h-5 text-[#1a1a6e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Sem cobrança por 7 dias
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Você pode cancelar a qualquer momento antes do período de teste terminar.
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 flex items-start gap-3 text-left">
                <LogIn className="w-5 h-5 text-[#1a1a6e] mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Tudo pronto!
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Faça login com <strong>{email}</strong> e a senha que você criou.
                  </p>
                </div>
              </div>

              <Button
                asChild
                className="w-full h-12 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
              >
                <a href="/auth">
                  Entrar no Argos X
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
