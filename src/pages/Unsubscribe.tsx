import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle2, AlertCircle } from "lucide-react";
import { validateUnsubscribeToken, processUnsubscribe } from "@/api/unsubscribe.api";

type Status = "loading" | "valid" | "already_unsubscribed" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const validate = async () => {
      try {
        const data = await validateUnsubscribeToken(token);
        if (data.valid === false && data.reason === "already_unsubscribed") { setStatus("already_unsubscribed"); return; }
        if (data.valid) { setStatus("valid"); return; }
        setStatus("invalid");
      } catch { setStatus("invalid"); }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      await processUnsubscribe(token);
      setStatus("success");
    } catch { setStatus("error"); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center bg-muted/30 py-16">
        <div className="max-w-md w-full mx-auto text-center px-4">
          {status === "loading" && <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />}

          {status === "valid" && (
            <div className="space-y-6">
              <MailX className="h-16 w-16 text-muted-foreground mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">Unsubscribe from emails</h1>
              <p className="text-muted-foreground">You'll stop receiving notification emails from ZentraGig. You can still view notifications in the app.</p>
              <Button onClick={handleUnsubscribe} disabled={processing} size="lg" variant="destructive">
                {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Confirm Unsubscribe
              </Button>
            </div>
          )}

          {status === "success" && (
            <div className="space-y-4">
              <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">You've been unsubscribed</h1>
              <p className="text-muted-foreground">You won't receive notification emails from ZentraGig anymore.</p>
            </div>
          )}

          {status === "already_unsubscribed" && (
            <div className="space-y-4">
              <CheckCircle2 className="h-16 w-16 text-muted-foreground mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">Already unsubscribed</h1>
              <p className="text-muted-foreground">You've already opted out of notification emails.</p>
            </div>
          )}

          {(status === "invalid" || status === "error") && (
            <div className="space-y-4">
              <AlertCircle className="h-16 w-16 text-destructive mx-auto" />
              <h1 className="text-2xl font-bold text-foreground">
                {status === "invalid" ? "Invalid link" : "Something went wrong"}
              </h1>
              <p className="text-muted-foreground">
                {status === "invalid" ? "This unsubscribe link is invalid or has expired." : "Please try again later."}
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
