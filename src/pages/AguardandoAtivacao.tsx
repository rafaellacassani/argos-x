import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import argosLogoDark from "@/assets/argos-logo-dark.png";

export default function AguardandoAtivacao() {
  const navigate = useNavigate();
  const [dots, setDots] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth", { replace: true });
        return;
      }

      // Auto-accept any pending invite for the logged-in user
      await supabase.functions.invoke("accept-invite").catch(() => {});

      const { data } = await supabase
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", session.user.id)
        .not("accepted_at", "is", null)
        .limit(1)
        .maybeSingle();

      if (data && !cancelled) {
        navigate("/dashboard", { replace: true });
      }
    };

    check();
    const interval = setInterval(check, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [navigate]);

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
          <Loader2 className="w-12 h-12 animate-spin text-[#1a1a6e] mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Ativando sua conta{dots}
          </h1>
          <p className="text-gray-600 mb-2">
            Estamos configurando tudo para você. Isso leva apenas alguns segundos.
          </p>
          <p className="text-sm text-gray-400">
            Você será redirecionado automaticamente.
          </p>
        </motion.div>
      </main>
    </div>
  );
}
