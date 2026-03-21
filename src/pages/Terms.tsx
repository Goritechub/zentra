import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getPublishedLegalDocument } from "@/api/client-read.api";

export default function Terms() {
  const [searchParams] = useSearchParams();
  const slug = searchParams.get("doc") || "terms-and-conditions";
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState("Terms and Conditions");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDoc = async () => {
      setLoading(true);
      const response = await getPublishedLegalDocument(slug);
      const data = response.document;
      if (data) {
        setTitle(data.title);
        setContent(data.content);
      }
      setLoading(false);
    };
    fetchDoc();
  }, [slug]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container-wide section-padding">
        <div className="max-w-3xl mx-auto">
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : content ? (
            <div className="prose prose-sm max-w-none">
              <h1 className="text-3xl font-bold text-foreground mb-8">{title}</h1>
              <MarkdownRenderer content={content} />
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-20">Document not found.</p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}

function MarkdownRenderer({ content }: { content: string }) {
  const lines = content.split("\n");

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-2" />;
        if (trimmed === "---") return <hr key={i} className="border-border my-6" />;
        if (trimmed.startsWith("# "))
          return <h1 key={i} className="text-2xl font-bold text-foreground mt-8 mb-3">{trimmed.slice(2)}</h1>;
        if (trimmed.startsWith("### "))
          return <h3 key={i} className="text-base font-semibold text-foreground mt-4 mb-1">{trimmed.slice(4)}</h3>;
        if (trimmed.startsWith("- "))
          return <li key={i} className="text-foreground/80 text-sm ml-4 list-disc">{trimmed.slice(2)}</li>;
        if (/^\d+\.\s/.test(trimmed))
          return <li key={i} className="text-foreground/80 text-sm ml-4 list-decimal">{trimmed.replace(/^\d+\.\s/, "")}</li>;
        return <p key={i} className="text-foreground/80 text-sm leading-relaxed">{trimmed}</p>;
      })}
    </div>
  );
}
