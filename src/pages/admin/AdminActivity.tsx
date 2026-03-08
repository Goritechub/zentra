import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Activity } from "lucide-react";

export default function AdminActivity() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("admin_activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setLogs(data || []);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Admin Activity Log</h1>

      {logs.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No activity recorded yet</p>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{log.action.replace(/_/g, " ")}</Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{log.target_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">{log.target_id?.substring(0, 12)}...</TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                    {JSON.stringify(log.details)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(log.created_at), "PP p")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
