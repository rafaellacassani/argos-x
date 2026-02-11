

## Importacao em Massa de Contatos para o Funil de Vendas

### Objetivo
Permitir importar contatos via CSV e criar automaticamente um card (lead) na Etapa 1 do funil ("Leads de Entrada") para cada contato importado. Tambem conectar a pagina de Contatos ao banco de dados real.

### Capacidade
- O banco suporta facilmente **10.000 a 50.000+ contatos** sem problemas de performance
- Recomendacao: importar em lotes de ate **500 por vez** para evitar timeouts no navegador
- Hoje existem 106 leads; a etapa destino sera "Leads de Entrada" (posicao 0)

---

### Etapa 1: Conectar pagina de Contatos ao banco real

Atualmente a pagina `src/pages/Contacts.tsx` usa dados mockados. Vamos substituir pelo hook `useLeads` existente para puxar os leads reais da tabela `leads`.

- Remover o array `contacts` hardcoded
- Usar `useLeads()` para buscar leads do banco
- Adaptar a tabela para exibir os campos reais (name, phone, email, company, source, tags, created_at)
- Manter busca e selecao em massa funcionando

### Etapa 2: Componente de importacao CSV

Criar um dialog `ImportContactsDialog.tsx` que:
1. Aceita upload de arquivo CSV (ate ~10.000 linhas)
2. Faz parse do CSV no navegador (sem precisar de backend)
3. Mostra preview das primeiras 5 linhas para o usuario confirmar
4. Permite mapear colunas do CSV para campos do lead (nome, telefone, email, empresa)
5. Exibe barra de progresso durante a importacao

### Etapa 3: Logica de importacao em lotes

- Processar o CSV e inserir leads em lotes de 100 registros via `supabase.from('leads').insert(batch)`
- Cada lead sera criado com:
  - `stage_id`: ID da etapa "Leads de Entrada"
  - `source`: "importacao"
  - `status`: "active"
  - `position`: auto-incrementado
- Ao final, exibir resumo: X importados, Y erros (duplicatas por telefone, etc.)

### Etapa 4: Prevencao de duplicatas

- Antes de inserir, verificar se ja existe lead com o mesmo `phone`
- Contatos duplicados serao ignorados e reportados no resumo final

---

### Detalhes Tecnicos

**Arquivos a criar:**
- `src/components/contacts/ImportContactsDialog.tsx` — dialog com upload, preview e progresso

**Arquivos a modificar:**
- `src/pages/Contacts.tsx` — conectar ao banco real via `useLeads`, adicionar onClick no botao "Importar"

**Dependencias:** Nenhuma nova. O parse de CSV sera feito com logica nativa (split por linhas e virgulas, com tratamento de aspas).

**Banco de dados:** Nenhuma alteracao de schema necessaria. A tabela `leads` ja possui todos os campos necessarios.

