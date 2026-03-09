import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Megaphone, Loader2, Send, AlertTriangle, CheckCircle2 } from "lucide-react";

const NOTIFICATION_TYPES = [
  { value: "platform_announcement", label: "📢 General Announcement" },
  { value: "policy_update", label: "📜 Policy Update" },
  { value: "maintenance", label: "🔧 Maintenance Notice" },
  { value: "feature_update", label: "✨ New Feature" },
  { value: "security_alert", label: "🔒 Security Alert" },
];

export function BroadcastNotificationCard() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("platform_announcement");
  const [linkUrl, setLinkUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [result, setResult] = useState<{ recipients: number; total: number } | null>(null);

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("Title is required"); return; }
    if (!message.trim()) { toast.error("Message is required"); return; }
    if (title.trim().length > 100) { toast.error("Title must be under 100 characters"); return; }
    if (message.trim().length > 500) { toast.error("Message must be under 500 characters"); return; }
    setShowConfirm(true);
  };

  const handleSend = async () => {
    setSending(true);
    setShowConfirm(false);

    try {
      const { data, error } = await supabase.functions.invoke("broadcast-notification", {
        body: {
          title: title.trim(),
          message: message.trim(),
          type,
          link_url: linkUrl.trim() || undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ recipients: data.recipients, total: data.total_users });
      toast.success(`Notification sent to ${data.recipients} users`);
      setTitle("");
      setMessage("");
      setLinkUrl("");
      setType("platform_announcement");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send broadcast");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" /> Notify All Users
          </CardTitle>
          <CardDescription>
            Send a notification to every user on the platform. Use for important announcements, policy changes, or maintenance notices.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {result && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
              <span>Last broadcast sent to <strong>{result.recipients}</strong> of {result.total} users</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Notification Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTIFICATION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Updated Terms of Service"
              maxLength={100}
            />
            <p className="text-xs text-muted-foreground">{title.length}/100</p>
          </div>

          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Write the notification message that all users will see..."
              rows={4}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">{message.length}/500</p>
          </div>

          <div className="space-y-2">
            <Label>Link URL (optional)</Label>
            <Input
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="e.g. /terms or https://..."
            />
            <p className="text-xs text-muted-foreground">Users will be directed here when they click the notification</p>
          </div>

          <Button onClick={handleSubmit} disabled={sending} className="w-full sm:w-auto">
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send to All Users
          </Button>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Broadcast
            </DialogTitle>
            <DialogDescription>
              This will send a notification to <strong>every user</strong> on the platform. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-1">Title</p>
              <p className="text-sm font-medium">{title}</p>
            </div>
            <div className="p-3 rounded-lg bg-muted border border-border">
              <p className="text-xs text-muted-foreground mb-1">Message</p>
              <p className="text-sm whitespace-pre-wrap">{message}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Megaphone className="h-4 w-4 mr-2" />}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
