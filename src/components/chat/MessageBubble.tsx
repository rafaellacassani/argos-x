import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Play, Pause, Download, ExternalLink, FileText, Image as ImageIcon, Video, Volume2, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface MessageBubbleProps {
  id: string;
  content: string;
  time: string;
  sent: boolean;
  read: boolean;
  type: "text" | "image" | "audio" | "document" | "video";
  mediaUrl?: string;
  thumbnailBase64?: string;
  fileName?: string;
  duration?: number;
  index: number;
  instanceName?: string;
  onDownloadMedia?: (messageId: string, convertToMp4?: boolean) => Promise<{ base64?: string; mimetype?: string } | null>;
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
  index,
  onDownloadMedia,
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [isLoadingMedia, setIsLoadingMedia] = useState(false);
  const [fullMediaBase64, setFullMediaBase64] = useState<string | null>(null);
  const [fullMediaMimetype, setFullMediaMimetype] = useState<string | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
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
    try {
      const result = await onDownloadMedia(id, type === "video");
      if (result?.base64) {
        const base64WithPrefix = result.base64.startsWith("data:") 
          ? result.base64 
          : `data:${result.mimetype || "image/jpeg"};base64,${result.base64}`;
        setFullMediaBase64(base64WithPrefix);
        setFullMediaMimetype(result.mimetype || null);
        setShowMediaModal(true);
      }
    } catch (err) {
      console.error("Error downloading media:", err);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [id, onDownloadMedia, fullMediaBase64, type]);

  const handleAudioPlay = useCallback(async () => {
    // If we have an audio ref with source, play/pause it
    if (audioRef && audioBase64) {
      if (isPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
      setIsPlaying(!isPlaying);
      return;
    }

    // Need to download audio first
    if (!onDownloadMedia || !id) return;

    setIsLoadingMedia(true);
    try {
      const result = await onDownloadMedia(id, false);
      if (result?.base64) {
        const base64WithPrefix = result.base64.startsWith("data:") 
          ? result.base64 
          : `data:${result.mimetype || "audio/ogg"};base64,${result.base64}`;
        setAudioBase64(base64WithPrefix);
        // Audio will auto-play when ref is set
      }
    } catch (err) {
      console.error("Error downloading audio:", err);
    } finally {
      setIsLoadingMedia(false);
    }
  }, [id, onDownloadMedia, audioRef, audioBase64, isPlaying]);

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  // Auto-play audio when loaded
  const handleAudioRef = useCallback((ref: HTMLAudioElement | null) => {
    setAudioRef(ref);
    if (ref && audioBase64 && !isPlaying) {
      ref.play();
      setIsPlaying(true);
    }
  }, [audioBase64, isPlaying]);

  const renderMedia = () => {
    switch (type) {
      case "image":
        const imageSrc = thumbnailBase64 || mediaUrl;
        if (imageSrc && !imageError) {
          return (
            <div className="mb-2">
              <div 
                className="relative cursor-pointer group"
                onClick={handleMediaClick}
              >
                <img
                  src={imageSrc}
                  alt="Imagem"
                  className="max-w-full rounded-lg max-h-64 object-cover hover:opacity-90 transition-opacity"
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                  {isLoadingMedia ? (
                    <Loader2 className="w-8 h-8 text-white animate-spin drop-shadow-lg" />
                  ) : (
                    <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
                  )}
                </div>
              </div>
              {content && (
                <p className="text-sm mt-2 whitespace-pre-wrap break-words">
                  {renderTextWithLinks(content)}
                </p>
              )}
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2 text-sm">
            <ImageIcon className="w-5 h-5 opacity-70" />
            <span>{content || "📷 Imagem"}</span>
          </div>
        );

      case "video":
        const videoThumb = thumbnailBase64;
        return (
          <div className="mb-2">
            <div 
              className="relative cursor-pointer group"
              onClick={handleMediaClick}
            >
              {videoThumb ? (
                <img
                  src={videoThumb}
                  alt="Vídeo"
                  className="max-w-full rounded-lg max-h-64 object-cover"
                />
              ) : (
                <div className="w-64 h-36 bg-muted-foreground/20 rounded-lg flex items-center justify-center">
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
            </div>
            {content && (
              <p className="text-sm mt-2 whitespace-pre-wrap break-words">
                {renderTextWithLinks(content)}
              </p>
            )}
          </div>
        );

      case "audio":
        return (
          <div className="flex items-center gap-3 min-w-[200px] py-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-10 w-10 rounded-full flex-shrink-0",
                sent ? "bg-secondary-foreground/20 hover:bg-secondary-foreground/30" : "bg-muted-foreground/20 hover:bg-muted-foreground/30"
              )}
              onClick={handleAudioPlay}
              disabled={isLoadingMedia}
            >
              {isLoadingMedia ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            {audioBase64 && (
              <audio
                ref={handleAudioRef}
                src={audioBase64}
                onEnded={handleAudioEnded}
                preload="auto"
              />
            )}
            <div className="flex-1 flex flex-col gap-1">
              <div className="h-1 bg-current/20 rounded-full overflow-hidden">
                <div className="h-full w-0 bg-current/60 rounded-full" />
              </div>
              {duration && (
                <span className="text-xs opacity-60">{formatDuration(duration)}</span>
              )}
            </div>
            <Volume2 className="w-4 h-4 opacity-50 flex-shrink-0" />
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
              <p className="text-xs opacity-70">Clique para baixar</p>
            </div>
            <Download className="w-4 h-4 opacity-50" />
          </div>
        );

      default:
        return (
          <p className="text-sm whitespace-pre-wrap break-words">
            {renderTextWithLinks(content)}
          </p>
        );
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.01 }}
        className={cn("flex", sent ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "max-w-[70%] rounded-2xl px-4 py-2.5 overflow-hidden",
            sent
              ? "bg-secondary text-secondary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
        >
          {renderMedia()}
          <div className={cn("flex items-center gap-1 mt-1", sent ? "justify-end" : "justify-start")}>
            <span className={cn("text-[10px]", sent ? "text-secondary-foreground/70" : "text-muted-foreground")}>
              {time}
            </span>
            {sent && (
              read ? (
                <CheckCheck className="w-3 h-3 text-secondary-foreground/70" />
              ) : (
                <Check className="w-3 h-3 text-secondary-foreground/70" />
              )
            )}
          </div>
        </div>
      </motion.div>

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