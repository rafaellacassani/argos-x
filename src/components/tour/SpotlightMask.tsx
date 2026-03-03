import { motion, AnimatePresence } from "framer-motion";

interface SpotlightMaskProps {
  targetRect: DOMRect | null;
  padding?: number;
}

export function SpotlightMask({ targetRect, padding = 8 }: SpotlightMaskProps) {
  const hasTarget = targetRect !== null;

  const x = hasTarget ? targetRect.left - padding : 0;
  const y = hasTarget ? targetRect.top - padding : 0;
  const w = hasTarget ? targetRect.width + padding * 2 : 0;
  const h = hasTarget ? targetRect.height + padding * 2 : 0;
  const r = 12;

  return (
    <svg
      className="fixed inset-0 z-[9998] pointer-events-none"
      width="100%"
      height="100%"
      style={{ width: "100vw", height: "100vh" }}
    >
      <defs>
        <mask id="tour-spotlight-mask">
          <rect width="100%" height="100%" fill="white" />
          <AnimatePresence>
            {hasTarget && (
              <motion.rect
                key="spotlight"
                initial={{ x, y, width: w, height: h, opacity: 0 }}
                animate={{ x, y, width: w, height: h, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                rx={r}
                ry={r}
                fill="black"
              />
            )}
          </AnimatePresence>
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.7)"
        mask="url(#tour-spotlight-mask)"
        style={{ pointerEvents: "auto" }}
      />
    </svg>
  );
}
