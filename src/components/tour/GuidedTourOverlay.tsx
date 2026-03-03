import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { SpotlightMask } from "./SpotlightMask";
import { tourSteps } from "./tourSteps";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";

interface GuidedTourOverlayProps {
  isActive: boolean;
  initialStep?: number;
  onComplete: () => void;
}

export function GuidedTourOverlay({ isActive, initialStep = 0, onComplete }: GuidedTourOverlayProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { workspace } = useWorkspace();
  const retryRef = useRef<NodeJS.Timeout | null>(null);

  const step = tourSteps[currentStep];
  const progress = ((currentStep + 1) / tourSteps.length) * 100;

  // Find and measure target element
  const findTarget = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      setIsNavigating(false);
      if (retryRef.current) clearTimeout(retryRef.current);
    } else {
      setTargetRect(null);
      // Retry a few times for lazy-loaded content
      retryRef.current = setTimeout(findTarget, 500);
    }
  }, [step]);

  // Navigate to correct route when step changes
  useEffect(() => {
    if (!isActive || !step) return;

    if (location.pathname !== step.route) {
      setIsNavigating(true);
      setTargetRect(null);
      navigate(step.route);
    } else {
      // Small delay to let the page render
      setTimeout(findTarget, 300);
    }
  }, [currentStep, isActive, step, location.pathname, navigate, findTarget]);

  // When route changes, try to find the element
  useEffect(() => {
    if (!isActive || !step) return;
    if (location.pathname === step.route) {
      setTimeout(findTarget, 500);
    }
  }, [location.pathname, isActive, step, findTarget]);

  // Recalculate on resize/scroll
  useEffect(() => {
    if (!isActive) return;
    const handler = () => findTarget();
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [isActive, findTarget]);

  // Cleanup retry on unmount
  useEffect(() => {
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, []);

  // Save step to database
  const saveStep = useCallback(
    async (stepIndex: number) => {
      if (!workspace?.id) return;
      await supabase
        .from("workspaces")
        .update({ onboarding_step: stepIndex })
        .eq("id", workspace.id);
    },
    [workspace?.id]
  );

  const handleNext = useCallback(async () => {
    if (currentStep < tourSteps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      await saveStep(next);
    } else {
      // Complete
      if (workspace?.id) {
        await supabase
          .from("workspaces")
          .update({ onboarding_completed: true, onboarding_step: tourSteps.length })
          .eq("id", workspace.id);
      }
      onComplete();
    }
  }, [currentStep, saveStep, workspace?.id, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      saveStep(prev);
    }
  }, [currentStep, saveStep]);

  const handleSkip = useCallback(async () => {
    if (workspace?.id) {
      await supabase
        .from("workspaces")
        .update({ onboarding_completed: true, onboarding_step: tourSteps.length })
        .eq("id", workspace.id);
    }
    onComplete();
  }, [workspace?.id, onComplete]);

  if (!isActive || !step) return null;

  // Calculate tooltip position
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      // Centered fallback
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }

    const tooltipWidth = 400;
    const tooltipHeight = 260;
    const gap = 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    // Try placement preference, then auto
    const placements = [step.placement, "bottom", "top", "right", "left"];
    for (const p of placements) {
      if (p === "bottom" && targetRect.bottom + gap + tooltipHeight < vh) {
        top = targetRect.bottom + gap;
        left = Math.max(16, Math.min(targetRect.left, vw - tooltipWidth - 16));
        break;
      }
      if (p === "top" && targetRect.top - gap - tooltipHeight > 0) {
        top = targetRect.top - gap - tooltipHeight;
        left = Math.max(16, Math.min(targetRect.left, vw - tooltipWidth - 16));
        break;
      }
      if (p === "right" && targetRect.right + gap + tooltipWidth < vw) {
        top = Math.max(16, Math.min(targetRect.top, vh - tooltipHeight - 16));
        left = targetRect.right + gap;
        break;
      }
      if (p === "left" && targetRect.left - gap - tooltipWidth > 0) {
        top = Math.max(16, Math.min(targetRect.top, vh - tooltipHeight - 16));
        left = targetRect.left - gap - tooltipWidth;
        break;
      }
    }

    return { position: "fixed", top, left };
  };

  return (
    <>
      <SpotlightMask targetRect={targetRect} />

      {/* Clickable overlay area to prevent interaction */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ pointerEvents: "none" }}
      />

      {/* Tooltip card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          className="z-[9999] w-[400px] max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-card shadow-2xl"
          style={getTooltipStyle()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                {step.id}
              </div>
              <span className="text-xs text-muted-foreground font-medium">
                {step.id} de {tourSteps.length}
              </span>
            </div>
            <button
              onClick={handleSkip}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
              title="Pular tour"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Progress */}
          <div className="px-5 pb-3">
            <Progress value={progress} className="h-1.5" />
          </div>

          {/* Content */}
          <div className="px-5 pb-3">
            <h3 className="text-lg font-bold text-foreground mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Loading state */}
          {isNavigating && (
            <div className="px-5 pb-3">
              <p className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                Navegando para a página...
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between px-5 pb-5 pt-2 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>

            <Button
              size="sm"
              onClick={handleNext}
              className="gap-1"
            >
              {currentStep === tourSteps.length - 1 ? "Concluir" : "Próximo"}
              {currentStep < tourSteps.length - 1 && (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}
