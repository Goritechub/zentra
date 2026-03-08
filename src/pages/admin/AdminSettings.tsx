import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Trash2, Settings } from "lucide-react";

export default function AdminSettings() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");

  useEffect(() => { fetchCategories(); }, []);

  const fetchCategories = async () => {
    const { data } = await supabase.from("categories").select("*").order("name");
    setCategories(data || []);
    setLoading(false);
  };

  const addCategory = async () => {
    if (!newCatName.trim() || !newCatSlug.trim()) { toast.error("Name and slug are required"); return; }
    const { error } = await supabase.from("categories").insert({ name: newCatName.trim(), slug: newCatSlug.trim() });
    if (error) { toast.error("Failed to add category"); return; }
    toast.success("Category added");
    setNewCatName(""); setNewCatSlug("");
    fetchCategories();
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Platform Settings</h1>

      <div className="grid gap-6">
        {/* Commission Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Commission Structure</CardTitle>
            <CardDescription>Current tiered commission rates (read-only)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-border"><span>Up to ₦300,000</span><Badge>20%</Badge></div>
              <div className="flex justify-between py-2 border-b border-border"><span>₦300,001 – ₦2,000,000</span><Badge>15%</Badge></div>
              <div className="flex justify-between py-2 border-b border-border"><span>₦2,000,001 – ₦10,000,000</span><Badge>10%</Badge></div>
              <div className="flex justify-between py-2"><span>Above ₦10,000,000</span><Badge>7%</Badge></div>
            </div>
          </CardContent>
        </Card>

        {/* Categories Management */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Manage platform job categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              <Input placeholder="Category name" value={newCatName} onChange={e => { setNewCatName(e.target.value); setNewCatSlug(e.target.value.toLowerCase().replace(/\s+/g, "-")); }} className="flex-1" />
              <Input placeholder="slug" value={newCatSlug} onChange={e => setNewCatSlug(e.target.value)} className="w-40" />
              <Button onClick={addCategory}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <Badge key={c.id} variant="secondary" className="text-sm py-1.5 px-3">
                  {c.icon && <span className="mr-1">{c.icon}</span>}
                  {c.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Dispute Config */}
        <Card>
          <CardHeader>
            <CardTitle>Dispute Configuration</CardTitle>
            <CardDescription>Current dispute response deadline</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Respondents have <span className="font-bold text-foreground">48 hours</span> to submit their response after a dispute is opened.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
