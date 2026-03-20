

## Captura de UTM/fbclid na página /cadastro

### O que será feito

1. **Tabela `lead_attribution`** — Nova migration criando a tabela com colunas: `id`, `workspace_id`, `fbclid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `created_at`. RLS: somente super-admins (has_role admin).

2. **`src/pages/Cadastro.tsx`** — No `useEffect` de mount, ler `fbclid`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` da URL e salvar no `localStorage` como JSON (`lead_attribution`). No `handleSubmit`, recuperar do localStorage e enviar junto no body do fetch para `public-signup` como campo `attribution`.

3. **`supabase/functions/public-signup/index.ts`** — Após criar o workspace (linha ~437), extrair `body.attribution` e, se existir algum valor, inserir na tabela `lead_attribution` com o `workspace_id` recém-criado. Fire-and-forget.

### Detalhes técnicos

**Migration SQL:**
```sql
CREATE TABLE public.lead_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  fbclid text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_attribution ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage lead_attribution"
  ON public.lead_attribution FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

**Cadastro.tsx — useEffect (mount):**
```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  const keys = ['fbclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term'];
  const attribution: Record<string,string> = {};
  keys.forEach(k => { const v = params.get(k); if (v) attribution[k] = v; });
  if (Object.keys(attribution).length > 0) {
    localStorage.setItem('lead_attribution', JSON.stringify(attribution));
  }
}, []);
```

**Cadastro.tsx — handleSubmit body:**
```typescript
const attribution = JSON.parse(localStorage.getItem('lead_attribution') || '{}');
// add to fetch body: ...attribution && Object.keys(attribution).length > 0 ? { attribution } : {}
```

**public-signup — after workspace creation:**
```typescript
const attribution = body.attribution;
if (attribution && typeof attribution === 'object') {
  await supabaseAdmin.from('lead_attribution').insert({
    workspace_id: workspace.id,
    ...attribution,
  }).then(() => {}).catch(e => console.warn('Attribution save error:', e));
}
```

### Arquivos modificados
- Nova migration SQL (tabela `lead_attribution`)
- `src/pages/Cadastro.tsx`
- `supabase/functions/public-signup/index.ts`

Nada mais é alterado.

