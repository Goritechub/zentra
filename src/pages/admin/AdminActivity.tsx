import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { getAdminActivityLogs } from "@/api/admin.api";
import type { AdminActivityLog } from "@/types/admin";

export default function AdminActivity() {
  const [logs, setLogs] = useState<AdminActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchLogs(); }, []);

  const fetchLogs = async () => {
    const data = await getAdminActivityLogs();
    setLogs(data.logs || []);
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Admin Activity Log</h1>

      {logs.length === 0 ? (
        <EmptyState variant="documents" title="No activity recorded yet" />
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
