import { useState, useRef, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Send, Loader2, ShieldAlert, Paperclip, X, FileText, Link2 } from "lucide-react";
import { filterMessageContent } from "@/lib/message-filters";
import { vetAttachmentName } from "@/lib/content-vetting";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  FILE_SIZE_LIMIT,
  FILE_SIZE_LIMIT_LABEL,
  LARGE_FILE_MESSAGE,
  isGoogleDriveLink,
  quickValidateGDriveLink,
} from "@/lib/google-drive-validator";

interface MessageInputProps {
  onSend: (content: string, attachments?: string[]) => Promise<boolean>;
  disabled?: boolean;
  sending?: boolean;
}

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export function MessageInput({ onSend, disabled, sending }: MessageInputProps) {
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [filterError, setFilterError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if ((!content.trim() && attachments.length === 0) || disabled || sending || uploading) return;

    // Client-side content filtering
    if (content.trim()) {
      const result = filterMessageContent(content.trim());
      if (result.blocked) {
        setFilterError(result.reason);
        return;
      }

      // Validate Google Drive links in the message
      const urls = content.match(/https?:\/\/[^\s]+/g) || [];
      for (const url of urls) {
        if (isGoogleDriveLink(url)) {
          const check = quickValidateGDriveLink(url);
          if (!check.valid) {
            setFilterError(check.reason || "Google Drive link must be set to public access.");
            return;
          }
        }
      }
    }

    setFilterError(null);

    // Upload attachments if any
    let uploadedUrls: string[] = [];
    if (attachments.length > 0) {
      setUploading(true);
      try {
        for (const file of attachments) {
          const filePath = `${user!.id}/${Date.now()}_${file.name}`;
          const { error } = await supabase.storage
            .from("chat-attachments")
            .upload(filePath, file);
          if (error) throw error;
          const { data: urlData } = supabase.storage
            .from("chat-attachments")
            .getPublicUrl(filePath);
          uploadedUrls.push(urlData.publicUrl);
        }
      } catch (err) {
        toast.error("Failed to upload attachment");
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const success = await onSend(content.trim() || "📎 Attachment", uploadedUrls);
    if (success) {
      setContent("");
      setAttachments([]);
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      if (file.size > FILE_SIZE_LIMIT) {
        toast.error(LARGE_FILE_MESSAGE, { duration: 8000 });
        continue;
      }
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`${file.name}: unsupported file type`);
        continue;
      }
      const nameCheck = vetAttachmentName(file.name);
      if (nameCheck.blocked) {
        toast.error(`${file.name}: ${nameCheck.reason}`);
        continue;
      }
      setAttachments(prev => [...prev, file]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="p-4 border-t bg-background">
      {filterError && (
        <Alert variant="destructive" className="mb-3">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-sm">{filterError}</AlertDescription>
        </Alert>
      )}

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {attachments.map((file, idx) => (
            <div key={idx} className="flex items-center gap-1 bg-muted rounded-lg px-3 py-1.5 text-sm">
              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[150px]">{file.name}</span>
              <button onClick={() => removeAttachment(idx)} className="ml-1 text-muted-foreground hover:text-destructive">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          multiple
          accept={ALLOWED_TYPES.join(",")}
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          className="flex-shrink-0 h-11 w-11"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || sending || uploading}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        <Textarea
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Press Enter to send)"
          disabled={disabled || sending || uploading}
          className="min-h-[44px] max-h-32 resize-none"
          rows={1}
        />
        <Button
          onClick={handleSend}
          disabled={(!content.trim() && attachments.length === 0) || disabled || sending || uploading}
          size="icon"
          className="flex-shrink-0 h-11 w-11"
        >
          {sending || uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        ⚠️ Max file size: {FILE_SIZE_LIMIT_LABEL}. For larger files, use Google Drive with public link sharing.
      </p>
    </div>
  );
}
