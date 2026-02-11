import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Loader2, ShieldAlert } from "lucide-react";
import { filterMessageContent } from "@/lib/message-filters";

interface MessageInputProps {
  onSend: (content: string) => Promise<boolean>;
  disabled?: boolean;
  sending?: boolean;
}

export function MessageInput({ onSend, disabled, sending }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!content.trim() || disabled || sending) return;

    // Client-side content filtering
    const result = filterMessageContent(content.trim());
    if (result.blocked) {
      setFilterError(result.reason);
      return;
    }

    setFilterError(null);
    const success = await onSend(content);
    if (success) {
      setContent("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    if (filterError) setFilterError(null);
  };

  return (
    <div className="p-4 border-t bg-background">
      {filterError && (
        <Alert variant="destructive" className="mb-3">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">{filterError}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2 items-end">
        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Press Enter to send)"
          disabled={disabled || sending}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={!content.trim() || disabled || sending}
          size="icon"
          className="flex-shrink-0 h-11 w-11"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        ⚠️ Sharing private contact or financial information is strictly prohibited and will be blocked.
      </p>
    </div>
  );
}
