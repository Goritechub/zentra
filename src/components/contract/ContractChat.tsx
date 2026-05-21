import { useRef, useEffect, useState, useCallback, KeyboardEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useContractMessages, ContractMessage } from "@/hooks/useContractMessages";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Send, Loader2, Paperclip, X, FileText, ShieldAlert, MessageSquare, Bot, ArrowDown,
  CheckCircle2, AlertCircle, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import {
  FILE_SIZE_LIMIT,
  LARGE_FILE_MESSAGE,
  isGoogleDriveLink,
  quickValidateGDriveLink,
} from "@/lib/google-drive-validator";
import { vetAttachmentName } from "@/lib/content-vetting";
import { getLocalStorageToken } from "@/api/axios";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const MAX_FILES = 5;

type UploadStatus = "uploading" | "done" | "error";
interface UploadItem {
  id: string;
  file: File;
  progress: number;
  status: UploadStatus;
  url: string | null;
  errorMsg: string | null;
}

const URL_REGEX = /(https?:\/\/[^\s]+)/g;
function linkifyText(text: string, isOwn: boolean) {
  return text.split(URL_REGEX).map((part, i) =>
    URL_REGEX.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer"
        className={`underline break-all ${isOwn ? "text-primary-foreground/80" : "text-primary"}`}>
        {part}
      </a>
    ) : part
  );
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(url);
}

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, "EEEE");
  return format(date, "MMMM yyyy");
}

interface ContractChatProps {
  contractId: string;
  partnerName: string;
  partnerAvatar?: string | null;
  isRestricted?: boolean;
  contractStatus?: string;
}

