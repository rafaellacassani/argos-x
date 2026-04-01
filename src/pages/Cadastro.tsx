import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, Eye, EyeOff, ChevronDown, Lock, Check, CreditCard, ShieldCheck, PartyPopper } from "lucide-react";
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

function applyCardNumberMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function applyExpiryMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function detectCardBrand(number: string): string {
  const d = number.replace(/\D/g, "");
  if (/^4/.test(d)) return "visa";
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^636368|438935|504175|451416|636297/.test(d) || /^5067|4576|4011/.test(d)) return "elo";
  if (/^606282|3841/.test(d)) return "hipercard";
  return "";
}

const BRAND_LABELS: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  elo: "Elo",
  hipercard: "Hipercard",
};

const PIXEL_ID = "1294031842786070";
const PRODUCTION_URL = "https://argosx.com.br/cadastro";

const PLANS = [
  { id: "essencial", name: "Essencial", price: "R$ 47,90", priceNum: "47,90" },
  { id: "negocio", name: "Negócio", price: "R$ 97,90", priceNum: "97,90" },
  { id: "escala", name: "Escala", price: "R$ 197,90", priceNum: "197,90" },
];

export default function Cadastro() {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2 | "success">(1);
  const { toast } = useToast();
  const navigate = useNavigate();

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

  const [cardForm, setCardForm] = useState({
    number: "",
    holderName: "",
    expiry: "",
    cvv: "",
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

  const goToStep2 = () => {
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
    if (!termsAccepted) {
      toast({ title: "Aceite os termos para continuar", variant: "destructive" });
      return;
    }
    const cpfDigits = form.cpfCnpj.replace(/\D/g, "");
    if (cpfDigits.length !== 11 && cpfDigits.length !== 14) {
      toast({ title: "CPF ou CNPJ inválido", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    const cardDigits = cardForm.number.replace(/\D/g, "");
    if (cardDigits.length < 13 || cardDigits.length > 16) {
      toast({ title: "Número do cartão inválido", variant: "destructive" });
      return;
    }
    if (!cardForm.holderName.trim()) {
      toast({ title: "Informe o nome impresso no cartão", variant: "destructive" });
      return;
    }
    const expiryDigits = cardForm.expiry.replace(/\D/g, "");
    if (expiryDigits.length !== 4) {
      toast({ title: "Data de validade inválida", variant: "destructive" });
      return;
    }
    const month = parseInt(expiryDigits.slice(0, 2));
    if (month < 1 || month > 12) {
      toast({ title: "Mês de validade inválido", variant: "destructive" });
      return;
    }
    if (cardForm.cvv.replace(/\D/g, "").length < 3) {
      toast({ title: "CVV inválido", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const eventId = `cr_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const storedAttribution = JSON.parse(localStorage.getItem('lead_attribution') || '{}');
      const hasAttribution = Object.keys(storedAttribution).length > 0;

      const expiryParts = cardForm.expiry.split("/");
      const expiryMonth = expiryParts[0];
      const expiryYear = `20${expiryParts[1]}`;

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/asaas-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            phone: `${selectedCountry.code}${form.phone.replace(/\D/g, "")}`,
            email: form.email,
            companyName: form.companyName,
            cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
            password: form.password,
            plan: selectedPlan,
            eventId,
            sourceUrl: PRODUCTION_URL,
            ...(hasAttribution ? { attribution: storedAttribution } : {}),
            creditCard: {
              holderName: cardForm.holderName.trim(),
              number: cardDigits,
              expiryMonth,
              expiryYear,
              ccv: cardForm.cvv.replace(/\D/g, ""),
            },
            creditCardHolderInfo: {
              name: form.name,
              email: form.email,
              cpfCnpj: form.cpfCnpj.replace(/\D/g, ""),
              phone: `${selectedCountry.code}${form.phone.replace(/\D/g, "")}`,
            },
          }),
        }
      );

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao processar cadastro");
      }

      // Fire Meta pixel — InitiateCheckout
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

        // Fire Purchase event (deduplicado com CAPI via purchaseEventId)
        if (data.purchaseEventId) {
          w.fbq("track", "Purchase", {
            value: data.planValue || currentPlan.priceNum?.replace(",", "."),
            currency: "BRL",
            content_name: `Argos X - ${currentPlan.name}`,
          }, { eventID: data.purchaseEventId });
        }
      }

      // Auto-login the user after successful checkout
      const { supabase: sb } = await import("@/integrations/supabase/client");
      const { error: loginError } = await sb.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });

      if (loginError) {
        setStep("success");
      } else {
        // If workspace was created inline, go straight to dashboard
        if (data.workspaceCreated) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/aguardando-ativacao", { replace: true });
        }
        return;
      }
    } catch (err: any) {
      toast({ title: err.message || "Erro ao criar conta", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const currentPlan = PLANS.find(p => p.id === selectedPlan)!;
  const detectedBrand = detectCardBrand(cardForm.number);

  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center">
            <img src={argosLogoDark} alt="Argos X" className="h-8" />
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center max-w-md"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <PartyPopper className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Seu trial de 7 dias começou! 🎉
            </h1>
            <p className="text-gray-600 mb-2">
              Sua conta foi criada com sucesso. O cartão será cobrado somente após o período de teste.
            </p>
            <p className="text-sm text-gray-500 mb-8">
              Plano <strong>{currentPlan.name}</strong> — {currentPlan.price}/mês após o trial
            </p>
            <Button
              onClick={() => navigate("/auth?returnTo=/dashboard")}
              className="h-12 px-8 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
            >
              Acessar o sistema agora
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        </main>
      </div>
    );
  }

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
            {/* Step indicator */}
            <div className="flex items-center justify-center gap-3 mt-4">
              <div className={`flex items-center gap-1.5 text-sm font-medium ${step === 1 ? "text-[#1a1a6e]" : "text-gray-400"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 1 ? "bg-[#1a1a6e] text-white" : "bg-gray-200 text-gray-500"}`}>
                  {step === 2 ? <Check className="w-4 h-4" /> : "1"}
                </div>
                Sua conta
              </div>
              <div className="w-8 h-px bg-gray-300" />
              <div className={`flex items-center gap-1.5 text-sm font-medium ${step === 2 ? "text-[#1a1a6e]" : "text-gray-400"}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 2 ? "bg-[#1a1a6e] text-white" : "bg-gray-200 text-gray-500"}`}>
                  2
                </div>
                Pagamento
              </div>
            </div>
          </div>

          <Card className="shadow-lg border-gray-100">
            <CardContent className="pt-6">
              <AnimatePresence mode="wait">
                {step === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="name">Nome completo</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Seu nome" required maxLength={100} />
                    </div>
                    <div>
                      <Label htmlFor="phone">WhatsApp</Label>
                      <div className="flex gap-2">
                        <div className="relative" ref={ddiRef}>
                          <button type="button" onClick={() => setDdiOpen(!ddiOpen)} className="flex items-center gap-1 h-10 px-3 rounded-md border border-input bg-background text-sm hover:bg-muted transition-colors shrink-0">
                            <span className="text-base">{selectedCountry.flag}</span>
                            <span>+{selectedCountry.code}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground" />
                          </button>
                          {ddiOpen && (
                            <div className="absolute top-full left-0 mt-1 w-52 max-h-56 overflow-y-auto rounded-md border border-input bg-background shadow-lg z-50">
                              {COUNTRY_CODES.map((c) => (
                                <button key={c.code} type="button" onClick={() => { setSelectedCountry(c); setDdiOpen(false); }}
                                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted transition-colors ${c.code === selectedCountry.code ? "bg-muted font-medium" : ""}`}>
                                  <span className="text-base">{c.flag}</span>
                                  <span className="flex-1 text-left">{c.name}</span>
                                  <span className="text-muted-foreground">+{c.code}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <Input id="phone" value={form.phone} onChange={(e) => handlePhoneChange(e.target.value)} placeholder="(11) 99999-9999" required maxLength={16} className="flex-1" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} placeholder="seu@email.com" required maxLength={255} />
                    </div>
                    <div>
                      <Label htmlFor="company">Nome da empresa</Label>
                      <Input id="company" value={form.companyName} onChange={(e) => setForm((p) => ({ ...p, companyName: e.target.value }))} placeholder="Sua empresa" required maxLength={100} />
                    </div>
                    <div>
                      <Label htmlFor="cpfCnpj">CPF ou CNPJ</Label>
                      <Input id="cpfCnpj" value={form.cpfCnpj} onChange={(e) => setForm((p) => ({ ...p, cpfCnpj: applyCpfCnpjMask(e.target.value) }))} placeholder="000.000.000-00" required maxLength={18} />
                    </div>
                    <div>
                      <Label htmlFor="password">Senha</Label>
                      <div className="relative">
                        <Input id="password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} placeholder="Mínimo 6 caracteres" required minLength={6} maxLength={72} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="confirmPassword">Confirmar senha</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirm ? "text" : "password"} value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repita a senha" required minLength={6} maxLength={72} />
                        <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Plan Selector */}
                    <div className="space-y-2">
                      <Label>Escolha seu plano</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {PLANS.map((plan) => (
                          <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)}
                            className={`relative flex flex-col items-center p-3 rounded-lg border-2 transition-all text-center ${selectedPlan === plan.id ? "border-[#1a1a6e] bg-[#1a1a6e]/5 shadow-sm" : "border-gray-200 hover:border-gray-300 bg-white"}`}>
                            {selectedPlan === plan.id && (
                              <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#1a1a6e] rounded-full flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                            <span className={`text-sm font-semibold ${selectedPlan === plan.id ? "text-[#1a1a6e]" : "text-gray-700"}`}>{plan.name}</span>
                            <span className={`text-xs mt-1 ${selectedPlan === plan.id ? "text-[#1a1a6e]/80" : "text-gray-500"}`}>{plan.price}/mês</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Terms */}
                    <div className="flex items-start gap-2">
                      <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(checked) => setTermsAccepted(checked === true)} className="mt-0.5" />
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
                            <Button type="button" onClick={goToStep2} disabled={!termsAccepted} className="w-full h-12 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white">
                              Continuar para pagamento
                              <ArrowRight className="w-5 h-5 ml-2" />
                            </Button>
                          </div>
                        </TooltipTrigger>
                        {!termsAccepted && (
                          <TooltipContent><p>Aceite os termos para continuar</p></TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>

                    <p className="text-center text-xs text-gray-500 flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      Seus dados estão seguros. Cobrança apenas após 7 dias.
                    </p>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-4"
                  >
                    <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
                      <ArrowLeft className="w-4 h-4" />
                      Voltar
                    </button>

                    <div className="bg-gray-50 rounded-lg p-3 mb-2">
                      <p className="text-sm text-gray-700">
                        Plano <strong>{currentPlan.name}</strong> — <strong>{currentPlan.price}/mês</strong>
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Primeiro pagamento em 7 dias. Cancele a qualquer momento.</p>
                    </div>

                    <div>
                      <Label htmlFor="cardNumber">Número do cartão</Label>
                      <div className="relative">
                        <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                          id="cardNumber"
                          value={cardForm.number}
                          onChange={(e) => setCardForm(p => ({ ...p, number: applyCardNumberMask(e.target.value) }))}
                          placeholder="0000 0000 0000 0000"
                          maxLength={19}
                          className="pl-10"
                          autoComplete="cc-number"
                        />
                        {detectedBrand && (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {BRAND_LABELS[detectedBrand] || detectedBrand}
                          </span>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="holderName">Nome impresso no cartão</Label>
                      <Input
                        id="holderName"
                        value={cardForm.holderName}
                        onChange={(e) => setCardForm(p => ({ ...p, holderName: e.target.value.toUpperCase() }))}
                        placeholder="NOME COMO NO CARTÃO"
                        maxLength={50}
                        autoComplete="cc-name"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="expiry">Validade</Label>
                        <Input
                          id="expiry"
                          value={cardForm.expiry}
                          onChange={(e) => setCardForm(p => ({ ...p, expiry: applyExpiryMask(e.target.value) }))}
                          placeholder="MM/AA"
                          maxLength={5}
                          autoComplete="cc-exp"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cvv">CVV</Label>
                        <Input
                          id="cvv"
                          value={cardForm.cvv}
                          onChange={(e) => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
                          placeholder="000"
                          maxLength={4}
                          autoComplete="cc-csc"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="w-full h-12 text-base font-semibold bg-[#1a1a6e] hover:bg-[#1a1a6e]/90 text-white"
                    >
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Lock className="w-4 h-4 mr-2" />
                          Iniciar Trial Grátis de 7 dias
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-gray-500 bg-green-50 rounded-lg py-2.5 px-3">
                      <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
                      <span>Ambiente seguro — dados protegidos pelo Asaas</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
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
