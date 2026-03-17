import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Copy, ExternalLink, RefreshCcw, FileInput } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useLeads } from '@/hooks/useLeads';
import { toast } from 'sonner';

const NATIVE_FIELDS = [
  { key: 'name', label: 'Nome' },
  { key: 'phone', label: 'Telefone' },
  { key: 'email', label: 'Email' },
  { key: 'company', label: 'Empresa' },
  { key: 'source', label: 'Origem' },
  { key: 'value', label: 'Valor' },
];

export function FormWebhookConfig() {
  const { workspaceId } = useWorkspace();
  const { definitions } = useCustomFields();
  const { stages } = useLeads();

  const [webhookToken, setWebhookToken] = useState<string | null>(null);
  const [defaultStageId, setDefaultStageId] = useState<string>('');
  const [fieldMapping, setFieldMapping] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConfig = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const { data } = await supabase
      .from('workspaces')
      .select('form_webhook_token, form_field_mapping, form_default_stage_id')
      .eq('id', workspaceId)
      .single();
    if (data) {
      setWebhookToken(data.form_webhook_token || null);
      setDefaultStageId(data.form_default_stage_id || '');
      setFieldMapping((data.form_field_mapping as Record<string, string>) || {});
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const webhookUrl = webhookToken
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/form-webhook?token=${webhookToken}`
    : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success('URL copiada!');
  };

  const handleRegenerateToken = async () => {
    if (!workspaceId) return;
    const newToken = crypto.randomUUID().replace(/-/g, '').slice(0, 48);
    const { error } = await supabase
      .from('workspaces')
      .update({ form_webhook_token: newToken })
      .eq('id', workspaceId);
    if (!error) {
      setWebhookToken(newToken);
      toast.success('Token regenerado');
    }
  };

  const handleSave = async () => {
    if (!workspaceId) return;
    setSaving(true);
    const { error } = await supabase
      .from('workspaces')
      .update({
        form_default_stage_id: defaultStageId || null,
        form_field_mapping: fieldMapping,
      })
      .eq('id', workspaceId);
    setSaving(false);
    if (error) {
      toast.error('Erro ao salvar');
    } else {
      toast.success('Configuração salva');
    }
  };

  const allCrmFields = [
    ...NATIVE_FIELDS,
    ...definitions.map(d => ({ key: `custom:${d.field_key}`, label: `${d.field_label} (personalizado)` })),
  ];

  const updateMapping = (formField: string, crmField: string) => {
    setFieldMapping(prev => {
      const next = { ...prev };
      if (crmField === '__remove__') {
        delete next[formField];
      } else {
        next[formField] = crmField;
      }
      return next;
    });
  };

  const addMappingRow = () => {
    setFieldMapping(prev => ({ ...prev, [`campo_${Object.keys(prev).length + 1}`]: '' }));
  };

  const removeMappingRow = (formField: string) => {
    setFieldMapping(prev => {
      const next = { ...prev };
      delete next[formField];
      return next;
    });
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);

  if (loading) return <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>;

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileInput className="h-5 w-5" />
            Webhook de Formulário
          </CardTitle>
          <CardDescription>
            Use esta URL para receber leads de formulários externos. Envie um POST com JSON contendo os dados do lead.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Webhook</Label>
            <div className="flex gap-2">
              <Input value={webhookUrl} readOnly className="font-mono text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                <Copy className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleRegenerateToken} title="Regenerar token">
                <RefreshCcw className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O token autentica as requisições. Regenerar invalidará o token anterior.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Fase padrão para novos leads</Label>
            <Select value={defaultStageId} onValueChange={setDefaultStageId}>
              <SelectTrigger><SelectValue placeholder="Selecione uma fase" /></SelectTrigger>
              <SelectContent>
                {sortedStages.map(s => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Field Mapping */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Mapeamento de Campos</CardTitle>
              <CardDescription>
                Defina como os campos do formulário externo correspondem aos campos do CRM.
                Campos nativos (name, phone, email, company) são mapeados automaticamente.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addMappingRow}>
              + Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Auto-mapped native fields */}
          <div className="space-y-1 mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Campos automáticos</p>
            <div className="flex flex-wrap gap-2">
              {NATIVE_FIELDS.slice(0, 4).map(f => (
                <Badge key={f.key} variant="secondary" className="text-xs">
                  {f.key} → {f.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Custom mappings */}
          {Object.entries(fieldMapping).map(([formField, crmField]) => (
            <div key={formField} className="flex items-center gap-2">
              <Input
                value={formField}
                onChange={e => {
                  const newKey = e.target.value;
                  setFieldMapping(prev => {
                    const next = { ...prev };
                    delete next[formField];
                    next[newKey] = crmField;
                    return next;
                  });
                }}
                placeholder="Campo do formulário"
                className="flex-1 text-sm"
              />
              <span className="text-muted-foreground text-sm">→</span>
              <Select value={crmField} onValueChange={v => updateMapping(formField, v)}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Campo do CRM" /></SelectTrigger>
                <SelectContent>
                  {allCrmFields.map(f => (
                    <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"
                onClick={() => removeMappingRow(formField)}>
                ✕
              </Button>
            </div>
          ))}

          {Object.keys(fieldMapping).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Campos extras enviados no webhook que não são nativos (name, phone, email, company)
              serão salvos automaticamente se existir um campo personalizado com a mesma chave.
            </p>
          )}

          <Button onClick={handleSave} disabled={saving} className="w-full mt-4">
            {saving ? 'Salvando...' : 'Salvar Configuração'}
          </Button>
        </CardContent>
      </Card>

      {/* Example payload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Exemplo de Payload</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">
{`POST ${webhookUrl}
Content-Type: application/json

{
  "name": "João Silva",
  "phone": "27999887766",
  "email": "joao@empresa.com",
  "company": "Empresa X"${definitions.length > 0 ? `,\n  ${definitions.map(d => `"${d.field_key}": "valor"`).join(',\n  ')}` : ''}
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
