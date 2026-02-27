import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet, FileText, Trash2, Globe, Loader2, Link } from "lucide-react";

interface Props {
  agentId: string;
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export function AttachmentsTab({ agentId, formData, updateField }: Props) {
  const { toast } = useToast();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["agent-attachments", agentId, "document"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_attachments")
        .select("*")
        .eq("agent_id", agentId)
        .eq("file_type", "document")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!agentId,
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !workspaceId) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
          toast({ title: "Arquivo muito grande", description: `${file.name} excede 10MB`, variant: "destructive" });
          continue;
        }

        const filePath = `${workspaceId}/${agentId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("agent-attachments")
          .upload(filePath, file);

        if (uploadError) {
          toast({ title: "Erro no upload", description: uploadError.message, variant: "destructive" });
          continue;
        }

        await supabase.from("agent_attachments").insert({
          agent_id: agentId,
          workspace_id: workspaceId,
          file_name: file.name,
          file_path: filePath,
          file_type: "document",
          file_size: file.size,
          mime_type: file.type,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["agent-attachments", agentId, "document"] });
      toast({ title: "Upload concluído", description: "Documentos anexados com sucesso." });
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
    queryClient.invalidateQueries({ queryKey: ["agent-attachments", agentId, "document"] });
    toast({ title: "Removido", description: "Documento excluído." });
  };

  const getFileIcon = (name: string) => {
    if (name.match(/\.(xlsx?|csv)$/i)) return <FileSpreadsheet className="w-5 h-5 text-success" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Anexos & Site</h3>
        <p className="text-sm text-muted-foreground">
          Anexe documentos ou insira um site para que a IA consulte automaticamente.
        </p>
      </div>

      {/* Documents Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Documentos Anexados
          </CardTitle>
          <CardDescription>
            Envie planilhas de preços, catálogos em PDF ou outros documentos. A IA consultará esses arquivos para responder seus leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label
              htmlFor="doc-upload"
              className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary/50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                  <span className="text-sm font-medium text-foreground">Clique para enviar documentos</span>
                  <span className="text-xs text-muted-foreground mt-1">PDF, Excel, CSV, TXT — até 10MB cada</span>
                </>
              )}
            </Label>
            <input
              id="doc-upload"
              type="file"
              multiple
              accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : attachments.length > 0 ? (
            <div className="space-y-2">
              {attachments.map((att: any) => (
                <div key={att.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <div className="flex items-center gap-3">
                    {getFileIcon(att.file_name)}
                    <div>
                      <p className="text-sm font-medium text-foreground truncate max-w-[250px]">{att.file_name}</p>
                      <p className="text-xs text-muted-foreground">{att.file_size ? formatSize(att.file_size) : ""}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(att.id, att.file_path)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum documento anexado ainda.</p>
          )}
        </CardContent>
      </Card>

      {/* Website URL */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Site / E-commerce
          </CardTitle>
          <CardDescription>
            Insira a URL do seu site ou loja virtual. A IA lerá automaticamente as informações de produtos e preços para responder aos leads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={formData.website_url || ""}
                onChange={(e) => updateField("website_url", e.target.value)}
                placeholder="https://www.sualoja.com.br"
                className="pl-10"
              />
            </div>
          </div>
          {formData.website_url && (
            <Badge variant="secondary" className="gap-1">
              <Globe className="w-3 h-3" />
              Site configurado
            </Badge>
          )}
          <p className="text-xs text-muted-foreground">
            A IA irá consultar este site quando precisar de informações sobre produtos, preços e disponibilidade.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
