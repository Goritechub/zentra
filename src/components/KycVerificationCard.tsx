import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, ExternalLink, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";
import { useKycVerification } from "@/hooks/useKycVerification";
import { toast } from "sonner";

export function KycVerificationCard() {
  const { kycData, loading, startVerification, checkStatus, isVerified, isZentraVerified } = useKycVerification();
  const [starting, setStarting] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleStart = async () => {
    setStarting(true);
    try {
      const result = await startVerification();
      if (result?.verification_url) {
        const w = window.top || window;
        w.open(result.verification_url, "_blank", "noopener,noreferrer");
      } else {
        toast.error("Failed to get verification URL");
      }
    } catch {
      toast.error("Failed to start verification");
    }
    setStarting(false);
  };

  const handleCheck = async () => {
    setChecking(true);
    await checkStatus();
    setChecking(false);
    toast.info("Status refreshed");
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const status = kycData?.kyc_status || "not_started";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Identity Verification
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status display */}
        <div className="flex items-center gap-3">
          {status === "not_started" && (
            <>
              <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">Not Verified</p>
                <p className="text-xs text-muted-foreground">Complete KYC to unlock contracts</p>
              </div>
            </>
          )}
          {status === "pending" && (
            <>
              <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-accent">Verification In Progress</p>
                <p className="text-xs text-muted-foreground">Complete the verification in the opened tab</p>
              </div>
            </>
          )}
          {status === "verified" && (
            <>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Identity Verified ✓</p>
                <p className="text-xs text-muted-foreground">Your identity has been confirmed</p>
              </div>
            </>
          )}
          {status === "failed" && (
            <>
              <div className="h-8 w-8 rounded-full bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-4 w-4 text-destructive" />
              </div>
              <div>
                <p className="text-sm font-medium text-destructive">Verification Failed</p>
                <p className="text-xs text-muted-foreground">Please try again with valid documents</p>
              </div>
            </>
          )}
          {status === "manual_review" && (
            <>
              <div className="h-8 w-8 rounded-full bg-accent/10 flex items-center justify-center">
                <AlertTriangle className="h-4 w-4 text-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-accent">Under Manual Review</p>
                <p className="text-xs text-muted-foreground">An admin will review your submission</p>
              </div>
            </>
          )}
        </div>

        {/* ZentraGig Verified badge status */}
        {isVerified && (
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            {isZentraVerified ? (
              <div className="flex items-center gap-2">
                <Badge className="bg-accent/15 text-accent border-accent/25">
                  ⭐ ZentraGig Verified Engineer
                </Badge>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Complete your portfolio and build account history to qualify for the
                <span className="font-medium text-accent"> ⭐ ZentraGig Verified Engineer</span> badge.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {(status === "not_started" || status === "failed") && (
            <Button size="sm" onClick={handleStart} disabled={starting}>
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
              {status === "failed" ? "Try Again" : "Verify Identity"}
            </Button>
          )}
          {status === "pending" && (
            <>
              {kycData?.verification_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={kycData.verification_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                    Continue Verification
                  </a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleCheck} disabled={checking}>
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checking ? "animate-spin" : ""}`} />
                Check Status
              </Button>
            </>
          )}
        </div>

        {/* Verification level progress */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Verification Levels</p>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground">Basic Account (email verified)</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {isVerified ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
              )}
              <span className={isVerified ? "text-foreground" : "text-muted-foreground"}>
                Identity Verified (KYC)
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {isZentraVerified ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
              ) : (
                <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/30" />
              )}
              <span className={isZentraVerified ? "text-foreground" : "text-muted-foreground"}>
                ZentraGig Verified Engineer
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
