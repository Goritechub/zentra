import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface KycRequiredModalProps {
  open: boolean;
  onClose: () => void;
  action?: string;
}

export function KycRequiredModal({ open, onClose, action = "start a contract" }: KycRequiredModalProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Identity Verification Required
          </DialogTitle>
          <DialogDescription>
            You must complete identity verification (KYC) before you can {action}. This helps protect all users on ZentraGig.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="p-3 rounded-lg bg-muted/50 border border-border text-sm space-y-2">
            <p className="font-medium text-foreground">What you'll need:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
              <li>Government-issued ID (passport, national ID, or driver's license)</li>
              <li>A selfie photo for face matching</li>
              <li>Basic personal information</li>
            </ul>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { onClose(); navigate("/my-profile?tab=verification"); }}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Verify Now
            </Button>
            <Button variant="outline" onClick={onClose}>
              Later
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
