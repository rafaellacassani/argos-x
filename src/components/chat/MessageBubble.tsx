import { useState, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Play, Pause, Download, ExternalLink, FileText, Image as ImageIcon, Video, Loader2, X, Mic } from "lucide-react";
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
  localAudioBase64?: string; // For locally sent audio that can play immediately
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
  onDownloadMedia,
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
            "max-w-[70%] rounded-2xl overflow-hidden",
            type === "image" || type === "video" ? "px-0 py-0" : "px-4 py-2.5",
            sent
              ? "bg-secondary text-secondary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          )}
          style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
        >
          {/* Media content */}
          <div className={type === "image" || type === "video" ? "" : ""}>
            {renderMedia()}
          </div>
          
          {/* Time and read status - inside bubble for media, separate for others */}
          <div className={cn(
            "flex items-center gap-1",
            type === "image" || type === "video" ? "px-4 py-2" : "mt-1",
            sent ? "justify-end" : "justify-start"
          )}>
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
