import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Key, Plus, Trash2, Copy, Code2,
  Shield, ShieldCheck, ShieldAlert, Settings2, BookOpen,
  Zap, AlertTriangle, Clock, Send
} from 'lucide-react';
import { useApiKeys, ApiKey, ApiPermissions, API_RESOURCES, PermissionLevel } from '@/hooks/useApiKeys';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { ApiKeyRevealDialog } from './ApiKeyRevealDialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export function ApiKeysManager() {
  const { keys, loading, fetchKeys, createKey, updateKey, deleteKey, toggleKey } = useApiKeys();
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revealKey, setRevealKey] = useState<{ raw: string; name: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const [editPermissions, setEditPermissions] = useState<ApiPermissions | null>(null);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const deriveScopes = (perms: ApiPermissions): string[] => {
    const scopes: string[] = [];
    for (const [resource, level] of Object.entries(perms)) {
      if (level === 'read') scopes.push(`${resource}:read`);
      else if (level === 'write') {
        scopes.push(`${resource}:read`, `${resource}:write`);
      }
    }
    if (perms.agents === 'write') scopes.push('agents:execute');
    return [...new Set(scopes)];
  };

  const handleCreate = async (name: string, permissions: ApiPermissions, expiresAt?: string) => {
    setCreating(true);
    const scopes = deriveScopes(permissions);
    const result = await createKey(name, permissions, expiresAt, scopes);
    setCreating(false);
    if (result) {
      setCreateOpen(false);
      setRevealKey({ raw: result.raw_key, name });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteKey(deleteId);
    setDeleteId(null);
  };

  const handleEditPermissions = async () => {
    if (!editKey || !editPermissions) return;
    const scopes = deriveScopes(editPermissions);
    await updateKey(editKey.id, { permissions: editPermissions, scopes } as any);
    setEditKey(null);
    setEditPermissions(null);
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const getPermissionSummary = (perms: ApiPermissions) => {
    const read = Object.values(perms).filter(p => p === 'read').length;
    const write = Object.values(perms).filter(p => p === 'write').length;
    return { read, write, total: read + write };
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'qczmdbqwpshioooncpjd';
  const baseUrl = `https://${projectId}.supabase.co/functions/v1/api-gateway/v1`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>Gerencie chaves para integrar plataformas externas com o Argos X</CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Nova chave
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Docs Tabs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" /> Documentação da API v1
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
              <TabsTrigger value="pagination">Paginação</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="limits">Limites</TabsTrigger>
            </TabsList>

            {/* ── OVERVIEW ── */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Base URL</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono flex-1 overflow-x-auto">{baseUrl}</code>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                      onClick={() => { navigator.clipboard.writeText(baseUrl); toast.success('Copiada'); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Autenticação</p>
                  <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono block">
                    X-API-Key: argx_SuaChaveAqui
                  </code>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Exemplo completo</p>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground">{`# Listar leads (paginado)
curl -X GET "${baseUrl}/leads?limit=20&updated_after=2026-01-01T00:00:00Z" \\
  -H "X-API-Key: argx_SuaChaveAqui"

# Resposta:
{
  "data": {
    "items": [...],
    "has_more": true,
    "next_cursor": "uuid-do-ultimo-item",
    "count": 20
  }
}`}</pre>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Idempotência</p>
                <p className="text-xs text-muted-foreground">
                  Para evitar operações duplicadas, envie o header <code className="text-primary">Idempotency-Key</code> em requests de escrita.
                  Se o mesmo key for enviado novamente, retorna <code className="text-primary">409 Duplicate</code>.
                </p>
              </div>
            </TabsContent>

            {/* ── ENDPOINTS ── */}
            <TabsContent value="endpoints" className="space-y-4">
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">Recurso</TableHead>
                      <TableHead>Leitura (read)</TableHead>
                      <TableHead>Gravação (write)</TableHead>
                      <TableHead className="w-[100px]">Guardrails</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/leads</TableCell>
                      <TableCell className="text-xs">GET → lista paginada</TableCell>
                      <TableCell className="text-xs">POST (name, phone, stage_id) · PATCH /:id</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/contacts</TableCell>
                      <TableCell className="text-xs">GET → lista paginada</TableCell>
                      <TableCell className="text-xs text-muted-foreground">—</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/messages</TableCell>
                      <TableCell className="text-xs">GET → lista paginada</TableCell>
                      <TableCell className="text-xs">POST (phone, message) · texto apenas</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">Restrito</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/agents</TableCell>
                      <TableCell className="text-xs">GET → lista agentes</TableCell>
                      <TableCell className="text-xs">POST /:id/execute (write = execute)</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">Restrito</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/campaigns</TableCell>
                      <TableCell className="text-xs">GET → lista paginada</TableCell>
                      <TableCell className="text-xs text-muted-foreground">—</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/calendar</TableCell>
                      <TableCell className="text-xs">GET → lista paginada</TableCell>
                      <TableCell className="text-xs">POST (title, start_at, end_at)</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/tags</TableCell>
                      <TableCell className="text-xs">GET → lista tags</TableCell>
                      <TableCell className="text-xs">POST (name) · POST /assign (lead_id, tag_id)</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/funnels</TableCell>
                      <TableCell className="text-xs">GET → funis + etapas</TableCell>
                      <TableCell className="text-xs">PATCH /move-lead (lead_id, stage_id)</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-mono text-primary text-xs">/webhooks</TableCell>
                      <TableCell className="text-xs">GET → lista webhooks</TableCell>
                      <TableCell className="text-xs">POST (url, events[]) · POST /test · DELETE /:id</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">—</Badge></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Exemplos de escrita</p>
                <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto space-y-4">
                  <pre className="text-muted-foreground">{`# Criar lead
curl -X POST "${baseUrl}/leads" \\
  -H "X-API-Key: argx_..." \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: unique-id-123" \\
  -d '{"name":"João","phone":"5511999999999","stage_id":"uuid-da-etapa"}'

# Enviar mensagem (texto)
curl -X POST "${baseUrl}/messages" \\
  -H "X-API-Key: argx_..." \\
  -H "Content-Type: application/json" \\
  -d '{"phone":"5511999999999","message":"Olá! Tudo bem?"}'

# Executar agente IA
curl -X POST "${baseUrl}/agents/AGENT_ID/execute" \\
  -H "X-API-Key: argx_..." \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Qual o status do pedido?","lead_id":"uuid-do-lead"}'

# Mover lead de etapa
curl -X PATCH "${baseUrl}/funnels/move-lead" \\
  -H "X-API-Key: argx_..." \\
  -H "Content-Type: application/json" \\
  -d '{"lead_id":"uuid","stage_id":"uuid-nova-etapa"}'`}</pre>
                </div>
              </div>
            </TabsContent>

            {/* ── PAGINATION ── */}
            <TabsContent value="pagination" className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">Paginação baseada em cursor</p>
                <p className="text-xs text-muted-foreground">
                  Todos os endpoints GET retornam dados paginados. Use os parâmetros abaixo para navegar.
                </p>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[150px]">Parâmetro</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="w-[100px]">Default</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-mono text-primary text-xs">limit</TableCell>
                        <TableCell className="text-xs">Itens por página (1–200)</TableCell>
                        <TableCell className="text-xs">50</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-primary text-xs">cursor</TableCell>
                        <TableCell className="text-xs">UUID opaco do último item (use next_cursor da resposta)</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-primary text-xs">updated_after</TableCell>
                        <TableCell className="text-xs">Filtro ISO 8601 por data de atualização</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-mono text-primary text-xs">created_after</TableCell>
                        <TableCell className="text-xs">Filtro ISO 8601 por data de criação</TableCell>
                        <TableCell className="text-xs">—</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground">{`# Primeira página
GET /leads?limit=20

# Próxima página (use next_cursor da resposta anterior)
GET /leads?limit=20&cursor=abc123-uuid

# Sync incremental
GET /leads?updated_after=2026-03-16T00:00:00Z`}</pre>
                </div>

                <div className="bg-muted rounded-lg p-3 text-xs">
                  <p className="font-medium mb-1">Formato da resposta:</p>
                  <pre className="text-muted-foreground font-mono">{`{
  "data": {
    "items": [...],        // array de resultados
    "has_more": true,      // há mais páginas?
    "next_cursor": "uuid", // cursor para próxima página
    "count": 20            // itens nesta página
  }
}`}</pre>
                </div>
              </div>
            </TabsContent>

            {/* ── WEBHOOKS ── */}
            <TabsContent value="webhooks" className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">Receba eventos em tempo real</p>
                <p className="text-xs text-muted-foreground">
                  Registre webhooks para receber notificações quando eventos ocorrerem no workspace.
                </p>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Eventos disponíveis (v1)</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {[
                      { event: 'lead.created', desc: 'Novo lead criado via API ou WhatsApp' },
                      { event: 'message.received', desc: 'Mensagem enviada via API' },
                      { event: 'deal.stage_changed', desc: 'Lead movido de etapa no funil' },
                    ].map(e => (
                      <div key={e.event} className="bg-muted/50 rounded p-3 space-y-1">
                        <code className="text-primary text-xs font-mono">{e.event}</code>
                        <p className="text-xs text-muted-foreground">{e.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
                  <pre className="text-muted-foreground">{`# Registrar webhook
curl -X POST "${baseUrl}/webhooks" \\
  -H "X-API-Key: argx_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://seu-servidor.com/webhook","events":["lead.created","deal.stage_changed"]}'

# Resposta: { webhook, secret: "whsec_...", warning: "Salve agora!" }

# Enviar evento de teste
curl -X POST "${baseUrl}/webhooks/test" \\
  -H "X-API-Key: argx_..." \\
  -d '{"webhook_id":"uuid-do-webhook"}'`}</pre>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Verificando a assinatura</p>
                  <p className="text-xs text-muted-foreground">
                    Cada delivery inclui os headers abaixo. Use HMAC-SHA256 para validar autenticidade.
                  </p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[200px]">Header</TableHead>
                          <TableHead>Descrição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-Argos-Signature</TableCell>
                          <TableCell className="text-xs">sha256=HMAC(secret_hash, body)</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-Argos-Event</TableCell>
                          <TableCell className="text-xs">Tipo do evento (ex: lead.created)</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-Argos-Timestamp</TableCell>
                          <TableCell className="text-xs">ISO 8601 do momento do envio</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-Argos-Delivery-Id</TableCell>
                          <TableCell className="text-xs">UUID único do delivery (idempotency)</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div className="bg-muted rounded-lg p-3 text-xs">
                  <p className="font-medium mb-1">Exemplo de validação (Node.js):</p>
                  <pre className="text-muted-foreground font-mono">{`const crypto = require('crypto');

function verifySignature(secret, body, signature) {
  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected), Buffer.from(signature)
  );
}`}</pre>
                </div>

                <div className="bg-amber-500/10 rounded-lg p-3 flex items-start gap-2 text-xs">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-600">Retries e tolerância</p>
                    <p className="text-muted-foreground mt-1">
                      3 tentativas com backoff exponencial (1s → 30s → 5min). 
                      Seu servidor deve responder com 2xx em até 10s.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── LIMITS ── */}
            <TabsContent value="limits" className="space-y-4">
              <div className="space-y-3">
                <p className="text-sm font-medium">Rate Limits e Guardrails</p>

                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Escopo</TableHead>
                        <TableHead>Limite</TableHead>
                        <TableHead>Resposta</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="text-xs font-medium">Global (por key)</TableCell>
                        <TableCell className="text-xs">1.000 req/hora (configurável)</TableCell>
                        <TableCell className="text-xs">429 + Retry-After</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium">messages.write</TableCell>
                        <TableCell className="text-xs">30 msg/min por key + 10 msg/min por destinatário</TableCell>
                        <TableCell className="text-xs">429</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium">agents.execute</TableCell>
                        <TableCell className="text-xs">60 exec/hora por key</TableCell>
                        <TableCell className="text-xs">429</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="text-xs font-medium">Agent timeout</TableCell>
                        <TableCell className="text-xs">30 segundos por execução</TableCell>
                        <TableCell className="text-xs">504 Gateway Timeout</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <Card className="border-muted">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Send className="h-4 w-4 text-muted-foreground" />
                        Guardrails: messages.write
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 text-xs text-muted-foreground space-y-1">
                      <p>✓ Apenas texto no v1 (mídia não suportada)</p>
                      <p>✓ Validação de telefone obrigatória</p>
                      <p>✓ Max 4.096 caracteres por mensagem</p>
                      <p>✓ Bulk sending bloqueado (use campanhas)</p>
                      <p>✓ Workspace inativo → 403</p>
                      <p>✓ Audit log: to, payload_size, latency_ms, ip, user-agent</p>
                    </CardContent>
                  </Card>

                  <Card className="border-muted">
                    <CardHeader className="pb-2 pt-4 px-4">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Zap className="h-4 w-4 text-muted-foreground" />
                        Guardrails: agents.execute
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 text-xs text-muted-foreground space-y-1">
                      <p>✓ agents:write = permissão de execução</p>
                      <p>✓ Allowlist de agent_ids por API key (opcional)</p>
                      <p>✓ Timeout de 30s → 504</p>
                      <p>✓ Max 10.000 caracteres no prompt</p>
                      <p>✓ Agente deve estar ativo</p>
                      <p>✓ Audit log: agent_id, session_id, latency_ms, input_size</p>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">Headers de resposta (rate limit)</p>
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[220px]">Header</TableHead>
                          <TableHead>Descrição</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-RateLimit-Limit</TableCell>
                          <TableCell className="text-xs">Limite total da janela</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-RateLimit-Remaining</TableCell>
                          <TableCell className="text-xs">Requests restantes na janela</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">X-RateLimit-Reset</TableCell>
                          <TableCell className="text-xs">Unix timestamp do reset da janela</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="font-mono text-primary text-xs">Retry-After</TableCell>
                          <TableCell className="text-xs">Segundos até poder tentar novamente (só em 429)</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── KEYS TABLE ── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Suas chaves ({keys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && keys.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : keys.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Key className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhuma chave de API criada</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Criar primeira chave
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Chave</TableHead>
                  <TableHead>Permissões</TableHead>
                  <TableHead>Último uso</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => {
                  const summary = getPermissionSummary(key.permissions);
                  const isExpired = key.expires_at && new Date(key.expires_at) < new Date();
                  return (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">{key.name}</TableCell>
                      <TableCell>
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{key.key_prefix}...****</code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {summary.read > 0 && (
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">{summary.read}R</Badge>
                          )}
                          {summary.write > 0 && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">{summary.write}W</Badge>
                          )}
                          <Button variant="ghost" size="icon" className="h-6 w-6"
                            onClick={() => { setEditKey(key); setEditPermissions({ ...key.permissions }); }}>
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDateTime(key.last_used_at)}</TableCell>
                      <TableCell className="text-sm">
                        {key.expires_at ? (
                          <span className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
                            {isExpired ? 'Expirada' : formatDate(key.expires_at)}
                          </span>
                        ) : <span className="text-muted-foreground">∞</span>}
                      </TableCell>
                      <TableCell>
                        <Switch checked={key.is_active && !isExpired} onCheckedChange={(c) => toggleKey(key.id, c)} disabled={!!isExpired} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(key.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <CreateApiKeyDialog open={createOpen} onOpenChange={setCreateOpen} onSubmit={handleCreate} loading={creating} />

      {revealKey && (
        <ApiKeyRevealDialog open={!!revealKey} onOpenChange={() => setRevealKey(null)} rawKey={revealKey.raw} keyName={revealKey.name} />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar chave de API?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação é irreversível. Qualquer integração usando esta chave deixará de funcionar imediatamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Revogar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editKey && editPermissions && (
        <Dialog open={!!editKey} onOpenChange={() => { setEditKey(null); setEditPermissions(null); }}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Editar permissões: {editKey.name}</DialogTitle>
              <DialogDescription>Altere os níveis de acesso por recurso</DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border divide-y">
              {API_RESOURCES.map((resource) => (
                <div key={resource.key} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium">{resource.label}</span>
                  <Select value={editPermissions[resource.key]}
                    onValueChange={(val: PermissionLevel) => setEditPermissions(prev => prev ? { ...prev, [resource.key]: val } : prev)}>
                    <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="denied"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-destructive" />Negado</span></SelectItem>
                      <SelectItem value="read"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500" />Leitura</span></SelectItem>
                      <SelectItem value="write"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-500" />Gravação</span></SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditKey(null); setEditPermissions(null); }}>Cancelar</Button>
              <Button onClick={handleEditPermissions}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
