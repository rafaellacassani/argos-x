import { useState, useEffect } from "react";
import { Save, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkspace } from "@/hooks/useWorkspace";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function MetaPixelSettings() {
  const { workspace, workspaceId, refreshWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [pixelId, setPixelId] = useState("");
  const [conversionsToken, setConversionsToken] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const currentPixelId = (workspace as any)?.meta_pixel_id;
    const currentToken = (workspace as any)?.meta_conversions_token;
    if (currentPixelId) setPixelId(currentPixelId);
    if (currentToken) setConversionsToken(currentToken);
  }, [workspace]);

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    try {
      const trimmed = pixelId.trim();
      const trimmedToken = conversionsToken.trim();
      const { error } = await supabase
        .from("workspaces")
        .update({ meta_pixel_id: trimmed || null, meta_conversions_token: trimmedToken || null } as any)
        .eq("id", workspaceId);

      if (error) throw error;

      refreshWorkspace();
      toast({
        title: trimmed ? "Pixel salvo com sucesso" : "Pixel removido",
        description: trimmed
          ? `Pixel ID ${trimmed} configurado.`
          : "O Meta Pixel foi desativado.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao salvar",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isActive = !!(workspace as any)?.meta_pixel_id;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Meta Pixel</CardTitle>
              <CardDescription>
                Rastreie conversões e otimize campanhas no Meta Ads
              </CardDescription>
            </div>
            <Badge
              variant="outline"
              className={
                isActive
                  ? "bg-success/10 text-success border-success/20"
                  : "bg-muted text-muted-foreground"
              }
            >
              {isActive ? "Ativo" : "Inativo"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pixel-id">Pixel ID</Label>
            <Input
              id="pixel-id"
              value={pixelId}
              onChange={(e) => setPixelId(e.target.value.replace(/\D/g, ""))}
              placeholder="Ex: 1294031842786070"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Encontre seu Pixel ID no{" "}
              <a
                href="https://business.facebook.com/events_manager2"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1"
              >
                Meta Events Manager
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Salvar
          </Button>

          {isActive && (
            <div className="rounded-lg border border-border bg-muted/50 p-4 mt-4">
              <h4 className="text-sm font-medium mb-2">Eventos rastreados</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• <strong>PageView</strong> — todas as páginas autenticadas</li>
                <li>• <strong>CompleteRegistration</strong> — página de cadastro</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
