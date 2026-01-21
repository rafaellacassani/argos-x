import { motion } from "framer-motion";
import { useEffect, useRef } from "react";

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const EMOJI_CATEGORIES = [
  {
    name: "Frequentes",
    emojis: ["😀", "😂", "😊", "❤️", "👍", "🔥", "✨", "🎉", "💪", "🙏"],
  },
  {
    name: "Rostos",
    emojis: [
      "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
      "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛",
      "😜", "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨",
      "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "🤥", "😌", "😔",
      "😪", "🤤", "😴", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥵",
      "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "😎", "🤓", "🧐", "😕",
    ],
  },
  {
    name: "Gestos",
    emojis: [
      "👋", "🤚", "✋", "🖐️", "👌", "🤌", "✌️", "🤞", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊",
      "👊", "🤛", "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "💪",
    ],
  },
  {
    name: "Corações",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔",
      "❣️", "💕", "💞", "💓", "💗", "💖", "💘", "💝", "💟", "♥️",
    ],
  },
  {
    name: "Objetos",
    emojis: [
      "🎉", "🎊", "🎈", "🎁", "🏆", "🥇", "⚽", "🏀", "🎮", "🎯",
      "📱", "💻", "⌚", "📷", "🔑", "💰", "💵", "💎", "🔔", "📌",
    ],
  },
  {
    name: "Natureza",
    emojis: [
      "☀️", "🌙", "⭐", "✨", "🌈", "🔥", "💧", "🌊", "🌸", "🌺",
      "🌻", "🌹", "🌷", "🍀", "🌿", "🍃", "🌴", "🌵", "🐶", "🐱",
    ],
  },
];

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 w-80 max-h-72 overflow-y-auto bg-popover border border-border rounded-lg shadow-lg z-50"
    >
      <div className="p-2">
        {EMOJI_CATEGORIES.map((category) => (
          <div key={category.name} className="mb-3">
            <p className="text-xs font-medium text-muted-foreground mb-1.5 px-1">
              {category.name}
            </p>
            <div className="grid grid-cols-10 gap-0.5">
              {category.emojis.map((emoji, index) => (
                <button
                  key={`${category.name}-${index}`}
                  onClick={() => onSelect(emoji)}
                  className="w-7 h-7 flex items-center justify-center text-lg hover:bg-muted rounded transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}
