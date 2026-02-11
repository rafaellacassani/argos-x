import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import inboxiaIcon from "@/assets/inboxia-icon.png";

export default function CreateWorkspace() {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const { createWorkspace } = useWorkspace();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    const ws = await createWorkspace(name.trim());
    setCreating(false);

    if (ws) {
      toast.success(`Workspace "${ws.name}" criado com sucesso!`);
      navigate("/dashboard");
    } else {
      toast.error("Erro ao criar workspace. Tente novamente.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl overflow-hidden mx-auto mb-4">
            <img src={inboxiaIcon} alt="Inboxia" className="w-16 h-16 object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-foreground font-display">
            Crie seu Workspace
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure o espaço da sua empresa para começar a usar o Inboxia.
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="workspace-name">Nome da empresa</Label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="workspace-name"
                  placeholder="Ex: ECX, Minha Empresa..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="pl-10"
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={!name.trim() || creating}
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ArrowRight className="w-4 h-4 mr-2" />
              )}
              Criar Workspace
            </Button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-4">
          <button onClick={signOut} className="underline hover:text-foreground transition-colors">
            Sair da conta
          </button>
        </p>
      </motion.div>
    </div>
  );
}
