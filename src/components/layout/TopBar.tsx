import { useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Bell, Search, Moon, Sun, User, ChevronDown, LogOut, Lock, CreditCard } from "lucide-react";
import { SetPasswordDialog } from "@/components/shared/SetPasswordDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";

interface TopBarProps {
  mobileMenuSlot?: ReactNode;
}

export function TopBar({ mobileMenuSlot }: TopBarProps) {
  const [isDark, setIsDark] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const { user, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const navigate = useNavigate();

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  return (
    <header className="h-14 md:h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-3 md:px-6 gap-2">
      {/* Mobile menu trigger */}
      {mobileMenuSlot}

      {/* Search */}
      <div className="flex items-center gap-4 flex-1 max-w-xl min-w-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            className="pl-10 bg-muted/50 border-transparent focus:border-secondary focus:bg-card transition-all text-sm"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground h-8 w-8 md:h-9 md:w-9"
        >
          <motion.div
            initial={false}
            animate={{ rotate: isDark ? 180 : 0 }}
            transition={{ duration: 0.3 }}
          >
            {isDark ? <Sun className="w-4 h-4 md:w-5 md:h-5" /> : <Moon className="w-4 h-4 md:w-5 md:h-5" />}
          </motion.div>
        </Button>

        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground h-8 w-8 md:h-9 md:w-9"
        >
          <Bell className="w-4 h-4 md:w-5 md:h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1 md:gap-2 pl-1.5 md:pl-2 pr-2 md:pr-3 h-8 md:h-9">
              <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <User className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary-foreground" />
              </div>
              <div className="hidden sm:flex flex-col items-start">
                <span className="font-medium text-sm leading-tight">{displayName}</span>
                {workspace && (
                  <span className="text-[10px] text-muted-foreground leading-tight">{workspace.name}</span>
                )}
              </div>
              <ChevronDown className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>{workspace?.name || "Minha Conta"}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/perfil")}>
              <User className="w-4 h-4 mr-2" />
              Perfil & Segurança
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/configuracoes")}>Configurações</DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate("/planos")}>
              <CreditCard className="w-4 h-4 mr-2" />
              Plano & Faturamento
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <SetPasswordDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog} />
    </header>
  );
}
