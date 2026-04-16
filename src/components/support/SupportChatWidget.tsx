import { Headset, X } from "lucide-react";
import { SupportChatWindow } from "./SupportChatWindow";

interface SupportChatWidgetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SupportChatWidget({ open, onOpenChange }: SupportChatWidgetProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-5rem)] rounded-2xl border bg-background shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Headset className="h-5 w-5" />
          <div>
            <p className="text-sm font-semibold">Suporte Argos X</p>
            <p className="text-xs opacity-80">Aria • Assistente IA</p>
          </div>
        </div>
        <button onClick={() => onOpenChange?.(false)} className="p-1 rounded hover:bg-white/20 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
      <SupportChatWindow />
    </div>
  );
}
