import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AuthCodeInput } from "@/components/AuthCodeInput";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";

interface AuthCodeVerifyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  title?: string;
  description?: string;
}

export function AuthCodeVerifyModal({
  open,
  onOpenChange,
  onVerified,
  title = "Enter Authentication Code",
  description = "Enter your 6-digit authentication code to proceed.",
}: AuthCodeVerifyModalProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) {
      toast.error("Please enter all 6 digits");
      return;
    }
    setVerifying(true);
    const { data, error } = await supabase.functions.invoke("auth-code", {
      body: { action: "verify", code },
    });
    setVerifying(false);

    if (error || !data?.success) {
      toast.error(data?.error || "Invalid authentication code");
      setCode("");
      return;
    }

    setCode("");
    onOpenChange(false);
    onVerified();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setCode(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <AuthCodeInput value={code} onChange={setCode} disabled={verifying} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleVerify} disabled={verifying || code.length !== 6}>
            {verifying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Verify
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
