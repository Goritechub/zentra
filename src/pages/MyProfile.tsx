import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cadSkills, cadSoftwareList, getAllStates, getCitiesByState } from "@/lib/nigerian-data";
import { Loader2, X, Save, Plus } from "lucide-react";

interface FreelancerProfile {
  id: string;
  user_id: string;
  title: string | null;
  bio: string | null;
  skills: string[] | null;
  hourly_rate: number | null;
  min_project_rate: number | null;
  years_experience: number | null;
  availability: "full_time" | "part_time" | "weekends" | "flexible" | null;
  show_whatsapp: boolean | null;
}

export default function MyProfilePage() {
  const { user, profile, loading: authLoading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [freelancerProfile, setFreelancerProfile] = useState<FreelancerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form fields – general profile
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  // Form fields – freelancer
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [hourlyRate, setHourlyRate] = useState("");
  const [minProjectRate, setMinProjectRate] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [availability, setAvailability] = useState("flexible");
  const [showWhatsapp, setShowWhatsapp] = useState(false);

  // Skill input
  const [skillSearch, setSkillSearch] = useState("");
  const [showSkillDropdown, setShowSkillDropdown] = useState(false);

  const filteredSkills = cadSkills.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !skills.includes(s)
  );
  const filteredSoftware = cadSoftwareList.filter(
    (s) => s.toLowerCase().includes(skillSearch.toLowerCase()) && !skills.includes(s)
  );
  const allSuggestions = [...filteredSkills, ...filteredSoftware].slice(0, 10);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const fetchFreelancerProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("freelancer_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      setFreelancerProfile(data);

      if (data) {
        setTitle(data.title || "");
        setBio(data.bio || "");
        setSkills(data.skills || []);
        setHourlyRate(data.hourly_rate?.toString() || "");
        setMinProjectRate(data.min_project_rate?.toString() || "");
        setYearsExperience(data.years_experience?.toString() || "");
        setAvailability(data.availability || "flexible");
        setShowWhatsapp(data.show_whatsapp || false);
      }
    } catch (err) {
      console.error("Error fetching freelancer profile:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setWhatsapp(profile.whatsapp || "");
      setState(profile.state || "");
      setCity(profile.city || "");
    }
    if (user && profile?.role === "freelancer") {
      fetchFreelancerProfile();
    } else if (profile) {
      setLoading(false);
    }
  }, [profile, user, fetchFreelancerProfile]);

  const addSkill = (skill: string) => {
    if (!skills.includes(skill)) {
      setSkills([...skills, skill]);
    }
    setSkillSearch("");
    setShowSkillDropdown(false);
  };

  const removeSkill = (skill: string) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    setSaving(true);

    try {
      // Update general profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          state: state || null,
          city: city || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Update freelancer profile
      if (profile.role === "freelancer") {
        const freelancerData = {
          user_id: user.id,
          title: title.trim() || null,
          bio: bio.trim() || null,
          skills,
          hourly_rate: hourlyRate ? parseInt(hourlyRate) : null,
          min_project_rate: minProjectRate ? parseInt(minProjectRate) : null,
          years_experience: yearsExperience ? parseInt(yearsExperience) : null,
          availability: availability as FreelancerProfile["availability"],
          show_whatsapp: showWhatsapp,
        };

        if (freelancerProfile) {
          const { error } = await supabase
            .from("freelancer_profiles")
            .update(freelancerData)
            .eq("id", freelancerProfile.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from("freelancer_profiles")
            .insert(freelancerData);
          if (error) throw error;
        }
      }

      await refreshProfile();
      toast({ title: "Profile updated", description: "Your changes have been saved." });
    } catch (err: any) {
      console.error("Error saving profile:", err);
      toast({ title: "Error", description: err.message || "Failed to save profile.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !profile) return null;

  const isFreelancer = profile.role === "freelancer";
  const cities = state ? getCitiesByState(state) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-wide max-w-3xl">
          <div className="mb-8">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Edit Profile</h1>
            <p className="text-muted-foreground mt-1">
              {isFreelancer
                ? "Set up your freelancer profile to attract clients."
                : "Complete your profile to get the most out of CADNaija."}
            </p>
          </div>

          <div className="space-y-8">
            {/* General Info */}
            <section className="bg-card rounded-xl border border-border p-6 space-y-5">
              <h2 className="text-lg font-semibold text-foreground">General Information</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} maxLength={100} placeholder="Your full name" />
                </div>
                <div /> {/* spacer */}
              </div>




              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={state} onValueChange={(v) => { setState(v); setCity(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select state" /></SelectTrigger>
                    <SelectContent>
                      {getAllStates().map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Select value={city} onValueChange={setCity} disabled={!state}>
                    <SelectTrigger><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* Freelancer-Specific */}
            {isFreelancer && (
              <>
                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-foreground">Professional Details</h2>

                  <div className="space-y-2">
                    <Label htmlFor="title">Professional Title</Label>
                    <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="e.g. Senior CAD Designer & BIM Specialist" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={1000} rows={5} placeholder="Describe your experience, specializations, and what makes you stand out..." />
                    <p className="text-xs text-muted-foreground text-right">{bio.length}/1000</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Skills & Software</Label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {skills.map((skill) => (
                        <Badge key={skill} variant="secondary" className="gap-1 pr-1">
                          {skill}
                          <button type="button" onClick={() => removeSkill(skill)} className="ml-1 rounded-full hover:bg-muted p-0.5">
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="relative">
                      <Input
                        value={skillSearch}
                        onChange={(e) => { setSkillSearch(e.target.value); setShowSkillDropdown(true); }}
                        onFocus={() => setShowSkillDropdown(true)}
                        placeholder="Search skills or software..."
                      />
                      {showSkillDropdown && skillSearch && allSuggestions.length > 0 && (
                        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {allSuggestions.map((s) => (
                            <button
                              key={s}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                              onClick={() => addSkill(s)}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {skillSearch && allSuggestions.length === 0 && (
                      <Button type="button" variant="outline" size="sm" className="mt-1" onClick={() => addSkill(skillSearch.trim())}>
                        <Plus className="h-3 w-3 mr-1" /> Add &quot;{skillSearch.trim()}&quot;
                      </Button>
                    )}
                  </div>
                </section>

                <section className="bg-card rounded-xl border border-border p-6 space-y-5">
                  <h2 className="text-lg font-semibold text-foreground">Rates & Availability</h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">Hourly Rate (₦)</Label>
                      <Input id="hourlyRate" type="number" min={0} value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="e.g. 15000" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="minProjectRate">Min Project Rate (₦)</Label>
                      <Input id="minProjectRate" type="number" min={0} value={minProjectRate} onChange={(e) => setMinProjectRate(e.target.value)} placeholder="e.g. 50000" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="yearsExperience">Years of Experience</Label>
                      <Input id="yearsExperience" type="number" min={0} max={50} value={yearsExperience} onChange={(e) => setYearsExperience(e.target.value)} placeholder="e.g. 5" />
                    </div>
                    <div className="space-y-2">
                      <Label>Availability</Label>
                      <Select value={availability} onValueChange={setAvailability}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="weekends">Weekends</SelectItem>
                          <SelectItem value="flexible">Flexible</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                    <div>
                      <p className="font-medium text-foreground text-sm">Show WhatsApp on Profile</p>
                      <p className="text-xs text-muted-foreground">Allow clients to contact you directly via WhatsApp</p>
                    </div>
                    <Switch checked={showWhatsapp} onCheckedChange={setShowWhatsapp} />
                  </div>
                </section>
              </>
            )}

            {/* Save */}
            <div className="flex justify-end gap-3 pb-8">
              <Button variant="outline" onClick={() => navigate("/dashboard")}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
