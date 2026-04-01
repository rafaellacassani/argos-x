import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Loader2, Eye, EyeOff, ChevronDown, Lock, Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import argosLogoDark from "@/assets/argos-logo-dark.png";

const COUNTRY_CODES = [
  { code: "55", flag: "🇧🇷", name: "Brasil" },
  { code: "1", flag: "🇺🇸", name: "EUA" },
  { code: "351", flag: "🇵🇹", name: "Portugal" },
  { code: "54", flag: "🇦🇷", name: "Argentina" },
  { code: "56", flag: "🇨🇱", name: "Chile" },
  { code: "57", flag: "🇨🇴", name: "Colômbia" },
  { code: "52", flag: "🇲🇽", name: "México" },
  { code: "598", flag: "🇺🇾", name: "Uruguai" },
  { code: "595", flag: "🇵🇾", name: "Paraguai" },
  { code: "34", flag: "🇪🇸", name: "Espanha" },
  { code: "44", flag: "🇬🇧", name: "Reino Unido" },
  { code: "49", flag: "🇩🇪", name: "Alemanha" },
  { code: "33", flag: "🇫🇷", name: "França" },
  { code: "39", flag: "🇮🇹", name: "Itália" },
];

function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function applyCpfCnpjMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  if (digits.length <= 11) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

const PIXEL_ID = "1294031842786070";
const PRODUCTION_URL = "https://argosx.com.br/cadastro";

const PLANS = [
  { id: "essencial", name: "Essencial", price: "R$ 47,90", priceNum: "47,90" },
  { id: "negocio", name: "Negócio", price: "R$ 97,90", priceNum: "97,90" },
  { id: "escala", name: "Escala", price: "R$ 197,90", priceNum: "197,90" },
];

