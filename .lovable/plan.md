
Objetivo: corrigir definitivamente o sumiço da sua WABA no workspace Argos X e impedir que isso volte a acontecer.

Diagnóstico confirmado
- A sua WABA não foi movida para outro workspace.
- Os registros encontrados continuam no workspace Argos X (`41efdc6d-d4ba-4589-9761-7438a5911d57`).
- O que aconteceu é que ela foi desativada no backend/UI:
  - existem 2 registros da mesma WABA em `whatsapp_cloud_connections` no Argos X, ambos com `is_active = false`
  - o `meta_page` vinculado também está com `is_active = false`
- Por isso ela “sumiu” do painel: a tela de Conexões só lista conexões com `is_active = true`.

O que no código explica isso
- `src/pages/Settings.tsx`
  - busca conexões com:
    - `workspace_id = workspaceId`
    - `is_active = true`
  - então qualquer conexão desativada desaparece da UI.
- `src/components/whatsapp/WABAConnectionCard.tsx`
  - a ação de desativar faz:
    - `whatsapp_cloud_connections.is_active = false`
    - `meta_pages.is_active = false`
- Não encontrei, no código lido, nenhuma lógica de “mover WABA para outro workspace”.
- Então o problema real é: desativação + ocultação da conexão, não migração.

Plano de correção
1. Recuperação imediata
- Reativar a conexão mais recente da sua WABA no Argos X.
- Reativar também o `meta_page` vinculado.
- Manter apenas 1 registro principal ativo para essa WABA.

2. Limpeza de duplicidade
- Corrigir o estado duplicado da mesma `phone_number_id`.
- Deixar o registro antigo arquivado/inativo e o atual como fonte única.
- Isso evita comportamento confuso na tela e no roteamento de webhook.

3. Correção estrutural no banco
- Adicionar restrição única para impedir duplicatas por workspace + número:
  - `whatsapp_cloud_connections (workspace_id, phone_number_id)`
- Hoje os fluxos OAuth/Embedded Signup usam upsert com esse conflito, mas a tabela não mostra uma unique constraint correspondente; isso ajuda a explicar duplicidade.

4. Correção de UX na tela de Conexões
- Parar de “sumir” com conexões desativadas.
- Mostrar uma seção de:
  - Ativas
  - Inativas
- Adicionar botão “Reativar” direto no card.
- Exibir status real: ativa, inativa, pendente, sem webhook.

5. Hardening do fluxo de conexão
- Ajustar `facebook-oauth` e `whatsapp-embedded-signup` para:
  - reaproveitar/reativar conexão existente
  - religar `meta_page_id` se estiver quebrado
  - evitar criar novo registro quando a mesma WABA já existe no mesmo workspace

6. Prevenção de novo susto
- Adicionar trilha de auditoria simples para eventos de conexão:
  - conectada
  - desativada
  - reativada
  - token atualizado
- Assim dá para saber exatamente “quem/quando” mudou o estado.

7. Validação final
- Confirmar que a WABA reaparece no Argos X em Conexões.
- Confirmar que ela volta a aparecer nas telas que dependem de `is_active = true`.
- Confirmar envio/recebimento e visibilidade no Chat e nos Agentes.

Detalhes técnicos
- Registros localizados no Argos X para a mesma `phone_number_id = 980377115162609`.
- Ambos estão `status = active`, mas `is_active = false`, o que mostra estado inconsistente.
- O `meta_pages.page_id = 980377115162609` vinculado também está `is_active = false`.
- Há um ponto extra a endurecer no app: `useWorkspace.tsx` pega apenas um `workspace_members` com `.limit(1).maybeSingle()` sem ordenação explícita; isso não parece ser a causa deste caso, mas é um risco para usuários com múltiplos workspaces e vale entrar no pacote de correção.

Resultado esperado após implementação
- Sua WABA volta a aparecer no Argos X.
- Ela não “some” mais apenas por estar inativa.
- O sistema deixa de criar/aceitar duplicatas da mesma WABA no mesmo workspace.
- Fica claro se a conexão foi desativada, por quem e quando.
