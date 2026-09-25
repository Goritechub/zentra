import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadBlogImages } from "@/api/blog.api";

interface BlogCoverImagePickerProps {
  value: string;
  onChange: (url: string) => void;
}

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif";

export function BlogCoverImagePicker({ value, onChange }: BlogCoverImagePickerProps) {
  const [mode, setMode] = useState<"upload" | "url">("url");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const { urls } = await uploadBlogImages([file]);
      if (urls[0]) onChange(urls[0]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload image");
    } finally {
      setUploading(false);
    }
  };

  if (value) {
    return (
      <div className="space-y-2">
        <div className="overflow-hidden rounded-lg border border-border">
          <img src={value} alt="Cover" className="h-32 w-full object-cover" />
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "Change image"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onChange("")}>
            Remove
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFile} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {mode === "upload" ? (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-28 w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-xs">{uploading ? "Uploading…" : "Add cover image"}</span>
        </button>
      ) : (
        <Input placeholder="https://…" value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} className="hidden" onChange={handleFile} />
      <button
        type="button"
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => setMode(mode === "upload" ? "url" : "upload")}
      >
        {mode === "upload" ? "Use a URL instead" : "Upload a file instead"}
      </button>
    </div>
  );
}
