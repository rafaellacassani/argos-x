import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Play, Pause, Download, ExternalLink, FileText, Image as ImageIcon, Video, Loader2, X, Mic, Reply, Smile, Copy, Trash2, Pencil, Forward, CheckSquare, User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

export interface MessageBubbleProps {
  id: string;
  content: string;
  time: string;
  sent: boolean;
  read: boolean;
  type: "text" | "image" | "audio" | "document" | "video" | "contact";
  mediaUrl?: string;
  thumbnailBase64?: string;
  fileName?: string;
  duration?: number;
  localAudioBase64?: string;
  index: number;
  instanceName?: string;
  messageId?: string; // Evolution API message key id
  remoteJid?: string;
  fromMe?: boolean;
  isMeta?: boolean;
  timestamp?: number; // Unix timestamp for checking if within edit/delete window
  onDownloadMedia?: (messageId: string, convertToMp4?: boolean) => Promise<{ base64?: string; mimetype?: string } | null>;
  onReply?: (message: { id: string; content: string; sent: boolean; type: string }) => void;
  onCopy?: (content: string) => void;
  onDeleteForMe?: (id: string) => void;
  onDeleteForEveryone?: (id: string, messageId: string) => void;
  onEdit?: (id: string, messageId: string, currentContent: string) => void;
  onReact?: (id: string, messageId: string, reaction: string) => void;
  onContactChat?: (phone: string, name: string) => void;
}

