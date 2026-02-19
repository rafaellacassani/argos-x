import { BotNode } from '@/hooks/useSalesBots';

interface ConditionNodeContentProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
}

export function ConditionNodeContent({ node, onUpdate }: ConditionNodeContentProps) {
  const field = (node.data.field as string) || 'message';

  return (
    <div className="space-y-2">
      <select
        className="w-full p-2 text-sm bg-background border rounded"
        value={field}
        onChange={(e) => onUpdate({ field: e.target.value })}
      >
        <option value="message">Mensagem</option>
        <option value="last_message">Última mensagem recebida</option>
        <option value="tag">Tag</option>
        <option value="stage">Etapa do funil</option>
        <option value="value">Valor do lead</option>
        <option value="name">Nome do lead</option>
        <option value="phone">Telefone do lead</option>
        <option value="current_time">Horário atual</option>
      </select>

      {field === 'current_time' ? (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Horário (início — fim)</label>
          <input
            type="text"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="09:00-18:00"
            value={(node.data.value as string) || '09:00-18:00'}
            onChange={(e) => onUpdate({ value: e.target.value, operator: 'between' })}
          />
          <p className="text-[10px] text-muted-foreground">Formato: HH:MM-HH:MM. Verdadeiro se dentro do intervalo.</p>
        </div>
      ) : (
        <>
          <select
            className="w-full p-2 text-sm bg-background border rounded"
            value={(node.data.operator as string) || 'contains'}
            onChange={(e) => onUpdate({ operator: e.target.value })}
          >
            <option value="contains">Contém</option>
            <option value="equals">É igual a</option>
            <option value="starts_with">Começa com</option>
            <option value="ends_with">Termina com</option>
            <option value="not_contains">Não contém</option>
          </select>
          <input
            type="text"
            className="w-full p-2 text-sm bg-background border rounded"
            placeholder="Valor..."
            value={(node.data.value as string) || ''}
            onChange={(e) => onUpdate({ value: e.target.value })}
          />
        </>
      )}
    </div>
  );
}
