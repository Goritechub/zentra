import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { MessageSquare, Loader2, FileText } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (user) fetchContractConversations();
  }, [user, authLoading]);

  const fetchContractConversations = async () => {
    if (!user) return;

    // Fetch all contracts for user
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, job_title, status, client_id, freelancer_id, client:profiles!contracts_client_id_fkey(full_name, avatar_url), freelancer:profiles!contracts_freelancer_id_fkey(full_name, avatar_url)")
      .or(`client_id.eq.${user.id},freelancer_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!contracts?.length) { setConversations([]); setLoading(false); return; }

    const isClient = profile?.role === "client";
    const contractIds = contracts.map(c => c.id);

    // Fetch all messages for these contracts
    const { data: allMsgs } = await supabase
      .from("contract_messages")
      .select("id, contract_id, sender_id, content, is_read, created_at")
      .in("contract_id", contractIds)
      .order("created_at", { ascending: false });

    // Group by contract
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

    // Sort by latest message (contracts with messages first)
    convos.sort((a, b) => {
      if (!a.lastMessageAt && !b.lastMessageAt) return 0;
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
    });

    setConversations(convos);
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("messages-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "contract_messages" }, () => fetchContractConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

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
      <main className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>

        <Card className="overflow-hidden">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Conversations will appear here when you have active contracts
              </p>
            </div>
          ) : (
            <ScrollArea className="max-h-[calc(100vh-240px)]">
              <div className="divide-y divide-border">
                {conversations.map((convo) => (
                  <button
                    key={convo.contractId}
                    onClick={() => navigate(`/contract/${convo.contractId}?tab=chat`)}
                    className={cn(
                      "w-full flex items-start gap-4 p-4 text-left transition-colors hover:bg-muted/50",
                      convo.unreadCount > 0 && "bg-primary/5"
                    )}
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
                ))}
              </div>
            </ScrollArea>
          )}
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Messages;
