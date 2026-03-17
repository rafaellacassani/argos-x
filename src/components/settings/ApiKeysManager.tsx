import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { 
  Key, Plus, Trash2, Copy, ExternalLink, Code2, 
  Shield, ShieldCheck, ShieldAlert, Settings2, BookOpen
} from 'lucide-react';
import { useApiKeys, ApiKey, ApiPermissions, API_RESOURCES, PermissionLevel } from '@/hooks/useApiKeys';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { ApiKeyRevealDialog } from './ApiKeyRevealDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async (name: string, permissions: ApiPermissions, expiresAt?: string) => {
    setCreating(true);
    const result = await createKey(name, permissions, expiresAt);
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
    await updateKey(editKey.id, { permissions: editPermissions });
    setEditKey(null);
    setEditPermissions(null);
  };

  const openEditPermissions = (key: ApiKey) => {
    setEditKey(key);
    setEditPermissions({ ...key.permissions });
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getPermissionSummary = (permissions: ApiPermissions) => {
    const read = Object.values(permissions).filter(p => p === 'read').length;
    const write = Object.values(permissions).filter(p => p === 'write').length;
    return { read, write, total: read + write };
  };

  const baseUrl = `https://qczmdbqwpshioooncpjd.supabase.co/functions/v1/api-gateway/v1`;

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Chaves de API</CardTitle>
                <CardDescription>
                  Gerencie chaves para integrar plataformas externas com o Argos X
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova chave
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Documentation Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            Documentação da API
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Base URL</p>
              <div className="flex items-center gap-2">
                <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono flex-1 overflow-x-auto">
                  {baseUrl}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => {
                    navigator.clipboard.writeText(baseUrl);
                    toast.success('URL copiada');
                  }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Autenticação</p>
              <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono block">
                Header: X-API-Key: argx_...
              </code>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Endpoints disponíveis</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {API_RESOURCES.map((r) => (
                <div key={r.key} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-3 py-2">
                  <Code2 className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="font-mono text-primary">/{r.key}</span>
                  <span className="text-muted-foreground">— {r.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Paginação (cursor)</p>
              <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono block">
                ?cursor=&lt;uuid&gt;&amp;limit=50&amp;updated_after=2026-01-01T00:00:00Z
              </code>
              <p className="text-xs text-muted-foreground">Máx 100 itens por página. Resposta inclui next_cursor e has_more.</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Rate Limit</p>
              <code className="bg-muted px-3 py-1.5 rounded text-xs font-mono block">
                1.000 req/h por chave (configurável) · Agents: 60 exec/h
              </code>
              <p className="text-xs text-muted-foreground">Resposta 429 com header Retry-After quando excedido.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Exemplo de requisição</p>
            <div className="bg-muted rounded-lg p-3 font-mono text-xs overflow-x-auto">
              <pre className="text-muted-foreground">{`curl -X GET "${baseUrl}/leads?limit=20" \\
  -H "X-API-Key: argx_SuaChaveAqui" \\
  -H "Content-Type: application/json"`}</pre>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Guardrails</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
              <div className="bg-muted/50 rounded p-2 space-y-1">
                <p className="font-medium">Messages (write)</p>
                <p className="text-muted-foreground">Apenas texto · Valida telefone · Max 4096 chars · 10 msg/min por destinatário</p>
              </div>
              <div className="bg-muted/50 rounded p-2 space-y-1">
                <p className="font-medium">Agents (execute)</p>
                <p className="text-muted-foreground">60 exec/h · Agente deve estar ativo · Max 10k chars · Log completo</p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Webhooks</p>
            <div className="bg-muted/50 rounded p-2 text-xs space-y-1">
              <p className="text-muted-foreground">Registre via <code className="text-primary">POST /webhooks</code> com url + events[]. Secret HMAC-SHA256 no header <code className="text-primary">X-Argos-Signature</code>.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Badge variant="outline" className="text-xs gap-1">
              <ShieldAlert className="h-3 w-3 text-destructive" /> Negado
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <Shield className="h-3 w-3 text-blue-500" /> Leitura — GET
            </Badge>
            <Badge variant="outline" className="text-xs gap-1">
              <ShieldCheck className="h-3 w-3 text-emerald-500" /> Gravação — GET + POST/PATCH
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Keys Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Suas chaves ({keys.length})
          </CardTitle>
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
                <Plus className="h-4 w-4" />
                Criar primeira chave
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
                        <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                          {key.key_prefix}...****
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {summary.read > 0 && (
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                              {summary.read}R
                            </Badge>
                          )}
                          {summary.write > 0 && (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                              {summary.write}W
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => openEditPermissions(key)}
                          >
                            <Settings2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDateTime(key.last_used_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {key.expires_at ? (
                          <span className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
                            {isExpired ? 'Expirada' : formatDate(key.expires_at)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sem expiração</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={key.is_active && !isExpired}
                          onCheckedChange={(checked) => toggleKey(key.id, checked)}
                          disabled={!!isExpired}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(key.id)}
                        >
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

      {/* Create Dialog */}
      <CreateApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={handleCreate}
        loading={creating}
      />

      {/* Reveal Dialog */}
      {revealKey && (
        <ApiKeyRevealDialog
          open={!!revealKey}
          onOpenChange={() => setRevealKey(null)}
          rawKey={revealKey.raw}
          keyName={revealKey.name}
        />
      )}

      {/* Delete Confirmation */}
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
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Permissions Dialog */}
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
                  <Select
                    value={editPermissions[resource.key]}
                    onValueChange={(val: PermissionLevel) =>
                      setEditPermissions(prev => prev ? { ...prev, [resource.key]: val } : prev)
                    }
                  >
                    <SelectTrigger className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="denied">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-destructive" />
                          Negado
                        </span>
                      </SelectItem>
                      <SelectItem value="read">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          Leitura
                        </span>
                      </SelectItem>
                      <SelectItem value="write">
                        <span className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Gravação
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setEditKey(null); setEditPermissions(null); }}>
                Cancelar
              </Button>
              <Button onClick={handleEditPermissions}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
