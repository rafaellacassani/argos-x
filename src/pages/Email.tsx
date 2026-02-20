import { useState } from "react";
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
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface EmailItem {
  id: string;
  from: string;
  fromEmail: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  starred: boolean;
  hasAttachment: boolean;
}

const emails: EmailItem[] = [
  { id: "1", from: "João Silva", fromEmail: "joao@techsolutions.com", subject: "Re: Proposta comercial", preview: "Olá! Analisei a proposta e gostaria de discutir alguns pontos...", date: "10:30", read: false, starred: true, hasAttachment: true },
  { id: "2", from: "Maria Santos", fromEmail: "maria@empresa.com", subject: "Dúvida sobre integração", preview: "Bom dia! Tenho uma dúvida sobre a integração do WhatsApp...", date: "09:15", read: false, starred: false, hasAttachment: false },
  { id: "3", from: "Pedro Costa", fromEmail: "pedro@agency.com", subject: "Contrato assinado", preview: "Segue em anexo o contrato assinado conforme combinado...", date: "Ontem", read: true, starred: true, hasAttachment: true },
  { id: "4", from: "Ana Oliveira", fromEmail: "ana@startup.io", subject: "Reunião de alinhamento", preview: "Podemos marcar uma reunião para a próxima semana?", date: "Ontem", read: true, starred: false, hasAttachment: false },
  { id: "5", from: "Sistema Argos X", fromEmail: "noreply@argosx.com", subject: "Novo lead recebido", preview: "Você recebeu um novo lead via WhatsApp: Carlos Lima...", date: "15/01", read: true, starred: false, hasAttachment: false },
  { id: "6", from: "Fernanda Rocha", fromEmail: "fernanda@ecommerce.com", subject: "Feedback do produto", preview: "Estou muito satisfeita com o sistema! Gostaria de dar um feedback...", date: "14/01", read: true, starred: false, hasAttachment: false },
];

const folders = [
  { icon: Inbox, label: "Caixa de Entrada", count: 12 },
  { icon: Star, label: "Com estrela", count: 3 },
  { icon: Send, label: "Enviados", count: 0 },
  { icon: File, label: "Rascunhos", count: 2 },
  { icon: Archive, label: "Arquivados", count: 0 },
  { icon: Trash2, label: "Lixeira", count: 0 },
];

export default function Email() {
  const [selectedEmail, setSelectedEmail] = useState(emails[0]);
  const [activeFolder, setActiveFolder] = useState("Caixa de Entrada");

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Sidebar */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="w-56 flex flex-col"
      >
        <Button className="mb-4 gap-2">
          <Plus className="w-4 h-4" />
          Novo Email
        </Button>

        <nav className="space-y-1">
          {folders.map((folder) => (
            <button
              key={folder.label}
              onClick={() => setActiveFolder(folder.label)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                activeFolder === folder.label
                  ? "bg-secondary/10 text-secondary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <folder.icon className="w-4 h-4" />
              <span className="flex-1 text-left">{folder.label}</span>
              {folder.count > 0 && (
                <span className="text-xs font-medium">{folder.count}</span>
              )}
            </button>
          ))}
        </nav>
      </motion.div>

      {/* Email List */}
      <div className="w-96 inboxia-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar emails..." className="pl-10 bg-muted/50 border-transparent" />
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {emails.map((email) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedEmail(email)}
                className={cn(
                  "p-4 rounded-lg cursor-pointer transition-all mb-1",
                  selectedEmail.id === email.id
                    ? "bg-secondary/10 border border-secondary/20"
                    : "hover:bg-muted/50",
                  !email.read && "border-l-4 border-l-secondary"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                    {email.from.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-sm", !email.read && "font-semibold")}>
                        {email.from}
                      </span>
                      <span className="text-xs text-muted-foreground">{email.date}</span>
                    </div>
                    <p className={cn("text-sm mb-1 truncate", !email.read && "font-medium")}>
                      {email.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{email.preview}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {email.starred && <Star className="w-3 h-3 text-warning fill-warning" />}
                      {email.hasAttachment && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Email Content */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex-1 inboxia-card flex flex-col"
      >
        {/* Email Header */}
        <div className="p-6 border-b border-border">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                {selectedEmail.from.split(" ").map((n) => n[0]).join("")}
              </div>
              <div>
                <h2 className="font-semibold text-lg">{selectedEmail.from}</h2>
                <p className="text-sm text-muted-foreground">{selectedEmail.fromEmail}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{selectedEmail.date}</span>
              <Button variant="ghost" size="icon">
                <Star className={cn("w-5 h-5", selectedEmail.starred && "fill-warning text-warning")} />
              </Button>
              <Button variant="ghost" size="icon">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </div>
          </div>
          <h1 className="text-xl font-display font-bold">{selectedEmail.subject}</h1>
        </div>

        {/* Email Body */}
        <ScrollArea className="flex-1 p-6">
          <div className="prose prose-sm max-w-none">
            <p>Olá,</p>
            <p>
              {selectedEmail.preview} Lorem ipsum dolor sit amet, consectetur adipiscing elit. 
              Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim 
              veniam, quis nostrud exercitation ullamco laboris.
            </p>
            <p>
              Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat 
              nulla pariatur. Excepteur sint occaecat cupidatat non proident.
            </p>
            <p>
              Atenciosamente,<br />
              {selectedEmail.from}
            </p>
          </div>

          {selectedEmail.hasAttachment && (
            <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm font-medium mb-3">Anexos (1)</p>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-card border border-border">
                <div className="w-10 h-10 rounded bg-secondary/10 flex items-center justify-center">
                  <File className="w-5 h-5 text-secondary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">documento.pdf</p>
                  <p className="text-xs text-muted-foreground">245 KB</p>
                </div>
                <Button variant="ghost" size="sm">
                  Download
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Actions */}
        <div className="p-4 border-t border-border flex items-center gap-2">
          <Button className="gap-2">
            <Reply className="w-4 h-4" />
            Responder
          </Button>
          <Button variant="outline" className="gap-2">
            <Forward className="w-4 h-4" />
            Encaminhar
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="icon">
            <Archive className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive">
            <Trash2 className="w-5 h-5" />
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
