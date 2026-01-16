import { useState } from "react";
import { motion } from "framer-motion";
import {
  Search,
  Plus,
  Filter,
  Download,
  Upload,
  MoreHorizontal,
  Phone,
  Mail,
  MessageCircle,
  Building,
  Tag,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Contact {
  id: string;
  leadId: string;
  name: string;
  company?: string;
  phone: string;
  email?: string;
  responsible: string;
  tags: string[];
  source: string;
  createdAt: string;
}

const contacts: Contact[] = [
  { id: "1", leadId: "INB-0001", name: "João Silva", company: "Tech Solutions", phone: "+55 11 99999-0001", email: "joao@tech.com", responsible: "Carlos", tags: ["VIP", "Interessado"], source: "WhatsApp", createdAt: "16/01/2026" },
  { id: "2", leadId: "INB-0002", name: "Maria Santos", phone: "+55 11 99999-0002", email: "maria@email.com", responsible: "Ana", tags: ["Novo"], source: "Site", createdAt: "15/01/2026" },
  { id: "3", leadId: "INB-0003", name: "Pedro Costa", company: "Digital Agency", phone: "+55 11 99999-0003", responsible: "Carlos", tags: ["Em negociação"], source: "Instagram", createdAt: "14/01/2026" },
  { id: "4", leadId: "INB-0004", name: "Ana Oliveira", company: "StartupXYZ", phone: "+55 11 99999-0004", email: "ana@startup.com", responsible: "João", tags: ["Qualificado"], source: "WhatsApp", createdAt: "13/01/2026" },
  { id: "5", leadId: "INB-0005", name: "Carlos Lima", phone: "+55 11 99999-0005", responsible: "Ana", tags: ["Novo"], source: "Indicação", createdAt: "12/01/2026" },
  { id: "6", leadId: "INB-0006", name: "Fernanda Rocha", company: "E-commerce Plus", phone: "+55 11 99999-0006", email: "fer@ecommerce.com", responsible: "Carlos", tags: ["VIP", "Fechado"], source: "WhatsApp", createdAt: "11/01/2026" },
  { id: "7", leadId: "INB-0007", name: "Ricardo Mendes", company: "Consultoria ABC", phone: "+55 11 99999-0007", email: "ricardo@abc.com", responsible: "João", tags: ["Proposta enviada"], source: "Site", createdAt: "10/01/2026" },
  { id: "8", leadId: "INB-0008", name: "Patricia Alves", company: "Marketing Pro", phone: "+55 11 99999-0008", email: "patricia@marketing.com", responsible: "Ana", tags: ["Fechado"], source: "WhatsApp", createdAt: "09/01/2026" },
];

const getTagColor = (tag: string) => {
  const colors: Record<string, string> = {
    VIP: "bg-warning/10 text-warning border-warning/20",
    Novo: "bg-secondary/10 text-secondary border-secondary/20",
    Interessado: "bg-success/10 text-success border-success/20",
    "Em negociação": "bg-primary/10 text-primary border-primary/20",
    Qualificado: "bg-inboxia-blue/10 text-inboxia-blue border-inboxia-blue/20",
    "Proposta enviada": "bg-purple-500/10 text-purple-500 border-purple-500/20",
    Fechado: "bg-success/10 text-success border-success/20",
  };
  return colors[tag] || "bg-muted text-muted-foreground border-border";
};

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const filteredContacts = contacts.filter(
    (contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm) ||
      contact.leadId.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([]);
    } else {
      setSelectedContacts(filteredContacts.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedContacts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Contatos</h1>
          <p className="text-muted-foreground">{contacts.length} contatos no total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2">
            <Upload className="w-4 h-4" />
            Importar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar
          </Button>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            Novo Contato
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="inboxia-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="gap-2">
              <Tag className="w-4 h-4" />
              Tags
              <ChevronDown className="w-4 h-4" />
            </Button>
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </Button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedContacts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inboxia-card p-4 flex items-center justify-between bg-secondary/5 border-secondary/20"
        >
          <span className="text-sm font-medium">
            {selectedContacts.length} contato(s) selecionado(s)
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar Mensagem
            </Button>
            <Button variant="outline" size="sm">
              <Tag className="w-4 h-4 mr-2" />
              Adicionar Tag
            </Button>
            <Button variant="outline" size="sm" className="text-destructive">
              Excluir
            </Button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="inboxia-card overflow-hidden"
      >
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedContacts.length === filteredContacts.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Contato</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead>Fonte</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map((contact, index) => (
              <motion.tr
                key={contact.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="hover:bg-muted/30 transition-colors"
              >
                <TableCell>
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => toggleSelect(contact.id)}
                  />
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {contact.leadId}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold">
                      {contact.name.split(" ").map((n) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{contact.name}</p>
                      {contact.company && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Building className="w-3 h-3" />
                          {contact.company}
                        </p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{contact.phone}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {contact.email || "-"}
                </TableCell>
                <TableCell className="text-sm">{contact.responsible}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {contact.tags.map((tag) => (
                      <span
                        key={tag}
                        className={`text-xs px-2 py-0.5 rounded-full border ${getTagColor(tag)}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{contact.source}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{contact.createdAt}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <MessageCircle className="w-4 h-4 mr-2" />
                        Enviar mensagem
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Phone className="w-4 h-4 mr-2" />
                        Ligar
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Mail className="w-4 h-4 mr-2" />
                        Enviar email
                      </DropdownMenuItem>
                      <DropdownMenuItem>Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}
