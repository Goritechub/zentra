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
 import { ArrowLeft, MessageSquare } from "lucide-react";
 import { useIsMobile } from "@/hooks/use-mobile";
 
 const Messages = () => {
   const { user, loading: authLoading } = useAuth();
   const navigate = useNavigate();
  const [searchParams] = useSearchParams();
   const isMobile = useIsMobile();
   const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
   
   const { conversations, messages, loading, sending, sendMessage } = useMessages(selectedUserId);
 
   const selectedConversation = conversations.find(c => c.id === selectedUserId);
 
  // Handle incoming user param from freelancer/job pages
  useEffect(() => {
    const userParam = searchParams.get("user");
    if (userParam) {
      setSelectedUserId(userParam);
    }
  }, [searchParams]);

   // Redirect to auth if not logged in
   if (!authLoading && !user) {
     navigate("/auth");
     return null;
   }
 
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
                   conversations={conversations}
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
                      <div
                        className="cursor-pointer hover:text-primary transition-colors"
                        onClick={() => selectedUserId && navigate(`/freelancer/${selectedUserId}`)}
                      >
                        <h3 className="font-semibold">
                          {selectedConversation?.participant.full_name || "Loading..."}
                        </h3>
                      </div>
                    </div>
                   
                    {/* Messages */}
                    <div className="flex-1 overflow-hidden">
                      <ChatWindow
                        messages={messages}
                        recipientName={selectedConversation?.participant.full_name || undefined}
                        recipientAvatar={selectedConversation?.participant.avatar_url}
                        recipientId={selectedUserId}
                      />
                    </div>
                   
                   {/* Input */}
                   <MessageInput
                     onSend={sendMessage}
                     sending={sending}
                   />
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