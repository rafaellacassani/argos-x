

## Diagnostico de Performance

Identifiquei **5 problemas principais** que estao deixando o sistema lento:

### 1. QueryClient sem configuracao de cache

O `QueryClient` esta instanciado sem nenhuma configuracao. Isso significa que:
- Nao ha cache de dados entre navegacoes
- Cada vez que voce muda de pagina e volta, todos os dados sao buscados novamente
- Nao ha `staleTime` (tempo em que os dados sao considerados "frescos")

**Correcao:** Configurar `staleTime`, `gcTime` e `refetchOnWindowFocus` para evitar requisicoes desnecessarias.

### 2. Hooks nao usam React Query (fetches manuais com useEffect)

Os hooks principais (`useLeads`, `useDashboardData`, `useWorkspace`) fazem fetch manual com `useState` + `useEffect` em vez de usar React Query (`useQuery`). Isso causa:
- Sem cache entre paginas
- Sem deduplicacao de requisicoes
- Re-fetch toda vez que o componente monta
- Sem retry automatico

**Correcao:** Migrar os hooks mais pesados para usar `useQuery` do TanStack React Query (ja instalado mas pouco usado).

### 3. Pagina de Chats faz chamadas sequenciais por instancia

No `Chats.tsx`, ao carregar instancias WhatsApp:
- Lista todas as instancias
- Para cada uma, chama `getConnectionState` **sequencialmente** (uma apos a outra)
- Depois carrega chats de cada instancia **sequencialmente**

**Correcao:** Usar `Promise.all` para chamadas paralelas.

### 4. Todas as paginas sao importadas no App.tsx (sem code splitting)

Todas as 18+ paginas sao importadas estaticamente no `App.tsx`. Isso significa que o bundle inicial carrega **todo** o codigo de todas as paginas, mesmo que o usuario so acesse o Dashboard.

**Correcao:** Usar `React.lazy()` + `Suspense` para carregar paginas sob demanda.

### 5. Animacoes Framer Motion em listas grandes

As paginas de Dashboard e Leads usam `motion.div` com animacoes em varios elementos. Em dispositivos mais lentos ou com muitos dados, isso pode causar engasgos visuais.

**Correcao:** Reduzir animacoes em listas e usar `will-change` CSS onde necessario.

---

## Plano de Implementacao

### Etapa 1 - Configurar QueryClient com cache (App.tsx)
Adicionar configuracao de cache global:
- `staleTime: 5 * 60 * 1000` (5 minutos -- dados ficam "frescos" por 5 min)
- `gcTime: 10 * 60 * 1000` (10 minutos de cache)
- `refetchOnWindowFocus: false` (nao recarregar ao focar janela)
- `retry: 1` (apenas 1 retry em erro)

### Etapa 2 - Code Splitting com React.lazy (App.tsx)
Converter todos os imports de paginas para lazy loading:
```text
Antes:  import Dashboard from "./pages/Dashboard"
Depois: const Dashboard = lazy(() => import("./pages/Dashboard"))
```
Adicionar `<Suspense>` com loading spinner.

### Etapa 3 - Migrar useDashboardData para useQuery
Substituir `useState` + `useEffect` por `useQuery` para cache automatico dos dados do dashboard.

### Etapa 4 - Paralelizar chamadas no Chats
Usar `Promise.all` para verificar estado de conexao de todas as instancias simultaneamente em vez de sequencialmente.

### Etapa 5 - Migrar useLeads para useQuery (parcial)
Migrar as consultas iniciais (funnels, stages, leads) para `useQuery` com cache.

---

## Resumo de Arquivos Alterados

| Arquivo | Acao | Impacto |
|---|---|---|
| `src/App.tsx` | Configurar QueryClient + lazy imports | Alto |
| `src/hooks/useDashboardData.ts` | Migrar para useQuery | Medio |
| `src/pages/Chats.tsx` | Paralelizar chamadas | Medio |
| `src/hooks/useLeads.ts` | Migrar queries iniciais para useQuery | Medio |

### O que NAO e necessario

- **Nao precisa de mais "memoria" ou VPS maior** para o frontend -- o problema e de otimizacao do codigo, nao de recursos de servidor
- O backend (banco de dados) ja esta no Lovable Cloud e escala automaticamente
- O VPS da Hostinger so afeta WhatsApp/Evolution API, nao a velocidade geral do sistema

