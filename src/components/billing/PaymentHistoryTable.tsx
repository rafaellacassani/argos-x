import { useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Invoice {
  date: string;
  description: string;
  amount: number;
  status: string;
  invoiceUrl?: string;
}

interface PaymentHistoryTableProps {
  workspaceId: string;
}

const statusColors: Record<string, string> = {
  pago: "bg-emerald-600 text-white",
  pendente: "bg-yellow-500 text-white",
  vencido: "bg-red-500 text-white",
  falhou: "bg-red-500 text-white",
  cancelado: "bg-muted text-muted-foreground",
  reembolsado: "bg-blue-500 text-white",
};

export default function PaymentHistoryTable({ workspaceId }: PaymentHistoryTableProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<string>("none");

  useEffect(() => {
    async function fetchInvoices() {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("billing-portal", {
          body: { workspaceId },
        });
        if (!error && data) {
          setInvoices(data.invoices || []);
          setProvider(data.provider || "none");
        }
      } catch (err) {
        console.error("Error fetching invoices:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInvoices();
  }, [workspaceId]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-lg">Histórico de pagamentos</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Carregando faturas...</span>
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {provider === "none"
              ? "Nenhum provedor de pagamento configurado."
              : "Nenhuma fatura encontrada."}
          </p>
        ) : (
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv, i) => (
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(inv.date).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">{inv.description}</TableCell>
                    <TableCell className="text-right whitespace-nowrap font-medium">
                      R$ {inv.amount.toFixed(2).replace(".", ",")}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[inv.status] || ""}>
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.invoiceUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-8 w-8"
                        >
                          <a href={inv.invoiceUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
