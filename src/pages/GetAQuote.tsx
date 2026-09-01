import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cadSoftwareList } from "@/lib/nigerian-data";
import { createQuoteRequest, uploadQuoteAttachments } from "@/api/quotes.api";
import { toast } from "sonner";
import { Loader2, X, Paperclip, FileText, CheckCircle2, Send } from "lucide-react";

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

type SkillLevel = "Beginner" | "Intermediate" | "Advanced";
type DurationUnit = "days" | "weeks" | "months";

export default function GetAQuote() {
  const navigate = useNavigate();

  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [deliveryValue, setDeliveryValue] = useState("");
  const [deliveryUnit, setDeliveryUnit] = useState<DurationUnit>("days");
  const [isRemote, setIsRemote] = useState(true);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("Intermediate");
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);
  const [customSoftware, setCustomSoftware] = useState("");

  const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [attempted, setAttempted] = useState(false);

  // reCAPTCHA (mirrors Auth.tsx's explicit-render pattern)
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const recaptchaWidgetIdRef = useRef<number | null>(null);
  const recaptchaScriptLoaded = useRef(false);
  const recaptchaRendering = useRef(false);
  const [recaptchaToken, setRecaptchaToken] = useState<string | null>(null);

  const onRecaptchaSuccess = useCallback((token: string) => {
    setRecaptchaToken(token);
  }, []);

  const onRecaptchaExpired = useCallback(() => {
    setRecaptchaToken(null);
  }, []);

  useEffect(() => {
    if (recaptchaScriptLoaded.current) return;
    if (document.getElementById("recaptcha-v2-script")) {
      recaptchaScriptLoaded.current = true;
      return;
    }
    const script = document.createElement("script");
    script.id = "recaptcha-v2-script";
    script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.onload = () => { recaptchaScriptLoaded.current = true; };
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    const tryRender = () => {
      const grecaptcha = (window as any).grecaptcha;
      if (!grecaptcha?.render) return false;
      if (!recaptchaContainerRef.current) return false;
      if (recaptchaWidgetIdRef.current !== null) return true;
      if (recaptchaRendering.current) return false;

      recaptchaRendering.current = true;
      recaptchaContainerRef.current.innerHTML = "";
      try {
        const widgetId = grecaptcha.render(recaptchaContainerRef.current, {
          sitekey: RECAPTCHA_SITE_KEY,
          callback: onRecaptchaSuccess,
          "expired-callback": onRecaptchaExpired,
        });
        recaptchaWidgetIdRef.current = widgetId;
      } catch (err) {
        console.error("[reCAPTCHA] Render error:", err);
      } finally {
        recaptchaRendering.current = false;
      }
      return true;
    };

    if (tryRender()) return;
    const interval = setInterval(() => {
      if (tryRender()) clearInterval(interval);
    }, 300);
    return () => clearInterval(interval);
  }, [onRecaptchaSuccess, onRecaptchaExpired]);

  const addSoftware = (sw: string) => {
    if (sw && !selectedSoftware.includes(sw)) {
      setSelectedSoftware([...selectedSoftware, sw]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!files.length) return;

    const allowed = files.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase();
      return ["pdf", "doc", "docx", "png", "jpg", "jpeg", "dwg", "dxf", "zip"].includes(ext || "");
    });
    if (allowed.length < files.length) {
      toast.error("Some files were skipped. Allowed: PDF, DOC, DOCX, PNG, JPG, DWG, DXF, ZIP");
    }
    const toAdd = allowed.slice(0, 5 - uploadedFiles.length);
    if (!toAdd.length) return;

    setUploading(true);
    try {
      const { urls } = await uploadQuoteAttachments(toAdd);
      setUploadedFiles((prev) => [...prev, ...toAdd.map((f, i) => ({ name: f.name, url: urls[i] }))]);
    } catch {
      toast.error("Failed to upload one or more files.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAttempted(true);

    if (!contactName.trim() || !contactEmail.trim()) {
      toast.error("Please provide your name and email");
      return;
    }
    if (!title.trim() || !description.trim()) {
      toast.error("Please describe your project");
      return;
    }
    if (!recaptchaToken) {
      toast.error("Please complete the reCAPTCHA verification");
      return;
    }

    const toDays = (value: number, unit: DurationUnit): number => {
      if (unit === "weeks") return value * 7;
      if (unit === "months") return value * 30;
      return value;
    };

    setSubmitting(true);
    try {
      await createQuoteRequest({
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim() || undefined,
        title: title.trim(),
        description: description.trim(),
        budget_min: budgetMin ? parseInt(budgetMin) : null,
        budget_max: budgetMax ? parseInt(budgetMax) : null,
        delivery_days: deliveryValue ? toDays(parseInt(deliveryValue), deliveryUnit) : null,
        delivery_unit: deliveryUnit,
        skill_level: skillLevel,
        required_software: selectedSoftware,
        is_remote: isRemote,
        attachments: uploadedFiles.map((f) => f.url),
        recaptchaToken,
      });
      setSubmitted(true);
    } catch (error: any) {
      toast.error(error?.message || "Failed to submit your quote request. Please try again.");
      const grecaptcha = (window as any).grecaptcha;
      if (grecaptcha && recaptchaWidgetIdRef.current !== null) {
        grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
      setRecaptchaToken(null);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex items-center justify-center bg-muted/30 py-12">
          <div className="text-center max-w-md mx-auto px-4">
            <CheckCircle2 className="h-14 w-14 mx-auto text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Request Received!</h2>
            <p className="text-muted-foreground mb-6">
              Thanks, {contactName.split(" ")[0]}. Our team will review your project and reach out to{" "}
              <span className="font-medium text-foreground">{contactEmail}</span> with a quote shortly.
            </p>
            <Button onClick={() => navigate("/")}>Back to Home</Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const nameError = attempted && !contactName.trim();
  const emailError = attempted && !contactEmail.trim();
  const titleError = attempted && !title.trim();
  const descriptionError = attempted && !description.trim();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-4 sm:py-8">
        <div className="container-tight">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">Get a Free Quote</h1>
          <p className="text-muted-foreground mb-4 sm:mb-8">
            Tell us about your project and we'll get back to you with a quote — no account required.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-8">
            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Your Contact Info</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Full Name *</Label>
                  <Input
                    placeholder="e.g. Jane Doe"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className={nameError ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="you@example.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className={emailError ? "border-destructive focus-visible:ring-destructive" : undefined}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Phone <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Input
                  placeholder="e.g. +234..."
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Project Details</h2>
              <div className="space-y-2">
                <Label>Project Title *</Label>
                <Input
                  placeholder="e.g. Architectural Drawings for 5-Bedroom Duplex"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={titleError ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  placeholder="Describe your project requirements in detail..."
                  rows={6}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={descriptionError ? "border-destructive focus-visible:ring-destructive" : undefined}
                />
              </div>
              <div className="space-y-2">
                <Label>Required Software <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <Select onValueChange={addSoftware}>
                  <SelectTrigger><SelectValue placeholder="Add software" /></SelectTrigger>
                  <SelectContent>
                    {cadSoftwareList.filter((s) => !selectedSoftware.includes(s)).map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Don't see it? Type it and press Enter"
                    maxLength={25}
                    value={customSoftware}
                    onChange={(e) => setCustomSoftware(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const trimmed = customSoftware.trim();
                        if (trimmed && !selectedSoftware.includes(trimmed)) {
                          addSoftware(trimmed);
                          setCustomSoftware("");
                        }
                      }
                    }}
                  />
                </div>
                {selectedSoftware.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSoftware.map((s) => (
                      <Badge key={s} variant="secondary" className="gap-1 pr-1">
                        {s}
                        <button
                          type="button"
                          onClick={() => setSelectedSoftware(selectedSoftware.filter((x) => x !== s))}
                          className="ml-1 rounded-full hover:bg-primary-foreground/20 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Skill Level Needed</Label>
                <Select value={skillLevel} onValueChange={(v) => setSkillLevel(v as SkillLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(["Beginner", "Intermediate", "Advanced"] as SkillLevel[]).map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4 sm:space-y-6">
              <h2 className="text-lg font-semibold">Budget & Timeline</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Budget Min (₦) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input type="number" placeholder="e.g. 100000" value={budgetMin} onChange={(e) => setBudgetMin(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Budget Max (₦) <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <Input type="number" placeholder="e.g. 500000" value={budgetMax} onChange={(e) => setBudgetMax(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Delivery Timeline <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    placeholder="e.g. 14"
                    min="1"
                    value={deliveryValue}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || parseInt(val) >= 1) setDeliveryValue(val);
                    }}
                    className="flex-1"
                  />
                  <Select value={deliveryUnit} onValueChange={(v) => setDeliveryUnit(v as DurationUnit)}>
                    <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="days">Days</SelectItem>
                      <SelectItem value="weeks">Weeks</SelectItem>
                      <SelectItem value="months">Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <RadioGroup value={isRemote ? "remote" : "physical"} onValueChange={(v) => setIsRemote(v === "remote")} className="flex flex-wrap gap-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="remote" id="quote-remote" />
                  <Label htmlFor="quote-remote" className="cursor-pointer">Remote</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="physical" id="quote-physical" />
                  <Label htmlFor="quote-physical" className="cursor-pointer">On-site</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-4">
              <h2 className="text-lg font-semibold">Attachments <span className="text-muted-foreground font-normal text-sm">(optional)</span></h2>
              <p className="text-sm text-muted-foreground">Upload reference files, drawings, or briefs (PDF, DOC, PNG, JPG, DWG, DXF, ZIP). Max 5 files.</p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.dwg,.dxf,.zip"
                className="hidden"
                onChange={handleFileChange}
              />
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map((f, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-sm flex-1 truncate">{f.name}</span>
                      <button
                        type="button"
                        onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || uploadedFiles.length >= 5}
              >
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paperclip className="h-4 w-4 mr-2" />}
                {uploading ? "Uploading..." : "Add Files"}
              </Button>
            </div>

            <div className="bg-card rounded-xl border border-border p-4 sm:p-6 space-y-3">
              <Label>Verify you're human</Label>
              <div ref={recaptchaContainerRef} />
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={submitting || uploading}>
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Request Quote</>
              )}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
