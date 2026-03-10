

## Importar e Usar Templates de Mensagem do WhatsApp Cloud API

### Contexto
O Meta exige que mensagens enviadas **fora da janela de 24h** usem **Message Templates** pré-aprovados. Você já criou templates no painel do Meta Business. Precisamos importar essa biblioteca para o Argos X e permitir seu uso em Campanhas e SalesBots.

Atualmente, campanhas e SalesBots enviam apenas via **Evolution API** (texto livre). Para Cloud API, precisamos suportar o envio de templates (`POST /{phone_number_id}/messages` com `type: "template"`).

---

### Plano

#### 1. Tabela `whatsapp_templates` (nova)
Armazena os templates sincronizados do Meta para cada workspace.

Colunas: `id`, `workspace_id`, `cloud_connection_id`, `template_name`, `language`, `category` (marketing/utility/authentication), `status` (approved/pending/rejected), `components` (jsonb -- header/body/footer/buttons com variáveis), `synced_at`, `created_at`.

RLS: workspace members can manage.

#### 2. Edge Function `sync-whatsapp-templates` (nova)
- Chama `GET https://graph.facebook.com/v21.0/{waba_id}/message_templates` usando o `access_token` da `whatsapp_cloud_connections`
- Faz upsert na tabela `whatsapp_templates`
- Chamada pelo frontend ao abrir a página de templates ou ao criar campanha

#### 3. Página de Gerenciamento de Templates (frontend)
Nova rota `/templates` ou seção dentro de Configurações:
- Botão "Sincronizar Templates" que chama a edge function
- Lista templates com nome, idioma, categoria, status (aprovado/pendente/rejeitado)
- Preview do template com variáveis destacadas
- Não permite criar/editar templates (isso é feito no Meta Business) -- apenas visualizar e sincronizar

#### 4. Campanhas -- Suporte a Templates Cloud API
No `CreateCampaignDialog`:
- Ao selecionar uma instância Cloud API, mostrar opção "Usar Template" ao invés de texto livre
- Seletor de template (da tabela `whatsapp_templates`, filtrado por `status = approved`)
- Campos dinâmicos para preencher variáveis do template (ex: `{{1}}`, `{{2}}`)
- Mapeamento: variável -> shortcode do lead (#nome#, #empresa#, etc.)

No `process-campaigns`:
- Detectar se campanha usa Cloud API (instância começa com `cloud_` ou campo dedicado)
- Enviar via Graph API com payload `type: "template"` + `template: { name, language, components }` ao invés de `sendText` da Evolution

#### 5. SalesBots -- Node "Enviar Template"
No `SendMessageNodeContent` e `BotBuilderCanvas`:
- Novo tipo de nó ou opção no nó "Enviar Mensagem": "Enviar Template WABA"
- Seletor de template + mapeamento de variáveis
- No `whatsapp-webhook` (execução do bot): quando o nó for template WABA, enviar via Graph API

---

### Arquivos alterados/criados
- **Migration SQL**: tabela `whatsapp_templates`
- **`supabase/functions/sync-whatsapp-templates/index.ts`** (novo)
- **`supabase/config.toml`**: registrar nova function
- **`src/components/campaigns/CreateCampaignDialog.tsx`**: seletor de template
- **`supabase/functions/process-campaigns/index.ts`**: envio via Graph API com template
- **`src/components/salesbots/SendMessageNodeContent.tsx`**: opção de template
- **`supabase/functions/whatsapp-webhook/index.ts`**: execução de nó template
- **Página/componente de listagem de templates** (nova)

### Complexidade
Alta. Envolve nova tabela, nova edge function de sincronização, alterações em 2 edge functions de envio (campanhas + bots), e UI para seleção de templates com variáveis dinâmicas.

Sugiro implementar em etapas:
1. Tabela + sync + página de visualização
2. Integração em Campanhas
3. Integração em SalesBots

