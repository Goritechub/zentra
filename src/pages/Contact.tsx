import { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useSupportSettings } from "@/hooks/useSupportSettings";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Mail, Phone, MessageCircle, Send, AlertTriangle, MessageSquare, Loader2,
  Headphones, Clock, CheckCircle2, XCircle, ArrowLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const COMPLAINT_CATEGORIES = [
  "Payment Issue",
  "Contract Dispute",
  "Account Problem",
  "Technical Bug",
  "Fraud / Scam Report",
  "Other",
];

const STATUS_CONFIG: Record<string, { label: string; icon: any; color: string }> = {
  new: { label: "New", icon: Clock, color: "text-amber-500" },
  in_review: { label: "In Review", icon: Clock, color: "text-primary" },
  resolved: { label: "Resolved", icon: CheckCircle2, color: "text-green-500" },
  closed: { label: "Closed", icon: XCircle, color: "text-muted-foreground" },
};

export default function ContactPage() {
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useSupportSettings();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-12">
        <div className="container max-w-4xl mx-auto px-4">
          <div className="text-center mb-8">
            <Headphones className="h-12 w-12 text-primary mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-foreground">Contact Support</h1>
            <p className="text-muted-foreground mt-2">Have a question or need help? We're here for you.</p>
          </div>

          {/* Support Contact Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <a href={`mailto:${settings.support_email}`} className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium text-foreground truncate">{settingsLoading ? "..." : settings.support_email}</p>
              </div>
            </a>
            <a href={`tel:${settings.support_phone.replace(/\s/g, "")}`} className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Phone</p>
                <p className="text-sm font-medium text-foreground truncate">{settingsLoading ? "..." : settings.support_phone}</p>
              </div>
            </a>
            <a href={`https://wa.me/${settings.support_whatsapp.replace(/[\s+]/g, "")}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-card rounded-xl border border-border p-4 hover:border-primary transition-colors">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MessageCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">WhatsApp</p>
                <p className="text-sm font-medium text-foreground truncate">{settingsLoading ? "..." : settings.support_whatsapp}</p>
              </div>
            </a>
          </div>

          {user ? (
            <Tabs defaultValue="complaint" className="space-y-6">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="complaint" className="gap-2"><AlertTriangle className="h-4 w-4" />Submit Complaint</TabsTrigger>
                <TabsTrigger value="chat" className="gap-2"><MessageSquare className="h-4 w-4" />Chat with Support</TabsTrigger>
                <TabsTrigger value="history" className="gap-2"><Clock className="h-4 w-4" />My Complaints</TabsTrigger>
              </TabsList>
              <TabsContent value="complaint"><ComplaintForm userId={user.id} /></TabsContent>
              <TabsContent value="chat"><SupportChatPanel userId={user.id} /></TabsContent>
              <TabsContent value="history"><ComplaintHistory userId={user.id} /></TabsContent>
            </Tabs>
          ) : (
            <div className="bg-card rounded-xl border border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">Please sign in to submit a complaint or chat with support.</p>
              <Button onClick={() => navigate("/auth")}>Sign In</Button>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

/* ─── Complaint Form ─── */
function ComplaintForm({ userId }: { userId: string }) {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !category || !message.trim()) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (subject.trim().length > 200) { toast.error("Subject must be under 200 characters"); return; }
    if (message.trim().length > 5000) { toast.error("Message must be under 5000 characters"); return; }

    setSubmitting(true);
    const { error } = await supabase.from("complaints" as any).insert({
      user_id: userId,
      subject: subject.trim(),
      category,
      message: message.trim(),
    } as any);

    if (error) {
      toast.error("Failed to submit complaint");
    } else {
      toast.success("Complaint submitted successfully. We'll review it shortly.");
      setSubject("");
      setCategory("");
      setMessage("");
    }
    setSubmitting(false);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label>Subject *</Label>
          <Input placeholder="Brief summary of your issue" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label>Category *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              {COMPLAINT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description *</Label>
          <Textarea placeholder="Describe your issue in detail..." rows={6} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={5000} />
          <p className="text-xs text-muted-foreground text-right">{message.length}/5000</p>
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : "Submit Complaint"}
        </Button>
      </form>
    </div>
  );
}

/* ─── Complaint History ─── */
function ComplaintHistory({ userId }: { userId: string }) {
  const [complaints, setComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("complaints" as any)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setComplaints((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [userId]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  if (complaints.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>No complaints submitted yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {complaints.map((c) => {
        const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.new;
        const Icon = cfg.icon;
        return (
          <div key={c.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground">{c.subject}</p>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{c.message}</p>
                <p className="text-xs text-muted-foreground mt-2">{c.category} • {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
              </div>
              <div className={cn("flex items-center gap-1 text-xs font-medium shrink-0", cfg.color)}>
                <Icon className="h-3.5 w-3.5" />
                {cfg.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Support Chat ─── */
function SupportChatPanel({ userId }: { userId: string }) {
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const initChat = useCallback(async () => {
    // Get or create support chat
    const { data: existing } = await supabase
      .from("support_chats" as any)
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    let id: string;
    if (existing) {
      id = (existing as any).id;
    } else {
      const { data: created } = await supabase
        .from("support_chats" as any)
        .insert({ user_id: userId } as any)
        .select("id")
        .single();
      id = (created as any).id;
    }

    setChatId(id);

    const { data: msgs } = await supabase
      .from("support_chat_messages" as any)
      .select("*")
      .eq("chat_id", id)
      .order("created_at", { ascending: true });
    setMessages((msgs as any[]) || []);
    setLoading(false);

    // Mark admin messages as read
    await supabase
      .from("support_chat_messages" as any)
      .update({ is_read: true } as any)
      .eq("chat_id", id)
      .eq("sender_type", "admin")
      .eq("is_read", false);

    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, [userId]);

  useEffect(() => { initChat(); }, [initChat]);

  // Realtime
  useEffect(() => {
    if (!chatId) return;
    const channel = supabase
      .channel(`user-support-chat-${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_chat_messages",
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as any]);
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  const handleSend = async () => {
    if (!newMsg.trim() || !chatId) return;
    setSending(true);
    await supabase.from("support_chat_messages" as any).insert({
      chat_id: chatId,
      sender_id: userId,
      sender_type: "user",
      message: newMsg.trim(),
    } as any);
    await supabase.from("support_chats" as any).update({ updated_at: new Date().toISOString() } as any).eq("id", chatId);
    setNewMsg("");
    setSending(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <p className="font-semibold text-sm">Chat with Customer Support</p>
        <p className="text-xs text-muted-foreground">Our team will respond as soon as possible.</p>
      </div>
      <ScrollArea className="h-[350px] p-4">
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No messages yet. Start a conversation!</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.sender_type === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                m.sender_type === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              )}>
                {m.sender_type === "admin" && <p className="text-[10px] font-semibold mb-0.5 opacity-70">Support Team</p>}
                <p>{m.message}</p>
                <p className={cn("text-[10px] mt-1", m.sender_type === "user" ? "text-primary-foreground/70" : "text-muted-foreground")}>
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
          placeholder="Type your message..."
          maxLength={2000}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
        />
        <Button onClick={handleSend} disabled={sending || !newMsg.trim()} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
