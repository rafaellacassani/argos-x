import { useState, useEffect, useRef } from 'react';
import { Send, AlertCircle, CheckCircle, Loader2, Phone, Settings2, Link2, Plus, FileText, ImagePlus, Mic, Video, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BotNode } from '@/hooks/useSalesBots';
import { ExecutionStatus, TestLead } from '@/hooks/useBotExecution';
import { useEvolutionAPI, EvolutionInstance } from '@/hooks/useEvolutionAPI';
import { useWhatsAppTemplates, WhatsAppTemplate } from '@/hooks/useWhatsAppTemplates';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface SendMessageNodeContentProps {
  node: BotNode;
  onUpdate: (data: Record<string, unknown>) => void;
  executionStatus?: ExecutionStatus;
  onTest?: (leadId: string, instanceName: string, forceWithoutConversation: boolean) => void;
  testLeads?: TestLead[];
  isTestingAvailable?: boolean;
}

const ACCEPTED_TYPES: Record<string, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  audio: 'audio/mpeg,audio/ogg,audio/wav,audio/mp4,audio/aac,audio/amr',
  video: 'video/mp4,video/3gpp',
};

export function SendMessageNodeContent({
  node,
  onUpdate,
  executionStatus,
  onTest,
  testLeads = [],
  isTestingAvailable = false,
}: SendMessageNodeContentProps) {
  const [instances, setInstances] = useState<EvolutionInstance[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTestLead, setSelectedTestLead] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [cloudConnections, setCloudConnections] = useState<{ id: string; inbox_name: string; phone_number: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const { listInstances } = useEvolutionAPI();
  const { templates, fetchTemplates, syncTemplates, syncing: syncingTemplates } = useWhatsAppTemplates();
  const { workspaceId } = useWorkspace();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const message = (node.data.message as string) || '';
  const instanceName = (node.data.instanceName as string) || '';
  const forceWithoutConversation = (node.data.forceWithoutConversation as boolean) || false;
  const urlButton = (node.data.url_button as { label: string; url: string } | null) || null;
  const [showUrlButton, setShowUrlButton] = useState(!!urlButton);
  const useWabaTemplate = (node.data.useWabaTemplate as boolean) || false;
  const selectedWabaTemplateId = (node.data.wabaTemplateId as string) || '';
  const wabaTemplateVars = (node.data.wabaTemplateVars as Record<string, string>) || {};

  // Media state from node data
  const mediaUrl = (node.data.mediaUrl as string) || '';
  const mediaType = (node.data.mediaType as 'image' | 'audio' | 'video') || '';
  const mediaFileName = (node.data.mediaFileName as string) || '';

  useEffect(() => {
    const loadInstances = async () => {
      setLoadingInstances(true);
      try {
        const data = await listInstances();
        setInstances(data);
        if (data.length === 1 && !instanceName) {
          onUpdate({ instanceName: data[0].instanceName });
        }
      } catch (error) {
        console.error('Error loading instances:', error);
      } finally {
        setLoadingInstances(false);
      }
    };

    const loadCloudConnections = async () => {
      if (!workspaceId) return;
      const { data } = await supabase
        .from('whatsapp_cloud_connections')
        .select('id, inbox_name, phone_number')
        .eq('workspace_id', workspaceId)
        .eq('is_active', true);
      setCloudConnections((data || []) as { id: string; inbox_name: string; phone_number: string }[]);
      if (data && data.length > 0 && useWabaTemplate) {
        fetchTemplates(data[0].id);
      }
    };

    loadInstances();
    loadCloudConnections();
  }, []);

  useEffect(() => {
    if (executionStatus?.status === 'running') {
      setIsSending(true);
    } else {
      setIsSending(false);
    }
  }, [executionStatus]);

  const handleTest = async () => {
    if (onTest && instanceName && selectedTestLead) {
      setIsSending(true);
      await onTest(selectedTestLead, instanceName, forceWithoutConversation);
    }
  };

  const handleMediaUpload = async (type: 'image' | 'audio' | 'video') => {
    if (!workspaceId) return;
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPTED_TYPES[type];
      fileInputRef.current.dataset.mediaType = type;
      fileInputRef.current.click();
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = e.target.dataset.mediaType as 'image' | 'audio' | 'video';
    if (!file || !type || !workspaceId) return;

    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'bin';
      const path = `${workspaceId}/${node.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('salesbot-media').upload(path, file, { upsert: true });
      if (error) throw error;

      const { data: urlData } = supabase.storage.from('salesbot-media').getPublicUrl(path);
      onUpdate({
        mediaUrl: urlData.publicUrl,
        mediaType: type,
        mediaFileName: file.name,
      });
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveMedia = () => {
    onUpdate({ mediaUrl: '', mediaType: '', mediaFileName: '' });
  };

  const getStatusIcon = () => {
    if (!executionStatus) return null;
    switch (executionStatus.status) {
      case 'running': return <Loader2 className="w-4 h-4 animate-spin text-blue-500" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusColor = () => {
    if (!executionStatus) return '';
    switch (executionStatus.status) {
      case 'running': return 'border-blue-500/50 bg-blue-500/5';
      case 'success': return 'border-green-500/50 bg-green-500/5';
      case 'error': return 'border-red-500/50 bg-red-500/5';
      default: return '';
    }
  };

  const insertVariable = (variable: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const newMsg = message.slice(0, start) + variable + message.slice(end);
    onUpdate({ message: newMsg });
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
  };

  const variables = [
    { label: 'Nome', value: '{{lead.name}}' },
    { label: 'Telefone', value: '{{lead.phone}}' },
    { label: 'Empresa', value: '{{lead.company}}' },
  ];

  const hasBracketText = /\[.*?\]/.test(message);

  return (
    <div className="space-y-3">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelected}
      />

      {/* WABA Template toggle */}
      {cloudConnections.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded border bg-muted/30">
          <Checkbox
            id={`waba-tpl-${node.id}`}
            checked={useWabaTemplate}
            onCheckedChange={(checked) => onUpdate({ useWabaTemplate: !!checked })}
          />
          <Label htmlFor={`waba-tpl-${node.id}`} className="text-xs flex items-center gap-1 cursor-pointer">
            <FileText className="w-3 h-3" />
            Enviar Template WABA
          </Label>
        </div>
      )}

      {useWabaTemplate ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Template *</Label>
            <button
              type="button"
              className="text-[10px] text-primary hover:underline"
              onClick={() => { if (cloudConnections.length > 0) syncTemplates(cloudConnections[0].id); }}
              disabled={syncingTemplates}
            >
              {syncingTemplates ? "Sincronizando..." : "Sincronizar"}
            </button>
          </div>
          <Select
            value={selectedWabaTemplateId}
            onValueChange={(v) => {
              onUpdate({ wabaTemplateId: v });
              const tpl = templates.find(t => t.id === v);
              if (tpl) {
                const body = tpl.components.find((c: any) => c.type === "BODY");
                const vars: Record<string, string> = {};
                const matches = body?.text?.match(/\{\{(\d+)\}\}/g) || [];
                for (const m of matches) vars[m] = wabaTemplateVars[m] || "";
                onUpdate({ wabaTemplateId: v, wabaTemplateVars: vars });
              }
            }}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Selecione o template" />
            </SelectTrigger>
            <SelectContent>
              {templates.filter(t => t.status === "APPROVED").map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.template_name} ({t.language})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedWabaTemplateId && (() => {
            const tpl = templates.find(t => t.id === selectedWabaTemplateId);
            if (!tpl) return null;
            const body = tpl.components.find((c: any) => c.type === "BODY");
            const varMatches = body?.text?.match(/\{\{(\d+)\}\}/g) || [];
            return (
              <div className="space-y-2">
                <div className="p-2 rounded bg-green-50 dark:bg-green-950/20 text-xs whitespace-pre-wrap border border-green-200 dark:border-green-800">
                  {body?.text || ""}
                </div>
                {varMatches.length > 0 && varMatches.map((v: string) => (
                  <div key={v} className="flex items-center gap-1">
                    <span className="text-[10px] font-mono bg-muted px-1 rounded">{v}</span>
                    <Select
                      value={wabaTemplateVars[v] || ""}
                      onValueChange={(val) => onUpdate({ wabaTemplateVars: { ...wabaTemplateVars, [v]: val } })}
                    >
                      <SelectTrigger className="h-6 text-[10px] flex-1">
                        <SelectValue placeholder="Campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="{{lead.name}}">Nome</SelectItem>
                        <SelectItem value="{{lead.phone}}">Telefone</SelectItem>
                        <SelectItem value="{{lead.company}}">Empresa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      ) : (
        <>
          {/* Message Input */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              className={cn(
                "w-full p-2 text-sm bg-background border rounded resize-none focus:ring-2 focus:ring-primary/50",
                hasBracketText && "border-amber-400 bg-amber-50/30 dark:bg-amber-950/20"
              )}
              placeholder={mediaType === 'audio' ? "Legenda (opcional para áudio)..." : "Digite a mensagem..."}
              rows={3}
              value={message}
              onChange={(e) => onUpdate({ message: e.target.value })}
            />
            {hasBracketText && (
              <p className="text-[10px] text-amber-600 mt-0.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Edite os textos entre [colchetes] para personalizar
              </p>
            )}
          </div>

          {/* Variable Chips */}
          <div className="flex flex-wrap gap-1">
            {variables.map(v => (
              <button
                key={v.value}
                type="button"
                className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
                onClick={() => insertVariable(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Media Attachment */}
          {mediaUrl ? (
            <div className="p-2 bg-muted/50 rounded border space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium flex items-center gap-1">
                  {mediaType === 'image' && <ImagePlus className="w-3 h-3" />}
                  {mediaType === 'audio' && <Mic className="w-3 h-3" />}
                  {mediaType === 'video' && <Video className="w-3 h-3" />}
                  {mediaType === 'image' ? 'Imagem' : mediaType === 'audio' ? 'Áudio (voz)' : 'Vídeo'}
                </span>
                <button type="button" className="text-[10px] text-destructive hover:underline flex items-center gap-0.5" onClick={handleRemoveMedia}>
                  <X className="w-3 h-3" /> Remover
                </button>
              </div>
              {mediaType === 'image' && (
                <img src={mediaUrl} alt="preview" className="w-full max-h-32 object-cover rounded" />
              )}
              {mediaType === 'audio' && (
                <div className="flex items-center gap-2">
                  <audio controls src={mediaUrl} className="w-full h-8" />
                </div>
              )}
              {mediaType === 'video' && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <File className="w-4 h-4" />
                  <span className="truncate">{mediaFileName}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                onClick={() => handleMediaUpload('image')}
                disabled={uploading}
              >
                <ImagePlus className="w-3 h-3" /> Imagem
              </button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                onClick={() => handleMediaUpload('audio')}
                disabled={uploading}
              >
                <Mic className="w-3 h-3" /> Áudio
              </button>
              <span className="text-muted-foreground text-[10px]">|</span>
              <button
                type="button"
                className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
                onClick={() => handleMediaUpload('video')}
                disabled={uploading}
              >
                <Video className="w-3 h-3" /> Vídeo
              </button>
              {uploading && <Loader2 className="w-3 h-3 animate-spin text-primary ml-1" />}
            </div>
          )}

          {/* URL Button */}
          {!showUrlButton ? (
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-primary hover:underline"
              onClick={() => setShowUrlButton(true)}
            >
              <Plus className="w-3 h-3" /> Botão de URL
            </button>
          ) : (
            <div className="space-y-1.5 p-2 bg-muted/50 rounded border">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium flex items-center gap-1"><Link2 className="w-3 h-3" /> Botão de URL</span>
                <button type="button" className="text-[10px] text-destructive hover:underline" onClick={() => { setShowUrlButton(false); onUpdate({ url_button: null }); }}>Remover</button>
              </div>
              <input
                type="text"
                className="w-full p-1.5 text-xs bg-background border rounded"
                placeholder="Texto do botão..."
                value={urlButton?.label || ''}
                onChange={(e) => onUpdate({ url_button: { label: e.target.value, url: urlButton?.url || '' } })}
              />
              <input
                type="url"
                className="w-full p-1.5 text-xs bg-background border rounded"
                placeholder="https://..."
                value={urlButton?.url || ''}
                onChange={(e) => onUpdate({ url_button: { label: urlButton?.label || '', url: e.target.value } })}
              />
            </div>
          )}
        </>
      )}

      {/* Instance Selection */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground flex items-center gap-1">
          <Phone className="w-3 h-3" />
          Instância WhatsApp
        </Label>
        <Select
          value={instanceName}
          onValueChange={(value) => onUpdate({ instanceName: value })}
          disabled={loadingInstances}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={loadingInstances ? "Carregando..." : "Selecione a instância"} />
          </SelectTrigger>
          <SelectContent>
            {instances.map((instance) => (
              <SelectItem key={instance.instanceName} value={instance.instanceName}>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      instance.connectionStatus === 'open' ? 'bg-green-500' : 'bg-red-500'
                    )}
                  />
                  {instance.instanceName}
                </div>
              </SelectItem>
            ))}
            {instances.length === 0 && !loadingInstances && (
              <SelectItem value="none" disabled>
                Nenhuma instância conectada
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Settings Collapsible */}
      <Collapsible open={showSettings} onOpenChange={setShowSettings}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs w-full justify-start">
            <Settings2 className="w-3 h-3 mr-1" />
            Configurações avançadas
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2 space-y-3">
          <div className="flex items-start gap-2">
            <Checkbox
              id={`force-${node.id}`}
              checked={forceWithoutConversation}
              onCheckedChange={(checked) => onUpdate({ forceWithoutConversation: !!checked })}
            />
            <Label htmlFor={`force-${node.id}`} className="text-xs text-muted-foreground leading-tight">
              Tentar enviar mesmo se nunca conversou
            </Label>
          </div>

          {isTestingAvailable && testLeads.length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <Label className="text-xs font-medium">Testar envio</Label>
              <Select value={selectedTestLead} onValueChange={setSelectedTestLead}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecione um lead de teste" />
                </SelectTrigger>
                <SelectContent>
                  {testLeads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex items-center gap-2">
                        <span>{lead.name}</span>
                        <span className="text-muted-foreground">({lead.phone})</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs w-full"
                disabled={!instanceName || !selectedTestLead || (!message.trim() && !mediaUrl) || isSending}
                onClick={handleTest}
              >
                {isSending ? (
                  <>
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-3 h-3 mr-1" />
                    Enviar mensagem de teste
                  </>
                )}
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Execution Status */}
      {executionStatus && (
        <div
          className={cn(
            'flex items-center gap-2 p-2 rounded border text-xs',
            getStatusColor()
          )}
        >
          {getStatusIcon()}
          <span className="flex-1">{executionStatus.message}</span>
          {executionStatus.timestamp && (
            <span className="text-muted-foreground text-[10px]">
              {new Date(executionStatus.timestamp).toLocaleTimeString('pt-BR')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
