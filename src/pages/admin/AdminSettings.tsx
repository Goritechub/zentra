import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Save, Settings, Pencil, X, Trash2, Bell, BellOff, BellRing, Tag } from "lucide-react";
import { useCurrency } from "@/hooks/useCurrency";
import { CommissionTier, CommissionPromo, invalidateCommissionCache, preloadCommissionTiers } from "@/lib/service-charge";
import { useAuth } from "@/hooks/useAuth";
import { ChangeAuthCodeCard } from "@/components/admin/ChangeAuthCodeCard";
import { TotpSetupCard } from "@/components/admin/TotpSetupCard";
import { BroadcastNotificationCard } from "@/components/admin/BroadcastNotificationCard";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { PlatformFreezeCard } from "@/components/admin/PlatformFreezeCard";
import { broadcastNotification } from "@/lib/broadcast";
import {
  addAdminCategory,
  getAdminSettingsData,
  updateAdminCommissionTiers,
  updateAdminCommissionPromo,
} from "@/api/admin.api";
import { format as fnsFormat } from "date-fns";
import type { AdminCategory } from "@/types/admin";

export default function AdminSettings() {
  const { format } = useCurrency();
  const { user } = useAuth();
  const { isSupported: pushSupported, isSubscribed, subscribe, unsubscribe, loading: pushLoading } = usePushNotifications();
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState("");
  const [newCatSlug, setNewCatSlug] = useState("");

  // Commission state
  const [tiers, setTiers] = useState<CommissionTier[]>([]);
  const [editingTiers, setEditingTiers] = useState(false);
  const [draftTiers, setDraftTiers] = useState<CommissionTier[]>([]);
  const [savingTiers, setSavingTiers] = useState(false);

  // Commission promo state
  const [promo, setPromo] = useState<CommissionPromo | null>(null);
  const [editingPromo, setEditingPromo] = useState(false);
  const [draftPromo, setDraftPromo] = useState<CommissionPromo | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const data = await getAdminSettingsData();
    setCategories(data.categories || []);
    setTiers((data.commissionTiers || []) as CommissionTier[]);
    setPromo(data.commissionPromo || null);
    setLoading(false);
  };

  const addCategory = async () => {
    if (!newCatName.trim() || !newCatSlug.trim()) { toast.error("Name and slug are required"); return; }
    try {
      await addAdminCategory(newCatName.trim(), newCatSlug.trim());
    } catch (error) {
      toast.error("Failed to add category");
      return;
    }
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
      label: `Up to ${format(prevMax + 1_000_000)}`,
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
    try {
      await updateAdminCommissionTiers(finalTiers);
    } catch (error) {
      toast.error("Failed to save commission tiers");
      setSavingTiers(false);
      return;
    }

    toast.success("Commission tiers updated");
    setTiers(finalTiers);
    invalidateCommissionCache();
    preloadCommissionTiers();
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
    setSavingTiers(false);
  };

  // Promo editing
  const startEditingPromo = () => {
    setDraftPromo(promo ? { ...promo } : {
      active: true,
      label: "Startup Launch Promo — 50% off platform fees",
      discount_percent: 50,
      starts_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3 * 365 * 24 * 60 * 60 * 1000).toISOString(),
    });
    setEditingPromo(true);
  };

  const cancelEditingPromo = () => {
    setEditingPromo(false);
    setDraftPromo(null);
  };

  const savePromo = async () => {
    if (!draftPromo) return;
    if (draftPromo.discount_percent <= 0 || draftPromo.discount_percent > 100) {
      toast.error("Discount must be between 1% and 100%");
      return;
    }
    if (!draftPromo.label.trim()) {
      toast.error("Label is required");
      return;
    }
    if (new Date(draftPromo.ends_at).getTime() <= new Date(draftPromo.starts_at).getTime()) {
      toast.error("End date must be after the start date");
      return;
    }

    setSavingPromo(true);
    try {
      await updateAdminCommissionPromo(draftPromo);
    } catch (error) {
      toast.error("Failed to save the promo");
      setSavingPromo(false);
      return;
    }

    toast.success("Commission promo updated");
    setPromo(draftPromo);
    invalidateCommissionCache();
    preloadCommissionTiers();
    setEditingPromo(false);
    setSavingPromo(false);
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
                            min="0"
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
                          aria-label="Remove tier"
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

        {/* Commission Promo */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5" /> Commission Promo</CardTitle>
                <CardDescription>An automatic discount applied on top of the commission tiers, for every user</CardDescription>
              </div>
              {!editingPromo ? (
                <Button variant="outline" size="sm" onClick={startEditingPromo}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEditingPromo} disabled={savingPromo}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={savePromo} disabled={savingPromo}>
                    {savingPromo ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!editingPromo ? (
              promo ? (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b border-border">
                    <span>{promo.label}</span>
                    <Badge variant={promo.active ? "default" : "secondary"}>
                      {promo.active ? `${promo.discount_percent}% off` : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    {fnsFormat(new Date(promo.starts_at), "PPP")} → {fnsFormat(new Date(promo.ends_at), "PPP")}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No promo configured.</p>
              )
            ) : draftPromo && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border">
                  <Label htmlFor="promo-active">Active</Label>
                  <Switch
                    id="promo-active"
                    checked={draftPromo.active}
                    onCheckedChange={(checked) => setDraftPromo(prev => prev && { ...prev, active: checked })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Label</label>
                  <Input
                    value={draftPromo.label}
                    onChange={e => setDraftPromo(prev => prev && { ...prev, label: e.target.value })}
                    className="h-9 text-sm"
                    placeholder="e.g. Startup Launch Promo — 50% off platform fees"
                  />
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Discount (%)</label>
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={0.5}
                      value={draftPromo.discount_percent}
                      onChange={e => {
                        const num = parseFloat(e.target.value);
                        setDraftPromo(prev => prev && { ...prev, discount_percent: isNaN(num) ? 0 : num });
                      }}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">Ends</label>
                    <Input
                      type="date"
                      value={draftPromo.ends_at ? draftPromo.ends_at.slice(0, 10) : ""}
                      onChange={e => setDraftPromo(prev => prev && { ...prev, ends_at: new Date(e.target.value).toISOString() })}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
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
        <TotpSetupCard />

        {/* Push Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BellRing className="h-5 w-5" /> Push Notifications</CardTitle>
            <CardDescription>Get instant browser alerts for withdrawal requests, even when the tab is closed.</CardDescription>
          </CardHeader>
          <CardContent>
            {!pushSupported ? (
              <p className="text-sm text-muted-foreground">Your browser doesn't support push notifications.</p>
            ) : isSubscribed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Bell className="h-4 w-4 text-primary" />
                  <span>Push notifications are <strong>enabled</strong> on this browser.</span>
                </div>
                <Button variant="outline" size="sm" onClick={unsubscribe} disabled={pushLoading}>
                  {pushLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <BellOff className="h-4 w-4 mr-1.5" />}
                  Disable
                </Button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Not enabled on this browser.</p>
                <Button size="sm" onClick={subscribe} disabled={pushLoading}>
                  {pushLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Bell className="h-4 w-4 mr-1.5" />}
                  Enable Notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Broadcast Notifications */}
        <BroadcastNotificationCard />

        {/* Emergency Controls */}
        <PlatformFreezeCard />
      </div>
    </div>
  );
}
