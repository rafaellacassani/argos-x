import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export function KnowledgeTab({ formData, updateField }: Props) {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="font-display font-semibold text-lg text-foreground mb-1">Base de Conhecimento</h3>
        <p className="text-sm text-muted-foreground">Informações que a agente usa para responder perguntas.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Produtos, Serviços e Preços</CardTitle>
          <CardDescription>Seja específico — quanto mais detalhes, melhor a agente vai responder.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.knowledge_products || ""}
            onChange={(e) => updateField("knowledge_products", e.target.value)}
            placeholder="Descreva seus produtos, serviços, preços e condições de pagamento. Seja específico — quanto mais detalhes, melhor a agente vai responder."
            className="min-h-[200px]"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {(formData.knowledge_products || "").length} caracteres • Dica: inclua valores, formas de pagamento, prazo de entrega e política de cancelamento
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras e Restrições</CardTitle>
          <CardDescription>Defina o que a agente pode e não pode fazer.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.knowledge_rules || ""}
            onChange={(e) => updateField("knowledge_rules", e.target.value)}
            placeholder="Ex: Nunca mencione concorrentes. Não prometa prazos sem confirmar com a equipe. Sempre que o cliente perguntar sobre desconto, encaminhe para um humano."
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contexto Adicional</CardTitle>
          <CardDescription>Outras informações úteis para a agente.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.knowledge_extra || ""}
            onChange={(e) => updateField("knowledge_extra", e.target.value)}
            placeholder="Outras informações que a agente deve saber: história da empresa, diferenciais, cases de sucesso, etc."
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
