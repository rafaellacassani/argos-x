

# Adicionar Botão "Conectar Facebook/Instagram" na Página de Settings

## Resumo

Vou modificar a página de Settings para tornar os cards de Instagram e Facebook clicáveis, permitindo iniciar o fluxo de OAuth da Meta.

---

## O que será feito

### 1. Atualizar os cards de Instagram e Facebook

Na lista de `integrations`, vou:
- Marcar Instagram e Facebook como `available: true`
- Adicionar lógica para buscar contas conectadas do banco de dados

### 2. Criar função para iniciar o OAuth

Quando o usuário clicar em "Conectar" no card do Instagram ou Facebook:

1. Chamar a edge function `facebook-oauth/url` via POST
2. Receber a URL de autorização do Facebook
3. Redirecionar o usuário para essa URL

### 3. Detectar retorno do OAuth

Quando o usuário voltar do Facebook com `?meta_connected=true`:
- Mostrar toast de sucesso
- Atualizar a lista de contas conectadas

### 4. Exibir contas conectadas

Buscar da tabela `meta_pages` as páginas/contas conectadas e exibir no card.

---

## Fluxo Visual

```text
Usuário na página /settings
        │
        ▼
Clica no card "Instagram" ou "Facebook"
        │
        ▼
Botão "Conectar" → Chama POST /facebook-oauth/url
        │
        ▼
Recebe URL → Redireciona para Facebook
        │
        ▼
Usuário autoriza no Facebook
        │
        ▼
Facebook redireciona para /settings?meta_connected=true
        │
        ▼
Toast "Conta conectada com sucesso!"
        │
        ▼
Lista de páginas/Instagram atualizada no card
```

---

## Detalhes Técnicos

### Código para iniciar OAuth

```typescript
const handleConnectMeta = async () => {
  try {
    const response = await supabase.functions.invoke("facebook-oauth/url", {
      method: "POST",
    });
    
    if (response.data?.url) {
      window.location.href = response.data.url;
    }
  } catch (error) {
    toast({
      title: "Erro ao conectar",
      description: "Não foi possível iniciar a conexão com a Meta.",
      variant: "destructive",
    });
  }
};
```

### Buscar contas conectadas

```typescript
const fetchMetaPages = async () => {
  const { data } = await supabase
    .from("meta_pages")
    .select("*, meta_accounts(*)");
  setMetaPages(data || []);
};
```

### Detectar sucesso no retorno

```typescript
useEffect(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("meta_connected") === "true") {
    toast({
      title: "Conta conectada!",
      description: `${params.get("pages")} página(s) conectada(s) com sucesso.`,
    });
    // Limpar URL
    window.history.replaceState({}, "", "/settings");
    fetchMetaPages();
  }
}, []);
```

---

## Arquivos que serão modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/pages/Settings.tsx` | Adicionar lógica de OAuth, buscar páginas conectadas, atualizar cards |

---

## Resultado Esperado

1. Cards de Instagram e Facebook terão botão "Conectar" ativo
2. Ao clicar, usuário é redirecionado para o login da Meta
3. Após autorizar, volta para Settings com toast de sucesso
4. Páginas/contas conectadas aparecem nos cards