// Helper to detect and render links in text
const renderTextWithLinks = (text: string) => {
  const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  const parts = text.split(urlPattern);
  
  return parts.map((part, index) => {
    if (urlPattern.test(part)) {
      urlPattern.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80 underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <span key={index}>{part}</span>;
  });
};

// Generate waveform bars for audio visualization
const generateWaveformBars = (count: number) => {
  const bars = [];
  for (let i = 0; i < count; i++) {
    // Generate semi-random heights for visual variety
    const height = Math.sin(i * 0.5) * 0.3 + Math.random() * 0.4 + 0.3;
    bars.push(height);
  }
  return bars;
};

export function MessageBubble({
  id,
  content,
  time,
  sent,
  read,
  type,
  mediaUrl,
  thumbnailBase64,
  fileName,
  duration,
  localAudioBase64,
  index,
  instanceName,
  messageId,
  remoteJid,
  fromMe,
  isMeta,
  timestamp,
  onDownloadMedia,
  onReply,
  onCopy,
  onDeleteForMe,
  onDeleteForEveryone,
  onEdit,
  onReact,
  onContactChat,
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [fullMediaBase64, setFullMediaBase64] = useState<string | null>(null);
  const [fullMediaMimetype, setFullMediaMimetype] = useState<string | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(localAudioBase64 || null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [waveformBars] = useState(() => generateWaveformBars(35));
  const [hasAutoPlayed, setHasAutoPlayed] = useState(false);
  const autoLoadAttemptedRef = useRef(false);

  // Auto-load image when no thumbnail is available
  useEffect(() => {
    if (type === "image" && !thumbnailBase64 && !fullMediaBase64 && !autoLoadAttemptedRef.current && onDownloadMedia && id) {
      autoLoadAttemptedRef.current = true;
      (async () => {
        setIsLoadingMedia(true);
        try {
          const result = await onDownloadMedia(id, false);
          if (result?.base64) {
            const base64WithPrefix = result.base64.startsWith("data:")
              ? result.base64
              : `data:${result.mimetype || "image/jpeg"};base64,${result.base64}`;
            setFullMediaBase64(base64WithPrefix);
            setFullMediaMimetype(result.mimetype || null);
          }
        } catch (err) {
          console.error("Auto-load image failed:", err);
        } finally {
          setIsLoadingMedia(false);
        }
      })();
    }
  }, [type, thumbnailBase64, fullMediaBase64, onDownloadMedia, id]);

  // Initialize audio base64 from local prop
  useEffect(() => {
    if (localAudioBase64 && !audioBase64) {
      setAudioBase64(localAudioBase64);
    }
  }, [localAudioBase64, audioBase64]);

  const formatDuration = (seconds?: number): string => {
    if (!seconds || seconds <= 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMediaClick = useCallback(async () => {
    if (!onDownloadMedia || !id) return;
    
    // If already have full media, just show modal
    if (fullMediaBase64) {
      setShowMediaModal(true);
      return;
    }

    setIsLoadingMedia(true);
    setMediaError(null);
    try {
      const result = await onDownloadMedia(id, type === "video");
      if (result?.base64) {
        const base64WithPrefix = result.base64.startsWith("data:") 
          ? result.base64 
          : `data:${result.mimetype || "image/jpeg"};base64,${result.base64}`;
        setFullMediaBase64(base64WithPrefix);
        setFullMediaMimetype(result.mimetype || null);
        setShowMediaModal(true);
      } else {
        setMediaError("Mídia não disponível");
      }
    } catch (err) {
      console.error("Error downloading media:", err);
      setMediaError("Erro ao carregar mídia");
    } finally {
      setIsLoadingMedia(false);
    }
  }, [id, onDownloadMedia, fullMediaBase64, type]);

  const handleAudioPlay = useCallback(async () => {
    // If we already have audio loaded, play/pause
    if (audioBase64 && audioElementRef.current) {
      if (isPlaying) {
        audioElementRef.current.pause();
        setIsPlaying(false);
      } else {
        audioElementRef.current.play();
        setIsPlaying(true);
      }
      return;
    }

    // Need to download audio first
    if (!onDownloadMedia || !id) {
      setMediaError("Áudio não disponível");
      return;
    }

    setIsLoadingMedia(true);
    setMediaError(null);
    try {
      const result = await onDownloadMedia(id, false);
      if (result?.base64) {
        const base64WithPrefix = result.base64.startsWith("data:") 
          ? result.base64 
          : `data:${result.mimetype || "audio/ogg"};base64,${result.base64}`;
        setAudioBase64(base64WithPrefix);
      } else {
        setMediaError("Áudio não disponível");
      }
    } catch (err) {
      console.error("Error downloading audio:", err);
      setMediaError("Erro ao carregar áudio");
    } finally {
      setIsLoadingMedia(false);
    }
  }, [id, onDownloadMedia, audioBase64, isPlaying]);

  // Auto-play when audio is FIRST loaded (not for local audio, only once)
  useEffect(() => {
    if (audioBase64 && audioElementRef.current && !hasAutoPlayed && !localAudioBase64) {
      audioElementRef.current.play();
      setIsPlaying(true);
      setHasAutoPlayed(true);
    }
  }, [audioBase64, hasAutoPlayed, localAudioBase64]);

  const handleAudioTimeUpdate = useCallback(() => {
    if (audioElementRef.current) {
      const progress = (audioElementRef.current.currentTime / audioElementRef.current.duration) * 100;
      setAudioProgress(progress || 0);
    }
  }, []);

  const handleAudioLoadedMetadata = useCallback(() => {
    if (audioElementRef.current) {
      setAudioDuration(audioElementRef.current.duration);
    }
  }, []);

  const handleAudioEnded = () => {
    setIsPlaying(false);
    setAudioProgress(0);
  };

  const handleWaveformClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioElementRef.current || !audioBase64) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    
    audioElementRef.current.currentTime = percentage * audioElementRef.current.duration;
    setAudioProgress(percentage * 100);
  }, [audioBase64]);

  const renderMedia = () => {
    switch (type) {
      case "image":
        // Show thumbnail if available, otherwise show placeholder
        const imageSrc = thumbnailBase64;
        if (imageSrc && !imageError) {
          return (
            <div className="-mx-4 -mt-2.5 mb-1">
              <div 
                className="relative cursor-pointer group"
                onClick={handleMediaClick}
              >
                <img
                  src={imageSrc}
                  alt="Imagem"
                  className="w-full max-w-[280px] rounded-t-2xl object-cover hover:opacity-95 transition-opacity"
                  style={{ maxHeight: "300px" }}
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-t-2xl transition-colors flex items-center justify-center">
                  {isLoadingMedia ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin drop-shadow-lg" />
                  ) : (
                    <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  )}
                </div>
                {mediaError && (
                  <div className="absolute bottom-2 left-2 right-2 bg-destructive/80 text-white text-xs px-2 py-1 rounded">
                    {mediaError}
                  </div>
                )}
              </div>
              {content && (
                <p className="text-sm mt-2 px-4 whitespace-pre-wrap break-words">
                  {renderTextWithLinks(content)}
                </p>
              )}
            </div>
          );
        }
        // No thumbnail available - show placeholder with click to load
        return (
          <div className="mb-2">
            <div 
              className="relative cursor-pointer group w-48 h-32 bg-muted/50 rounded-lg flex items-center justify-center"
              onClick={handleMediaClick}
            >
              {isLoadingMedia ? (
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <ImageIcon className="w-10 h-10 text-muted-foreground" />
                  <div className="absolute bottom-2 left-2 right-2 text-xs text-muted-foreground text-center">
                    Clique para ver
                  </div>
                </>
              )}
              {mediaError && (
                <div className="absolute bottom-2 left-2 right-2 bg-destructive/80 text-white text-xs px-2 py-1 rounded text-center">
                  {mediaError}
                </div>
              )}
            </div>
            {content && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">
                {renderTextWithLinks(content)}
              </p>
            )}
          </div>
        );

      case "video":
        const videoThumb = thumbnailBase64;
        return (
          <div className="-mx-4 -mt-2.5 mb-1">
            <div 
              className="relative cursor-pointer group"
              onClick={handleMediaClick}
            >
              {videoThumb ? (
                <img
                  src={videoThumb}
                  alt="Vídeo"
                  className="w-full max-w-[280px] rounded-t-2xl object-cover"
                  style={{ maxHeight: "300px" }}
                />
              ) : (
                <div className="w-64 h-36 bg-muted-foreground/20 rounded-t-2xl flex items-center justify-center">
                  <Video className="w-8 h-8 opacity-50" />
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center">
                {isLoadingMedia ? (
                  <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                    <Play className="w-7 h-7 text-white ml-1" fill="white" />
                  </div>
                )}
              </div>
              {duration && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                  {formatDuration(duration)}
                </div>
              )}
              {mediaError && (
                <div className="absolute bottom-2 left-2 right-2 bg-destructive/80 text-white text-xs px-2 py-1 rounded text-center">
                  {mediaError}
                </div>
              )}
            </div>
            {content && (
              <p className="text-sm mt-2 px-4 whitespace-pre-wrap break-words">
                {renderTextWithLinks(content)}
              </p>
            )}
          </div>
        );

      case "audio":
        const currentTime = audioElementRef.current?.currentTime || 0;
        const displayDuration = audioDuration || duration || 0;
        const displayTime = isPlaying ? currentTime : displayDuration;
        
        return (
          <div className="flex items-center gap-3 min-w-[240px] max-w-[320px] py-1">
            {/* Play/Pause Button */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-12 w-12 rounded-full flex-shrink-0 transition-colors",
                sent 
                  ? "bg-secondary-foreground/20 hover:bg-secondary-foreground/30 text-secondary-foreground" 
                  : "bg-primary/20 hover:bg-primary/30 text-primary"
              )}
              onClick={handleAudioPlay}
              disabled={isLoadingMedia}
            >
              {isLoadingMedia ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-6 h-6" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
              )}
            </Button>

            {/* Audio element */}
            {audioBase64 && (
              <audio
                ref={audioElementRef}
                src={audioBase64}
                onEnded={handleAudioEnded}
                onTimeUpdate={handleAudioTimeUpdate}
                onLoadedMetadata={handleAudioLoadedMetadata}
                preload="auto"
              />
            )}

            {/* Waveform and duration */}
            <div className="flex-1 flex flex-col gap-1.5">
              {/* Waveform bars */}
              <div 
                className="flex items-center gap-[2px] h-6 cursor-pointer"
                onClick={handleWaveformClick}
              >
                {waveformBars.map((height, i) => {
                  const barProgress = (i / waveformBars.length) * 100;
                  const isPlayed = barProgress <= audioProgress;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "w-[3px] rounded-full transition-colors",
                        isPlayed 
                          ? (sent ? "bg-secondary-foreground/80" : "bg-primary") 
                          : (sent ? "bg-secondary-foreground/30" : "bg-primary/30")
                      )}
                      style={{ height: `${height * 24}px` }}
                    />
                  );
                })}
              </div>

              {/* Duration */}
              <div className="flex items-center justify-between">
                <span className={cn(
                  "text-xs",
                  sent ? "text-secondary-foreground/70" : "text-muted-foreground"
                )}>
                  {formatDuration(displayTime)}
                </span>
                {mediaError && (
                  <span className="text-xs text-destructive">{mediaError}</span>
                )}
              </div>
            </div>

            {/* Microphone icon indicator */}
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
              sent ? "bg-secondary-foreground/10" : "bg-primary/10"
            )}>
              <Mic className={cn(
                "w-5 h-5",
                sent ? "text-secondary-foreground/60" : "text-primary/60"
              )} />
            </div>
          </div>
        );

      case "document":
        return (
          <div 
            className="flex items-center gap-3 cursor-pointer hover:opacity-80"
            onClick={handleMediaClick}
          >
            <div className={cn(
              "p-2 rounded-lg",
              sent ? "bg-secondary-foreground/20" : "bg-muted-foreground/20"
            )}>
              {isLoadingMedia ? (
                <Loader2 className="w-6 h-6 animate-spin" />
              ) : (
                <FileText className="w-6 h-6" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName || content || "Documento"}</p>
              <p className="text-xs opacity-70">
                {mediaError || "Clique para baixar"}
              </p>
            </div>
            <Download className="w-4 h-4 opacity-50" />
          </div>
        );

      case "contact": {
        // Parse contact card content (format: 📇 Name\n📱 Phone)
        const contactBlocks = content.split("\n\n").filter(Boolean);
        return (
          <div className="space-y-2 min-w-[200px]">
            {contactBlocks.map((block, idx) => {
              const lines = block.split("\n");
              const nameLine = lines.find(l => l.startsWith("📇"))?.replace("📇 ", "") || "Contato";
              const phoneLine = lines.find(l => l.startsWith("📱"))?.replace("📱 ", "") || "";
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl",
                    sent ? "bg-secondary-foreground/10" : "bg-muted/60"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                    sent ? "bg-secondary-foreground/20" : "bg-primary/15"
                  )}>
                    <User className={cn(
                      "w-5 h-5",
                      sent ? "text-secondary-foreground" : "text-primary"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{nameLine}</p>
                    {phoneLine && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 opacity-60" />
                        <p className="text-xs opacity-70">{phoneLine}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      }

      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">
            {renderTextWithLinks(content)}
          </p>
        );
    }
  };

  // Check if message is within 48 hours (WhatsApp delete/edit window)
  const isWithinEditWindow = () => {
    if (!timestamp) return true; // if no timestamp, allow
    const now = Math.floor(Date.now() / 1000);
    return now - timestamp < 172800; // 48 hours
  };

  const canDeleteForEveryone = sent && messageId && isWithinEditWindow();
  const canEdit = sent && type === "text" && messageId && !isMeta && isWithinEditWindow();
  const canReact = messageId && !isMeta;

  const quickReactions = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.008, 0.3), duration: 0.15 }}
            className={cn("flex", sent ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[70%] overflow-hidden relative group",
                type === "image" || type === "video" ? "px-0 py-0" : "px-3 py-1.5",
                sent
                  ? "rounded-tl-xl rounded-tr-xl rounded-bl-xl rounded-br-sm shadow-sm"
                  : "rounded-tl-xl rounded-tr-xl rounded-br-xl rounded-bl-sm shadow-sm",
                sent
                  ? "bg-[hsl(var(--chat-bubble-sent))] text-[hsl(var(--chat-bubble-sent-foreground))]"
                  : "bg-[hsl(var(--chat-bubble-received))] text-[hsl(var(--chat-bubble-received-foreground))]"
              )}
              style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
            >
              {/* Media content */}
              <div>{renderMedia()}</div>
              
              {/* Time and read status — inside bubble, bottom-right */}
              <div className={cn(
                "flex items-center gap-1 mt-0.5",
                type === "image" || type === "video" ? "px-3 pb-1.5" : "",
                "justify-end"
              )}>
                <span className="text-[10px] text-[hsl(var(--chat-timestamp))]">
                  {time}
                </span>
                {sent && (
                  read ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[hsl(var(--secondary))]" />
                  ) : (
                    <Check className="w-3 h-3 text-[hsl(var(--chat-timestamp))]" />
                  )
                )}
              </div>
            </div>
          </motion.div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-56">
          {/* Quick reactions row */}
          {canReact && onReact && (
            <>
              <div className="flex items-center justify-around px-2 py-1.5">
                {quickReactions.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(id, messageId!, emoji)}
                    className="text-lg hover:scale-125 transition-transform active:scale-95 p-1 rounded-md hover:bg-accent"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <ContextMenuSeparator />
            </>
          )}

          {/* Reply */}
          {onReply && (
            <ContextMenuItem onClick={() => onReply({ id, content, sent, type })}>
              <Reply className="w-4 h-4 mr-2" />
              Responder
            </ContextMenuItem>
          )}

          {/* Copy */}
          {type === "text" && content && (
            <ContextMenuItem onClick={() => {
              navigator.clipboard.writeText(content);
              onCopy?.(content);
            }}>
              <Copy className="w-4 h-4 mr-2" />
              Copiar
            </ContextMenuItem>
          )}

          {/* Edit */}
          {canEdit && onEdit && (
            <ContextMenuItem onClick={() => onEdit(id, messageId!, content)}>
              <Pencil className="w-4 h-4 mr-2" />
              Editar
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {/* Delete for me */}
          {onDeleteForMe && (
            <ContextMenuItem onClick={() => onDeleteForMe(id)}>
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar para mim
            </ContextMenuItem>
          )}

          {/* Delete for everyone */}
          {canDeleteForEveryone && onDeleteForEveryone && (
            <ContextMenuItem 
              onClick={() => onDeleteForEveryone(id, messageId!)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Apagar para todos
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      {/* Media Modal */}
      <Dialog open={showMediaModal} onOpenChange={setShowMediaModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-black/95">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 z-10 text-white hover:bg-white/20"
            onClick={() => setShowMediaModal(false)}
          >
            <X className="w-5 h-5" />
          </Button>
          
          {fullMediaBase64 && type === "image" && (
            <div className="flex items-center justify-center p-4 max-h-[90vh]">
              <img
                src={fullMediaBase64}
                alt="Imagem completa"
                className="max-w-full max-h-[85vh] object-contain rounded-lg"
              />
            </div>
          )}
          
          {fullMediaBase64 && type === "video" && (
            <div className="flex items-center justify-center p-4">
              <video
                src={fullMediaBase64}
                controls
                autoPlay
                className="max-w-full max-h-[85vh] rounded-lg"
              />
            </div>
          )}

          {fullMediaBase64 && type === "document" && (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
              <FileText className="w-16 h-16 text-white opacity-50" />
              <p className="text-white text-lg">{fileName || "Documento"}</p>
              <a
                href={fullMediaBase64}
                download={fileName || "documento"}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
              >
                Baixar Arquivo
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
