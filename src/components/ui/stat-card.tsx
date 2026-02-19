import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  change?: {
    value: number;
    type: "increase" | "decrease";
  };
  className?: string;
  delay?: number;
}

export function StatCard({ title, value, icon, change, className, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn("inboxia-card p-6", className)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-display font-bold text-foreground">{value}</p>
          {change && (
            <div className="flex items-center gap-1 mt-2">
              {change.type === "increase" ? (
                <TrendingUp className="w-4 h-4 text-success" />
              ) : (
                <TrendingDown className="w-4 h-4 text-destructive" />
              )}
              <span
                className={cn(
                  "text-sm font-medium",
                  change.type === "increase" ? "text-success" : "text-destructive"
                )}
              >
                {change.type === "increase" ? "+" : ""}{change.value}%
              </span>
              <span className="text-sm text-muted-foreground">vs último período</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary/20 to-primary/10 flex items-center justify-center">
          <div className="text-secondary">{icon}</div>
        </div>
      </div>
    </motion.div>
  );
}
