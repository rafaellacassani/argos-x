

## Plano: Adicionar aba "Meta Pixel" na página de Integrações

### O que será feito

Adicionar uma nova aba **"Meta Pixel"** na página de Integrações (`/settings`), ao lado das abas existentes (Integrações, WhatsApp, Geral). Nessa aba o usuário poderá:

- Ver o Pixel ID atualmente configurado
- Alterar o Pixel ID (salvo na tabela `workspace_settings` ou similar)
- Ver status (ativo/inativo)
- O código no `index.html` será tornado dinâmico — em vez de hardcoded, o Pixel será inicializado em runtime a partir do ID salvo no banco

### Implementação

**1. DB Migration**
- Adicionar coluna `meta_pixel_id text` na tabela `workspaces` (já existe e é a entidade central do workspace)

**2. `src/pages/Settings.tsx`**
- Nova aba `"meta-pixel"` no `TabsList`: "Meta Pixel"
- `TabsContent` com card mostrando:
  - Input para o Pixel ID (pré-preenchido do workspace)
  - Botão Salvar (update no `workspaces.meta_pixel_id`)
  - Badge de status (Ativo se ID preenchido, Inativo se vazio)
  - Instruções breves de como encontrar o ID no Meta Business Suite

**3. `index.html`**
- Remover o script hardcoded do Meta Pixel (init + PageView)
- Remover o `<noscript>` fallback

**4. Novo componente: `src/components/settings/MetaPixelLoader.tsx`**
- Componente React montado no `App.tsx` (dentro do workspace provider)
- Busca `meta_pixel_id` do workspace atual
- Se existir, injeta o script do fbq dinamicamente e chama `fbq('init', pixelId)` + `fbq('track', 'PageView')`
- Nas páginas públicas (`/cadastro`), busca o pixel ID via query direta (sem auth)

**5. `src/pages/Cadastro.tsx` e `CadastroSucesso.tsx`**
- Mantém `window.fbq?.('track', 'CompleteRegistration', ...)` — funciona automaticamente se o script foi carregado

### Fluxo

```text
Workspace settings (DB)
  └─ meta_pixel_id: "1294031842786070"
       │
       ├─ Páginas autenticadas: MetaPixelLoader lê do contexto do workspace
       │
       └─ Páginas públicas (/cadastro): busca pixel_id via edge function ou query pública
            │
            └─ Injeta script fbq → dispara PageView + CompleteRegistration
```

### Arquivos

| Arquivo | Mudança |
|---------|---------|
| DB migration | `meta_pixel_id` em `workspaces` |
| `Settings.tsx` | Nova aba "Meta Pixel" com input e save |
| `index.html` | Remover script hardcoded do Pixel |
| `MetaPixelLoader.tsx` (novo) | Carregamento dinâmico do Pixel |
| `App.tsx` | Montar `MetaPixelLoader` |
| `Cadastro.tsx` | Carregar pixel para páginas públicas |

