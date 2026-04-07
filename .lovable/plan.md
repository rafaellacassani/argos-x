

## Corrigir rolagem do menu mobile

### Problema

O `SheetContent` do menu mobile não tem layout flex com altura controlada. O `nav` tem `overflow-y-auto` mas o container pai não restringe a altura, então o conteúdo ultrapassa a tela sem scroll.

### Correção

**1 arquivo**: `src/components/layout/AppSidebar.tsx`

Na seção mobile (linhas 221-233), adicionar `flex flex-col h-full` ao `SheetContent` e garantir que o header/workspace fiquem fixos (flex-shrink-0) enquanto o `nav` ocupa o espaço restante com scroll:

- `SheetContent`: adicionar `flex flex-col h-full`
- Header (logo + botão X): adicionar `flex-shrink-0`
- Workspace block: adicionar `flex-shrink-0`
- Nav: já tem `flex-1 overflow-y-auto` — adicionar `scrollbar-thin min-h-0`

### Resultado

Logo e workspace ficam fixos no topo. Itens do menu rolam independentemente dentro do espaço disponível.

