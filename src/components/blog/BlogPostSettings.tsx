import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { BlogCoverImagePicker } from "@/components/blog/BlogCoverImagePicker";
import { BlogTagInput } from "@/components/blog/BlogTagInput";
import { blogCategories } from "@/lib/blogCategories";

interface BlogPostSettingsProps {
  category: string;
  onCategoryChange: (category: string) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  coverImage: string;
  onCoverImageChange: (url: string) => void;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function BlogPostSettings({
  category,
  onCategoryChange,
  tags,
  onTagsChange,
  coverImage,
  onCoverImageChange,
}: BlogPostSettingsProps) {
  return (
    <div className="p-5">
      <h2 className="mb-5 text-sm font-semibold text-foreground">Post settings</h2>

      <SettingsSection title="Cover image">
        <BlogCoverImagePicker value={coverImage} onChange={onCoverImageChange} />
      </SettingsSection>

      <Separator className="my-5 bg-border/60" />

      <SettingsSection title="Category">
        <Select value={category} onValueChange={onCategoryChange}>
          <SelectTrigger className="border-border/60">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {blogCategories.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsSection>

      <Separator className="my-5 bg-border/60" />

      <SettingsSection title="Tags">
        <BlogTagInput value={tags} onChange={onTagsChange} />
      </SettingsSection>
    </div>
  );
}
