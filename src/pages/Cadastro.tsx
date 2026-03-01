import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Crown, Sparkles, Rocket, Shield, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import argosLogoDark from "@/assets/argos-logo-dark.png";

// Phone mask helper
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

const plans = [
  {
    id: "essencial",
    name: "Essencial",
    price: "47,90",
    icon: Shield,
    features: [
      "1 usuário",
      "1 WhatsApp conectado",
      "Até 300 leads",
      "100 interações com IA/mês",
      "Funil Kanban + Chat omnichannel",
    ],
  },
  {
    id: "negocio",
    name: "Negócio",
    price: "97,90",
    icon: Sparkles,
    popular: true,
    features: [
      "Até 3 usuários",
      "2 WhatsApps conectados",
      "Até 1.000 leads",
      "500 interações com IA/mês",
      "Tudo do Essencial + alertas WhatsApp + agente SDR",
    ],
  },
  {
    id: "escala",
    name: "Escala",
    price: "197,90",
    icon: Rocket,
    features: [
      "Até 10 usuários",
      "5 WhatsApps conectados",
      "Até 5.000 leads",
      "2.000 interações com IA/mês",
      "Tudo do Negócio + dashboards avançados + suporte prioritário",
    ],
  },
];

export default function Cadastro() {
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
  });

  const handlePhoneChange = (value: string) => {
    setForm((prev) => ({ ...prev, phone: applyPhoneMask(value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.email || !form.companyName) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-signup`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: form.phone.replace(/\D/g, ""),
            email: form.email,
            companyName: form.companyName,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao criar conta");
      }

      setEmail(form.email);
      setStep(2);
    } catch (err: any) {
      toast({ title: err.message || "Erro ao criar conta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    setCheckoutLoading(planId);
    try {
      // We need to call create-checkout-session without auth for a public user
      // Since the user was just created, we sign them in temporarily to get a session
      // Actually, we call the edge function directly with the workspace info
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

      // Use create-checkout-session which expects auth, but our user has no password yet.
      // Instead, let's create a lightweight public checkout flow
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/public-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            plan: planId,
            successUrl: `${window.location.origin}/cadastro/sucesso?email=${encodeURIComponent(email)}`,
            cancelUrl: `${window.location.origin}/cadastro`,
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar checkout");

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro ao processar", variant: "destructive" });
    } finally {
      setCheckoutLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={argosLogoDark} alt="Argos X" className="h-8" />
          <a href="/auth" className="text-sm text-[#1a1a6e] hover:underline font-medium">
            Já tenho conta
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="max-w-md mx-auto"
            >
              <div className="text-center mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Comece grátis por 7 dias
                </h1>
                <p className="text-gray-500">
                  Sem cartão de crédito. Cancele quando quiser.
                </p>
              </div>

              <Card className="shadow-lg border-gray-100">
                <CardContent className="pt-6">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome completo</Label>
                      <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                        placeholder="Seu nome"
                        required
                        maxLength={100}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">WhatsApp</Label>
                      <Input
                        id="phone"
                        value={form.phone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        placeholder="(11) 99999-9999"
                        required
                        maxLength={16}
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                        placeholder="seu@email.com"
                        required
                        maxLength={255}
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Nome da empresa</Label>
                      <Input
                        id="company"
                        value={form.companyName}
                        onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))}
                        placeholder="Sua empresa"
                        required
                        maxLength={100}
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={loading}
                      className="w-full h-12 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          Começar grátis
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-center text-xs text-gray-400 mt-4">
                Ao continuar, você concorda com nossos{" "}
                <a href="/terms" className="underline">Termos de Serviço</a> e{" "}
                <a href="/privacy-policy" className="underline">Política de Privacidade</a>.
              </p>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-700 text-sm font-medium mb-4">
                  <Check className="w-4 h-4" />
                  Conta criada com sucesso!
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  Escolha seu plano
                </h2>
                <p className="text-gray-500">
                  Todos os planos incluem 7 dias grátis. Cancele a qualquer momento.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                {plans.map((plan) => {
                  const Icon = plan.icon;
                  return (
                    <motion.div
                      key={plan.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: plans.indexOf(plan) * 0.1 }}
                    >
                      <Card
                        className={`relative h-full flex flex-col shadow-md hover:shadow-xl transition-shadow border ${
                          plan.popular
                            ? "border-[#1a1a6e] ring-2 ring-[#1a1a6e]/10"
                            : "border-gray-100"
                        }`}
                      >
                        {/* Trial badge */}
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white text-xs px-3 py-1">
                            7 dias grátis
                          </Badge>
                        </div>

                        {plan.popular && (
                          <div className="absolute -top-3 right-4">
                            <Badge className="bg-[#1a1a6e] hover:bg-[#1a1a6e] text-white text-xs px-3 py-1">
                              <Crown className="w-3 h-3 mr-1" />
                              Mais popular
                            </Badge>
                          </div>
                        )}

                        <CardHeader className="pb-2 pt-6">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-[#1a1a6e]/5 flex items-center justify-center">
                              <Icon className="w-5 h-5 text-[#1a1a6e]" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-gray-900">R$ {plan.price}</span>
                            <span className="text-gray-400 text-sm">/mês</span>
                          </div>
                        </CardHeader>

                        <CardContent className="flex-1 flex flex-col justify-between pt-2">
                          <ul className="space-y-3 mb-6">
                            {plan.features.map((f, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                                <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                                {f}
                              </li>
                            ))}
                          </ul>

                          <Button
                            onClick={() => handleSelectPlan(plan.id)}
                            disabled={!!checkoutLoading}
                            className={`w-full h-11 font-semibold ${
                              plan.popular
                                ? "bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
                                : "bg-white border-2 border-[#1a1a6e] text-[#1a1a6e] hover:bg-[#1a1a6e]/5"
                            }`}
                            variant={plan.popular ? "default" : "outline"}
                          >
                            {checkoutLoading === plan.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              "Começar teste grátis"
                            )}
                          </Button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              <p className="text-center text-sm text-gray-400 mt-8">
                Você pode pular esta etapa e escolher depois nas configurações.{" "}
                <a href="/auth" className="text-[#1a1a6e] underline font-medium">
                  Ir para o login →
                </a>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
