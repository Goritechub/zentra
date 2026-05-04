import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";

type CallbackStatus = "loading" | "successful" | "cancelled" | "failed";

export default function WalletCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>("loading");

  const txRef = searchParams.get("tx_ref");
  const rawStatus = searchParams.get("status");

  useEffect(() => {
    if (rawStatus === "successful") setStatus("successful");
    else if (rawStatus === "cancelled") setStatus("cancelled");
    else setStatus("failed");
  }, [rawStatus]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 flex items-center justify-center py-16 px-4">
        <div className="bg-card rounded-2xl border border-border p-10 max-w-md w-full text-center space-y-6 shadow-sm">
          {status === "successful" && (
            <>
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-10 w-10 text-primary" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment Received</h1>
              <p className="text-muted-foreground">
                Your payment was successful. Your wallet will be credited within a few minutes once the transaction is confirmed.
              </p>
              {txRef && (
                <p className="text-xs text-muted-foreground font-mono bg-muted rounded px-3 py-1.5 break-all">
                  Ref: {txRef}
                </p>
              )}
            </>
          )}

          {status === "cancelled" && (
            <>
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto">
                <Clock className="h-10 w-10 text-muted-foreground" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment Cancelled</h1>
              <p className="text-muted-foreground">You cancelled the payment. No money was charged.</p>
            </>
          )}

          {status === "failed" && (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
              <p className="text-muted-foreground">
                Something went wrong with your payment. Please try again or contact support if the issue persists.
              </p>
            </>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Go to Dashboard
            </Button>
            <Button variant="outline" onClick={() => navigate("/transactions")} className="w-full">
              View Transactions
            </Button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
