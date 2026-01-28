import { Helmet } from "react-helmet-async";

export default function PrivacyPolicy() {
  return (
    <>
      <Helmet>
        <title>Política de Privacidade - Inboxia</title>
        <meta name="description" content="Política de Privacidade do Inboxia - CRM para WhatsApp, Facebook e Instagram" />
        <meta name="robots" content="index, follow" />
      </Helmet>
      
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-foreground mb-8">Política de Privacidade</h1>
          
          <div className="prose prose-neutral dark:prose-invert max-w-none space-y-6 text-muted-foreground">
            <p className="text-sm text-muted-foreground">
              Última atualização: {new Date().toLocaleDateString('pt-BR')}
            </p>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Introdução</h2>
              <p>
                O Inboxia ("nós", "nosso" ou "nossa") respeita sua privacidade e está comprometido em proteger seus dados pessoais. 
                Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações quando você usa nossa plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Dados que Coletamos</h2>
              <p>Coletamos os seguintes tipos de informações:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Informações de conta:</strong> Nome, email, telefone e dados de login</li>
                <li><strong>Dados de integração:</strong> Tokens de acesso do WhatsApp, Facebook e Instagram para permitir o funcionamento do CRM</li>
                <li><strong>Mensagens:</strong> Conteúdo das conversas com seus clientes através das plataformas integradas</li>
                <li><strong>Dados de uso:</strong> Informações sobre como você utiliza nossa plataforma</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Como Usamos seus Dados</h2>
              <p>Utilizamos suas informações para:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Fornecer e manter nossos serviços de CRM</li>
                <li>Processar e gerenciar suas conversas com clientes</li>
                <li>Enviar notificações sobre sua conta e serviços</li>
                <li>Melhorar e personalizar sua experiência</li>
                <li>Cumprir obrigações legais</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Compartilhamento de Dados</h2>
              <p>
                Não vendemos seus dados pessoais. Compartilhamos informações apenas com:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Plataformas integradas:</strong> Meta (Facebook/Instagram) e WhatsApp para funcionamento das integrações</li>
                <li><strong>Provedores de serviço:</strong> Empresas que nos ajudam a operar a plataforma (hospedagem, analytics)</li>
                <li><strong>Requisitos legais:</strong> Quando exigido por lei ou para proteger nossos direitos</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Segurança dos Dados</h2>
              <p>
                Implementamos medidas de segurança técnicas e organizacionais para proteger seus dados, incluindo:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Criptografia de dados em trânsito e em repouso</li>
                <li>Controles de acesso rigorosos</li>
                <li>Monitoramento contínuo de segurança</li>
                <li>Backups regulares</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Seus Direitos (LGPD)</h2>
              <p>
                De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Acessar seus dados pessoais</li>
                <li>Corrigir dados incompletos ou desatualizados</li>
                <li>Solicitar a exclusão de seus dados</li>
                <li>Revogar o consentimento a qualquer momento</li>
                <li>Solicitar a portabilidade dos dados</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Retenção de Dados</h2>
              <p>
                Mantemos seus dados pelo tempo necessário para fornecer nossos serviços ou conforme exigido por lei. 
                Você pode solicitar a exclusão de sua conta e dados a qualquer momento.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Alterações nesta Política</h2>
              <p>
                Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos sobre mudanças significativas 
                através de email ou aviso em nossa plataforma.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Contato</h2>
              <p>
                Para questões sobre esta Política de Privacidade ou exercer seus direitos, entre em contato:
              </p>
              <ul className="list-none mt-2 space-y-1">
                <li><strong>Email:</strong> privacidade@inboxia.com.br</li>
                <li><strong>Responsável:</strong> Mkt Boost</li>
              </ul>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
