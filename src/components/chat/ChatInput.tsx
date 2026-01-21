import { useState, useRef, useCallback, useEffect, KeyboardEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Paperclip,
  Smile,
  Mic,
  X,
  Image,
  FileText,
  Video,
  Square,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import EmojiPicker from "./EmojiPicker";

interface ChatInputProps {
  onSendMessage: (text: string) => Promise<boolean>;
  onSendMedia: (file: File, caption?: string) => Promise<boolean>;
  onSendAudio: (audioBlob: Blob) => Promise<boolean>;
  disabled?: boolean;
}

export function ChatInput({
  onSendMessage,
  onSendMedia,
  onSendAudio,
  disabled = false,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Handle sending text message
  const handleSendMessage = async () => {
    if (isSending || disabled) return;

    // If we have a file selected, send it
    if (selectedFile) {
      setIsSending(true);
      try {
        const success = await onSendMedia(selectedFile, message.trim() || undefined);
        if (success) {
          setSelectedFile(null);
          setFilePreview(null);
          setMessage("");
        }
      } finally {
        setIsSending(false);
      }
      return;
    }

    // Send text message
    const text = message.trim();
    if (!text) return;

    setIsSending(true);
    try {
      const success = await onSendMessage(text);
      if (success) {
        setMessage("");
      }
    } finally {
      setIsSending(false);
    }
  };

  // Handle keyboard Enter
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);

    // Create preview for images/videos
    if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
      const reader = new FileReader();
      reader.onload = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }

    // Reset file input
    e.target.value = "";
  };

  // Clear selected file
  const clearSelectedFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach((track) => track.stop());

        if (audioBlob.size > 0) {
          setIsSending(true);
          try {
            await onSendAudio(audioBlob);
          } finally {
            setIsSending(false);
          }
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error starting recording:", err);
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Cancel recording
  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsRecording(false);
      audioChunksRef.current = [];
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  // Format recording time
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  // Get file type icon
  const getFileIcon = () => {
    if (!selectedFile) return null;
    if (selectedFile.type.startsWith("image/")) return <Image className="w-5 h-5" />;
    if (selectedFile.type.startsWith("video/")) return <Video className="w-5 h-5" />;
    return <FileText className="w-5 h-5" />;
  };

  return (
    <div className="p-4 border-t border-border bg-card">
      {/* File Preview */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-3 p-3 bg-muted/50 rounded-lg flex items-center gap-3 max-w-3xl mx-auto"
          >
            {filePreview && selectedFile.type.startsWith("image/") ? (
              <img src={filePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
            ) : filePreview && selectedFile.type.startsWith("video/") ? (
              <video src={filePreview} className="w-16 h-16 object-cover rounded" />
            ) : (
              <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                {getFileIcon()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={clearSelectedFile}
            >
              <X className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording UI */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-4 max-w-3xl mx-auto"
          >
            <Button
              variant="ghost"
              size="icon"
              className="text-destructive"
              onClick={cancelRecording}
            >
              <X className="w-5 h-5" />
            </Button>
            <div className="flex-1 flex items-center gap-3">
              <div className="w-3 h-3 bg-destructive rounded-full animate-pulse" />
              <span className="text-sm font-medium">{formatTime(recordingTime)}</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-destructive"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 60, ease: "linear" }}
                />
              </div>
            </div>
            <Button
              size="icon"
              className="bg-secondary hover:bg-secondary/90"
              onClick={stopRecording}
            >
              <Square className="w-4 h-4" fill="currentColor" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Normal Input UI */}
      {!isRecording && (
        <div className="flex items-center gap-2 max-w-3xl mx-auto relative">
          {/* Emoji Picker */}
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={disabled}
            >
              <Smile className="w-5 h-5" />
            </Button>
            <AnimatePresence>
              {showEmojiPicker && (
                <EmojiPicker
                  onSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>

          {/* File Attachment */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="w-5 h-5" />
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text Input */}
          <div className="flex-1">
            <Input
              ref={inputRef}
              placeholder={selectedFile ? "Adicione uma legenda..." : "Digite sua mensagem..."}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-muted/50 border-transparent focus:border-secondary"
              disabled={disabled}
            />
          </div>

          {/* Audio Recording or Send Button */}
          {!message.trim() && !selectedFile ? (
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground hover:text-foreground"
              onClick={startRecording}
              disabled={disabled || isSending}
            >
              <Mic className="w-5 h-5" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="bg-secondary hover:bg-secondary/90"
              onClick={handleSendMessage}
              disabled={disabled || isSending}
            >
              {isSending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
