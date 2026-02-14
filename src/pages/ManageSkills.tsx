import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cadSkills, cadSoftwareList } from "@/lib/nigerian-data";
import { ArrowLeft, Loader2, Save, Plus, X, Wrench } from "lucide-react";

const allOptions = [...cadSoftwareList, ...cadSkills];

export default function ManageSkillsPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [skills, setSkills] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const suggestions = allOptions
    .filter(s => s.toLowerCase().includes(search.toLowerCase()) && !skills.includes(s))
    .slice(0, 10);

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
    if (!authLoading && profile?.role !== "freelancer") navigate("/dashboard");
  }, [user, authLoading, profile]);

  const fetchSkills = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("freelancer_profiles")
      .select("id, skills")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setProfileId(data.id);
      setSkills(data.skills || []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchSkills();
  }, [user, fetchSkills]);

  const addSkill = (skill: string) => {
    if (!skills.includes(skill)) setSkills([...skills, skill]);
    setSearch("");
    setShowDropdown(false);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    if (profileId) {
      const { error } = await supabase.from("freelancer_profiles").update({ skills }).eq("id", profileId);
      if (error) toast.error("Failed to save skills");
      else toast.success("Skills updated!");
    } else {
      const { error } = await supabase.from("freelancer_profiles").insert({ user_id: user.id, skills });
      if (error) toast.error("Failed to create profile");
      else toast.success("Skills saved!");
    }
    setSaving(false);
  };

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-2xl">
          <Button variant="ghost" onClick={() => navigate("/dashboard")} className="mb-6">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>

          <div className="bg-card rounded-xl border border-border p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Manage Skills</h1>
                <p className="text-sm text-muted-foreground">Add your CAD skills & software expertise to improve job matching.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
              {skills.map(skill => (
                <Badge key={skill} variant="secondary" className="gap-1 pr-1 text-sm">
                  {skill}
                  <button onClick={() => setSkills(skills.filter(s => s !== skill))} className="ml-1 rounded-full hover:bg-muted p-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
              {skills.length === 0 && <p className="text-muted-foreground text-sm">No skills added yet.</p>}
            </div>

            <div className="relative mb-6">
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Search skills or software (e.g. AutoCAD, BIM)..."
              />
              {showDropdown && search && suggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(s => (
                    <button key={s} type="button" className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors" onMouseDown={() => addSkill(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {search && suggestions.length === 0 && (
                <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => addSkill(search.trim())}>
                  <Plus className="h-3 w-3 mr-1" /> Add "{search.trim()}"
                </Button>
              )}
            </div>

            <h3 className="text-sm font-medium text-muted-foreground mb-2">Popular Skills</h3>
            <div className="flex flex-wrap gap-2 mb-6">
              {allOptions.slice(0, 12).filter(s => !skills.includes(s)).map(s => (
                <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => addSkill(s)}>
                  <Plus className="h-3 w-3 mr-1" />{s}
                </Button>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Skills
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
