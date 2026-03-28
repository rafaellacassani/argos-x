import { Helmet } from "react-helmet-async";

export default function TermsOfService() {
  return (
    <>
      <Helmet>
        <title>Termos de Uso - Argos X</title>
        <meta name="description" content="Termos de Uso do Argos X - CRM para WhatsApp, Facebook e Instagram" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Termos de Uso</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm font-medium text-foreground">
              Versão 1.0 — vigente desde 28/03/2026
            </p>
            <p className="text-sm text-muted-foreground">
              Última atualização: 28 de março de 2026
            </p>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Aceitação dos Termos</h2>
              <p>
                Ao acessar e utilizar a plataforma Argos X ("Plataforma"), você concorda com estes Termos de Uso. 
                Caso não concorde com algum dos termos aqui descritos, não utilize a Plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Descrição do Serviço</h2>
              <p>
                O Argos X é uma plataforma de CRM (Customer Relationship Management) que integra canais de comunicação como 
                WhatsApp, Facebook Messenger e Instagram Direct, permitindo a gestão centralizada de leads, conversas e automações comerciais.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Cadastro e Conta</h2>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Para utilizar a Plataforma, é necessário criar uma conta com informações verdadeiras e atualizadas.</li>
                <li>Você é responsável por manter a confidencialidade de suas credenciais de acesso.</li>
                <li>É proibido compartilhar ou ceder sua conta a terceiros sem autorização.</li>
                <li>O Argos X reserva-se o direito de suspender contas que violem estes Termos.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Uso Adequado</h2>
              <p>Ao utilizar a Plataforma, você se compromete a:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Não enviar mensagens de spam ou conteúdo não solicitado</li>
                <li>Respeitar as políticas de uso das plataformas integradas (Meta, WhatsApp)</li>
                <li>Não utilizar a Plataforma para fins ilegais ou não autorizados</li>
                <li>Não tentar acessar dados de outros usuários sem autorização</li>
                <li>Cumprir a legislação brasileira vigente, incluindo a LGPD</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Planos e Pagamentos</h2>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>O acesso à Plataforma é oferecido mediante planos de assinatura, conforme descrito na página de planos.</li>
                <li>Os pagamentos são processados de forma recorrente conforme o plano contratado.</li>
                <li>O cancelamento pode ser realizado a qualquer momento, com efeito ao final do período vigente.</li>
                <li>Não há reembolso proporcional para cancelamentos antes do término do período contratado.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Propriedade Intelectual</h2>
              <p>
                Todo o conteúdo da Plataforma, incluindo mas não limitado a design, código, textos, logotipos e funcionalidades, 
                é de propriedade exclusiva do Argos X e está protegido pelas leis de propriedade intelectual brasileiras.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Privacidade e Dados</h2>
              <p>
                O tratamento de dados pessoais é regido pela nossa{" "}
                <a href="/privacy-policy" className="text-primary hover:underline">Política de Privacidade</a>, 
                que é parte integrante destes Termos de Uso. Os dados coletados são utilizados exclusivamente para 
                o funcionamento e melhoria do serviço.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Limitação de Responsabilidade</h2>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>O Argos X não se responsabiliza por interrupções nas plataformas de terceiros (WhatsApp, Meta).</li>
                <li>Não garantimos disponibilidade ininterrupta do serviço, embora nos esforcemos para manter alta disponibilidade.</li>
                <li>O usuário é responsável pelo conteúdo das mensagens enviadas através da Plataforma.</li>
                <li>O Argos X não se responsabiliza por danos indiretos decorrentes do uso ou impossibilidade de uso da Plataforma.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Modificações dos Termos</h2>
              <p>
                O Argos X reserva-se o direito de modificar estes Termos a qualquer momento. 
                As alterações entrarão em vigor após a publicação na Plataforma. 
                O uso continuado após as modificações constitui aceitação dos novos termos.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. Foro e Legislação Aplicável</h2>
              <p>
                Estes Termos são regidos pelas leis da República Federativa do Brasil. 
                Fica eleito o foro da comarca da sede do Argos X para dirimir quaisquer controvérsias.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. Contato</h2>
              <p>
                Para dúvidas sobre estes Termos de Uso, entre em contato:
              </p>
              <ul className="list-none mt-2 space-y-1">
                <li><strong>Email:</strong> contato@argosx.com.br</li>
                <li><strong>Responsável:</strong> Argos X</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
