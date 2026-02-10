import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cadSkills, cadSoftwareList } from "@/lib/nigerian-data";
import { Loader2, X, Trophy } from "lucide-react";

export default function LaunchContestPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [prizeFirst, setPrizeFirst] = useState("");
  const [prizeSecond, setPrizeSecond] = useState("");
  const [prizeThird, setPrizeThird] = useState("");
  const [deadline, setDeadline] = useState("");
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [selectedSoftware, setSelectedSoftware] = useState<string[]>([]);

  const categories = [
    "Architectural Drafting", "Mechanical CAD", "Electrical CAD", "3D Modeling",
    "BIM/Revit", "AutoCAD 2D Plans", "SolidWorks", "Fusion 360", "Civil/Structural Drawings"
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/auth"); return; }
    if (!title.trim() || !description.trim() || !prizeFirst || !deadline) {
      toast.error("Please fill in all required fields");
      return;
    }

    setLoading(true);
    const { error } = await supabase.from("contests" as any).insert({
      client_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category: category || null,
      prize_first: parseInt(prizeFirst),
      prize_second: prizeSecond ? parseInt(prizeSecond) : 0,
      prize_third: prizeThird ? parseInt(prizeThird) : 0,
      deadline,
      required_skills: selectedSkills,
      required_software: selectedSoftware,
    } as any);

    if (error) {
      toast.error("Failed to launch contest");
    } else {
      toast.success("Contest launched!");
      navigate("/dashboard");
    }
    setLoading(false);
  };

  if (!user || profile?.role !== "client") {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Client Access Only</h2>
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-muted/30 py-8">
        <div className="container-tight">
          <h1 className="text-3xl font-bold text-foreground mb-2">Launch a Contest</h1>
          <p className="text-muted-foreground mb-8">Get multiple design submissions and pick the best one.</p>

          <form onSubmit={handleSubmit} className="space-y-8">
            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Contest Details</h2>
              <div className="space-y-2">
                <Label>Contest Title *</Label>
                <Input placeholder="e.g. Office Building Floor Plan Design" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea placeholder="Describe what you want contestants to design..." rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Submission Deadline *</Label>
                <Input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-accent" />Prize Structure</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>🥇 1st Prize (₦) *</Label>
                  <Input type="number" placeholder="e.g. 500000" value={prizeFirst} onChange={(e) => setPrizeFirst(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>🥈 2nd Prize (₦)</Label>
                  <Input type="number" placeholder="Optional" value={prizeSecond} onChange={(e) => setPrizeSecond(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>🥉 3rd Prize (₦)</Label>
                  <Input type="number" placeholder="Optional" value={prizeThird} onChange={(e) => setPrizeThird(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border p-6 space-y-6">
              <h2 className="text-lg font-semibold">Requirements</h2>
              <div className="space-y-2">
                <Label>Required Skills</Label>
                <Select onValueChange={(s) => { if (!selectedSkills.includes(s)) setSelectedSkills([...selectedSkills, s]); }}>
                  <SelectTrigger><SelectValue placeholder="Add skill" /></SelectTrigger>
                  <SelectContent>
                    {cadSkills.filter(s => !selectedSkills.includes(s)).map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex flex-wrap gap-2 mt-2">
                  {selectedSkills.map(s => (
                    <Badge key={s} variant="secondary" className="gap-1">
                      {s} <X className="h-3 w-3 cursor-pointer" onClick={() => setSelectedSkills(selectedSkills.filter(x => x !== s))} />
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Launching...</> : <><Trophy className="h-4 w-4 mr-2" />Launch Contest</>}
            </Button>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}