export function ContractChat({ contractId, partnerName, partnerAvatar, isRestricted, contractStatus }: ContractChatProps) {
  const chatDisabled = isRestricted || ["rejected", "cancelled", "completed"].includes(contractStatus || "");
  const { user } = useAuth();
  const { messages, loading, sending, sendMessage } = useContractMessages(contractId);
  const [content, setContent] = useState("");
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [content]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCount = useRef(messages.length);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessages(false);
  }, []);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMessages(false);
  }, []);

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (isAtBottom) {
        requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));
      } else {
        setHasNewMessages(true);
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, isAtBottom]);

  // Initial scroll
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    }
  }, [loading]);

  const uploadOneFile = useCallback((item: UploadItem) => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";
    const token = getLocalStorageToken();
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${baseUrl}/contracts/attachments`, true);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        setUploadItems(prev => prev.map(u => u.id === item.id ? { ...u, progress: pct } : u));
      }
    });

    xhr.addEventListener("load", () => {
      try {
        const res = JSON.parse(xhr.responseText);
        const url = res?.data?.urls?.[0];
        if (xhr.status >= 200 && xhr.status < 300 && url) {
          setUploadItems(prev => prev.map(u => u.id === item.id ? { ...u, status: "done", url, progress: 100 } : u));
        } else {
          const msg = res?.message || "Upload failed";
          setUploadItems(prev => prev.map(u => u.id === item.id ? { ...u, status: "error", errorMsg: msg } : u));
        }
      } catch {
        setUploadItems(prev => prev.map(u => u.id === item.id ? { ...u, status: "error", errorMsg: "Upload failed" } : u));
      }
    });

    xhr.addEventListener("error", () => {
      setUploadItems(prev => prev.map(u => u.id === item.id ? { ...u, status: "error", errorMsg: "Network error" } : u));
    });

    const form = new FormData();
    form.append("files", item.file);
    xhr.send(form);
  }, []);

  const handleSend = async () => {
    const anyUploading = uploadItems.some(u => u.status === "uploading");
    const anyError = uploadItems.some(u => u.status === "error");
    if ((!content.trim() && uploadItems.length === 0) || sending || anyUploading) return;
    if (anyError) {
      toast.error("Some files failed to upload. Retry or remove them before sending.");
      return;
    }

    if (content.trim()) {
      const urls = content.match(/https?:\/\/[^\s]+/g) || [];
      for (const url of urls) {
        if (isGoogleDriveLink(url)) {
          const check = quickValidateGDriveLink(url);
          if (!check.valid) {
            toast.error(check.reason || "Google Drive link must be set to public access.");
            return;
          }
        }
      }
    }

    const attachments = uploadItems
      .filter(u => u.status === "done")
      .map(u => ({ url: u.url!, name: u.file.name, type: u.file.type }));

    const success = await sendMessage(content, attachments.length > 0 ? attachments : undefined);
    if (success) {
      setContent("");
      setUploadItems([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const remaining = MAX_FILES - uploadItems.length;
    let added = 0;
    for (const file of selected) {
      if (added >= remaining) { toast.error(`Maximum ${MAX_FILES} files per message`); break; }
      if (file.size > FILE_SIZE_LIMIT) { toast.error(LARGE_FILE_MESSAGE, { duration: 8000 }); continue; }
      if (!ALLOWED_TYPES.includes(file.type)) { toast.error(`${file.name}: unsupported file type`); continue; }
      const nameCheck = vetAttachmentName(file.name);
      if (nameCheck.blocked) { toast.error(`${file.name}: ${nameCheck.reason}`); continue; }
      const item: UploadItem = { id: `${Date.now()}-${Math.random()}`, file, progress: 0, status: "uploading", url: null, errorMsg: null };
      setUploadItems(prev => [...prev, item]);
      uploadOneFile(item);
      added++;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const retryUpload = (item: UploadItem) => {
    const reset: UploadItem = { ...item, status: "uploading", progress: 0, errorMsg: null };
    setUploadItems(prev => prev.map(u => u.id === item.id ? reset : u));
    uploadOneFile(reset);
  };

  const removeUpload = (id: string) => {
    setUploadItems(prev => prev.filter(u => u.id !== id));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[500px] border border-border rounded-xl overflow-hidden bg-card relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, index) => {
              const isOwn = msg.sender_id === user?.id;
              const isSystem = msg.is_system_message;
              const showAvatar = index === 0 || messages[index - 1]?.sender_id !== msg.sender_id;
              const msgDate = new Date(msg.created_at);
              const prevDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
              const showDateHeader = !prevDate || getDateLabel(msgDate) !== getDateLabel(prevDate);

              return (
                <div key={msg.id}>
                  {showDateHeader && (
                    <div className="flex items-center justify-center my-3">
                      <div className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
                        {getDateLabel(msgDate)}
                      </div>
                    </div>
                  )}

                  {isSystem ? (
                    <div className="flex justify-center my-2">
                      <div className="bg-muted/50 border border-border rounded-lg px-4 py-2 max-w-[85%] text-center">
                        <div className="flex items-center gap-1.5 justify-center text-xs text-muted-foreground mb-1">
                          <Bot className="h-3 w-3" /> System
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">{linkifyText(msg.content, false)}</p>
                        <p className="text-xs text-muted-foreground mt-1">{format(msgDate, "HH:mm")}</p>
                      </div>
                    </div>
                  ) : (
                    <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
                      {showAvatar && !isOwn && (
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={partnerAvatar || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {partnerName?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!showAvatar && !isOwn && <div className="w-7" />}

                      <div className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2",
                        isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"
                      )}>
                        <p className="text-sm whitespace-pre-wrap break-words">{linkifyText(msg.content, isOwn)}</p>

                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-1.5">
                            {msg.attachments.map((att) => {
                              if (isImageUrl(att.file_url)) {
                                return (
                                  <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer">
                                    <img src={att.file_url} alt={att.file_name} className="rounded-lg max-w-full max-h-48 object-cover border border-border/30" />
                                  </a>
                                );
                              }
                              return (
                                <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer"
                                  className={cn("flex items-center gap-2 p-2 rounded-lg text-sm border",
                                    isOwn ? "border-primary-foreground/20 hover:bg-primary-foreground/10" : "border-border hover:bg-background/50"
                                  )}>
                                  <FileText className="h-4 w-4 shrink-0" />
                                  <span className="truncate">{att.file_name}</span>
                                </a>
                              );
                            })}
                          </div>
                        )}

                        <p className={cn("text-xs mt-1", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {format(msgDate, "HH:mm")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* New messages pill */}
      {hasNewMessages && !isAtBottom && (
        <Button
          size="sm"
          className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-full shadow-lg gap-1 z-10"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          New messages
        </Button>
      )}

      {/* Input */}
      {chatDisabled ? (
        <div className="p-3 border-t">
          <Alert variant={isRestricted ? "destructive" : "default"}>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {isRestricted
                ? "Your account is temporarily restricted from messaging."
                : contractStatus === "rejected"
                  ? "This interview has been closed. Messaging is disabled."
                  : `This contract is ${contractStatus}. Messaging is no longer available.`
              }
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="p-3 border-t bg-background">
          {uploadItems.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {uploadItems.map((item) => (
                <div key={item.id} className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1 text-xs max-w-[200px]">
                  {item.status === "uploading" ? (
                    <Loader2 className="h-3 w-3 text-primary shrink-0 animate-spin" />
                  ) : item.status === "done" ? (
                    <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3 w-3 text-destructive shrink-0" />
                  )}
                  <span className="truncate flex-1">{item.file.name}</span>
                  {item.status === "uploading" && (
                    <span className="text-muted-foreground shrink-0">{item.progress}%</span>
                  )}
                  {item.status === "error" && (
                    <button onClick={() => retryUpload(item)} className="text-muted-foreground hover:text-primary shrink-0">
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  )}
                  <button onClick={() => removeUpload(item.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input ref={fileInputRef} type="file" className="hidden" multiple accept={ALLOWED_TYPES.join(",")} onChange={handleFileSelect} />
            <Button
              variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || uploadItems.length >= MAX_FILES}
              title={uploadItems.length === 0 ? `Attach files (max ${MAX_FILES})` : `${MAX_FILES - uploadItems.length} of ${MAX_FILES} slots remaining`}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={sending}
              className="min-h-[36px] max-h-36 resize-none text-sm overflow-y-auto"
            />
            <Button
              onClick={handleSend}
              disabled={(!content.trim() && uploadItems.length === 0) || sending || uploadItems.some(u => u.status === "uploading")}
              size="icon" className="flex-shrink-0 h-9 w-9"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
