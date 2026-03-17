import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Key, Shield, ShieldAlert, ShieldCheck, Calendar } from 'lucide-react';
import { API_RESOURCES, ApiPermissions, PermissionLevel } from '@/hooks/useApiKeys';

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, permissions: ApiPermissions, expiresAt?: string) => Promise<void>;
  loading?: boolean;
}

const defaultPermissions: ApiPermissions = {
  leads: 'denied',
  contacts: 'denied',
  messages: 'denied',
  agents: 'denied',
  campaigns: 'denied',
  calendar: 'denied',
  tags: 'denied',
  funnels: 'denied',
  webhooks: 'denied',
};

const permissionLabels: Record<PermissionLevel, { label: string; color: string }> = {
  denied: { label: 'Negado', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  read: { label: 'Leitura', color: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
  write: { label: 'Gravação', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
};

export function CreateApiKeyDialog({ open, onOpenChange, onSubmit, loading }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [permissions, setPermissions] = useState<ApiPermissions>({ ...defaultPermissions });
  const [expiresAt, setExpiresAt] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    await onSubmit(name.trim(), permissions, expiresAt || undefined);
    setName('');
    setPermissions({ ...defaultPermissions });
    setExpiresAt('');
  };

  const updatePermission = (resource: string, level: PermissionLevel) => {
    setPermissions(prev => ({ ...prev, [resource]: level }));
  };

  const setAllPermissions = (level: PermissionLevel) => {
    const newPerms = { ...permissions };
    API_RESOURCES.forEach(r => { newPerms[r.key] = level; });
    setPermissions(newPerms);
  };

  const activeCount = Object.values(permissions).filter(p => p !== 'denied').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Nova Chave de API
          </DialogTitle>
          <DialogDescription>
            Configure as permissões granulares para esta chave. A chave será exibida apenas uma vez após a criação.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="key-name">Nome da chave</Label>
            <Input
              id="key-name"
              placeholder="Ex: Integração Zapier, Webhook N8N..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Expiration */}
          <div className="space-y-2">
            <Label htmlFor="key-expires" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Expiração (opcional)
            </Label>
            <Input
              id="key-expires"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-muted-foreground">Deixe vazio para chave sem expiração</p>
          </div>

          {/* Permissions Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Permissões por recurso</Label>
              <div className="flex gap-1">
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted text-xs"
                  onClick={() => setAllPermissions('denied')}
                >
                  Negar todos
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted text-xs"
                  onClick={() => setAllPermissions('read')}
                >
                  Leitura total
                </Badge>
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-muted text-xs"
                  onClick={() => setAllPermissions('write')}
                >
                  Gravação total
                </Badge>
              </div>
            </div>

            <div className="rounded-lg border bg-card divide-y">
              {API_RESOURCES.map((resource) => (
                <div
                  key={resource.key}
                  className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {permissions[resource.key] === 'denied' && <ShieldAlert className="h-4 w-4 text-destructive/60" />}
                      {permissions[resource.key] === 'read' && <Shield className="h-4 w-4 text-blue-500" />}
                      {permissions[resource.key] === 'write' && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                      <span className="font-medium text-sm">{resource.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 ml-6">{resource.description}</p>
                  </div>
                  <Select
                    value={permissions[resource.key]}
                    onValueChange={(val: PermissionLevel) => updatePermission(resource.key, val)}
                  >
                    <SelectTrigger className="w-[140px]">
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

            <p className="text-xs text-muted-foreground">
              {activeCount} de {API_RESOURCES.length} recursos habilitados
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || activeCount === 0 || loading}>
            {loading ? 'Criando...' : 'Criar chave'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
