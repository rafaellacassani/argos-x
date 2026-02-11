import { useState, useMemo } from "react";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Zap,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTagRules, type TagRule } from "@/hooks/useTagRules";
import { useLeads, type LeadTag } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
];

export function AutoTagRules() {
  const { rules, loading, createRule, updateRule, deleteRule } = useTagRules();
  const { tags, fetchTags } = useLeads();
  const { workspaceId } = useWorkspace();
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TagRule | null>(null);
  
  // Form state
  const [matchPhrase, setMatchPhrase] = useState("");
  const [selectedTagId, setSelectedTagId] = useState<string>("");
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isCreatingTag, setIsCreatingTag] = useState(false);

  const resetForm = () => {
    setMatchPhrase("");
    setSelectedTagId("");
    setNewTagName("");
    setNewTagColor(TAG_COLORS[0]);
    setIsCreatingTag(false);
    setEditingRule(null);
  };

  const handleCreateRule = async () => {
    if (!matchPhrase.trim() || !selectedTagId) return;
    
    await createRule(matchPhrase.trim(), selectedTagId);
    setIsCreateOpen(false);
    resetForm();
  };

  const handleUpdateRule = async () => {
    if (!editingRule || !matchPhrase.trim() || !selectedTagId) return;
    
    await updateRule(editingRule.id, {
      match_phrase: matchPhrase.trim(),
      tag_id: selectedTagId,
    });
    resetForm();
  };

  const handleToggleActive = async (rule: TagRule) => {
    await updateRule(rule.id, { is_active: !rule.is_active });
  };

  const handleCreateNewTag = async () => {
    if (!newTagName.trim()) return;
    
    // Import supabase to create tag directly
    const { supabase } = await import("@/integrations/supabase/client");
    
    try {
      const { data, error } = await supabase
        .from("lead_tags")
        .insert({ name: newTagName.trim(), color: newTagColor, workspace_id: workspaceId! })
        .select()
        .single();
      
      if (error) throw error;
      
      await fetchTags();
      setSelectedTagId(data.id);
      setIsCreatingTag(false);
      setNewTagName("");
    } catch (err) {
      console.error("Error creating tag:", err);
    }
  };

  const openEditDialog = (rule: TagRule) => {
    setEditingRule(rule);
    setMatchPhrase(rule.match_phrase);
    setSelectedTagId(rule.tag_id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              Tags Automáticas por Saudação
            </CardTitle>
            <CardDescription>
              Crie regras para atribuir tags automaticamente baseado na primeira mensagem do lead
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Regra
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Criar Regra de Tag Automática</DialogTitle>
                <DialogDescription>
                  Configure uma regra para atribuir tags automaticamente quando a primeira mensagem do lead contiver determinado texto.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Se a primeira mensagem contiver:</Label>
                  <Input
                    placeholder="Ex: Quero saber mais sobre o Desafio 30 dias"
                    value={matchPhrase}
                    onChange={(e) => setMatchPhrase(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A verificação não diferencia maiúsculas de minúsculas
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label>Atribuir automaticamente a tag:</Label>
                  {!isCreatingTag ? (
                    <div className="flex gap-2">
                      <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Selecione uma tag" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover">
                          {tags.map((tag) => (
                            <SelectItem key={tag.id} value={tag.id}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ backgroundColor: tag.color }}
                                />
                                {tag.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreatingTag(true)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 border rounded-lg">
                      <Input
                        placeholder="Nome da nova tag"
                        value={newTagName}
                        onChange={(e) => setNewTagName(e.target.value)}
                      />
                      <div className="flex gap-1">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            className={cn(
                              "w-6 h-6 rounded-full border-2 transition-transform",
                              newTagColor === color
                                ? "border-foreground scale-110"
                                : "border-transparent hover:scale-105"
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => setNewTagColor(color)}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleCreateNewTag}
                          disabled={!newTagName.trim()}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          Criar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setIsCreatingTag(false);
                            setNewTagName("");
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateRule}
                  disabled={!matchPhrase.trim() || !selectedTagId}
                >
                  Criar Regra
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando regras...
          </div>
        ) : rules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma regra configurada ainda</p>
            <p className="text-sm">Crie sua primeira regra para começar a tagear leads automaticamente</p>
          </div>
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {rules.map((rule) => (
                <motion.div
                  key={rule.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "flex items-center gap-4 p-4 border rounded-lg transition-colors",
                    rule.is_active ? "bg-card" : "bg-muted/50 opacity-60"
                  )}
                >
                  <button
                    onClick={() => handleToggleActive(rule)}
                    className="shrink-0"
                  >
                    {rule.is_active ? (
                      <ToggleRight className="h-6 w-6 text-green-500" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-muted-foreground" />
                    )}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      Se contiver: <span className="font-medium text-foreground">"{rule.match_phrase}"</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">Aplicar:</span>
                      {rule.tag && (
                        <Badge
                          variant="secondary"
                          style={{
                            backgroundColor: rule.tag.color + "20",
                            color: rule.tag.color,
                          }}
                        >
                          {rule.tag.name}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Edit Dialog */}
                    <Dialog
                      open={editingRule?.id === rule.id}
                      onOpenChange={(open) => {
                        if (!open) resetForm();
                        else openEditDialog(rule);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-background">
                        <DialogHeader>
                          <DialogTitle>Editar Regra</DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Se a primeira mensagem contiver:</Label>
                            <Input
                              value={matchPhrase}
                              onChange={(e) => setMatchPhrase(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Atribuir a tag:</Label>
                            <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-popover">
                                {tags.map((tag) => (
                                  <SelectItem key={tag.id} value={tag.id}>
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: tag.color }}
                                      />
                                      {tag.name}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={resetForm}>
                            Cancelar
                          </Button>
                          <Button onClick={handleUpdateRule}>
                            Salvar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-background">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A regra será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRule(rule.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Excluir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        
        {/* Example */}
        <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-dashed">
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Exemplo de uso
          </h4>
          <p className="text-sm text-muted-foreground">
            <strong>Frase:</strong> "Olá! Quero saber mais sobre o Desafio 30 dias"<br />
            <strong>Tag:</strong> Campanha Desafio30D<br />
            <br />
            Quando um lead enviar uma mensagem inicial contendo essa frase, a tag será automaticamente aplicada ao card dele no funil.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
