import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useMessages } from "@/hooks/useMessages";
import { ConversationList } from "@/components/messaging/ConversationList";
import { ChatWindow } from "@/components/messaging/ChatWindow";
import { MessageInput } from "@/components/messaging/MessageInput";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MessageSquare, Bot, LifeBuoy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

const SYSTEM_ID = "system";

const Messages = () => {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const [systemMessages, setSystemMessages] = useState<any[]>([]);
  const [isRestricted, setIsRestricted] = useState(false);

  // Only pass non-system IDs to the hook
  const activeUserId = selectedUserId === SYSTEM_ID ? undefined : selectedUserId;
  const { conversations, messages, loading, sending, sendMessage } = useMessages(activeUserId);

  const selectedConversation = conversations.find(c => c.id === selectedUserId);
  const isSystemChat = selectedUserId === SYSTEM_ID;

  // Handle incoming user param from freelancer/job pages
  useEffect(() => {
    const userParam = searchParams.get("user");
    if (userParam) {
      setSelectedUserId(userParam);
    }
  }, [searchParams]);

  // Fetch system notifications for expert
  useEffect(() => {
    if (!user || profile?.role !== "freelancer") return;

    const fetchSystemMessages = async () => {
      // Fetch proposals where status is 'interviewing' to generate system messages
      const { data: interviews } = await supabase
        .from("proposals")
        .select("id, job_id, status, updated_at, jobs(title, client_id, profiles:client_id(full_name))")
        .eq("freelancer_id", user.id)
        .eq("status", "interviewing")
        .order("updated_at", { ascending: false });

      const msgs: any[] = [];

      if (interviews) {
        for (const interview of interviews) {
          const jobTitle = (interview as any).jobs?.title || "a job";
          const clientName = (interview as any).jobs?.profiles?.full_name || "A client";
          msgs.push({
            id: `interview-${interview.id}`,
            sender_id: SYSTEM_ID,
            receiver_id: user.id,
            content: `🎉 ${clientName} has invited you for an interview for "${jobTitle}". Check your proposals for details.`,
            created_at: interview.updated_at,
          });
        }
      }

      // Fetch moderation warnings
      const { data: warnings } = await supabase
        .from("moderation_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (warnings) {
        for (const w of warnings) {
          msgs.push({
            id: `warning-${w.id}`,
            sender_id: SYSTEM_ID,
            receiver_id: user.id,
            content: `⚠️ Content Warning: Your ${w.content_type} was flagged — ${w.violation_reason}. Please review our community guidelines.`,
            created_at: w.created_at,
          });
        }
      }

      // Sort by date
      msgs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSystemMessages(msgs);
    };

    fetchSystemMessages();
  }, [user, profile]);

  // Check if user is restricted from messaging
  useEffect(() => {
    if (!user) return;
    const checkRestriction = async () => {
      const { data } = await supabase
        .from("user_violation_counts")
        .select("is_suspended, messaging_restricted_until")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        if (data.is_suspended) {
          setIsRestricted(true);
        } else if (data.messaging_restricted_until) {
          setIsRestricted(new Date(data.messaging_restricted_until) > new Date());
        }
      }
    };
    checkRestriction();
  }, [user]);

  // Redirect to auth if not logged in
  if (!authLoading && !user) {
    navigate("/auth");
    return null;
  }

  // Build conversation list with system channel for freelancers
  const allConversations = profile?.role === "freelancer" && systemMessages.length > 0
    ? [
        {
          id: SYSTEM_ID,
          participant: {
            id: SYSTEM_ID,
            full_name: "CADGigs Notifications",
            avatar_url: null,
          },
          lastMessage: systemMessages[0] || null,
          unreadCount: 0,
        },
        ...conversations,
      ]
    : conversations;

  const showConversationList = !isMobile || !selectedUserId;
  const showChatWindow = !isMobile || selectedUserId;

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        
        <Card className="h-[calc(100vh-240px)] min-h-[500px] flex overflow-hidden">
          {/* Conversation List */}
          {showConversationList && (
            <div className={`${isMobile ? 'w-full' : 'w-80'} border-r flex flex-col`}>
              <div className="p-4 border-b">
                <h2 className="font-semibold">Conversations</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <ConversationList
                  conversations={allConversations}
                  selectedId={selectedUserId}
                  onSelect={setSelectedUserId}
                  loading={loading}
                />
              </div>
            </div>
          )}

          {/* Chat Window */}
          {showChatWindow && (
            <div className="flex-1 flex flex-col">
              {selectedUserId ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b flex items-center gap-3">
                    {isMobile && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedUserId(undefined)}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                    )}
                    {isSystemChat ? (
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <h3 className="font-semibold">CADGigs Notifications</h3>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-3 cursor-pointer hover:text-primary transition-colors"
                        onClick={() => selectedUserId && navigate(`/expert/${selectedUserId}`)}
                      >
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={selectedConversation?.participant.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">
                            {selectedConversation?.participant.full_name?.[0]?.toUpperCase() || "U"}
                          </AvatarFallback>
                        </Avatar>
                        <h3 className="font-semibold">
                          {selectedConversation?.participant.full_name || "Loading..."}
                        </h3>
                      </div>
                    )}
                  </div>
                  
                  {/* Messages */}
                  <div className="flex-1 overflow-hidden">
                    <ChatWindow
                      messages={isSystemChat ? systemMessages : messages}
                      recipientName={isSystemChat ? "CADGigs" : selectedConversation?.participant.full_name || undefined}
                      recipientAvatar={isSystemChat ? undefined : selectedConversation?.participant.avatar_url}
                      recipientId={isSystemChat ? undefined : selectedUserId}
                    />
                  </div>
                  
                  {/* Input or Contact Support */}
                  {isSystemChat ? (
                    <div className="p-4 border-t">
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => navigate("/contact")}
                      >
                        <LifeBuoy className="h-4 w-4 mr-2" /> Contact Support
                      </Button>
                    </div>
                  ) : isRestricted ? (
                    <div className="p-4 border-t">
                      <Alert variant="destructive">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertDescription>
                          You can't send messages as your account has been temporarily restricted due to policy violations.
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <MessageInput
                      onSend={sendMessage}
                      sending={sending}
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to start messaging</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      </main>
      
      <Footer />
    </div>
  );
};

export default Messages;
