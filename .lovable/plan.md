
# Plano: Sistema de Multiplas Vendas por Lead

## Objetivo

Permitir que cada lead tenha multiplas vendas/produtos associados, cada uma com nome do produto e valor, exibindo o total no card e no LeadDetailSheet.

---

## Mudancas Necessarias

### 1. Nova Tabela no Banco de Dados

Criar tabela `lead_sales` para armazenar vendas individuais:

```sql
CREATE TABLE lead_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  value NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_lead_sales_lead ON lead_sales(lead_id);
```

### 2. Atualizar LeadDetailSheet.tsx

**Substituir** o campo unico "Valor da Venda (R$)" por uma secao de vendas dinamica:

```text
+--------------------------------------------------+
| $ Vendas                           Total: R$ 850 |
+--------------------------------------------------+
| [Clareamento Dental    ] [R$ 350    ] [X]        |
| [Limpeza              ] [R$ 500    ] [X]        |
|                                                  |
| [+ Adicionar nova venda]                         |
+--------------------------------------------------+
```

**Layout de cada linha de venda:**
- Campo de texto pequeno para nome do produto (flex-1)
- Campo numerico pequeno para valor (w-24)
- Botao X para remover a venda

**Botao "Adicionar nova venda":**
- Adiciona uma linha vazia ao array local de vendas
- Salva automaticamente ao clicar em "Salvar Alteracoes"

### 3. Atualizar LeadCard.tsx

**Exibir soma total** das vendas ao inves de `lead.value`:

```tsx
// Antes
{lead.value > 0 && (
  <div className="...">
    <DollarSign className="h-4 w-4" />
    {formatCurrency(lead.value)}
  </div>
)}

// Depois
{(lead.total_sales_value || lead.value) > 0 && (
  <div className="...">
    <DollarSign className="h-4 w-4" />
    {formatCurrency(lead.total_sales_value || lead.value)}
    {lead.sales_count > 0 && (
      <span className="text-muted-foreground ml-1">
        ({lead.sales_count} {lead.sales_count === 1 ? 'venda' : 'vendas'})
      </span>
    )}
  </div>
)}
```

### 4. Atualizar useLeads.ts

**Buscar vendas junto com leads:**

```typescript
// Adicionar ao tipo Lead
export interface Lead {
  // ... campos existentes
  sales?: LeadSale[];
  total_sales_value?: number;
  sales_count?: number;
}

export interface LeadSale {
  id: string;
  lead_id: string;
  product_name: string;
  value: number;
  created_at: string;
}

// Ao buscar leads, incluir vendas
const fetchLeads = async (stageIds: string[]) => {
  // ... buscar leads
  
  // Buscar vendas para cada lead
  const { data: salesData } = await supabase
    .from('lead_sales')
    .select('*')
    .in('lead_id', leadIds);
  
  // Mapear vendas para cada lead e calcular total
  leads.map(lead => ({
    ...lead,
    sales: salesData.filter(s => s.lead_id === lead.id),
    total_sales_value: salesData
      .filter(s => s.lead_id === lead.id)
      .reduce((sum, s) => sum + s.value, 0),
    sales_count: salesData.filter(s => s.lead_id === lead.id).length
  }));
};
```

**Adicionar funcoes para gerenciar vendas:**

```typescript
const addSale = async (leadId: string, productName: string, value: number) => {
  await supabase.from('lead_sales').insert({ lead_id: leadId, product_name: productName, value });
};

const updateSale = async (saleId: string, updates: { product_name?: string; value?: number }) => {
  await supabase.from('lead_sales').update(updates).eq('id', saleId);
};

const deleteSale = async (saleId: string) => {
  await supabase.from('lead_sales').delete().eq('id', saleId);
};
```

---

## Detalhes da Interface (LeadDetailSheet)

### Secao de Vendas (Nova)

```text
Localizacao: Entre "Empresa" e "Responsavel"

+----------------------------------------------------------+
| $ Vendas                                                 |
+----------------------------------------------------------+
|                                                          |
| +----------------------------------------------+         |
| | Produto/Servico         | Valor (R$) |  X  |         |
| +----------------------------------------------+         |
| | [Clareamento Dental   ] | [350      ] | [X] |         |
| | [Limpeza Periodontal  ] | [500      ] | [X] |         |
| +----------------------------------------------+         |
|                                                          |
| [+ Adicionar nova venda]                                 |
|                                                          |
| Total: R$ 850,00                                    |
+----------------------------------------------------------+
```

### Estados Gerenciados

```typescript
// Estado local para vendas editaveis
const [editedSales, setEditedSales] = useState<Array<{
  id?: string;       // undefined = nova venda
  product_name: string;
  value: number;
}>>([]);

// Inicializar quando lead mudar
useEffect(() => {
  if (lead?.sales) {
    setEditedSales(lead.sales.map(s => ({
      id: s.id,
      product_name: s.product_name,
      value: s.value
    })));
  }
}, [lead]);
```

### Acoes

1. **Adicionar Venda**: Adiciona `{ product_name: '', value: 0 }` ao array
2. **Editar Venda**: Atualiza o item no array local
3. **Remover Venda**: Remove do array (se ja salvo, marca para exclusao)
4. **Salvar**: 
   - Deleta vendas removidas
   - Insere novas vendas (sem id)
   - Atualiza vendas existentes (com id)

---

## Arquivos a Modificar

| Arquivo | Mudanca |
|---------|---------|
| `supabase/migrations/...` | Nova tabela `lead_sales` |
| `src/hooks/useLeads.ts` | Tipo LeadSale, funcoes CRUD, fetch com vendas |
| `src/components/leads/LeadDetailSheet.tsx` | Secao de vendas dinamica |
| `src/components/leads/LeadCard.tsx` | Exibir total e contagem de vendas |

---

## Beneficios

1. **Flexibilidade**: Adicionar quantas vendas quiser por lead
2. **Rastreabilidade**: Cada produto/servico registrado individualmente
3. **Visibilidade**: Total exibido no card do Kanban
4. **Historico**: Manter registro de todos os produtos vendidos

---

## Migracao de Dados Existentes

Os leads que ja possuem valor no campo `value` continuarao funcionando:
- Se `total_sales_value` for 0 ou undefined, exibe `lead.value` (retrocompatibilidade)
- Opcionalmente, podemos migrar valores existentes para a nova tabela

