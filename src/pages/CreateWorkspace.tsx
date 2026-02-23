import { useState, useRef } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import argosLogoLight from "@/assets/argos-logo-light.png";

export default function CreateWorkspace() {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createWorkspace, hasWorkspace, loading: wsLoading } = useWorkspace();
  const { signOut } = useAuth();
  const navigate = useNavigate();

  if (wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (hasWorkspace) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 2MB.");
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    const ws = await createWorkspace(name.trim());

    if (ws && logoFile) {
      const ext = logoFile.name.split(".").pop() || "png";
      const path = `${ws.id}/logo.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("workspace-logos")
        .upload(path, logoFile, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("workspace-logos")
          .getPublicUrl(path);

        await supabase
          .from("workspaces")
          .update({ logo_url: urlData.publicUrl } as any)
          .eq("id", ws.id);
      }
    }

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
          <img src={argosLogoLight} alt="Argos X" className="h-20 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground font-display">
            Crie seu Workspace
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure o espaço da sua empresa para começar a usar o Argos X.
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

            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Logo da empresa (opcional)</Label>
              {logoPreview ? (
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-12 h-12 rounded-lg object-contain bg-background border border-border"
                  />
                  <span className="text-sm text-muted-foreground flex-1 truncate">
                    {logoFile?.name}
                  </span>
                  <Button type="button" variant="ghost" size="icon" onClick={removeLogo}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all text-muted-foreground hover:text-foreground"
                >
                  <Upload className="w-5 h-5" />
                  <span className="text-sm">Clique para enviar o logo</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
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
