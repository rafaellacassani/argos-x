import { useState, useMemo } from "react";
import { X, Plus, Tag, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { Lead, LeadTag } from "@/hooks/useLeads";

interface ChatTagManagerProps {
  lead: Lead | null;
  allTags: LeadTag[];
  onAddTag: (leadId: string, tagId: string) => Promise<boolean>;
  onRemoveTag: (leadId: string, tagId: string) => Promise<boolean>;
  onCreateTag: (name: string, color: string) => Promise<LeadTag | null>;
}

const TAG_COLORS = [
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // yellow
  "#22C55E", // green
  "#14B8A6", // teal
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#6B7280", // gray
];

export function ChatTagManager({
  lead,
  allTags,
  onAddTag,
  onRemoveTag,
  onCreateTag,
}: ChatTagManagerProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  const assignedTagIds = useMemo(
    () => new Set(lead?.tags?.map((t) => t.id) || []),
    [lead?.tags]
  );

  const availableTags = useMemo(
    () => allTags.filter((tag) => !assignedTagIds.has(tag.id)),
    [allTags, assignedTagIds]
  );

  const filteredTags = useMemo(() => {
    if (!searchValue) return availableTags;
    return availableTags.filter((tag) =>
      tag.name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [availableTags, searchValue]);

  const showCreateOption = useMemo(() => {
    if (!searchValue.trim()) return false;
    return !allTags.some(
      (tag) => tag.name.toLowerCase() === searchValue.trim().toLowerCase()
    );
  }, [searchValue, allTags]);

  const handleAddTag = async (tagId: string) => {
    if (!lead) return;
    await onAddTag(lead.id, tagId);
    setSearchValue("");
  };

  const handleRemoveTag = async (tagId: string) => {
    if (!lead) return;
    await onRemoveTag(lead.id, tagId);
  };

  const handleCreateAndAdd = async () => {
    if (!lead || !searchValue.trim()) return;
    setIsCreating(true);
    try {
      const newTag = await onCreateTag(searchValue.trim(), newTagColor);
      if (newTag) {
        await onAddTag(lead.id, newTag.id);
        setSearchValue("");
        setOpen(false);
      }
    } finally {
      setIsCreating(false);
    }
  };

  if (!lead) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Assigned tags */}
      {lead.tags?.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className="flex items-center gap-1 px-2 py-0.5 text-xs"
          style={{ backgroundColor: tag.color + "20", color: tag.color }}
        >
          {tag.name}
          <button
            onClick={() => handleRemoveTag(tag.id)}
            className="ml-1 hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      {/* Add tag button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Tag className="h-3 w-3 mr-1" />
            <Plus className="h-3 w-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0 bg-popover border shadow-lg z-50" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar ou criar tag..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>
                {showCreateOption ? (
                  <div className="p-2 space-y-2">
                    <p className="text-sm text-muted-foreground px-2">
                      Criar nova tag "{searchValue}"
                    </p>
                    <div className="flex gap-1 px-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          className={cn(
                            "w-5 h-5 rounded-full border-2",
                            newTagColor === color
                              ? "border-foreground"
                              : "border-transparent"
                          )}
                          style={{ backgroundColor: color }}
                          onClick={() => setNewTagColor(color)}
                        />
                      ))}
                    </div>
                    <Button
                      size="sm"
                      className="w-full mt-2"
                      onClick={handleCreateAndAdd}
                      disabled={isCreating}
                    >
                      {isCreating ? "Criando..." : "Criar e adicionar"}
                    </Button>
                  </div>
                ) : (
                  <span className="px-2 py-4 text-sm text-muted-foreground">
                    Nenhuma tag encontrada
                  </span>
                )}
              </CommandEmpty>
              <CommandGroup>
                {filteredTags.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.name}
                    onSelect={() => handleAddTag(tag.id)}
                    className="cursor-pointer"
                  >
                    <div
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    {assignedTagIds.has(tag.id) && (
                      <Check className="ml-auto h-4 w-4 text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreateOption && filteredTags.length > 0 && (
                <CommandGroup heading="Criar nova">
                  <CommandItem
                    onSelect={handleCreateAndAdd}
                    className="cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Criar "{searchValue}"
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
