

## Corrigir vazamento de dados do calendário para leads

### Problema
A IA está expondo títulos e horários de eventos internos do workspace diretamente na mensagem enviada ao lead. Na imagem, o lead vê "Checkin semanal | Nautica" com horários completos — informação confidencial do workspace.

Isso acontece em 3 pontos do `ai-agent-chat`:
1. **Criar evento com conflito** (linhas ~1138-1141): concatena título e horários dos eventos conflitantes no `responseContent` que vai para o lead
2. **Reagendar com conflito** (linhas ~1249-1251): mesmo problema
3. **Consultar** (linhas ~1379-1381): lista todos os horários ocupados do workspace

### Correção

**Arquivo**: `supabase/functions/ai-agent-chat/index.ts`

**1. Conflito ao criar (linhas ~1138-1142)**
- Em vez de listar os eventos, apenas informar à IA que o horário está ocupado, sem revelar detalhes
- Trocar por: `responseContent += "\n\n[INSTRUÇÃO INTERNA: Este horário já está ocupado. Informe ao lead que esse horário não está disponível e sugira outro horário próximo. NÃO revele quais compromissos existem.]";`

**2. Conflito ao reagendar (linhas ~1249-1252)**
- Mesmo tratamento: informar que está ocupado sem revelar detalhes
- Trocar por: `responseContent += "\n\n[INSTRUÇÃO INTERNA: Este horário já está ocupado. Sugira outro horário ao lead. NÃO revele detalhes dos compromissos existentes.]";`

**3. Consultar (linhas ~1378-1382)**
- Remover a listagem de "Horários já ocupados" com todos os eventos
- Manter apenas os eventos do próprio lead (que já é filtrado por `lead_id`)
- Os busy slots devem ser usados internamente pela IA apenas como referência de indisponibilidade, sem expor títulos

### O que NÃO será alterado
- Nenhum componente frontend
- Nenhuma tabela do banco
- A lógica de criar/reagendar/cancelar eventos permanece igual
- A consulta de disponibilidade continua funcionando — apenas os detalhes não são mais expostos ao lead

### Resultado
- **Antes**: Lead vê "Checkin semanal | Nautica (2026-03-26T18:00...)"
- **Depois**: Lead recebe "Esse horário não está disponível, que tal às 17h?" — sem ver nenhum dado interno

