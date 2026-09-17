import { toast } from "sonner";

export interface ShareOptions {
  title?: string;
  text?: string;
  url: string;
}

export function useShare() {
  const share = async ({ title, text, url }: ShareOptions) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // user cancelled the native share sheet — no-op
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(text ? `${text} ${url}` : url);
      toast.success("Link copied to clipboard!");
    } catch {
      toast.error("Could not copy link.");
    }
  };

  return { share };
}
