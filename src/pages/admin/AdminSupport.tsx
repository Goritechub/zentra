import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Settings, MessageSquare, AlertTriangle, Send, Mail, Phone, MessageCircle,
  Eye, ChevronRight, Clock, CheckCircle2, XCircle, Search
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  getAdminSupportChatMessages,
  getAdminSupportChats,
  getAdminSupportComplaints,
  getAdminSupportSettings,
  sendAdminSupportChatMessage,
  updateAdminSupportComplaintStatus,
  updateAdminSupportSettings,
} from "@/api/support.api";

const COMPLAINT_STATUSES = ["new", "in_review", "resolved", "closed"] as const;
const COMPLAINT_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "New", variant: "destructive" },
  in_review: { label: "In Review", variant: "default" },
  resolved: { label: "Resolved", variant: "secondary" },
  closed: { label: "Closed", variant: "outline" },
};

export default function AdminSupport() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Customer Support</h1>
      <Tabs defaultValue="settings" className="space-y-6">
        <TabsList>
          <TabsTrigger value="settings" className="gap-2"><Settings className="h-4 w-4" />Settings</TabsTrigger>
          <TabsTrigger value="chats" className="gap-2"><MessageSquare className="h-4 w-4" />Support Chats</TabsTrigger>
          <TabsTrigger value="complaints" className="gap-2"><AlertTriangle className="h-4 w-4" />Complaints</TabsTrigger>
        </TabsList>

        <TabsContent value="settings"><SupportSettingsTab /></TabsContent>
        <TabsContent value="chats"><SupportChatsTab /></TabsContent>
        <TabsContent value="complaints"><ComplaintsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* ─── Settings Tab ─── */
function SupportSettingsTab() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getAdminSupportSettings();
        setEmail(data.email || "");
        setPhone(data.phone || "");
        setWhatsapp(data.whatsapp || "");
      } catch (error) {
        setEmail("");
        setPhone("");
        setWhatsapp("");
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      toast.error("Please enter a valid email address");
      return;
    }
    if (!phone.trim()) { toast.error("Phone number is required"); return; }
    if (!whatsapp.trim()) { toast.error("WhatsApp number is required"); return; }

    setSaving(true);
    try {
      await updateAdminSupportSettings(email.trim(), phone.trim(), whatsapp.trim());
      toast.success("Support settings updated");
    } catch (error) {
      toast.error("Failed to update support settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border p-6 max-w-xl space-y-5">
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Mail className="h-4 w-4 text-primary" />Support Email</Label>
        <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="support@zentragig.com" />
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" />Support Phone</Label>
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." />
      </div>
      <div className="space-y-2">
        <Label className="flex items-center gap-2"><MessageCircle className="h-4 w-4 text-primary" />WhatsApp Number</Label>
        <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+234..." />
      </div>
      <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Settings"}</Button>
    </div>
  );
}

/* ─── Complaints Tab ─── */
function ComplaintsTab() {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchComplaints = useCallback(async () => {
    const data = await getAdminSupportComplaints(statusFilter);
    setComplaints(data.complaints || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchComplaints(); }, [fetchComplaints]);

  const updateStatus = async (id: string, newStatus: string) => {
    await updateAdminSupportComplaintStatus(id, newStatus);
    toast.success(`Complaint status updated to ${COMPLAINT_STATUS_CONFIG[newStatus]?.label}`);
    fetchComplaints();
    if (selected?.id === id) setSelected({ ...selected, status: newStatus });
  };

  const filtered = complaints.filter(c =>
    !searchQuery || c.subject?.toLowerCase().includes(searchQuery.toLowerCase()) || c.message?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search complaints..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {COMPLAINT_STATUSES.map(s => <SelectItem key={s} value={s}>{COMPLAINT_STATUS_CONFIG[s].label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No complaints found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-foreground truncate">{c.subject}</p>
                    <Badge variant={COMPLAINT_STATUS_CONFIG[c.status]?.variant || "outline"} className="text-xs shrink-0">
                      {COMPLAINT_STATUS_CONFIG[c.status]?.label || c.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">{c.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">Category: {c.category} • {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Complaint Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Complaint Details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-semibold text-foreground">{selected.subject}</p>
              </div>
              <div className="flex gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Category</Label>
                  <p className="text-sm">{selected.category}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Status</Label>
                  <Badge variant={COMPLAINT_STATUS_CONFIG[selected.status]?.variant || "outline"} className="ml-1">
                    {COMPLAINT_STATUS_CONFIG[selected.status]?.label}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Message</Label>
                <p className="text-sm text-foreground whitespace-pre-wrap">{selected.message}</p>
              </div>
              {selected.attachments?.length > 0 && (
                <div>
                  <Label className="text-xs text-muted-foreground">Attachments</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {selected.attachments.map((url: string, i: number) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Submitted</Label>
                <p className="text-sm">{format(new Date(selected.created_at), "PPp")}</p>
              </div>
              <div className="space-y-2">
                <Label>Update Status</Label>
                <div className="flex gap-2 flex-wrap">
                  {COMPLAINT_STATUSES.map(s => (
                    <Button
                      key={s}
                      size="sm"
                      variant={selected.status === s ? "default" : "outline"}
                      onClick={() => updateStatus(selected.id, s)}
                      disabled={selected.status === s}
                    >
                      {COMPLAINT_STATUS_CONFIG[s].label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Support Chats Tab ─── */
function SupportChatsTab() {
  const { user } = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChat, setSelectedChat] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChats = useCallback(async () => {
    const data = await getAdminSupportChats();
    setChats(data.chats || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  const openChat = async (chat: any) => {
    setSelectedChat(chat);
    const data = await getAdminSupportChatMessages(chat.id);
    setMessages(data.messages || []);

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  // Realtime for selected chat
  useEffect(() => {
    if (!selectedChat) return;
    const channel = supabase
      .channel(`admin-support-chat-${selectedChat.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_chat_messages",
        filter: `chat_id=eq.${selectedChat.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as any]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedChat]);

  const handleSend = async () => {
    if (!newMsg.trim() || !user || !selectedChat) return;
    setSending(true);
    await sendAdminSupportChatMessage(selectedChat.id, newMsg.trim());
    setNewMsg("");
    setSending(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (selectedChat) {
    return (
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Button variant="ghost" size="sm" onClick={() => setSelectedChat(null)}>← Back</Button>
          <div>
            <p className="font-semibold text-sm">Support Chat</p>
            <p className="text-xs text-muted-foreground">User: {selectedChat.user_id?.slice(0, 8)}...</p>
          </div>
        </div>
        <ScrollArea className="h-[400px] p-4">
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={cn("flex", m.sender_type === "admin" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[70%] rounded-xl px-3 py-2 text-sm",
                  m.sender_type === "admin" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                )}>
                  <p>{m.message}</p>
                  <p className={cn("text-[10px] mt-1", m.sender_type === "admin" ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>
        <div className="border-t border-border p-3 flex gap-2">
          <Input
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            placeholder="Type a reply..."
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          />
          <Button onClick={handleSend} disabled={sending || !newMsg.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {chats.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p>No support chats yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c)}
              className="w-full text-left bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-sm text-foreground">User: {c.user_id?.slice(0, 8)}...</p>
                  <p className="text-xs text-muted-foreground">
                    {c.status === "open" ? "Open" : "Closed"} • Updated {formatDistanceToNow(new Date(c.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
