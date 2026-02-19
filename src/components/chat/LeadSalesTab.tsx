import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Plus, X, Edit2, Check, Trash2, ExternalLink, ShoppingBag,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "@/hooks/use-toast";
import type { Lead } from "@/hooks/useLeads";

interface Sale {
  id: string;
  lead_id: string;
  product_name: string;
  value: number;
  sale_date: string;
  link: string | null;
  created_by: string | null;
  created_at: string;
}

interface LeadSalesTabProps {
  lead: Lead;
  onLeadValueChanged?: (leadId: string, newValue: number) => void;
}

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function LeadSalesTab({ lead, onLeadValueChanged }: LeadSalesTabProps) {
  const { workspaceId } = useWorkspace();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formProduct, setFormProduct] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDate, setFormDate] = useState<Date>(new Date());
  const [formLink, setFormLink] = useState("");
  const [saving, setSaving] = useState(false);

  const totalValue = useMemo(() => sales.reduce((s, sale) => s + sale.value, 0), [sales]);

  const fetchSales = useCallback(async () => {
    const { data } = await supabase
      .from("lead_sales")
      .select("*")
      .eq("lead_id", lead.id)
      .order("sale_date", { ascending: false });
    setSales((data || []) as Sale[]);
    setLoading(false);
  }, [lead.id]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const syncLeadValue = useCallback(async (newTotal: number) => {
    await supabase.from("leads").update({ value: newTotal }).eq("id", lead.id);
    onLeadValueChanged?.(lead.id, newTotal);
  }, [lead.id, onLeadValueChanged]);

  const resetForm = () => {
    setFormProduct(""); setFormValue(""); setFormDate(new Date()); setFormLink("");
    setShowForm(false); setEditingId(null);
  };

  const handleSave = async () => {
    if (!formProduct.trim() || !formValue) return;
    const numValue = parseFloat(formValue.replace(",", "."));
    if (isNaN(numValue) || numValue <= 0) {
      toast({ title: "Valor inválido", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const dateStr = format(formDate, "yyyy-MM-dd");

      if (editingId) {
        // Update
        await supabase.from("lead_sales").update({
          product_name: formProduct.trim(),
          value: numValue,
          sale_date: dateStr,
          link: formLink.trim() || null,
        }).eq("id", editingId);
        toast({ title: "Venda atualizada" });
      } else {
        // Insert
        await supabase.from("lead_sales").insert({
          lead_id: lead.id,
          workspace_id: workspaceId!,
          product_name: formProduct.trim(),
          value: numValue,
          sale_date: dateStr,
          link: formLink.trim() || null,
          created_by: userData.user?.id || null,
        });
        toast({ title: "Venda registrada" });
      }
      resetForm();
      await fetchSales();
      // Recalculate total and sync lead value
      const { data: freshSales } = await supabase
        .from("lead_sales").select("value").eq("lead_id", lead.id);
      const newTotal = (freshSales || []).reduce((s, r) => s + Number(r.value), 0);
      await syncLeadValue(newTotal);
    } catch {
      toast({ title: "Erro ao salvar venda", variant: "destructive" });
    }
    setSaving(false);
  };

  const handleDelete = async (sale: Sale) => {
    await supabase.from("lead_sales").delete().eq("id", sale.id);
    toast({ title: "Venda removida" });
    await fetchSales();
    const { data: freshSales } = await supabase
      .from("lead_sales").select("value").eq("lead_id", lead.id);
    const newTotal = (freshSales || []).reduce((s, r) => s + Number(r.value), 0);
    await syncLeadValue(newTotal);
  };

  const startEdit = (sale: Sale) => {
    setEditingId(sale.id);
    setFormProduct(sale.product_name);
    setFormValue(sale.value.toString());
    setFormDate(new Date(sale.sale_date + "T12:00:00"));
    setFormLink(sale.link || "");
    setShowForm(true);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">

        {/* Summary */}
        <div className="bg-muted/30 rounded-xl px-4 py-3 text-center space-y-0.5">
          <p className="text-xl font-extrabold text-foreground">{formatCurrency(totalValue)}</p>
          <p className="text-[11px] text-muted-foreground">
            {sales.length} {sales.length === 1 ? "venda registrada" : "vendas registradas"}
          </p>
        </div>

        {/* Add button */}
        {!showForm && (
          <Button size="sm" className="w-full gap-1.5" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-3.5 h-3.5" /> Adicionar venda
          </Button>
        )}

        {/* Inline Form */}
        {showForm && (
          <div className="border border-border rounded-lg p-3 space-y-2.5 bg-muted/20">
            <p className="text-xs font-semibold">{editingId ? "Editar venda" : "Nova venda"}</p>
            <Input
              placeholder="Item / Produto *"
              value={formProduct}
              onChange={(e) => setFormProduct(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              placeholder="Valor (R$) *"
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
              className="h-8 text-sm"
              type="text"
              inputMode="decimal"
            />
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-full h-8 text-sm justify-start font-normal")}>
                  📅 {format(formDate, "dd/MM/yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formDate}
                  onSelect={(d) => d && setFormDate(d)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <Input
              placeholder="Link (NF, pedido, etc) — opcional"
              value={formLink}
              onChange={(e) => setFormLink(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" className="flex-1 h-8 text-xs gap-1" onClick={handleSave} disabled={saving}>
                <Check className="w-3 h-3" /> {editingId ? "Atualizar" : "Salvar"}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={resetForm}>
                <X className="w-3 h-3" /> Cancelar
              </Button>
            </div>
          </div>
        )}

        <Separator />

        {/* Sales list */}
        {loading ? (
          <p className="text-xs text-muted-foreground text-center">Carregando...</p>
        ) : sales.length === 0 ? (
          <div className="text-center py-6">
            <ShoppingBag className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma venda registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sales.map((sale) => (
              <div key={sale.id} className="flex items-start gap-2 bg-muted/20 rounded-lg px-3 py-2 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{sale.product_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatCurrency(sale.value)}</span>
                    <span>·</span>
                    <span>{new Date(sale.sale_date + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    {sale.link && (
                      <a href={sale.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(sale)}>
                    <Edit2 className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDelete(sale)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
