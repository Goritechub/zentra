import { useRef } from "react";
import { Trash2 } from "lucide-react";
import { AutoResizeTextarea } from "@/components/blog/AutoResizeTextarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BULLET_LIST_STYLE_OPTIONS, NUMBERED_LIST_STYLE_OPTIONS, getListMarker, type ListStyle } from "@/lib/listMarkers";

interface BlogListBlockEditorProps {
  type: "bullet_list" | "numbered_list";
  items: string[];
  style?: ListStyle;
  onChange: (patch: { type: "bullet_list" | "numbered_list"; items: string[]; style?: ListStyle }) => void;
  /** Called when Backspace is pressed at the start of the only, empty item — nothing left to keep bulleted. */
  onDissolve?: () => void;
  /** Called when Enter is pressed on a trailing empty item with other items still in the list. */
  onExitList?: () => void;
}

function isFirstLine(el: HTMLTextAreaElement) {
  return !el.value.slice(0, el.selectionStart ?? 0).includes("\n");
}

function isLastLine(el: HTMLTextAreaElement) {
  return !el.value.slice(el.selectionEnd ?? el.value.length).includes("\n");
}

export function BlogListBlockEditor({ type, items, style, onChange, onDissolve, onExitList }: BlogListBlockEditorProps) {
  const rowRefs = useRef<Array<HTMLTextAreaElement | null>>([]);

  const focusRow = (i: number, cursorPos: number) => {
    requestAnimationFrame(() => {
      const el = rowRefs.current[i];
      if (!el) return;
      el.focus();
      const pos = Math.min(cursorPos, el.value.length);
      el.setSelectionRange(pos, pos);
    });
  };

  const setItem = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange({ type, items: next, style });
  };

  const splitItem = (i: number, cursorPos: number) => {
    const before = items[i].slice(0, cursorPos);
    const after = items[i].slice(cursorPos);
    const next = [...items];
    next[i] = before;
    next.splice(i + 1, 0, after);
    onChange({ type, items: next, style });
    focusRow(i + 1, 0);
  };

  const removeItem = (i: number) => {
    if (items.length <= 1) return;
    const next = items.filter((_, idx) => idx !== i);
    onChange({ type, items: next, style });
    if (i === 0) {
      focusRow(0, 0);
    } else {
      focusRow(i - 1, items[i - 1].length);
    }
  };

  const mergeIntoPrevious = (i: number) => {
    if (i === 0) return;
    const prevLen = items[i - 1].length;
    const next = [...items];
    next[i - 1] = next[i - 1] + next[i];
    next.splice(i, 1);
    onChange({ type, items: next, style });
    focusRow(i - 1, prevLen);
  };

  const handleStyleSelect = (value: string) => {
    const bulletMatch = BULLET_LIST_STYLE_OPTIONS.find((o) => o.value === value);
    if (bulletMatch) {
      onChange({ type: "bullet_list", items, style: bulletMatch.value });
      return;
    }
    const numberedMatch = NUMBERED_LIST_STYLE_OPTIONS.find((o) => o.value === value);
    if (numberedMatch) {
      onChange({ type: "numbered_list", items, style: numberedMatch.value });
    }
  };

  return (
    <div className="space-y-1.5">
      <Select value={style ?? (type === "bullet_list" ? "disc" : "decimal")} onValueChange={handleStyleSelect}>
        <SelectTrigger className="h-7 w-auto gap-1.5 border-none bg-transparent px-1 text-xs text-muted-foreground shadow-none hover:bg-muted/40 focus:ring-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Numbered</SelectLabel>
            {NUMBERED_LIST_STYLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Bulleted</SelectLabel>
            {BULLET_LIST_STYLE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.glyph} {o.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      <ul className="space-y-1">
        {items.map((item, i) => (
          <li key={i} className="group/item flex items-start gap-2">
            <span className="mt-1 w-6 shrink-0 select-none text-sm text-muted-foreground">
              {getListMarker(type, style, i)}
            </span>
            <AutoResizeTextarea
              ref={(el) => {
                rowRefs.current[i] = el;
              }}
              value={item}
              placeholder="List item"
              onChange={(e) => setItem(i, e.target.value)}
              onKeyDown={(e) => {
                const el = e.currentTarget;
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (i === items.length - 1 && item.trim() === "") {
                    if (items.length === 1) {
                      onDissolve?.();
                    } else {
                      onChange({ type, items: items.slice(0, -1), style });
                      onExitList?.();
                    }
                    return;
                  }
                  splitItem(i, el.selectionStart ?? item.length);
                  return;
                }
                if (e.key === "Backspace" && el.selectionStart === 0 && el.selectionEnd === 0) {
                  if (i > 0) {
                    e.preventDefault();
                    mergeIntoPrevious(i);
                  } else if (item === "") {
                    if (items.length > 1) {
                      e.preventDefault();
                      removeItem(i);
                    } else if (onDissolve) {
                      e.preventDefault();
                      onDissolve();
                    }
                  }
                  return;
                }
                if (e.key === "ArrowUp" && isFirstLine(el) && i > 0) {
                  e.preventDefault();
                  focusRow(i - 1, el.selectionStart ?? 0);
                  return;
                }
                if (e.key === "ArrowDown" && isLastLine(el) && i < items.length - 1) {
                  e.preventDefault();
                  focusRow(i + 1, el.selectionStart ?? 0);
                }
              }}
              className="flex-1 text-base leading-7"
            />
            {items.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover/item:opacity-100"
                onClick={() => removeItem(i)}
                aria-label="Remove item"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
