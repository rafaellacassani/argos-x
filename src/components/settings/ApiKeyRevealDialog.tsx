import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check, AlertTriangle, Key } from 'lucide-react';
import { toast } from 'sonner';

interface ApiKeyRevealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawKey: string;
  keyName: string;
}

export function ApiKeyRevealDialog({ open, onOpenChange, rawKey, keyName }: ApiKeyRevealDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rawKey);
      setCopied(true);
      toast.success('Chave copiada!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      toast.error('Erro ao copiar');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[90vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Chave criada: {keyName}
          </DialogTitle>
          <DialogDescription>
            Copie a chave abaixo. Ela não será exibida novamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Warning */}
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold text-amber-600">Atenção: salve esta chave agora!</p>
              <p className="text-muted-foreground mt-1">
                Por segurança, a chave completa será exibida apenas neste momento. 
                Armazene-a em local seguro.
              </p>
            </div>
          </div>

          {/* Key display */}
          <div className="relative">
            <div className="bg-muted rounded-lg p-4 font-mono text-sm break-all select-all border">
              {rawKey}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="absolute top-2 right-2"
              onClick={handleCopy}
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiada!' : 'Copiar'}
            </Button>
          </div>

          {/* Usage example */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Exemplo de uso:</p>
            <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto border">
              <pre className="text-muted-foreground">{`curl -X GET \\
  "https://qczmdbqwpshioooncpjd.supabase.co/functions/v1/api-gateway/v1/leads" \\
  -H "X-API-Key: ${rawKey.substring(0, 12)}..."`}</pre>
            </div>
          </div>
        </div>

        <Button onClick={() => onOpenChange(false)} className="w-full">
          Entendi, já copiei a chave
        </Button>
      </DialogContent>
    </Dialog>
  );
}
