

## Ativar workspace Fellipe Magnago Costa — Plano Escala 6 meses

### O que já foi feito (agora)
1. **Workspace criado** via `create-free-workspace`: `bc7bfbe5-07cc-409c-9a85-5ce46f94b9b3`
2. **Usuário criado** no auth: `99ac5dd2-0f6b-42eb-8ad0-afe09a304421`
3. **Limites atualizados** via `update-limits`: 30.000 leads, 10 WhatsApp, 30 usuários, 30.000 IA
4. **Link de recuperação enviado** por WhatsApp ao Fellipe

### O que falta (precisa de migração)
O workspace foi criado com `plan_name: "gratuito"` e sem `stripe_customer_id`. A edge function `update-workspace` não aceita esses campos. Precisamos de uma migração SQL para:

```sql
UPDATE workspaces 
SET plan_name = 'escala',
    stripe_customer_id = 'cus_UFFjO2y2ckcEb3'
WHERE id = 'bc7bfbe5-07cc-409c-9a85-5ce46f94b9b3';
```

Também atualizar o `client_invites` para marcar como ativado:

```sql
UPDATE client_invites 
SET status = 'activated',
    workspace_id = 'bc7bfbe5-07cc-409c-9a85-5ce46f94b9b3'
WHERE email = 'fellipe.magnagoc@gmail.com';
```

### Resumo
Uma migração com 2 UPDATEs simples para finalizar a ativação do workspace.

### Arquivos
| Arquivo | Alteração |
|---|---|
| Nova migração SQL | UPDATE `workspaces` (plan_name, stripe_customer_id) + UPDATE `client_invites` (status, workspace_id) |

