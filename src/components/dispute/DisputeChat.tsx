import { useRef, useEffect, useState, useCallback, KeyboardEvent } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useDisputeMessages } from "@/hooks/useDisputeMessages";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Send, Loader2, ShieldAlert, MessageSquare, Bot, ArrowDown, Gavel,
} from "lucide-react";

function getDateLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (differenceInCalendarDays(new Date(), date) < 7) return format(date, "EEEE");
  return format(date, "MMMM yyyy");
}

interface PartyInfo {
  id: string;
  name: string;
  avatar?: string | null;
  role: "complainant" | "respondent" | "adjudicator";
}

interface DisputeChatProps {
  disputeId: string;
  parties: PartyInfo[];
  isActive: boolean;
}

export function DisputeChat({ disputeId, parties, isActive }: DisputeChatProps) {
  const { user } = useAuth();
  const { messages, loading, sending, sendMessage } = useDisputeMessages(disputeId);
  const [content, setContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const prevMessageCount = useRef(messages.length);

  const partiesMap = new Map(parties.map(p => [p.id, p]));

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

  useEffect(() => {
    if (messages.length > 0 && !loading) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" as ScrollBehavior });
    }
  }, [loading]);

  const handleSend = async () => {
    if (!content.trim() || sending) return;
    const success = await sendMessage(content);
    if (success) setContent("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[400px] border border-border rounded-xl overflow-hidden bg-card relative">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef} onScroll={handleScroll}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mb-3 opacity-50" />
            <p className="text-muted-foreground text-sm">No messages yet. Start the conversation.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, index) => {
              const isOwn = msg.sender_id === user?.id;
              const isSystem = msg.is_system_message;
              const sender = partiesMap.get(msg.sender_id);
              const showAvatar = index === 0 || messages[index - 1]?.sender_id !== msg.sender_id;
              const msgDate = new Date(msg.created_at);
              const prevDate = index > 0 ? new Date(messages[index - 1].created_at) : null;
              const showDateHeader = !prevDate || getDateLabel(msgDate) !== getDateLabel(prevDate);

              const roleColor = sender?.role === "adjudicator"
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : sender?.role === "complainant"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary";

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
                          <AvatarImage src={sender?.avatar || undefined} />
                          <AvatarFallback className={cn("text-xs", roleColor)}>
                            {sender?.role === "adjudicator" ? (
                              <Gavel className="h-3.5 w-3.5" />
                            ) : (
                              (sender?.name?.[0] || "U").toUpperCase()
                            )}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!showAvatar && !isOwn && <div className="w-7" />}

                      <div className="max-w-[70%]">
                        {showAvatar && !isOwn && (
                          <p className="text-xs text-muted-foreground mb-0.5 ml-1">
                            {sender?.name || "Unknown"}
                            {sender?.role === "adjudicator" && (
                              <span className="ml-1 text-amber-600 dark:text-amber-400 font-medium">• Adjudicator</span>
                            )}
                          </p>
                        )}
                        <div className={cn(
                          "rounded-2xl px-4 py-2",
                          isOwn
                            ? sender?.role === "adjudicator"
                              ? "bg-amber-500/20 text-foreground rounded-br-md"
                              : "bg-primary text-primary-foreground rounded-br-md"
                            : sender?.role === "adjudicator"
                              ? "bg-amber-500/10 border border-amber-500/20 rounded-bl-md"
                              : "bg-muted rounded-bl-md"
                        )}>
                          <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                          <p className={cn("text-xs mt-1",
                            isOwn && sender?.role !== "adjudicator" ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}>
                            {format(msgDate, "HH:mm")}
                          </p>
                        </div>
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
      {!isActive ? (
        <div className="p-3 border-t">
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-sm">
              This dispute has been resolved. Messaging is closed.
            </AlertDescription>
          </Alert>
        </div>
      ) : (
        <div className="p-3 border-t bg-background">
          <div className="flex gap-2 items-end">
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              disabled={sending}
              className="min-h-[36px] max-h-24 resize-none text-sm"
              rows={1}
            />
            <Button onClick={handleSend} disabled={!content.trim() || sending} size="icon" className="flex-shrink-0 h-9 w-9">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
