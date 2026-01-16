import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Check,
  CheckCheck,
  Image,
  File,
  Mic,
  Star,
  Archive,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  name: string;
  avatar?: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
  phone: string;
}

interface Message {
  id: string;
  content: string;
  time: string;
  sent: boolean;
  read: boolean;
}

const chats: Chat[] = [
  { id: "1", name: "João Silva", lastMessage: "Olá, gostaria de saber mais sobre o produto", time: "2 min", unread: 3, online: true, phone: "+55 11 99999-0001" },
  { id: "2", name: "Maria Santos", lastMessage: "Perfeito, vou analisar a proposta", time: "15 min", unread: 0, online: true, phone: "+55 11 99999-0002" },
  { id: "3", name: "Pedro Costa", lastMessage: "Qual o prazo de entrega?", time: "1h", unread: 1, online: false, phone: "+55 11 99999-0003" },
  { id: "4", name: "Ana Oliveira", lastMessage: "Obrigada pelo atendimento!", time: "3h", unread: 0, online: false, phone: "+55 11 99999-0004" },
  { id: "5", name: "Carlos Lima", lastMessage: "Podemos agendar uma reunião?", time: "5h", unread: 0, online: true, phone: "+55 11 99999-0005" },
  { id: "6", name: "Fernanda Rocha", lastMessage: "Enviei o comprovante", time: "1d", unread: 0, online: false, phone: "+55 11 99999-0006" },
];

const messages: Message[] = [
  { id: "1", content: "Olá! Vi o anúncio do produto de vocês", time: "10:30", sent: false, read: true },
  { id: "2", content: "Olá João! Seja bem-vindo! 😊 Como posso ajudar?", time: "10:31", sent: true, read: true },
  { id: "3", content: "Gostaria de saber mais sobre os planos disponíveis", time: "10:32", sent: false, read: true },
  { id: "4", content: "Claro! Temos 3 planos: Básico, Pro e Enterprise. Qual se encaixa melhor nas suas necessidades?", time: "10:33", sent: true, read: true },
  { id: "5", content: "O Pro parece interessante. Qual o valor?", time: "10:35", sent: false, read: true },
  { id: "6", content: "O plano Pro custa R$ 297/mês e inclui todas as funcionalidades de automação + 5 agentes de IA", time: "10:36", sent: true, read: true },
  { id: "7", content: "Tem desconto para pagamento anual?", time: "10:38", sent: false, read: true },
  { id: "8", content: "Sim! No plano anual você economiza 20%, ficando R$ 237/mês 🎉", time: "10:39", sent: true, read: true },
  { id: "9", content: "Olá, gostaria de saber mais sobre o produto", time: "10:45", sent: false, read: false },
];

export default function Chats() {
  const [selectedChat, setSelectedChat] = useState(chats[0]);
  const [message, setMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChats = chats.filter((chat) =>
    chat.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-8rem)] flex rounded-xl overflow-hidden border border-border bg-card">
      {/* Chat List */}
      <div className="w-96 border-r border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-bold text-lg">Conversas</h2>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Filter className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Archive className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-muted/50 border-transparent"
            />
          </div>
        </div>

        {/* Chat List */}
        <ScrollArea className="flex-1">
          <div className="p-2">
            {filteredChats.map((chat) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                onClick={() => setSelectedChat(chat)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                  selectedChat.id === chat.id
                    ? "bg-secondary/10 border border-secondary/20"
                    : "hover:bg-muted/50"
                )}
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold">
                    {chat.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  {chat.online && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-success rounded-full border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">{chat.name}</span>
                    <span className="text-xs text-muted-foreground">{chat.time}</span>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                </div>
                {chat.unread > 0 && (
                  <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                    <span className="text-xs text-white font-medium">{chat.unread}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="h-16 px-4 border-b border-border flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-sm">
                {selectedChat.name.split(" ").map((n) => n[0]).join("")}
              </div>
              {selectedChat.online && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-success rounded-full border-2 border-card" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{selectedChat.name}</h3>
              <p className="text-xs text-muted-foreground">
                {selectedChat.online ? "Online" : "Offline"} · {selectedChat.phone}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon">
              <Phone className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Video className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <Star className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4 max-w-3xl mx-auto">
            {/* Date Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground bg-card px-2">Hoje</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn("flex", msg.sent ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-2.5",
                    msg.sent
                      ? "bg-secondary text-secondary-foreground rounded-br-md"
                      : "bg-muted rounded-bl-md"
                  )}
                >
                  <p className="text-sm">{msg.content}</p>
                  <div className={cn("flex items-center gap-1 mt-1", msg.sent ? "justify-end" : "justify-start")}>
                    <span className={cn("text-[10px]", msg.sent ? "text-secondary-foreground/70" : "text-muted-foreground")}>
                      {msg.time}
                    </span>
                    {msg.sent && (
                      msg.read ? (
                        <CheckCheck className="w-3 h-3 text-secondary-foreground/70" />
                      ) : (
                        <Check className="w-3 h-3 text-secondary-foreground/70" />
                      )
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-border bg-card">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Smile className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" className="text-muted-foreground">
              <Paperclip className="w-5 h-5" />
            </Button>
            <div className="flex-1 relative">
              <Input
                placeholder="Digite sua mensagem..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="pr-20 bg-muted/50 border-transparent focus:border-secondary"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <Image className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
                  <Mic className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <Button size="icon" className="bg-secondary hover:bg-secondary/90">
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
