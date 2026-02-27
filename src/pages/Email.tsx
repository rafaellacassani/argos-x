import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Star,
  Archive,
  Trash2,
  MoreHorizontal,
  Paperclip,
  Reply,
  Forward,
  Inbox,
  Send,
  File,
  RefreshCw,
  Mail,
  LogOut,
  X,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useEmails, type Email } from "@/hooks/useEmails";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

const folders = [
  { id: "inbox", icon: Inbox, label: "Caixa de Entrada" },
  { id: "starred", icon: Star, label: "Com estrela" },
  { id: "sent", icon: Send, label: "Enviados" },
  { id: "drafts", icon: File, label: "Rascunhos" },
  { id: "archive", icon: Archive, label: "Arquivados" },
  { id: "trash", icon: Trash2, label: "Lixeira" },
];

function formatEmailDate(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Ontem";
  return format(date, "dd/MM", { locale: ptBR });
}

function getInitials(name: string | null, email: string | null) {
  const src = name || email || "?";
  return src.split(/[\s@]/).filter(Boolean).slice(0, 2).map(n => n[0]?.toUpperCase()).join("");
}

// Empty state for when no Gmail account is connected
function ConnectGmailView({ onConnect, loading: connecting }: { onConnect: () => void; loading: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md space-y-6"
      >
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto">
          <Mail className="w-10 h-10 text-primary-foreground" />
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold mb-2">Conecte seu Email</h2>
          <p className="text-muted-foreground">
            Conecte sua conta Gmail para ler, responder e enviar emails diretamente pelo Argos X.
          </p>
        </div>
        <Button onClick={onConnect} disabled={connecting} size="lg" className="gap-2">
          {connecting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
          Conectar Gmail
        </Button>
      </motion.div>
    </div>
  );
}

// Compose email dialog
function ComposeDialog({
  open,
  onOpenChange,
  onSend,
  sending,
  replyTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (to: string, subject: string, body: string, cc?: string, replyToId?: string) => Promise<boolean>;
  sending: boolean;
  replyTo?: Email | null;
}) {
  const [to, setTo] = useState(replyTo ? (replyTo.from_email || "") : "");
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject || ""}` : "");
  const [body, setBody] = useState("");

  const handleSend = async () => {
    if (!to || !subject) return;
    const success = await onSend(to, subject, `<p>${body.replace(/\n/g, "<br/>")}</p>`, cc || undefined, replyTo?.id);
    if (success) {
      onOpenChange(false);
      setTo("");
      setCc("");
      setSubject("");
      setBody("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{replyTo ? "Responder" : "Novo Email"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Para</Label>
            <Input value={to} onChange={e => setTo(e.target.value)} placeholder="email@exemplo.com" />
          </div>
          <div>
            <Label>CC (opcional)</Label>
            <Input value={cc} onChange={e => setCc(e.target.value)} placeholder="cc@exemplo.com" />
          </div>
          <div>
            <Label>Assunto</Label>
            <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do email" />
          </div>
          <div>
            <Label>Mensagem</Label>
            <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Escreva sua mensagem..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSend} disabled={sending || !to || !subject} className="gap-2">
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EmailPage() {
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .then(({ data }) => setIsSuperAdmin(!!(data && data.length > 0)));
  }, [user]);

  if (isSuperAdmin === false) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md space-y-4"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mx-auto">
            <Clock className="w-10 h-10 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-display font-bold">Em breve</h2>
          <p className="text-muted-foreground">
            O módulo de Email está sendo desenvolvido e estará disponível em breve.
          </p>
        </motion.div>
      </div>
    );
  }

  if (isSuperAdmin === null) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Mail className="w-8 h-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  return <EmailPageContent />;
}

function EmailPageContent() {
  const {
    emailAccount,
    emails,
    loading,
    syncing,
    sending,
    connectGmail,
    disconnectGmail,
    syncEmails,
    sendEmail,
    performAction,
    fetchEmails,
  } = useEmails();

  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [searchQuery, setSearchQuery] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<Email | null>(null);
  const [connectingGmail, setConnectingGmail] = useState(false);

  // Handle folder change
  const handleFolderChange = (folderId: string) => {
    setActiveFolder(folderId);
    setSelectedEmail(null);
    if (folderId === "starred") {
      // Filter starred locally
    } else {
      fetchEmails(folderId);
    }
  };

  // Filter emails
  const filteredEmails = emails.filter(e => {
    if (activeFolder === "starred") return e.is_starred;
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      e.subject?.toLowerCase().includes(q) ||
      e.from_name?.toLowerCase().includes(q) ||
      e.from_email?.toLowerCase().includes(q) ||
      e.snippet?.toLowerCase().includes(q)
    );
  });

  const unreadCount = emails.filter(e => !e.is_read && e.folder === "inbox").length;

  // Handle connect
  const handleConnect = async () => {
    setConnectingGmail(true);
    await connectGmail();
  };

  // Handle reply
  const handleReply = (email: Email) => {
    setReplyTo(email);
    setComposeOpen(true);
  };

  // Handle compose
  const handleCompose = () => {
    setReplyTo(null);
    setComposeOpen(true);
  };

  // Handle send
  const handleSend = async (to: string, subject: string, body: string, cc?: string, replyToId?: string) => {
    return await sendEmail(to, subject, body, cc, replyToId);
  };

  // If no email account connected
  if (!loading && !emailAccount) {
    return (
      <div className="h-[calc(100vh-8rem)] flex">
        <ConnectGmailView onConnect={handleConnect} loading={connectingGmail} />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Sidebar */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-56 flex flex-col">
        <Button onClick={handleCompose} className="mb-4 gap-2">
          <Plus className="w-4 h-4" />
          Novo Email
        </Button>

        <nav className="space-y-1">
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => handleFolderChange(folder.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                activeFolder === folder.id
                  ? "bg-secondary/10 text-secondary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <folder.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.id === "inbox" && unreadCount > 0 && (
                <span className="text-xs font-medium">{unreadCount}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Account info */}
        {emailAccount && (
          <div className="mt-auto pt-4 border-t border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Mail className="w-3 h-3" />
              <span className="truncate">{emailAccount.email_address}</span>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={syncEmails} disabled={syncing} className="flex-1 text-xs gap-1">
                <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
                Sincronizar
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={disconnectGmail}>
                <LogOut className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Email List */}
      <div className="w-96 bg-card rounded-xl border border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar emails..."
              className="pl-10 bg-muted/50 border-transparent"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-4 mb-1">
                  <div className="flex items-start gap-3">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-48 mb-1" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </div>
              ))
            ) : filteredEmails.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum email encontrado</p>
              </div>
            ) : (
              filteredEmails.map(email => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => {
                    setSelectedEmail(email);
                    if (!email.is_read) performAction(email.id, "mark_read");
                  }}
                  className={cn(
                    "p-4 rounded-lg cursor-pointer transition-all mb-1",
                    selectedEmail?.id === email.id
                      ? "bg-secondary/10 border border-secondary/20"
                      : "hover:bg-muted/50",
                    !email.is_read && "border-l-4 border-l-secondary"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground text-sm font-semibold flex-shrink-0">
                      {getInitials(email.from_name, email.from_email)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("text-sm truncate", !email.is_read && "font-semibold")}>
                          {email.from_name || email.from_email}
                        </span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {formatEmailDate(email.received_at)}
                        </span>
                      </div>
                      <p className={cn("text-sm mb-1 truncate", !email.is_read && "font-medium")}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{email.snippet}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {email.is_starred && <Star className="w-3 h-3 text-warning fill-warning" />}
                        {email.has_attachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Email Content */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex-1 bg-card rounded-xl border border-border flex flex-col">
        {selectedEmail ? (
          <>
            {/* Header */}
            <div className="p-6 border-b border-border">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-primary-foreground font-semibold">
                    {getInitials(selectedEmail.from_name, selectedEmail.from_email)}
                  </div>
                  <div>
                    <h2 className="font-semibold text-lg">{selectedEmail.from_name || selectedEmail.from_email}</h2>
                    <p className="text-sm text-muted-foreground">{selectedEmail.from_email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{formatEmailDate(selectedEmail.received_at)}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => performAction(selectedEmail.id, selectedEmail.is_starred ? "unstar" : "star")}
                  >
                    <Star className={cn("w-5 h-5", selectedEmail.is_starred && "fill-warning text-warning")} />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              <h1 className="text-xl font-display font-bold">{selectedEmail.subject}</h1>
              {selectedEmail.to_emails && selectedEmail.to_emails.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">Para: {(selectedEmail.to_emails as string[]).join(", ")}</p>
              )}
            </div>

            {/* Body */}
            <ScrollArea className="flex-1 p-6">
              {selectedEmail.body_html ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: selectedEmail.body_html }}
                />
              ) : (
                <div className="whitespace-pre-wrap text-sm">
                  {selectedEmail.body_text || selectedEmail.snippet}
                </div>
              )}

              {selectedEmail.has_attachments && selectedEmail.attachments && (selectedEmail.attachments as any[]).length > 0 && (
                <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-sm font-medium mb-3">Anexos ({(selectedEmail.attachments as any[]).length})</p>
                  {(selectedEmail.attachments as any[]).map((att: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border mb-2">
                      <div className="w-10 h-10 rounded bg-secondary/10 flex items-center justify-center">
                        <File className="w-5 h-5 text-secondary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{att.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {att.size ? `${Math.round(att.size / 1024)} KB` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Actions */}
            <div className="p-4 border-t border-border flex items-center gap-2">
              <Button onClick={() => handleReply(selectedEmail)} className="gap-2">
                <Reply className="w-4 h-4" />
                Responder
              </Button>
              <Button variant="outline" className="gap-2" onClick={() => {
                setReplyTo(null);
                setComposeOpen(true);
              }}>
                <Forward className="w-4 h-4" />
                Encaminhar
              </Button>
              <div className="flex-1" />
              <Button variant="ghost" size="icon" onClick={() => performAction(selectedEmail.id, "archive")}>
                <Archive className="w-5 h-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => performAction(selectedEmail.id, "trash")}>
                <Trash2 className="w-5 h-5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Selecione um email para visualizar</p>
            </div>
          </div>
        )}
      </motion.div>

      {/* Compose Dialog */}
      <ComposeDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onSend={handleSend}
        sending={sending}
        replyTo={replyTo}
      />
    </div>
  );
}
