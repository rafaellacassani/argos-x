import { useEffect, useRef } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

export function MetaPixelLoader() {
  const { workspace } = useWorkspace();
  const loadedPixelId = useRef<string | null>(null);

  useEffect(() => {
    const pixelId = (workspace as any)?.meta_pixel_id;
    if (!pixelId || pixelId === loadedPixelId.current) return;

    loadedPixelId.current = pixelId;

    if (!window.fbq) {
      const n: any = (window.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      });
      if (!window._fbq) window._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }

    // Build advanced matching data from authenticated user
    const initPixel = async () => {
      const advancedMatching: Record<string, string> = {};

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.email) {
          advancedMatching.em = user.email;
        }

        if (user?.id) {
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("phone, full_name")
            .eq("user_id", user.id)
            .maybeSingle();

          if (profile?.phone) {
            let phone = profile.phone.replace(/\D/g, "");
            if (phone.length >= 10 && !phone.startsWith("55")) {
              phone = "55" + phone;
            }
            advancedMatching.ph = phone;
          }
          if (profile?.full_name) {
            const parts = profile.full_name.trim().split(/\s+/);
            if (parts.length >= 1) advancedMatching.fn = parts[0];
            if (parts.length >= 2) advancedMatching.ln = parts[parts.length - 1];
          }
        }
      } catch {
        // Proceed without advanced matching if fetch fails
      }

      window.fbq("init", pixelId, advancedMatching);
      window.fbq("track", "PageView");
    };

    initPixel();
  }, [workspace]);

  return null;
}
