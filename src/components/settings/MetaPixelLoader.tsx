import { useEffect, useRef } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";

export function MetaPixelLoader() {
  const { workspace } = useWorkspace();
  const loadedPixelId = useRef<string | null>(null);

  useEffect(() => {
    const pixelId = (workspace as any)?.meta_pixel_id;
    if (!pixelId || pixelId === loadedPixelId.current) return;

    loadedPixelId.current = pixelId;

    // Inject fbevents.js if not already loaded
    if (!(window as any).fbq) {
      const f = window as any;
      const n = (f.fbq = function () {
        n.callMethod
          ? n.callMethod.apply(n, arguments)
          : n.queue.push(arguments);
      });
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = true;
      n.version = "2.0";
      n.queue = [];

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://connect.facebook.net/en_US/fbevents.js";
      document.head.appendChild(script);
    }

    (window as any).fbq("init", pixelId);
    (window as any).fbq("track", "PageView");
  }, [workspace]);

  return null;
}