export default function Cadastro() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  // Redirect logged-in users with workspace to dashboard
  useEffect(() => {
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (!session) return;
        const { data } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .not("accepted_at", "is", null)
          .limit(1)
          .maybeSingle();
        if (data) navigate("/dashboard", { replace: true });
      });
    });
  }, [navigate]);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pixelReady, setPixelReady] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("essencial");
  const [termsAccepted, setTermsAccepted] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const keys = ['fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    const attribution: Record<string, string> = {};
    keys.forEach(k => { const v = params.get(k); if (v) attribution[k] = v; });
    if (Object.keys(attribution).length > 0) {
      localStorage.setItem('lead_attribution', JSON.stringify(attribution));
    }
    // Pre-select plan from URL if provided
    const planParam = params.get('plan');
    if (planParam && PLANS.some(p => p.id === planParam)) {
      setSelectedPlan(planParam);
    }
  }, []);

  useEffect(() => {
    const w = window as any;
    if (!w.fbq) {
      const n: any = (w.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      });
      if (!w._fbq) w._fbq = n;
      n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
    }

    const existing = document.querySelector('script[src*="fbevents.js"]');
    if (existing) {
      w.fbq("init", PIXEL_ID);
      w.fbq("track", "PageView");
      setPixelReady(true);
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    script.onload = () => { setPixelReady(true); };
    document.head.appendChild(script);

    w.fbq("init", PIXEL_ID);
    w.fbq("track", "PageView");
  }, []);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    companyName: "",
    cpfCnpj: "",
    password: "",
    confirmPassword: "",
  });
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_CODES[0]);
  const [ddiOpen, setDdiOpen] = useState(false);
  const ddiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddiRef.current && !ddiRef.current.contains(e.target as Node)) setDdiOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handlePhoneChange = (value: string) => {
    setForm((prev) => ({ ...prev, phone: applyPhoneMask(value) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone || !form.email || !form.companyName || !form.cpfCnpj || !form.password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }

    if (form.password.length < 6) {
      toast({ title: "A senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }

    if (form.password !== form.confirmPassword) {
      toast({ title: "As senhas não coincidem", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const eventId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const storedAttribution = JSON.parse(localStorage.getItem('lead_attribution') || '{}');
      const hasAttribution = Object.keys(storedAttribution).length > 0;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/signup-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: `${selectedCountry.code}${form.phone.replace(/\D/g, "")}`,
            email: form.email,
            companyName: form.companyName,
            password: form.password,
            plan: selectedPlan,
            eventId,
            sourceUrl: PRODUCTION_URL,
            ...(hasAttribution ? { attribution: storedAttribution } : {}),
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar cadastro");
      }

      // Fire Meta pixel with full advanced matching
      const w = window as any;
      if (w.fbq) {
        const nameParts = form.name.trim().toLowerCase().split(/\s+/);
        const fullPhone = `${selectedCountry.code}${form.phone.replace(/\D/g, "")}`;
        w.fbq("init", PIXEL_ID, {
          em: form.email.trim().toLowerCase(),
          ph: fullPhone,
          fn: nameParts[0] || "",
          ln: nameParts.length > 1 ? nameParts.slice(1).join(" ") : "",
        });
        w.fbq("track", "InitiateCheckout", {
          content_name: `Argos X - ${selectedPlan}`,
          currency: "BRL",
        }, { eventID: eventId });
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("URL de checkout não retornada");
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro ao criar conta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = PLANS.find(p => p.id === selectedPlan)!;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <img src={argosLogoDark} alt="Argos X" className="h-8" />
          <a href="/auth?returnTo=/dashboard" className="text-sm text-[#1a1a6e] hover:underline font-medium">
            Já tenho conta
          </a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="max-w-md mx-auto"
        >
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              Comece grátis por 7 dias
            </h1>
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
                  <div className="flex gap-2">
                    <div className="relative" ref={ddiRef}>
                      <button
                        type="button"
                        onClick={() => setDdiOpen(!ddiOpen)}
                        className="flex items-center gap-1 h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors shrink-0"
                      >
                        <span className="text-base">{selectedCountry.flag}</span>
                        <span>+{selectedCountry.code}</span>
                        <ChevronDown className="w-3 h-3 text-muted-foreground" />
                      </button>
                      {ddiOpen && (
                        <div className="absolute top-full left-0 mt-1 w-52 max-h-56 overflow-y-auto rounded-md border border-input bg-background shadow-lg z-50">
                          {COUNTRY_CODES.map((c) => (
                            <button
                              key={c.code}
                              type="button"
                              onClick={() => { setSelectedCountry(c); setDdiOpen(false); }}
                              className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors ${c.code === selectedCountry.code ? "bg-muted font-medium" : ""}`}
                            >
                              <span className="text-base">{c.flag}</span>
                              <span className="flex-1 text-left">{c.name}</span>
                              <span className="text-muted-foreground">+{c.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handlePhoneChange(e.target.value)}
                      placeholder="(11) 99999-9999"
                      required
                      maxLength={16}
                      className="flex-1"
                    />
                  </div>
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
                <div>
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={form.password}
                      onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      required
                      minLength={6}
                      maxLength={72}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirmar senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      value={form.confirmPassword}
                      onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Repita a senha"
                      required
                      minLength={6}
                      maxLength={72}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Plan Selector */}
                <div className="space-y-2">
                  <Label>Escolha seu plano</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {PLANS.map((plan) => (
                      <button
                        key={plan.id}
                        type="button"
                        onClick={() => setSelectedPlan(plan.id)}
                        className={`relative flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center ${
                          selectedPlan === plan.id
                            ? "border-[#1a1a6e] bg-[#1a1a6e]/5 shadow-sm"
                            : "border-gray-200 hover:border-gray-300 bg-white"
                        }`}
                      >
                        {selectedPlan === plan.id && (
                          <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a6e] rounded-full flex items-center justify-center">
                            <Check className="w-3 h-3 text-white" />
                          </div>
                        )}
                        <span className={`text-sm font-semibold ${selectedPlan === plan.id ? "text-[#1a1a6e]" : "text-gray-700"}`}>
                          {plan.name}
                        </span>
                        <span className={`text-xs mt-1 ${selectedPlan === plan.id ? "text-[#1a1a6e]/80" : "text-gray-500"}`}>
                          {plan.price}/mês
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Terms checkbox */}
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className="text-xs text-gray-500 leading-relaxed cursor-pointer">
                    Eu entendo que após 7 dias gratuitos serei cobrado automaticamente o valor do plano escolhido. Posso cancelar a qualquer momento antes do fim do período de teste. Li e aceito os{" "}
                    <a href="/terms" className="underline text-gray-600" target="_blank" onClick={(e) => e.stopPropagation()}>Termos de Serviço</a> e a{" "}
                    <a href="/privacy-policy" className="underline text-gray-600" target="_blank" onClick={(e) => e.stopPropagation()}>Política de Privacidade</a>.
                  </label>
                </div>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="w-full">
                        <Button
                          type="submit"
                          disabled={loading || !termsAccepted}
                          className="w-full h-12 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
                        >
                          {loading ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <>
                              Ativar meu teste grátis
                              <ArrowRight className="w-5 h-5 ml-2" />
                            </>
                          )}
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {!termsAccepted && (
                      <TooltipContent>
                        <p>Aceite os termos para continuar</p>
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>

                <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Seus dados estão seguros. Cobrança apenas após 7 dias.
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <p className="text-sm text-gray-500">
              ✅ 7 dias grátis — depois {currentPlan.price}/mês
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
