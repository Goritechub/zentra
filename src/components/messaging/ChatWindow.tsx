 import { useRef, useEffect } from "react";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { format } from "date-fns";
 import { cn } from "@/lib/utils";
 import { useAuth } from "@/hooks/useAuth";
 import { MessageSquare, ShieldAlert } from "lucide-react";
 import { Alert, AlertDescription } from "@/components/ui/alert";
 
 interface Message {
   id: string;
   sender_id: string;
   receiver_id: string;
   content: string;
   created_at: string;
 }
 
 interface ChatWindowProps {
   messages: Message[];
   recipientName?: string;
   recipientAvatar?: string | null;
 }
 
 export function ChatWindow({ messages, recipientName, recipientAvatar }: ChatWindowProps) {
   const { user } = useAuth();
   const scrollRef = useRef<HTMLDivElement>(null);
 
   useEffect(() => {
     if (scrollRef.current) {
       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
     }
   }, [messages]);
 
    if (messages.length === 0) {
      return (
        <div className="flex flex-col h-full">
          <Alert className="mx-4 mt-4 border-destructive/30 bg-destructive/5">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <AlertDescription className="text-xs">
              <strong>Platform Policy:</strong> Sharing email addresses, phone numbers, bank details, or any private contact information in messages is strictly prohibited and will be blocked automatically.
            </AlertDescription>
          </Alert>
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Send a message to start the conversation
            </p>
          </div>
        </div>
      );
    }
 
   return (
     <div className="flex flex-col h-full">
        <Alert className="mx-4 mt-4 border-destructive/30 bg-destructive/5">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          <AlertDescription className="text-xs">
            <strong>Platform Policy:</strong> Sharing email addresses, phone numbers, bank details, or any private contact information is strictly prohibited and will be blocked automatically.
          </AlertDescription>
        </Alert>
       
       <ScrollArea className="flex-1 p-4" ref={scrollRef}>
         <div className="space-y-4">
           {messages.map((message, index) => {
             const isOwn = message.sender_id === user?.id;
             const showAvatar = index === 0 || 
               messages[index - 1]?.sender_id !== message.sender_id;
 
             return (
               <div
                 key={message.id}
                 className={cn(
                   "flex items-end gap-2",
                   isOwn ? "flex-row-reverse" : "flex-row"
                 )}
               >
                 {showAvatar && !isOwn && (
                   <Avatar className="h-8 w-8">
                     <AvatarImage src={recipientAvatar || undefined} />
                     <AvatarFallback className="bg-primary/10 text-primary text-xs">
                       {recipientName?.[0]?.toUpperCase() || "U"}
                     </AvatarFallback>
                   </Avatar>
                 )}
                 {!showAvatar && !isOwn && <div className="w-8" />}
                 
                 <div
                   className={cn(
                     "max-w-[70%] rounded-2xl px-4 py-2",
                     isOwn
                       ? "bg-primary text-primary-foreground rounded-br-md"
                       : "bg-muted rounded-bl-md"
                   )}
                 >
                   <p className="text-sm whitespace-pre-wrap break-words">
                     {message.content}
                   </p>
                   <p
                     className={cn(
                       "text-xs mt-1",
                       isOwn ? "text-primary-foreground/70" : "text-muted-foreground"
                     )}
                   >
                     {format(new Date(message.created_at), "HH:mm")}
                   </p>
                 </div>
               </div>
             );
           })}
         </div>
       </ScrollArea>
     </div>
   );
 }