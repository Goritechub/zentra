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
} from "lucide-react";
import { toast } from "sonner";
import {
  FILE_SIZE_LIMIT,
  FILE_SIZE_LIMIT_LABEL,
  LARGE_FILE_MESSAGE,
  isGoogleDriveLink,
  quickValidateGDriveLink,
} from "@/lib/google-drive-validator";

const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/webp", "image/gif",
  "application/pdf",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

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
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
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

  const handleSend = async () => {
    if ((!content.trim() && files.length === 0) || sending) return;
    const success = await sendMessage(content, files.length > 0 ? files : undefined);
    if (success) {
      setContent("");
      setFiles([]);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) { toast.error(`${file.name} exceeds 5MB`); continue; }
      if (!ALLOWED_TYPES.includes(file.type)) { toast.error(`${file.name}: unsupported type`); continue; }
      setFiles(prev => [...prev, file]);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
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
                        <p className="text-sm text-foreground whitespace-pre-wrap">{msg.content}</p>
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
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>

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
          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1 bg-muted rounded-lg px-2 py-1 text-xs">
                  <FileText className="h-3 w-3 text-primary shrink-0" />
                  <span className="truncate max-w-[120px]">{file.name}</span>
                  <button onClick={() => setFiles(f => f.filter((_, i) => i !== idx))} className="ml-1 text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-end">
            <input ref={fileInputRef} type="file" className="hidden" multiple accept={ALLOWED_TYPES.join(",")} onChange={handleFileSelect} />
            <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9" onClick={() => fileInputRef.current?.click()} disabled={sending}>
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={sending}
              className="min-h-[36px] max-h-24 resize-none text-sm"
              rows={1}
            />
            <Button onClick={handleSend} disabled={(!content.trim() && files.length === 0) || sending} size="icon" className="flex-shrink-0 h-9 w-9">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
