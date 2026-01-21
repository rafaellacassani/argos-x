import { Settings } from "lucide-react";

export default function Configuracoes() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Configurações
        </h1>
        <p className="text-muted-foreground">
          Configurações gerais do sistema
        </p>
      </div>

      {/* Empty State */}
      <div className="inboxia-card p-12 text-center">
        <Settings className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="font-semibold text-lg mb-2">Em breve</h3>
        <p className="text-muted-foreground">
          As configurações gerais estarão disponíveis em breve.
        </p>
      </div>
    </div>
  );
}
