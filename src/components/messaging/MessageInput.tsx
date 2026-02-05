 import { useState, KeyboardEvent } from "react";
 import { Button } from "@/components/ui/button";
 import { Textarea } from "@/components/ui/textarea";
 import { Send, Loader2 } from "lucide-react";
 
 interface MessageInputProps {
   onSend: (content: string) => Promise<boolean>;
   disabled?: boolean;
   sending?: boolean;
 }
 
 export function MessageInput({ onSend, disabled, sending }: MessageInputProps) {
   const [content, setContent] = useState("");
 
   const handleSend = async () => {
     if (!content.trim() || disabled || sending) return;
     
     const success = await onSend(content);
     if (success) {
       setContent("");
     }
   };
 
   const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
     if (e.key === "Enter" && !e.shiftKey) {
       e.preventDefault();
       handleSend();
     }
   };
 
   return (
     <div className="p-4 border-t bg-background">
       <div className="flex gap-2 items-end">
         <Textarea
           value={content}
           onChange={(e) => setContent(e.target.value)}
           onKeyDown={handleKeyDown}
           placeholder="Type a message... (Press Enter to send)"
           disabled={disabled || sending}
           className="min-h-[44px] max-h-32 resize-none"
           rows={1}
         />
         <Button
           onClick={handleSend}
           disabled={!content.trim() || disabled || sending}
           size="icon"
           className="flex-shrink-0 h-11 w-11"
         >
           {sending ? (
             <Loader2 className="h-5 w-5 animate-spin" />
           ) : (
             <Send className="h-5 w-5" />
           )}
         </Button>
       </div>
       <p className="text-xs text-muted-foreground mt-2">
         Keep all communication on the platform. Contact details and external links are not allowed.
       </p>
     </div>
   );
 }