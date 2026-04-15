import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, StickyNote, Loader2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";

interface LeadNote {
  id: string;
  content: string;
  created_at: string;
  created_by: string;
  author_name?: string;
}

interface LeadNotesTabProps {
  leadId: string;
}

export function LeadNotesTab({ leadId }: LeadNotesTabProps) {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!leadId || !workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_notes" as any)
        .select("*")
        .eq("lead_id", leadId)
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const notesData = (data || []) as unknown as LeadNote[];

      // Fetch author names
      const authorIds = [...new Set(notesData.map(n => n.created_by).filter(Boolean))];
      let authorMap: Record<string, string> = {};
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("user_profiles")
          .select("id, full_name")
          .in("id", authorIds);
        (profiles || []).forEach(p => {
          authorMap[p.id] = p.full_name;
        });
      }

      setNotes(notesData.map(n => ({
        ...n,
        author_name: authorMap[n.created_by] || "Usuário",
      })));
    } catch (err) {
      console.error("Error fetching notes:", err);
    } finally {
      setLoading(false);
    }
  }, [leadId, workspaceId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async () => {
    if (!newNote.trim() || !user || !workspaceId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("lead_notes" as any)
        .insert({
          lead_id: leadId,
          workspace_id: workspaceId,
          created_by: user.id,
          content: newNote.trim(),
        });

      if (error) throw error;
      setNewNote("");
      toast({ title: "Nota adicionada" });
      fetchNotes();
    } catch (err) {
      console.error("Error adding note:", err);
      toast({ title: "Erro ao adicionar nota", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from("lead_notes" as any)
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast({ title: "Nota excluída" });
    } catch (err) {
      console.error("Error deleting note:", err);
      toast({ title: "Erro ao excluir nota", variant: "destructive" });
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Add note area */}
      <div className="p-4 border-b border-border space-y-3">
        <Textarea
          placeholder="Escreva uma nota ou comentário sobre este lead..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="min-h-[80px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleAddNote();
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground">
            Ctrl+Enter para salvar
          </span>
          <Button
            size="sm"
            onClick={handleAddNote}
            disabled={!newNote.trim() || saving}
            className="gap-1.5"
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            Adicionar nota
          </Button>
        </div>
      </div>

      {/* Notes list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : notes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <StickyNote className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm font-medium">Nenhuma nota registrada</p>
              <p className="text-xs mt-1">Adicione uma nota para manter o histórico deste lead.</p>
            </div>
          ) : (
            notes.map((note) => (
              <div
                key={note.id}
                className="group relative bg-muted/40 hover:bg-muted/60 rounded-xl p-4 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="w-8 h-8 flex-shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-semibold">
                      {(note.author_name || "U").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground">
                        {note.author_name}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(note.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words leading-relaxed">
                      {note.content}
                    </p>
                  </div>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive flex-shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir nota?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
