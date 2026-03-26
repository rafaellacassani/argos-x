

## E-mail de convite em inglês e domínio errado — Diagnóstico e Correção

### Problema
O convite de novo membro usa `auth.admin.inviteUserByEmail()` do Supabase, que dispara o **template padrão de auth** — em inglês e enviado por `no-reply@auth.lovable.cloud`. Não existe nenhum template de e-mail customizado configurado no projeto.

### Causa raiz
O projeto **não tem domínio de e-mail configurado** nem templates de auth personalizados (`auth-email-hook` não existe). Todos os e-mails de autenticação (convite, reset de senha, verificação) usam o template padrão do sistema — em inglês, sem branding.

### Solução em 2 etapas

**Etapa 1: Configurar domínio de e-mail (argosx.com.br)**
- Abrir o setup de domínio de e-mail e configurar `argosx.com.br` como domínio remetente
- Será necessário adicionar registros DNS (NS) no provedor do domínio
- Após verificação, todos os e-mails de auth passarão a sair desse domínio

**Etapa 2: Criar templates de auth em Português**
- Usar o sistema de templates de auth para criar os 6 templates padrão (signup, recovery, invite, magic-link, email-change, reauthentication)
- Traduzir todos para português brasileiro
- Aplicar branding do Argos X (cores, logo, tom)
- Deploy da edge function `auth-email-hook`

### Templates que serão criados (todos em PT-BR)
| Template | Assunto |
|----------|---------|
| **Convite** | "Você foi convidado para o Argos X" |
| **Confirmação de e-mail** | "Confirme seu e-mail" |
| **Recuperação de senha** | "Redefina sua senha" |
| **Magic link** | "Seu link de acesso" |
| **Mudança de e-mail** | "Confirme a alteração de e-mail" |
| **Reautenticação** | "Código de verificação" |

### Resultado
- **Antes**: `no-reply@auth.lovable.cloud`, inglês, sem branding
- **Depois**: `noreply@argosx.com.br` (ou subdomínio), português, com logo e cores do Argos X

### O que NÃO será alterado
- Nenhuma lógica de convite (invite-member continua igual)
- Nenhuma lógica de agentes, calendário, áudio
- Nenhum componente frontend

### Pré-requisito
Acesso ao painel DNS do domínio `argosx.com.br` para adicionar os registros NS necessários.

