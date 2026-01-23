import { useState, useEffect } from "react";
import {
  Tag,
  Plus,
  Trash2,
  Edit2,
  Check,
  X,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useLeads, type LeadTag } from "@/hooks/useLeads";
import { cn } from "@/lib/utils";

const TAG_COLORS = [
  "#EF4444", "#F97316", "#EAB308", "#22C55E", "#14B8A6",
  "#3B82F6", "#8B5CF6", "#EC4899", "#6B7280",
];

interface TagWithCount extends LeadTag {
  usageCount: number;
}

export function TagManager() {
  const { createTag, updateTag, deleteTag, getTagsWithCounts } = useLeads();
  
  const [tagsWithCounts, setTagsWithCounts] = useState<TagWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagWithCount | null>(null);
  
  // Form state
  const [tagName, setTagName] = useState("");
  const [tagColor, setTagColor] = useState(TAG_COLORS[0]);

  const loadTags = async () => {
    setLoading(true);
    const data = await getTagsWithCounts();
    setTagsWithCounts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadTags();
  }, []);

  const resetForm = () => {
    setTagName("");
    setTagColor(TAG_COLORS[0]);
    setEditingTag(null);
  };

  const handleCreateTag = async () => {
    if (!tagName.trim()) return;
    
    const newTag = await createTag(tagName.trim(), tagColor);
    if (newTag) {
      setTagsWithCounts(prev => [...prev, { ...newTag, usageCount: 0 }]);
      setIsCreateOpen(false);
      resetForm();
    }
  };

  const handleUpdateTag = async () => {
    if (!editingTag || !tagName.trim()) return;
    
    const updated = await updateTag(editingTag.id, {
      name: tagName.trim(),
      color: tagColor,
    });
    
    if (updated) {
      setTagsWithCounts(prev => 
        prev.map(t => t.id === editingTag.id 
          ? { ...t, name: tagName.trim(), color: tagColor } 
          : t
        )
      );
      resetForm();
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const success = await deleteTag(tagId);
    if (success) {
      setTagsWithCounts(prev => prev.filter(t => t.id !== tagId));
    }
  };

  const openEditDialog = (tag: TagWithCount) => {
    setEditingTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Gerenciar Tags
            </CardTitle>
            <CardDescription>
              Crie e gerencie as tags do sistema para organizar seus leads
            </CardDescription>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Tag
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-background">
              <DialogHeader>
                <DialogTitle>Criar Nova Tag</DialogTitle>
                <DialogDescription>
                  Crie uma tag para categorizar e organizar seus leads.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Nome da Tag</Label>
                  <Input
                    placeholder="Ex: Lead Quente, Campanha Natal..."
                    value={tagName}
                    onChange={(e) => setTagName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Cor</Label>
                  <div className="flex gap-2">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={cn(
                          "w-8 h-8 rounded-full border-2 transition-transform",
                          tagColor === color
                            ? "border-foreground scale-110"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => setTagColor(color)}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                {tagName && (
                  <div className="pt-2">
                    <Label className="text-muted-foreground">Preview</Label>
                    <div className="mt-2">
                      <span
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                        style={{
                          backgroundColor: tagColor + "20",
                          color: tagColor,
                        }}
                      >
                        {tagName}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setIsCreateOpen(false);
                  resetForm();
                }}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleCreateTag}
                  disabled={!tagName.trim()}
                >
                  Criar Tag
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando tags...
          </div>
        ) : tagsWithCounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma tag criada ainda</p>
            <p className="text-sm">Crie sua primeira tag para começar a organizar seus leads</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {tagsWithCounts.map((tag) => (
                <motion.div
                  key={tag.id}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="flex items-center gap-4 p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors"
                >
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{tag.name}</p>
                  </div>

                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{tag.usageCount} lead{tag.usageCount !== 1 ? 's' : ''}</span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Edit Dialog */}
                    <Dialog
                      open={editingTag?.id === tag.id}
                      onOpenChange={(open) => {
                        if (!open) resetForm();
                        else openEditDialog(tag);
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-background">
                        <DialogHeader>
                          <DialogTitle>Editar Tag</DialogTitle>
                        </DialogHeader>
                        
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Nome da Tag</Label>
                            <Input
                              value={tagName}
                              onChange={(e) => setTagName(e.target.value)}
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Cor</Label>
                            <div className="flex gap-2">
                              {TAG_COLORS.map((color) => (
                                <button
                                  key={color}
                                  type="button"
                                  className={cn(
                                    "w-8 h-8 rounded-full border-2 transition-transform",
                                    tagColor === color
                                      ? "border-foreground scale-110"
                                      : "border-transparent hover:scale-105"
                                  )}
                                  style={{ backgroundColor: color }}
                                  onClick={() => setTagColor(color)}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Preview */}
                          {tagName && (
                            <div className="pt-2">
                              <Label className="text-muted-foreground">Preview</Label>
                              <div className="mt-2">
                                <span
                                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium"
                                  style={{
                                    backgroundColor: tagColor + "20",
                                    color: tagColor,
                                  }}
                                >
                                  {tagName}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>

                        <DialogFooter>
                          <Button variant="outline" onClick={resetForm}>
                            Cancelar
                          </Button>
                          <Button onClick={handleUpdateTag}>
                            Salvar
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    {/* Delete */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-background">
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir tag?</AlertDialogTitle>
                          <AlertDialogDescription>
                            {tag.usageCount > 0 
                              ? `Esta tag está sendo usada por ${tag.usageCount} lead${tag.usageCount !== 1 ? 's' : ''}. Ao excluir, ela será removida de todos os leads.`
                              : 'Esta ação não pode ser desfeita. A tag será removida permanentemente.'
                            }
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteTag(tag.id)}
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
      </CardContent>
    </Card>
  );
}
