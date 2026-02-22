import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { MessageSquare, Loader2, ArrowLeft, Trash2, X } from "lucide-react";
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

const Messages = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ContractConversation[]>([]);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchAll();
  }, [user, authLoading]);

  const fetchAll = async () => {
    if (!user) return;
    await Promise.all([fetchContractConversations(), fetchHidden()]);
    setLoading(false);
  };

  const fetchHidden = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("hidden_conversations")
      .select("contract_id")
      .eq("user_id", user.id);
    setHiddenIds(new Set((data || []).map((h: any) => h.contract_id)));
  };

  const fetchContractConversations = async () => {
    if (!user) return;

    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, job_title, status, client_id, freelancer_id, client:profiles!contracts_client_id_fkey(full_name, avatar_url), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url)")
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!contracts?.length) { setConversations([]); return; }

    const isClient = profile?.role === "client";
    const contractIds = contracts.map(c => c.id);

    const { data: allMsgs } = await supabase
      .from("contract_messages")
      .select("id, contract_id, sender_id, content, is_read, created_at")
      .in("contract_id", contractIds)
      .order("created_at", { ascending: false });

    const msgMap = new Map<string, any[]>();
    (allMsgs || []).forEach((m: any) => {
      if (!msgMap.has(m.contract_id)) msgMap.set(m.contract_id, []);
      msgMap.get(m.contract_id)!.push(m);
    });

    const convos: ContractConversation[] = contracts.map((c: any) => {
      const msgs = msgMap.get(c.id) || [];
      const latest = msgs[0];
      const unread = msgs.filter((m: any) => m.sender_id !== user.id && !m.is_read).length;
      const partner = isClient ? c.freelancer : c.client;

      return {
        contractId: c.id,
        contractTitle: c.job_title || "Contract",
        contractStatus: c.status,
        partner: { full_name: partner?.full_name || "User", avatar_url: partner?.avatar_url },
        lastMessage: latest?.content || null,
        lastMessageAt: latest?.created_at || null,
        unreadCount: unread,
      };
    });

    convos.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(convos);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contract_messages" }, () => fetchContractConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const isClosedContract = (status: string) => {
    return ["completed", "cancelled"].includes(status);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleHideSelected = async () => {
    if (!user || selectedIds.size === 0) return;
    const rows = Array.from(selectedIds).map(contractId => ({
      user_id: user.id,
      contract_id: contractId,
    }));

    const { error } = await supabase.from("hidden_conversations").insert(rows as any);
    if (error) {
      toast.error("Failed to hide conversations");
    } else {
      setHiddenIds(prev => {
        const next = new Set(prev);
        selectedIds.forEach(id => next.add(id));
        return next;
      });
      toast.success(`${selectedIds.size} conversation(s) hidden`);
      setSelectedIds(new Set());
      setSelectMode(false);
    }
  };

  const handleHideSingle = async (contractId: string) => {
    if (!user) return;
    const { error } = await supabase.from("hidden_conversations").insert({
      user_id: user.id,
      contract_id: contractId,
    } as any);
    if (error) {
      toast.error("Failed to hide conversation");
    } else {
      setHiddenIds(prev => new Set(prev).add(contractId));
      toast.success("Conversation hidden");
    }
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

  const visibleConversations = conversations.filter(c => !hiddenIds.has(c.contractId));

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6 overflow-hidden flex flex-col">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold">Messages</h1>
        </div>

        {/* Select mode toolbar */}
        {selectMode && (
          <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
              <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={handleHideSelected}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Hide Selected
            </Button>
          </div>
        )}

        <Card className="overflow-hidden flex-1 flex flex-col min-h-0">
          {visibleConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Conversations will appear here when you have active contracts
              </p>
            </div>
          ) : (
            <div className="overflow-y-auto flex-1">
              <div className="divide-y divide-border">
                {visibleConversations.map((convo) => (
                  <div
                    key={convo.contractId}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50",
                      convo.unreadCount > 0 && "bg-primary/5"
                    )}
                    onPointerDown={() => onPointerDown(convo)}
                    onPointerUp={onPointerUp}
                    onPointerLeave={onPointerUp}
                  >
                    {selectMode && (
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
                        if (selectMode) {
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
                            {convo.unreadCount > 0 && (
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
                    {!selectMode && isClosedContract(convo.contractStatus) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHideSingle(convo.contractId);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Messages;
