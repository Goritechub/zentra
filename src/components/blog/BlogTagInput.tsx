import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { MAX_TAGS, MAX_TAG_LENGTH } from "@/types/blog";

interface BlogTagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

export function BlogTagInput({ value, onChange }: BlogTagInputProps) {
  const [draft, setDraft] = useState("");

  const commit = () => {
    const tag = draft.trim();
    setDraft("");
    if (!tag) return;
    if (value.includes(tag)) return;
    if (value.length >= MAX_TAGS) {
      toast.error(`You can add at most ${MAX_TAGS} tags.`);
      return;
    }
    if (tag.length > MAX_TAG_LENGTH) {
      toast.error(`Tags must be ${MAX_TAG_LENGTH} characters or fewer.`);
      return;
    }
    onChange([...value, tag]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border/60 bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
      {value.map((tag) => (
        <Badge key={tag} variant="secondary" className="gap-1 pr-1 font-normal">
          {tag}
          <button
            type="button"
            onClick={() => onChange(value.filter((t) => t !== tag))}
            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
            aria-label={`Remove tag ${tag}`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length === 0 ? "Add a tag…" : ""}
        className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
