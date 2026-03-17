import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Search } from "lucide-react";
import { useClients } from "@/hooks/useClients";
import { useWorkspace } from "@/hooks/useWorkspace";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateClientDialog({ open, onOpenChange }: Props) {
  const { workspace } = useWorkspace();
  const { createClient } = useClients();
  const [loading, setLoading] = useState(false);
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [sameSocio, setSameSocio] = useState(true);

  const [form, setForm] = useState({
    cnpj: "", razao_social: "", nome_fantasia: "", pais: "Brasil",
    endereco: "", numero: "", bairro: "", municipio: "", estado: "", cep: "",
    socio_nome: "", socio_cpf: "", socio_email: "", socio_telefone: "",
    stakeholder_nome: "", stakeholder_email: "", financeiro_email: "",
    pacote: "Express", valor_negociado: "", data_inicio_pagamento: "",
    negociacoes_personalizadas: "", closer: "", bdr: "",
  });

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  useEffect(() => {
    if (sameSocio) {
      setForm((p) => ({
        ...p,
        stakeholder_nome: p.socio_nome,
        stakeholder_email: p.socio_email,
        financeiro_email: p.socio_email,
      }));
    }
  }, [sameSocio, form.socio_nome, form.socio_email]);

  const buscarCNPJ = async () => {
    const cnpjClean = form.cnpj.replace(/\D/g, "");
    if (cnpjClean.length !== 14) {
      toast.error("CNPJ deve ter 14 dígitos");
      return;
    }
    setCnpjLoading(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjClean}`);
      if (!res.ok) throw new Error("CNPJ não encontrado");
      const data = await res.json();
      setForm((p) => ({
        ...p,
        razao_social: data.razao_social || p.razao_social,
        nome_fantasia: data.nome_fantasia || p.nome_fantasia,
        endereco: [data.logradouro, data.complemento].filter(Boolean).join(", "),
        numero: data.numero || "",
        bairro: data.bairro || "",
        municipio: data.municipio || "",
        estado: data.uf || "",
        cep: data.cep || "",
      }));
      toast.success("Dados preenchidos via CNPJ!");
    } catch {
      toast.error("Erro ao buscar CNPJ");
    } finally {
      setCnpjLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.razao_social || !form.socio_nome || !workspace?.id) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setLoading(true);
    try {
      await createClient.mutateAsync({
        workspace_id: workspace.id,
        razao_social: form.razao_social,
        nome_fantasia: form.nome_fantasia || null,
        cnpj: form.cnpj || null,
        pais: form.pais,
        endereco: form.endereco || null,
        numero: form.numero || null,
        bairro: form.bairro || null,
        municipio: form.municipio || null,
        estado: form.estado || null,
        cep: form.cep || null,
        socio_nome: form.socio_nome,
        socio_cpf: form.socio_cpf || null,
        socio_email: form.socio_email || null,
        socio_telefone: form.socio_telefone || null,
        stakeholder_nome: sameSocio ? form.socio_nome : form.stakeholder_nome || null,
        stakeholder_email: sameSocio ? form.socio_email : form.stakeholder_email || null,
        financeiro_email: sameSocio ? form.socio_email : form.financeiro_email || null,
        pacote: form.pacote,
        valor_negociado: parseFloat(form.valor_negociado) || 0,
        valor_extenso: null,
        data_inicio_pagamento: form.data_inicio_pagamento || null,
        negociacoes_personalizadas: form.negociacoes_personalizadas || null,
        status: "Ativo",
        stage: "Onboarding",
        closer: form.closer || null,
        bdr: form.bdr || null,
        created_by: null,
      });
      onOpenChange(false);
      setForm({
        cnpj: "", razao_social: "", nome_fantasia: "", pais: "Brasil",
        endereco: "", numero: "", bairro: "", municipio: "", estado: "", cep: "",
        socio_nome: "", socio_cpf: "", socio_email: "", socio_telefone: "",
        stakeholder_nome: "", stakeholder_email: "", financeiro_email: "",
        pacote: "Express", valor_negociado: "", data_inicio_pagamento: "",
        negociacoes_personalizadas: "", closer: "", bdr: "",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Novo Cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* CNPJ */}
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <div className="flex gap-2">
              <Input
                placeholder="00.000.000/0000-00"
                value={form.cnpj}
                onChange={(e) => set("cnpj", e.target.value)}
              />
              <Button variant="outline" onClick={buscarCNPJ} disabled={cnpjLoading}>
                {cnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Buscar
              </Button>
            </div>
          </div>

          {/* Company */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Razão Social *</Label>
              <Input value={form.razao_social} onChange={(e) => set("razao_social", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Nome Fantasia</Label>
              <Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2 space-y-2">
              <Label>Endereço</Label>
              <Input value={form.endereco} onChange={(e) => set("endereco", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Número</Label>
              <Input value={form.numero} onChange={(e) => set("numero", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={form.bairro} onChange={(e) => set("bairro", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Município</Label>
              <Input value={form.municipio} onChange={(e) => set("municipio", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Input value={form.estado} onChange={(e) => set("estado", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CEP</Label>
              <Input value={form.cep} onChange={(e) => set("cep", e.target.value)} />
            </div>
          </div>

          {/* Sócio */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do sócio *</Label>
              <Input value={form.socio_nome} onChange={(e) => set("socio_nome", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>CPF do sócio</Label>
              <Input value={form.socio_cpf} onChange={(e) => set("socio_cpf", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email do sócio</Label>
              <Input value={form.socio_email} onChange={(e) => set("socio_email", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone do sócio</Label>
              <Input value={form.socio_telefone} onChange={(e) => set("socio_telefone", e.target.value)} />
            </div>
          </div>

          {/* Same as sócio checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={sameSocio}
              onCheckedChange={(v) => setSameSocio(!!v)}
              id="same-socio"
            />
            <Label htmlFor="same-socio" className="text-sm cursor-pointer">
              Responsável MKT e Financeiro são o mesmo sócio
            </Label>
          </div>

          {!sameSocio && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome stakeholder MKT</Label>
                <Input value={form.stakeholder_nome} onChange={(e) => set("stakeholder_nome", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email stakeholder</Label>
                <Input value={form.stakeholder_email} onChange={(e) => set("stakeholder_email", e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email financeiro</Label>
                <Input value={form.financeiro_email} onChange={(e) => set("financeiro_email", e.target.value)} />
              </div>
            </div>
          )}

          {/* Package */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Pacote *</Label>
              <Select value={form.pacote} onValueChange={(v) => set("pacote", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Lite">Lite</SelectItem>
                  <SelectItem value="Express">Express</SelectItem>
                  <SelectItem value="Premium">Premium</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                  <SelectItem value="Master">Master</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor negociado (R$)</Label>
              <Input
                type="number"
                value={form.valor_negociado}
                onChange={(e) => set("valor_negociado", e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data início pagamento</Label>
              <Input
                type="date"
                value={form.data_inicio_pagamento}
                onChange={(e) => set("data_inicio_pagamento", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Closer</Label>
              <Input value={form.closer} onChange={(e) => set("closer", e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Negociações personalizadas</Label>
            <Textarea
              value={form.negociacoes_personalizadas}
              onChange={(e) => set("negociacoes_personalizadas", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Criar Cliente
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
