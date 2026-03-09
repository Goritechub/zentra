 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Badge } from "@/components/ui/badge";
 import { formatDistanceToNow } from "date-fns";
 import { cn } from "@/lib/utils";
 
 interface Conversation {
   id: string;
   participant: {
     id: string;
     full_name: string | null;
     avatar_url: string | null;
   };
   lastMessage: {
     content: string;
     created_at: string;
   } | null;
   unreadCount: number;
 }
 
 interface ConversationListProps {
   conversations: Conversation[];
   selectedId?: string;
   onSelect: (id: string) => void;
   loading?: boolean;
 }
 
 export function ConversationList({ 
   conversations, 
   selectedId, 
   onSelect, 
   loading 
 }: ConversationListProps) {
   if (loading) {
     return (
       <div className="flex items-center justify-center h-full">
         <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
       </div>
     );
   }
 
   if (conversations.length === 0) {
     return (
       <div className="flex flex-col items-center justify-center h-full p-6 text-center">
         <p className="text-muted-foreground">No conversations yet</p>
         <p className="text-sm text-muted-foreground mt-1">
           Start a conversation by messaging a freelancer or client
         </p>
       </div>
     );
   }
 
   return (
     <ScrollArea className="h-full">
       <div className="space-y-1 p-2">
         {conversations.map((conversation) => (
           <button
             key={conversation.id}
             onClick={() => onSelect(conversation.id)}
             className={cn(
               "w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors",
               selectedId === conversation.id
                 ? "bg-primary/10 border border-primary/20"
                 : "hover:bg-muted"
             )}
           >
             <Avatar className="h-10 w-10 flex-shrink-0">
               <AvatarImage src={conversation.participant.avatar_url || undefined} />
               <AvatarFallback className="bg-primary/10 text-primary">
                 {conversation.participant.full_name?.[0]?.toUpperCase() || "U"}
               </AvatarFallback>
             </Avatar>
             <div className="flex-1 min-w-0">
               <div className="flex items-center justify-between gap-2">
                  <a href={`/expert/${conversation.participant.id}/profile`} onClick={(e) => e.stopPropagation()} className="font-medium truncate hover:underline hover:text-primary transition-colors">
                    {conversation.participant.full_name || "Unknown User"}
                  </a>
                 {conversation.unreadCount > 0 && (
                   <Badge variant="default" className="h-5 min-w-[20px] flex items-center justify-center">
                     {conversation.unreadCount}
                   </Badge>
                 )}
               </div>
               {conversation.lastMessage && (
                 <div className="flex items-center justify-between gap-2 mt-0.5">
                   <p className="text-sm text-muted-foreground truncate">
                     {conversation.lastMessage.content}
                   </p>
                   <span className="text-xs text-muted-foreground flex-shrink-0">
                     {formatDistanceToNow(new Date(conversation.lastMessage.created_at), { 
                       addSuffix: true 
                     })}
                   </span>
                 </div>
               )}
             </div>
           </button>
         ))}
       </div>
     </ScrollArea>
   );
 }