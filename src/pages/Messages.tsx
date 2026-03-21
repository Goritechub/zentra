import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  getMessagesConversations,
  hideConversation,
  hideConversations,
  unhideConversation,
} from "@/api/messages.api";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { MessageSquare, Loader2, ArrowLeft, Trash2, X, Archive, RotateCcw } from "lucide-react";
import { toast } from "sonner";

interface ContractConversation {
  contractId: string;
  contractTitle: string;
  contractStatus: string;
  partner: { full_name: string | null; avatar_url: string | null };
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

interface MessagesPageData {
  conversations: ContractConversation[];
  hiddenIds: Set<string>;
}

const Messages = () => {
  const { user, role, bootstrapStatus } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = ["messages-page", user?.id, role];

  const { data, isPending, isFetching } = useQuery({
    queryKey,
    enabled: bootstrapStatus === "ready" && !!user,
    staleTime: 60 * 1000,
    placeholderData: (previousData) => previousData,
    queryFn: async () => {
      const data = await getMessagesConversations();
      return {
        conversations: data.conversations || [],
        hiddenIds: new Set<string>(data.hiddenIds || []),
      };
    },
  });

  useEffect(() => {
    if (bootstrapStatus !== "ready" || !user) return;
    const channel = supabase
      .channel("messages-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contract_messages" }, () => {
        queryClient.invalidateQueries({ queryKey });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [bootstrapStatus, queryClient, queryKey, user]);

  const isClosedContract = (status: string) => ["completed", "cancelled"].includes(status);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateHiddenIds = (updater: (previous: Set<string>) => Set<string>) => {
    queryClient.setQueryData<MessagesPageData>(queryKey, (previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        hiddenIds: updater(previous.hiddenIds),
      };
    });
  };

  const handleHideSelected = async () => {
    if (!user || selectedIds.size === 0) return;
    try {
      await hideConversations(Array.from(selectedIds));
    } catch (error) {
      toast.error("Failed to hide conversations");
      return;
    }

    updateHiddenIds((previous) => {
      const next = new Set(previous);
      selectedIds.forEach((id) => next.add(id));
      return next;
    });
    toast.success(`${selectedIds.size} conversation(s) hidden`);
    setSelectedIds(new Set());
    setSelectMode(false);
  };

  const handleHideSingle = async (contractId: string) => {
    if (!user) return;
    try {
      await hideConversation(contractId);
    } catch (error) {
      toast.error("Failed to hide conversation");
      return;
    }

    updateHiddenIds((previous) => {
      const next = new Set(previous);
      next.add(contractId);
      return next;
    });
    toast.success("Conversation hidden");
  };

  const handleUnhide = async (contractId: string) => {
    if (!user) return;
    try {
      await unhideConversation(contractId);
    } catch (error) {
      toast.error("Failed to unhide conversation");
      return;
    }

    updateHiddenIds((previous) => {
      const next = new Set(previous);
      next.delete(contractId);
      return next;
    });
    toast.success("Conversation restored");
  };

  const onPointerDown = useCallback((convo: ContractConversation) => {
    longPressTimer.current = setTimeout(() => {
      setSelectMode(true);
      setSelectedIds(new Set([convo.contractId]));
    }, 600);
  }, []);

  const onPointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  if (!user || bootstrapStatus !== "ready") {
    return null;
  }

  const conversations = data?.conversations || [];
  const hiddenIds = data?.hiddenIds || new Set<string>();
  const visibleConversations = conversations.filter((conversation) => !hiddenIds.has(conversation.contractId));
  const archivedConversations = conversations.filter((conversation) => hiddenIds.has(conversation.contractId));

  const renderConvoList = (convos: ContractConversation[], isArchived = false) => (
    isPending && !data ? (
      <div className="overflow-y-auto flex-1 p-4 space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="flex items-start gap-4 rounded-lg border border-border p-4">
            <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="h-4 w-40 rounded bg-muted animate-pulse" />
                <div className="h-3 w-16 rounded bg-muted/80 animate-pulse" />
              </div>
              <div className="h-3 w-24 rounded bg-muted/70 animate-pulse" />
              <div className="h-3 w-56 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    ) : convos.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
        <p className="text-muted-foreground">{isArchived ? "No archived conversations" : "No conversations yet"}</p>
      </div>
    ) : (
      <div className="overflow-y-auto flex-1">
        <div className="divide-y divide-border">
          {convos.map((convo) => (
            <div
              key={convo.contractId}
              className={cn(
                "w-full flex items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50",
                convo.unreadCount > 0 && !isArchived && "bg-primary/5"
              )}
              onPointerDown={!isArchived ? () => onPointerDown(convo) : undefined}
              onPointerUp={!isArchived ? onPointerUp : undefined}
              onPointerLeave={!isArchived ? onPointerUp : undefined}
            >
              {selectMode && !isArchived && (
                <div className="flex items-center pt-1">
                  <Checkbox
                    checked={selectedIds.has(convo.contractId)}
                    onCheckedChange={() => toggleSelect(convo.contractId)}
                  />
                </div>
              )}
              <button
                className="flex items-start gap-4 flex-1 text-left"
                onClick={() => {
                  if (selectMode && !isArchived) {
                    toggleSelect(convo.contractId);
                  } else {
                    navigate(`/contract/${convo.contractId}?tab=chat`);
                  }
                }}
              >
                <Avatar className="h-11 w-11 flex-shrink-0">
                  <AvatarImage src={convo.partner.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {convo.partner.full_name?.[0]?.toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-foreground truncate">{convo.contractTitle}</span>
                      <Badge variant="outline" className="text-xs shrink-0">{convo.contractStatus}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {convo.lastMessageAt && (
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(convo.lastMessageAt), { addSuffix: true })}
                        </span>
                      )}
                      {convo.unreadCount > 0 && !isArchived && (
                        <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center">
                          {convo.unreadCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">with {convo.partner.full_name}</p>
                  {convo.lastMessage && (
                    <p className="text-sm text-muted-foreground truncate mt-1">{convo.lastMessage}</p>
                  )}
                </div>
              </button>
              {isArchived ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); handleUnhide(convo.contractId); }}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              ) : (
                !selectMode && isClosedContract(convo.contractStatus) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.stopPropagation(); handleHideSingle(convo.contractId); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )
              )}
            </div>
          ))}
        </div>
      </div>
    )
  );

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Messages</h1>
          {isFetching && <span className="text-sm text-muted-foreground">Refreshing...</span>}
        </div>

        {selectMode && (
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            </div>
            <Button variant="destructive" size="sm" disabled={selectedIds.size === 0} onClick={handleHideSelected}>
              <Trash2 className="h-4 w-4 mr-1" /> Hide Selected
            </Button>
          </div>
        )}

        <Tabs defaultValue="active" className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-4">
            <TabsTrigger value="active">
              <MessageSquare className="h-4 w-4 mr-1" /> Messages ({visibleConversations.length})
            </TabsTrigger>
            <TabsTrigger value="archived">
              <Archive className="h-4 w-4 mr-1" /> Archived ({archivedConversations.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="flex-1 min-h-0">
            <Card className="overflow-hidden flex-1 flex flex-col min-h-0">
              {renderConvoList(visibleConversations)}
            </Card>
          </TabsContent>
          <TabsContent value="archived" className="flex-1 min-h-0">
            <Card className="overflow-hidden flex-1 flex flex-col min-h-0">
              {renderConvoList(archivedConversations, true)}
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
};

export default Messages;
