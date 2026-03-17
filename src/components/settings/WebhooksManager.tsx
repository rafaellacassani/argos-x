import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Webhook, Plus, Trash2, Copy, TestTube2, Radio, Eye, AlertTriangle } from 'lucide-react';
import { useWebhooks, WEBHOOK_EVENTS } from '@/hooks/useWebhooks';
import { toast } from 'sonner';

export function WebhooksManager() {
  const {
    webhooks, deliveries, loading,
    fetchWebhooks, fetchDeliveries,
    createWebhook, toggleWebhook, deleteWebhook, testWebhook,
  } = useWebhooks();

  const [createOpen, setCreateOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [selectedEvents, setSelectedEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [revealSecret, setRevealSecret] = useState<{ secret: string; name: string } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [viewDeliveriesId, setViewDeliveriesId] = useState<string | null>(null);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const handleCreate = async () => {
    if (!url || selectedEvents.length === 0) {
      toast.error('Informe a URL e selecione ao menos um evento');
      return;
    }
    setCreating(true);
    const result = await createWebhook(url, selectedEvents);
    setCreating(false);
    if (result) {
      setCreateOpen(false);
      setUrl('');
      setSelectedEvents([]);
      setRevealSecret({ secret: result.secret, name: result.webhook.url });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteWebhook(deleteId);
    setDeleteId(null);
  };

  const handleViewDeliveries = async (webhookId: string) => {
    setViewDeliveriesId(webhookId);
    await fetchDeliveries(webhookId);
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'delivered') return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">Entregue</Badge>;
    if (status === 'failed') return <Badge variant="destructive">Falhou</Badge>;
    return <Badge variant="outline">Pendente</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Webhook className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Webhooks</CardTitle>
                <CardDescription>Receba eventos em tempo real no seu servidor</CardDescription>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" /> Novo webhook
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Webhooks Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Seus webhooks ({webhooks.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading && webhooks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">Carregando...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Radio className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">Nenhum webhook registrado</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Registrar primeiro webhook
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead>Eventos</TableHead>
                  <TableHead>Secret</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((wh) => (
                  <TableRow key={wh.id}>
                    <TableCell className="font-mono text-xs max-w-[200px] truncate">{wh.url}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(wh.events as string[]).map(e => (
                          <Badge key={e} variant="outline" className="text-xs">{e}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="bg-muted px-2 py-1 rounded text-xs font-mono">{wh.secret_prefix}...****</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatDateTime(wh.created_at)}</TableCell>
                    <TableCell>
                      <Switch checked={wh.is_active} onCheckedChange={(c) => toggleWebhook(wh.id, c)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Ver entregas"
                          onClick={() => handleViewDeliveries(wh.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Testar"
                          onClick={() => testWebhook(wh.id)}>
                          <TestTube2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="Remover"
                          onClick={() => setDeleteId(wh.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Registrar webhook</DialogTitle>
            <DialogDescription>Receba eventos em tempo real via HTTP POST</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL de destino</Label>
              <Input
                placeholder="https://seu-servidor.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Eventos</Label>
              <div className="space-y-2">
                {WEBHOOK_EVENTS.map((evt) => (
                  <div key={evt.key} className="flex items-center gap-3 p-2 rounded border">
                    <Checkbox
                      id={evt.key}
                      checked={selectedEvents.includes(evt.key)}
                      onCheckedChange={(checked) => {
                        setSelectedEvents(prev =>
                          checked ? [...prev, evt.key] : prev.filter(e => e !== evt.key)
                        );
                      }}
                    />
                    <div className="flex-1">
                      <label htmlFor={evt.key} className="text-sm font-medium cursor-pointer">{evt.label}</label>
                      <p className="text-xs text-muted-foreground">{evt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating || !url || selectedEvents.length === 0}>
              {creating ? 'Registrando...' : 'Registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Secret Reveal Dialog */}
      {revealSecret && (
        <Dialog open={!!revealSecret} onOpenChange={() => setRevealSecret(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Webhook Secret
              </DialogTitle>
              <DialogDescription>
                Salve este secret agora! Ele <strong>não será exibido novamente</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="bg-muted rounded-lg p-4 font-mono text-sm break-all select-all">
                {revealSecret.secret}
              </div>
              <Button className="w-full gap-2" onClick={() => {
                navigator.clipboard.writeText(revealSecret.secret);
                toast.success('Secret copiado!');
              }}>
                <Copy className="h-4 w-4" /> Copiar secret
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRevealSecret(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              Eventos não serão mais enviados para esta URL. Essa ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Deliveries Dialog */}
      <Dialog open={!!viewDeliveriesId} onOpenChange={() => setViewDeliveriesId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico de entregas</DialogTitle>
            <DialogDescription>Últimas 50 entregas deste webhook</DialogDescription>
          </DialogHeader>
          {deliveries.length === 0 ? (
            <p className="text-center py-6 text-muted-foreground text-sm">Nenhuma entrega registrada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>HTTP</TableHead>
                  <TableHead>Tentativa</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-xs">{d.event_type}</TableCell>
                    <TableCell>{getStatusBadge(d.status)}</TableCell>
                    <TableCell className="text-xs">{d.response_status || '—'}</TableCell>
                    <TableCell className="text-xs">{d.attempt}/3</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
