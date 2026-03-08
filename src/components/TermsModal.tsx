import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface TermsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgree: () => void;
}

export function TermsModal({ open, onOpenChange, onAgree }: TermsModalProps) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && !content) {
      setLoading(true);
      supabase
        .from("legal_documents" as any)
        .select("content")
        .eq("slug", "terms-and-conditions")
        .eq("is_published", true)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setContent((data as any).content);
          setLoading(false);
        });
    }
    if (open) setScrolledToBottom(false);
  }, [open]);

  const handleScroll = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom && !scrolledToBottom) setScrolledToBottom(true);
  }, [scrolledToBottom]);

  const handleAgree = () => {
    onAgree();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="text-xl font-bold">Terms and Conditions</DialogTitle>
        </DialogHeader>
        <div
          ref={viewportRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-6 py-4"
          style={{ maxHeight: "60vh" }}
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
              {(content || "").trim()}
            </pre>
          )}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAgree} disabled={!scrolledToBottom}>
            {scrolledToBottom ? "I Agree" : "Scroll to bottom to agree"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
