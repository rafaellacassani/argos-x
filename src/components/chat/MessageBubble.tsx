import { useState } from "react";
import { motion } from "framer-motion";
import { Check, CheckCheck, Play, Pause, Download, ExternalLink, FileText, Image as ImageIcon, Video, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
}

// Helper to detect and render links in text
const renderTextWithLinks = (text: string) => {
  // URL regex pattern
  const urlPattern = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
  
  const parts = text.split(urlPattern);
  
  return parts.map((part, index) => {
    if (urlPattern.test(part)) {
      // Reset regex lastIndex
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
}: MessageBubbleProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);

  // Format duration (seconds) to mm:ss
  const formatDuration = (seconds?: number): string => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAudioPlay = () => {
    if (audioRef) {
      if (isPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
  };

  const renderMedia = () => {
    switch (type) {
      case "image":
        // Use thumbnail if available, fallback to mediaUrl
        const imageSrc = thumbnailBase64 || mediaUrl;
        if (imageSrc && !imageError) {
          return (
            <div className="mb-2">
              <div 
                className="relative cursor-pointer group"
                onClick={() => mediaUrl && window.open(mediaUrl, '_blank')}
              >
                <img
                  src={imageSrc}
                  alt="Imagem"
                  className="max-w-full rounded-lg max-h-64 object-cover hover:opacity-90 transition-opacity"
                  onError={() => setImageError(true)}
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
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
        // Use thumbnail for video preview
        const videoThumb = thumbnailBase64;
        if (videoThumb || mediaUrl) {
          return (
            <div className="mb-2">
              <div 
                className="relative cursor-pointer group"
                onClick={() => mediaUrl && window.open(mediaUrl, '_blank')}
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
                {/* Play button overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center group-hover:bg-black/80 transition-colors">
                    <Play className="w-7 h-7 text-white ml-1" fill="white" />
                  </div>
                </div>
                {/* Duration badge */}
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
        }
        return (
          <div className="flex items-center gap-2 text-sm">
            <Video className="w-5 h-5 opacity-70" />
            <span>{content || "🎥 Vídeo"}</span>
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
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" />
              )}
            </Button>
            {mediaUrl && (
              <audio
                ref={(ref) => setAudioRef(ref)}
                src={mediaUrl}
                onEnded={handleAudioEnded}
                preload="metadata"
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
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              sent ? "bg-secondary-foreground/20" : "bg-muted-foreground/20"
            )}>
              <FileText className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName || content || "Documento"}</p>
              <p className="text-xs opacity-70">Documento</p>
            </div>
            {mediaUrl && (
              <a
                href={mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
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
  );
}