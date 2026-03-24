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
          <CardDescription>
            Seja específico — quanto mais detalhes, melhor a agente vai responder.
            <br className="mt-1" />
            <span className="block mt-1">Inclua: o que você vende ou oferece, preços, formas de pagamento, diferenciais e política de cancelamento. Não coloque instruções de comportamento aqui — apenas fatos sobre o seu negócio.</span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.knowledge_products || ""}
            onChange={(e) => updateField("knowledge_products", e.target.value)}
            placeholder={"Ex: Somos uma clínica odontológica. Oferecemos limpeza (R$150), clareamento (R$800) e consulta de avaliação gratuita. Atendemos seg-sex 8h-18h. Aceitamos cartão, Pix e parcelamos em até 6x."}
            className="min-h-[200px]"
          />
          <p className="text-xs text-muted-foreground mt-2">
            {(formData.knowledge_products || "").length} caracteres
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Regras e Restrições</CardTitle>
          <CardDescription>Defina o que a IA nunca deve dizer ou prometer, como lidar com reclamações e quando transferir para atendimento humano.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.knowledge_rules || ""}
            onChange={(e) => updateField("knowledge_rules", e.target.value)}
            placeholder={"Ex: Nunca prometa desconto sem consultar o dono. Nunca confirme agendamento sem verificar a agenda. Se o cliente reclamar, diga que vai acionar a equipe. Atendimento humano disponível seg-sex, 9h às 18h."}
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contexto Adicional</CardTitle>
          <CardDescription>Informações sobre seus clientes e o contexto do seu negócio que ajudam a IA a responder melhor.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.knowledge_extra || ""}
            onChange={(e) => updateField("knowledge_extra", e.target.value)}
            placeholder={"Ex: Nossos clientes são adultos entre 25 e 45 anos que nos encontram pelo Instagram. A dúvida mais comum é sobre preço e prazo. Somos conhecidos pelo atendimento rápido e personalizado."}
            className="min-h-[120px]"
          />
        </CardContent>
      </Card>
    </div>
  );
}
