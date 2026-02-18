import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Search,
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  Phone,
  Mail,
  MessageCircle,
  Building,
  Tag,
  ChevronDown,
  Filter,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import ImportContactsDialog from "@/components/contacts/ImportContactsDialog";

interface ContactRow {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  source?: string | null;
  created_at: string;
  tags?: { id: string; name: string; color: string }[];
}

export default function Contacts() {
  const { canDeleteContacts } = useUserRole();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);

  const fetchContacts = async () => {
    setLoading(true);
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, phone, email, company, source, created_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (!leads || leads.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    const leadIds = leads.map((l) => l.id);
    const { data: tagAssignments } = await supabase
      .from("lead_tag_assignments")
      .select("lead_id, lead_tags(id, name, color)")
      .in("lead_id", leadIds);

    const tagMap = new Map<string, { id: string; name: string; color: string }[]>();
    (tagAssignments || []).forEach((ta) => {
      if (!ta.lead_tags) return;
      const arr = tagMap.get(ta.lead_id) || [];
      arr.push(ta.lead_tags as any);
      tagMap.set(ta.lead_id, arr);
    });

    setContacts(
      leads.map((l) => ({ ...l, tags: tagMap.get(l.id) || [] }))
    );
    setLoading(false);
  };

  useEffect(() => { fetchContacts(); }, []);

  const filteredContacts = useMemo(() => {
    if (!searchTerm) return contacts;
    const q = searchTerm.toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(searchTerm) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [contacts, searchTerm]);

  const toggleSelectAll = () => {
    setSelectedContacts((prev) =>
      prev.length === filteredContacts.length ? [] : filteredContacts.map((c) => c.id)
    );
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
          <p className="text-muted-foreground">
            {loading ? "Carregando..." : `${contacts.length} contatos no total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setImportOpen(true)}>
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

      {/* Search */}
      <div className="inboxia-card p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone ou email..."
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
          <span className="text-sm font-medium">{selectedContacts.length} contato(s) selecionado(s)</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <MessageCircle className="w-4 h-4 mr-2" />
              Enviar Mensagem
            </Button>
            <Button variant="outline" size="sm">
              <Tag className="w-4 h-4 mr-2" />
              Adicionar Tag
            </Button>
            <Button variant="outline" size="sm" className="text-destructive" disabled={!canDeleteContacts}>
              Excluir
            </Button>
          </div>
        </motion.div>
      )}

      {/* Table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="inboxia-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-12">
                  <Checkbox
                    checked={filteredContacts.length > 0 && selectedContacts.length === filteredContacts.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Fonte</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Nenhum contato encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact, index) => (
                  <motion.tr
                    key={contact.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(index * 0.02, 0.5) }}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedContacts.includes(contact.id)}
                        onCheckedChange={() => toggleSelect(contact.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-sm font-semibold">
                          {contact.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
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
                    <TableCell className="text-sm text-muted-foreground">{contact.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(contact.tags || []).map((tag) => (
                          <span
                            key={tag.id}
                            className="text-xs px-2 py-0.5 rounded-full border"
                            style={{
                              backgroundColor: `${tag.color}15`,
                              color: tag.color,
                              borderColor: `${tag.color}30`,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{contact.source || "-"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(contact.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><MessageCircle className="w-4 h-4 mr-2" />Enviar mensagem</DropdownMenuItem>
                          <DropdownMenuItem><Phone className="w-4 h-4 mr-2" />Ligar</DropdownMenuItem>
                          <DropdownMenuItem><Mail className="w-4 h-4 mr-2" />Enviar email</DropdownMenuItem>
                          <DropdownMenuItem>Editar</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" disabled={!canDeleteContacts}>Excluir</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </motion.tr>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </motion.div>

      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={fetchContacts} />
    </div>
  );
}
