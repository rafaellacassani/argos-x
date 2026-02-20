import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useUserRole } from "@/hooks/useUserRole";
import { useEvolutionAPI } from "@/hooks/useEvolutionAPI";
import { useLeads } from "@/hooks/useLeads";
import { toast } from "@/hooks/use-toast";
import {
  Search,
  Plus,
  Download,
  Upload,
  MoreHorizontal,
  RefreshCw,
  Phone,
  Mail,
  MessageCircle,
  Building,
  Tag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
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

// Format phone: remove JID suffixes and format for display
const formatContactPhone = (phone: string): string => {
  const digits = phone
    .replace(/@s\.whatsapp\.net$/i, "")
    .replace(/@g\.us$/i, "")
    .replace(/@lid$/i, "")
    .replace(/@c\.us$/i, "")
    .replace(/[^0-9]/g, "");
  if (!digits || digits.length < 4) return phone;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length === 9) return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
    if (rest.length === 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
  }
  if (digits.length >= 10) return `+${digits}`;
  return phone;
};

export default function Contacts() {
  const { canDeleteContacts } = useUserRole();
  const { listInstances, getConnectionState, fetchProfilesBatch } = useEvolutionAPI();
  const { tags: allTags, addTagToLead, removeTagFromLead, createTag, fetchTags } = useLeads();
  const { workspaceId } = useWorkspace();
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [tagFilterOpen, setTagFilterOpen] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string[]>([]);
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [bulkTagSearch, setBulkTagSearch] = useState("");
  const [newBulkTagColor, setNewBulkTagColor] = useState("#3B82F6");
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 100;

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const bulkAssignTag = useCallback(async (tagId: string) => {
    if (!workspaceId || selectedContacts.length === 0) return;
    try {
      const assignments = selectedContacts.map(leadId => ({
        lead_id: leadId,
        tag_id: tagId,
        workspace_id: workspaceId,
      }));
      // Batch upsert in chunks of 500
      const BATCH = 500;
      for (let i = 0; i < assignments.length; i += BATCH) {
        const { error } = await supabase
          .from("lead_tag_assignments")
          .upsert(assignments.slice(i, i + BATCH), { onConflict: "lead_id,tag_id", ignoreDuplicates: true });
        if (error) throw error;
      }
      toast({ title: "Tag aplicada", description: `Tag adicionada a ${selectedContacts.length} contato(s).` });
      setBulkTagSearch("");
      setBulkTagOpen(false);
      fetchContacts(currentPage);
    } catch (err) {
      console.error("Bulk tag assign error:", err);
      toast({ title: "Erro ao aplicar tag", description: "Tente novamente.", variant: "destructive" });
    }
  }, [workspaceId, selectedContacts]);

  // Batch enrich contacts: fetch WhatsApp profile name/photo for contacts with only numbers
  const handleBatchEnrich = useCallback(async () => {
    setEnriching(true);
    try {
      // Get connected instances
      const allInstances = await listInstances();
      const stateResults = await Promise.all(
        allInstances.map(async (inst) => {
          const state = await getConnectionState(inst.instanceName);
          return { inst, connected: state?.instance?.state === "open" };
        })
      );
      const connectedInstance = stateResults.find((r) => r.connected)?.inst;
      if (!connectedInstance) {
        toast({ title: "Nenhuma instância conectada", description: "Conecte o WhatsApp primeiro.", variant: "destructive" });
        return;
      }

      // Find leads with only phone numbers (no proper names)
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, phone, whatsapp_jid, avatar_url")
        .not("whatsapp_jid", "is", null);

      if (!leads || leads.length === 0) {
        toast({ title: "Nenhum contato para enriquecer" });
        return;
      }

      // Filter leads that need enrichment (name looks like a number or has @lid)
      const needsEnrichment = leads.filter((l) => {
        const nameIsNumber = /^\+?\d[\d\s()-]*$/.test(l.name.trim());
        const nameHasLid = l.name.includes("@lid") || l.name.includes("@s.whatsapp");
        return (nameIsNumber || nameHasLid || !l.avatar_url) && l.whatsapp_jid;
      });

      if (needsEnrichment.length === 0) {
        toast({ title: "Todos os contatos já estão enriquecidos!" });
        return;
      }

      // Process in batches of 10
      let updated = 0;
      for (let i = 0; i < needsEnrichment.length; i += 10) {
        const batch = needsEnrichment.slice(i, i + 10);
        const numbers = batch.map((l) => 
          l.whatsapp_jid!.replace(/@s\.whatsapp\.net$/, "").replace(/@lid$/, "").replace(/@g\.us$/, "")
        );

        const profiles = await fetchProfilesBatch(connectedInstance.instanceName, numbers);

        for (let j = 0; j < batch.length; j++) {
          const lead = batch[j];
          const profile = profiles[numbers[j]];
          if (!profile) continue;

          const updates: Record<string, string> = {};
          if (profile.name && (lead.name.includes("@") || /^\+?\d[\d\s()-]*$/.test(lead.name.trim()))) {
            updates.name = profile.name;
          }
          if (profile.profilePicUrl && !lead.avatar_url) {
            updates.avatar_url = profile.profilePicUrl;
          }

          if (Object.keys(updates).length > 0) {
            await supabase.from("leads").update(updates).eq("id", lead.id);
            updated++;
          }
        }

        // Pause between batches
        if (i + 10 < needsEnrichment.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      toast({ title: "Enriquecimento concluído", description: `${updated} contatos atualizados de ${needsEnrichment.length} processados.` });
      fetchContacts(currentPage);
    } catch (err) {
      console.error("[Contacts] Batch enrich error:", err);
      toast({ title: "Erro no enriquecimento", description: "Tente novamente.", variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  }, [listInstances, getConnectionState, fetchProfilesBatch]);

  const fetchContacts = useCallback(async (page = currentPage) => {
    setLoading(true);

    // Get total count
    const { count } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true });
    setTotalCount(count ?? 0);

    // Fetch paginated leads
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: leads } = await supabase
      .from("leads")
      .select("id, name, phone, email, company, source, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

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
  }, [currentPage]);

  useEffect(() => { fetchContacts(currentPage); }, [currentPage]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    setSelectedContacts([]);
  };

  const filteredContacts = useMemo(() => {
    let result = contacts;
    // Tag filter
    if (selectedTagFilter.length > 0) {
      result = result.filter(c => 
        (c.tags || []).some(t => selectedTagFilter.includes(t.id))
      );
    }
    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(searchTerm) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }
    return result;
  }, [contacts, searchTerm, selectedTagFilter]);

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
            {loading ? "Carregando..." : `${totalCount} contatos no total · Página ${currentPage} de ${totalPages || 1}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={handleBatchEnrich}
            disabled={enriching}
          >
            <RefreshCw className={`w-4 h-4 ${enriching ? "animate-spin" : ""}`} />
            {enriching ? "Enriquecendo..." : "Enriquecer Perfis"}
          </Button>
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
            <Popover open={tagFilterOpen} onOpenChange={setTagFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Tag className="w-4 h-4" />
                  Tags
                  {selectedTagFilter.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{selectedTagFilter.length}</Badge>
                  )}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar tag..." />
                  <CommandList>
                    <CommandEmpty>Nenhuma tag encontrada</CommandEmpty>
                    <CommandGroup>
                      {allTags.map((tag) => (
                        <CommandItem
                          key={tag.id}
                          onSelect={() => {
                            setSelectedTagFilter(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                          className="cursor-pointer"
                        >
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                          {selectedTagFilter.includes(tag.id) && (
                            <Check className="ml-auto h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {selectedTagFilter.length > 0 && (
                  <div className="p-2 border-t">
                    <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setSelectedTagFilter([])}>
                      <X className="w-3 h-3 mr-1" /> Limpar filtros
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
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
            <Popover open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="w-4 h-4 mr-2" />
                  Adicionar Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput placeholder="Buscar ou criar tag..." value={bulkTagSearch} onValueChange={setBulkTagSearch} />
                  <CommandList>
                    <CommandEmpty>
                      {bulkTagSearch.trim() && !allTags.some(t => t.name.toLowerCase() === bulkTagSearch.trim().toLowerCase()) ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="w-full justify-start text-xs"
                          onClick={async () => {
                            const newTag = await createTag(bulkTagSearch.trim(), newBulkTagColor);
                            if (newTag) {
                              await bulkAssignTag(newTag.id);
                            }
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Criar "{bulkTagSearch}"
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">Nenhuma tag</span>
                      )}
                    </CommandEmpty>
                    <CommandGroup>
                      {allTags
                        .filter(t => !bulkTagSearch || t.name.toLowerCase().includes(bulkTagSearch.toLowerCase()))
                        .map((tag) => (
                        <CommandItem
                          key={tag.id}
                          value={tag.name}
                          onSelect={async () => {
                            await bulkAssignTag(tag.id);
                          }}
                          className="cursor-pointer"
                        >
                          <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                          {tag.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
                filteredContacts.map((contact) => (
                  <TableRow
                    key={contact.id}
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
                    <TableCell className="text-sm">{formatContactPhone(contact.phone)}</TableCell>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Mostrando {((currentPage - 1) * PAGE_SIZE) + 1}–{Math.min(currentPage * PAGE_SIZE, totalCount)} de {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let page: number;
              if (totalPages <= 7) {
                page = i + 1;
              } else if (currentPage <= 4) {
                page = i + 1;
              } else if (currentPage >= totalPages - 3) {
                page = totalPages - 6 + i;
              } else {
                page = currentPage - 3 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "outline"}
                  size="sm"
                  className="w-8 h-8 p-0"
                  onClick={() => goToPage(page)}
                >
                  {page}
                </Button>
              );
            })}
            <Button
              variant="outline"
              size="sm"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <ImportContactsDialog open={importOpen} onOpenChange={setImportOpen} onImportComplete={() => fetchContacts(currentPage)} />
    </div>
  );
}
