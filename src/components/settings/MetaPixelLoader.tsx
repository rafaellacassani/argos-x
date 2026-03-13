import { useEffect, useRef } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";

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

    window.fbq("init", pixelId);
    window.fbq("track", "PageView");
  }, [workspace]);

  return null;
}
