import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Save, FileText, Trash2, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface LegalDocument {
  id: string;
  slug: string;
  title: string;
  content: string;
  is_published: boolean;
  sort_order: number;
  updated_at: string;
}

export default function AdminLegalDocuments() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPublished, setEditPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    const { data, error } = await supabase
      .from("legal_documents" as any)
      .select("*")
      .order("sort_order", { ascending: true });

    if (!error && data) {
      setDocuments(data as any);
      if (!selectedId && data.length > 0) {
        selectDocument(data[0] as any);
      }
    }
    setLoading(false);
  };

  const selectDocument = (doc: LegalDocument) => {
    setSelectedId(doc.id);
    setEditTitle(doc.title);
    setEditSlug(doc.slug);
    setEditContent(doc.content);
    setEditPublished(doc.is_published);
    setIsNew(false);
  };

  const handleNew = () => {
    setSelectedId(null);
    setEditTitle("");
    setEditSlug("");
    setEditContent("");
    setEditPublished(true);
    setIsNew(true);
  };

  const generateSlug = (title: string) =>
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const handleSave = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      toast.error("Title and content are required");
      return;
    }

    const slug = editSlug.trim() || generateSlug(editTitle);
    setSaving(true);

    if (isNew) {
      const maxOrder = documents.length > 0 ? Math.max(...documents.map(d => d.sort_order)) : 0;
      const { error } = await supabase
        .from("legal_documents" as any)
        .insert({
          title: editTitle.trim(),
          slug,
          content: editContent,
          is_published: editPublished,
          sort_order: maxOrder + 1,
        } as any);

      if (error) {
        toast.error("Failed to create document");
      } else {
        toast.success("Document created");
        setIsNew(false);
      }
    } else if (selectedId) {
      const { error } = await supabase
        .from("legal_documents" as any)
        .update({
          title: editTitle.trim(),
          slug,
          content: editContent,
          is_published: editPublished,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", selectedId);

      if (error) {
        toast.error("Failed to save changes");
      } else {
        toast.success("Document saved");
      }
    }

    await fetchDocuments();
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId || isNew) return;
    if (!confirm("Are you sure you want to delete this document?")) return;

    const { error } = await supabase
      .from("legal_documents" as any)
      .delete()
      .eq("id", selectedId);

    if (error) {
      toast.error("Failed to delete");
    } else {
      toast.success("Document deleted");
      setSelectedId(null);
      setIsNew(false);
      await fetchDocuments();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Legal Documents</h1>
          <p className="text-muted-foreground text-sm">Manage platform policies and legal documents</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[70vh]">
        {/* Document List - 1/3 */}
        <Card className="p-0 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <span className="font-semibold text-sm">Documents</span>
            <Button size="sm" variant="outline" onClick={handleNew}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
          <ScrollArea className="h-[calc(70vh-52px)]">
            <div className="p-2 space-y-1">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => selectDocument(doc)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors flex items-center gap-2",
                    selectedId === doc.id && !isNew
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground/70 hover:bg-muted"
                  )}
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate flex-1">{doc.title}</span>
                  {!doc.is_published && (
                    <Badge variant="secondary" className="text-xs shrink-0">Draft</Badge>
                  )}
                </button>
              ))}
              {isNew && (
                <div className="px-3 py-2.5 rounded-lg text-sm bg-primary/10 text-primary font-medium flex items-center gap-2">
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>New Document</span>
                </div>
              )}
            </div>
          </ScrollArea>
        </Card>

        {/* Editor - 2/3 */}
        <Card className="lg:col-span-2 p-0 overflow-hidden flex flex-col">
          {(selectedId || isNew) ? (
            <>
              <div className="p-4 border-b border-border space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground mb-1 block">Title</Label>
                    <Input
                      value={editTitle}
                      onChange={(e) => {
                        setEditTitle(e.target.value);
                        if (isNew) setEditSlug(generateSlug(e.target.value));
                      }}
                      placeholder="Document title"
                    />
                  </div>
                  <div className="w-48">
                    <Label className="text-xs text-muted-foreground mb-1 block">Slug</Label>
                    <Input
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value)}
                      placeholder="url-slug"
                      className="font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editPublished}
                      onCheckedChange={setEditPublished}
                    />
                    <Label className="text-sm flex items-center gap-1.5">
                      {editPublished ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                      {editPublished ? "Published" : "Draft"}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isNew && (
                      <Button variant="destructive" size="sm" onClick={handleDelete}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    )}
                    <Button size="sm" onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                      {isNew ? "Create" : "Save"}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-4">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Content (Markdown supported)
                </Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Write document content here using Markdown..."
                  className="h-[calc(70vh-200px)] resize-none font-mono text-sm"
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>Select a document or create a new one</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
