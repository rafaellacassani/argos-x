
# Simplificação do Sistema de Notificações

## Visão Geral
Redesenhar a interface de notificações para que o Admin tenha controle centralizado sobre quem recebe quais alertas, em vez de cada usuário configurar individualmente.

## Mudanças na Interface

### Tela de Equipe (TeamManager.tsx)
A tabela de membros da equipe vai incluir uma coluna de **Notificações** com um seletor simples:

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  Equipe & Notificações                                     [+ Adicionar]     │
├──────────────────────────────────────────────────────────────────────────────┤
│  Avatar │ Nome           │ Função      │ WhatsApp         │ Notificações    │
├─────────┼────────────────┼─────────────┼──────────────────┼─────────────────┤
│   👤    │ João Silva     │ Vendedor    │ (27) 99999-9999  │ [▼ Sem resposta]│
│   👤    │ Maria Admin    │ Admin       │ (27) 88888-8888  │ [▼ Ambos      ] │
│   👤    │ Carlos Gestor  │ Gestor      │ (27) 77777-7777  │ [▼ Nenhum     ] │
└─────────┴────────────────┴─────────────┴──────────────────┴─────────────────┘
```

### Opções do Seletor de Notificações
- **Dashboard semanal** - Recebe apenas o relatório semanal
- **Sem resposta** - Recebe apenas alertas de leads sem resposta  
- **Ambos** - Recebe dashboard semanal E alertas de sem resposta
- **Nenhum** - Não recebe nenhuma notificação

### Modal de Edição (Simplificado)
O modal de edição do membro vai focar apenas nos dados básicos:
- Avatar, Nome, Email, WhatsApp, Função
- **Remove** toda a seção de configuração de notificações do modal
- A seleção de notificações fica diretamente na tabela principal

---

## Mudanças Técnicas

### 1. Banco de Dados (notification_settings)
Manter a estrutura atual, mas a lógica de UI muda:
- `notify_no_response` = true/false
- `notify_weekly_report` = true/false

Combinações:
| Opção UI | notify_no_response | notify_weekly_report |
|----------|-------------------|---------------------|
| Dashboard semanal | false | true |
| Sem resposta | true | false |
| Ambos | true | true |
| Nenhum | false | false |

### 2. TeamManager.tsx
- Adicionar coluna de Select na tabela
- Criar função `getNotificationType()` para converter os booleans em tipo UI
- Criar função `handleNotificationChange()` para atualizar os settings
- Remover seção de notificações do modal `MemberEditor`
- Carregar notification settings junto com os membros

### 3. useTeam.ts
- Modificar `fetchTeamMembers()` para também buscar notification_settings de cada membro
- Adicionar propriedade `notification_settings` no tipo `UserProfile`

---

## Fluxo de Uso
1. Admin acessa `/configuracoes` → Aba Equipe
2. Vê a lista de todos os membros com suas notificações atuais
3. Clica no dropdown de "Notificações" de qualquer membro
4. Seleciona a opção desejada
5. A mudança é salva automaticamente no banco

---

## Arquivos a Modificar

| Arquivo | Mudança |
|---------|---------|
| `src/components/settings/TeamManager.tsx` | Adicionar coluna de select, remover config do modal |
| `src/hooks/useTeam.ts` | Incluir notification_settings no fetch de membros |

