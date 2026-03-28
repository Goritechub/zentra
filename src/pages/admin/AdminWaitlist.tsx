import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Download, Search, Users, Briefcase } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  getAdminWaitlistEntries,
  deleteAdminWaitlistEntry,
} from "@/api/waitlist.api";
import { toast } from "sonner";

export default function AdminWaitlist() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      const data = await getAdminWaitlistEntries();
      setEntries(data.entries);
    } catch (err: any) {
      toast.error(err?.message || "Failed to load waitlist entries.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAdminWaitlistEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success("Entry removed.");
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete entry.");
    }
  };

  const filtered = entries.filter((e: any) => {
    const q = search.toLowerCase();
    return (
      e.email?.toLowerCase().includes(q) ||
      e.country?.toLowerCase().includes(q) ||
      e.profession_or_skills?.toLowerCase().includes(q) ||
      e.referral_source?.toLowerCase().includes(q) ||
      e.project_description?.toLowerCase().includes(q)
    );
  });

  const exportCSV = () => {
    const headers = ["Email", "Role", "Country", "Profession/Skills", "Project Description", "Referral Source", "Joined"];
    const rows = entries.map((e: any) => [
      e.email,
      e.role,
      e.country || "",
      e.profession_or_skills || "",
      e.project_description || "",
      e.referral_source || "",
      new Date(e.created_at).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c: string) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zentragig-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clientCount = entries.filter((e: any) => e.role === "client").length;
  const expertCount = entries.filter((e: any) => e.role === "expert").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Waitlist</h1>
          <p className="text-sm text-muted-foreground mt-1">{entries.length} people have joined</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{entries.length}</p>
          <p className="text-xs text-muted-foreground">Total Signups</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center flex flex-col items-center gap-1">
          <Briefcase className="h-5 w-5 text-primary" />
          <p className="text-2xl font-bold text-foreground">{clientCount}</p>
          <p className="text-xs text-muted-foreground">Clients</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center flex flex-col items-center gap-1">
          <Users className="h-5 w-5 text-primary" />
          <p className="text-2xl font-bold text-foreground">{expertCount}</p>
          <p className="text-xs text-muted-foreground">Experts</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by email, country, skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Profession / Skills</TableHead>
                <TableHead>Project Needed</TableHead>
                <TableHead>Referral</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {search ? "No matches found" : "No waitlist entries yet"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-sm">{entry.email}</TableCell>
                    <TableCell>
                      <Badge variant={entry.role === "client" ? "default" : "secondary"} className="capitalize">
                        {entry.role === "expert" ? "Expert" : "Client"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{entry.country || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{entry.profession_or_skills || "—"}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{entry.project_description || "—"}</TableCell>
                    <TableCell className="text-sm">{entry.referral_source || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
