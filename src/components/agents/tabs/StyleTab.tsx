import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, Image, Trash2, Loader2, MessageSquare, Sparkles } from "lucide-react";

interface Props {
  agentId: string;
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

const MAX_SCREENSHOTS = 6;

export function StyleTab({ agentId, formData, updateField }: Props) {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const { data: screenshots = [], isLoading } = useQuery({
    queryKey: ["agent-attachments", agentId, "style_screenshot"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_attachments")
        .select("*")
        .eq("agent_id", agentId)
        .eq("file_type", "style_screenshot")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !workspaceId) return;

    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (remaining <= 0) {
      toast({ title: "Limite atingido", description: `Máximo de ${MAX_SCREENSHOTS} prints.`, variant: "destructive" });
      return;
    }

    const filesToUpload = Array.from(files).slice(0, remaining);

    setUploading(true);
    try {
      for (const file of filesToUpload) {
        if (!file.type.startsWith("image/")) {
          toast({ title: "Tipo inválido", description: `${file.name} não é uma imagem.`, variant: "destructive" });
          continue;
        }

        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          toast({ title: "Arquivo grande", description: `${file.name} excede 5MB.`, variant: "destructive" });
          continue;
        }

        const filePath = `${workspaceId}/${agentId}/style/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("agent-attachments")
          .upload(filePath, file);

        if (uploadError) {
          toast({ title: "Erro", description: uploadError.message, variant: "destructive" });
          continue;
        }

        await supabase.from("agent_attachments").insert({
          agent_id: agentId,
          workspace_id: workspaceId,
          file_name: file.name,
          file_path: filePath,
          file_type: "style_screenshot",
          file_size: file.size,
          mime_type: file.type,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["agent-attachments", agentId, "style_screenshot"] });
      toast({ title: "Prints enviados", description: "Screenshots adicionadas com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async (id: string, filePath: string) => {
    await supabase.storage.from("agent-attachments").remove([filePath]);
    await supabase.from("agent_attachments").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["agent-attachments", agentId, "style_screenshot"] });
    toast({ title: "Removido" });
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from("agent-attachments").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleAnalyze = async () => {
    if (screenshots.length === 0) {
      toast({ title: "Sem prints", description: "Envie pelo menos 1 print de conversa.", variant: "destructive" });
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-agent-chat", {
        body: {
          action: "analyze_style",
          agent_id: agentId,
          screenshot_paths: screenshots.map((s: any) => s.file_path),
        },
      });

      if (error) throw error;

      if (data?.style_analysis) {
        updateField("style_analysis", data.style_analysis);
        toast({ title: "Análise concluída", description: "O estilo de atendimento foi identificado e será usado pela IA." });
      }
    } catch (err: any) {
      toast({ title: "Erro na análise", description: err.message, variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Seu Estilo de Atendimento</h3>
        <p className="text-sm text-muted-foreground">
          Envie até 6 prints de conversas reais suas com clientes pelo WhatsApp. Quanto mais exemplos você enviar, mais a IA vai aprender a falar do seu jeito — com o seu tom, suas expressões e a sua forma de atender.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Prints de Conversas
          </CardTitle>
          <CardDescription>
            Envie até {MAX_SCREENSHOTS} capturas de tela de conversas no WhatsApp. A IA vai analisar seu jeito de falar, trejeitos e linguagem para replicar seu estilo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {screenshots.length < MAX_SCREENSHOTS && (
            <div>
              <Label
                htmlFor="style-upload"
                className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                ) : (
                  <>
                    <Image className="w-8 h-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-foreground">Enviar prints de conversa</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {screenshots.length}/{MAX_SCREENSHOTS} • PNG, JPG — até 5MB
                    </span>
                  </>
                )}
              </Label>
              <input
                id="style-upload"
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : screenshots.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {screenshots.map((ss: any) => (
                <div key={ss.id} className="relative group rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={getPublicUrl(ss.file_path)}
                    alt={ss.file_name}
                    className="w-full h-40 object-cover"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(ss.id, ss.file_path)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">
              Nenhum print enviado ainda. Esta etapa é opcional, mas faz grande diferença na naturalidade das respostas da IA.
            </p>
          )}

          {screenshots.length > 0 && (
            <Button onClick={handleAnalyze} disabled={analyzing} className="w-full gap-2">
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {analyzing ? "Analisando estilo..." : "Analisar meu estilo de atendimento"}
            </Button>
          )}
        </CardContent>
      </Card>

      {formData.style_analysis && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Estilo Identificado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap">
              {formData.style_analysis}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Este estilo será incorporado automaticamente ao prompt da IA.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
