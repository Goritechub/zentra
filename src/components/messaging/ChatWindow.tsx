import { useRef, useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { MessageSquare, FileText, ArrowDown } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  attachments?: string[];
}

interface ChatWindowProps {
  messages: Message[];
  recipientName?: string;
  recipientAvatar?: string | null;
  recipientId?: string;
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

export function ChatWindow({ messages, recipientName, recipientAvatar, recipientId }: ChatWindowProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCount = useRef(messages.length);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setHasNewMessages(false);
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
    if (atBottom) setHasNewMessages(false);
  }, []);

  // Auto-scroll on new messages if at bottom
  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      if (isAtBottom) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        });
      } else {
        setHasNewMessages(true);
      }
    }
    prevMessageCount.current = messages.length;
  }, [messages.length, isAtBottom]);

  // Initial scroll to bottom
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    }
  }, []);

  const handleRecipientClick = () => {
    if (recipientId) navigate(`/freelancer/${recipientId}`);
  };

  if (messages.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No messages yet</p>
          <p className="text-sm text-muted-foreground mt-1">Send a message to start the conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef} onScroll={handleScroll}>
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === user?.id;
            const showAvatar = index === 0 || messages[index - 1]?.sender_id !== message.sender_id;
            const msgDate = new Date(message.created_at);
            const prevDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
            const showDateHeader = !prevDate || getDateLabel(msgDate) !== getDateLabel(prevDate);

            return (
              <div key={message.id}>
                {showDateHeader && (
                  <div className="flex items-center justify-center my-4">
                    <div className="bg-muted text-muted-foreground text-xs font-medium px-3 py-1 rounded-full">
                      {getDateLabel(msgDate)}
                    </div>
                  </div>
                )}
                <div className={cn("flex items-end gap-2", isOwn ? "flex-row-reverse" : "flex-row")}>
                  {showAvatar && !isOwn && (
                    <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 hover:ring-primary transition-all" onClick={handleRecipientClick}>
                      <AvatarImage src={recipientAvatar || undefined} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">{recipientName?.[0]?.toUpperCase() || "U"}</AvatarFallback>
                    </Avatar>
                  )}
                  {!showAvatar && !isOwn && <div className="w-8" />}

                  <div className={cn("max-w-[70%] rounded-2xl px-4 py-2", isOwn ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md")}>
                    <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

                    {message.attachments && message.attachments.length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {message.attachments.map((url, idx) => {
                          if (isImageUrl(url)) {
                            return (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt="attachment" className="rounded-lg max-w-full max-h-48 object-cover border border-border/30" />
                              </a>
                            );
                          }
                          const name = decodeURIComponent(url.split("/").pop() || `File ${idx + 1}`).replace(/^\d+_/, "");
                          return (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                              className={cn("flex items-center gap-2 p-2 rounded-lg text-sm border",
                                isOwn ? "border-primary-foreground/20 hover:bg-primary-foreground/10" : "border-border hover:bg-background/50"
                              )}>
                              <FileText className="h-4 w-4 shrink-0" />
                              <span className="truncate">{name}</span>
                            </a>
                          );
                        })}
                      </div>
                    )}

                    <p className={cn("text-xs mt-1", isOwn ? "text-primary-foreground/70" : "text-muted-foreground")}>
                      {format(new Date(message.created_at), "HH:mm")}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* New messages pill */}
      {hasNewMessages && !isAtBottom && (
        <Button
          size="sm"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-lg gap-1 z-10"
          onClick={scrollToBottom}
        >
          <ArrowDown className="h-3.5 w-3.5" />
          New messages
        </Button>
      )}
    </div>
  );
}
