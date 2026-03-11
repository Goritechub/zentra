import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Plus, Save, Settings, Pencil, X, Trash2 } from "lucide-react";
import { formatNaira } from "@/lib/nigerian-data";
import { CommissionTier, invalidateCommissionCache, preloadCommissionTiers } from "@/lib/service-charge";
import { useAuth } from "@/hooks/useAuth";
import { ChangeAuthCodeCard } from "@/components/admin/ChangeAuthCodeCard";
import { BroadcastNotificationCard } from "@/components/admin/BroadcastNotificationCard";
import { PlatformFreezeCard } from "@/components/admin/PlatformFreezeCard";
import { broadcastNotification } from "@/lib/broadcast";

export default function AdminSettings() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");

  // Commission state
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [editingTiers, setEditingTiers] = useState(false);
  const [draftTiers, setDraftTiers] = useState<CommissionTier[]>([]);
  const [savingTiers, setSavingTiers] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const [catRes, settingsRes] = await Promise.all([
      supabase.from("categories").select("*").order("name"),
      (supabase.from("platform_settings" as any).select("*").eq("key", "commission_tiers").maybeSingle() as any),
    ]);
    setCategories(catRes.data || []);
    if (settingsRes.data?.value && Array.isArray(settingsRes.data.value)) {
      setTiers(settingsRes.data.value as CommissionTier[]);
    }
    setLoading(false);
  };

  const addCategory = async () => {
    if (!newCatName.trim() || !newCatSlug.trim()) { toast.error("Name and slug are required"); return; }
    const { error } = await supabase.from("categories").insert({ name: newCatName.trim(), slug: newCatSlug.trim() });
    if (error) { toast.error("Failed to add category"); return; }
    toast.success("Category added");
    setNewCatName(""); setNewCatSlug("");
    fetchAll();
  };

  // Commission editing
  const startEditing = () => {
    setDraftTiers(tiers.map(t => ({ ...t })));
    setEditingTiers(true);
  };

  const cancelEditing = () => {
    setEditingTiers(false);
    setDraftTiers([]);
  };

  const updateDraftTier = (index: number, field: keyof CommissionTier, value: string) => {
    setDraftTiers(prev => {
      const updated = [...prev];
      if (field === "rate") {
        const num = parseFloat(value);
        updated[index] = { ...updated[index], rate: isNaN(num) ? 0 : num };
      } else if (field === "max_amount") {
        const num = value === "" ? null : parseInt(value.replace(/,/g, ""));
        updated[index] = { ...updated[index], max_amount: isNaN(num as number) ? null : num };
      } else if (field === "label") {
        updated[index] = { ...updated[index], label: value };
      }
      return updated;
    });
  };

  const addDraftTier = () => {
    // Insert before the last (unlimited) tier
    const lastTier = draftTiers[draftTiers.length - 1];
    const prevMax = draftTiers.length >= 2 ? (draftTiers[draftTiers.length - 2].max_amount || 0) : 0;
    const newTier: CommissionTier = {
      max_amount: prevMax + 1_000_000,
      rate: lastTier ? lastTier.rate + 2 : 10,
      label: `Up to ${formatNaira(prevMax + 1_000_000)}`,
    };
    const updated = [...draftTiers];
    updated.splice(draftTiers.length - 1, 0, newTier);
    setDraftTiers(updated);
  };

  const removeDraftTier = (index: number) => {
    if (draftTiers.length <= 2) { toast.error("At least 2 tiers required"); return; }
    setDraftTiers(prev => prev.filter((_, i) => i !== index));
  };

  const saveTiers = async () => {
    // Validate
    for (let i = 0; i < draftTiers.length; i++) {
      const t = draftTiers[i];
      if (t.rate <= 0 || t.rate > 100) {
        toast.error(`Tier ${i + 1}: Rate must be between 1% and 100%`);
        return;
      }
      if (!t.label.trim()) {
        toast.error(`Tier ${i + 1}: Label is required`);
        return;
      }
      if (i < draftTiers.length - 1 && (t.max_amount === null || t.max_amount <= 0)) {
        toast.error(`Tier ${i + 1}: Max amount is required (except last tier)`);
        return;
      }
    }

    // Ensure last tier has null max_amount (unlimited)
    const finalTiers = draftTiers.map((t, i) =>
      i === draftTiers.length - 1 ? { ...t, max_amount: null } : t
    );

    setSavingTiers(true);
    const { error } = await supabase
      .from("platform_settings" as any)
      .update({ value: finalTiers, updated_at: new Date().toISOString(), updated_by: user?.id })
      .eq("key", "commission_tiers");

    if (error) {
      toast.error("Failed to save commission tiers");
      console.error(error);
    } else {
      toast.success("Commission tiers updated");
      setTiers(finalTiers);
      invalidateCommissionCache();
      setEditingTiers(false);

      // Auto-notify all users about commission change
      try {
        await broadcastNotification({
          title: "Commission Structure Updated",
          message: "The platform commission rates have been updated. The new rates apply to all future milestone releases.",
          type: "policy_update",
          link_url: "/terms",
        });
      } catch (e) {
        console.error("Failed to broadcast commission update:", e);
      }
    }
    setSavingTiers(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Platform Settings</h1>

      <div className="grid gap-6">
        {/* Commission Structure */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Commission Structure</CardTitle>
                <CardDescription>Tiered commission rates applied to released payments</CardDescription>
              </div>
              {!editingTiers ? (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditing} disabled={savingTiers}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveTiers} disabled={savingTiers}>
                    {savingTiers ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!editingTiers ? (
              <div className="space-y-2 text-sm">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-border last:border-0">
                    <span>{tier.label}</span>
                    <Badge>{tier.rate}%</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {draftTiers.map((tier, i) => {
                  const isLast = i === draftTiers.length - 1;
                  return (
                    <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg bg-muted/50 border border-border">
                      <div className="flex-1 w-full sm:w-auto">
                        <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                        <Input
                          value={tier.label}
                          onChange={e => updateDraftTier(i, "label", e.target.value)}
                          className="h-9 text-sm"
                          placeholder="e.g. Up to ₦300,000"
                        />
                      </div>
                      {!isLast && (
                        <div className="w-full sm:w-36">
                          <label className="text-xs text-muted-foreground mb-1 block">Max Amount (₦)</label>
                          <Input
                            type="number"
                            value={tier.max_amount || ""}
                            onChange={e => updateDraftTier(i, "max_amount", e.target.value)}
                            className="h-9 text-sm"
                            placeholder="300000"
                          />
                        </div>
                      )}
                      {isLast && (
                        <div className="w-full sm:w-36">
                          <label className="text-xs text-muted-foreground mb-1 block">Max Amount</label>
                          <div className="h-9 flex items-center text-sm text-muted-foreground px-3 bg-muted rounded-md">Unlimited</div>
                        </div>
                      )}
                      <div className="w-full sm:w-24">
                        <label className="text-xs text-muted-foreground mb-1 block">Rate (%)</label>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          step={0.5}
                          value={tier.rate}
                          onChange={e => updateDraftTier(i, "rate", e.target.value)}
                          className="h-9 text-sm"
                        />
                      </div>
                      <div className="pt-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-destructive hover:text-destructive"
                          onClick={() => removeDraftTier(i)}
                          disabled={draftTiers.length <= 2}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <Button variant="outline" size="sm" onClick={addDraftTier} className="w-full sm:w-auto">
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Tier
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Categories Management */}
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Manage platform job categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <Input placeholder="Category name" value={newCatName} onChange={e => { setNewCatName(e.target.value); setNewCatSlug(e.target.value.toLowerCase().replace(/\s+/g, "-")); }} className="flex-1" />
              <Input placeholder="slug" value={newCatSlug} onChange={e => setNewCatSlug(e.target.value)} className="w-full sm:w-40" />
              <Button onClick={addCategory} className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-1" /> Add</Button>
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

        {/* Authentication Code */}
        <ChangeAuthCodeCard />

        {/* Broadcast Notifications */}
        <BroadcastNotificationCard />

        {/* Emergency Controls */}
        <PlatformFreezeCard />
      </div>
    </div>
  );
}
