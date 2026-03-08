import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira } from "@/lib/nigerian-data";
import { Loader2, Users, Briefcase, FileText, Wallet, Gavel, TrendingUp, UserCheck, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Stats {
  totalUsers: number;
  totalClients: number;
  totalExperts: number;
  activeJobs: number;
  activeContracts: number;
  totalEscrow: number;
  totalTransactions: number;
  openDisputes: number;
  totalRevenue: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [
      profilesRes, clientsRes, expertsRes, jobsRes, contractsRes,
      walletsRes, txRes, disputesRes, revenueRes
    ] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "freelancer"),
      supabase.from("jobs").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("contracts").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("wallets").select("escrow_balance"),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("platform_revenue").select("commission_amount"),
    ]);

    const totalEscrow = (walletsRes.data || []).reduce((s, w) => s + (w.escrow_balance || 0), 0);
    const totalRevenue = (revenueRes.data || []).reduce((s, r) => s + (r.commission_amount || 0), 0);

    setStats({
      totalUsers: profilesRes.count || 0,
      totalClients: clientsRes.count || 0,
      totalExperts: expertsRes.count || 0,
      activeJobs: jobsRes.count || 0,
      activeContracts: contractsRes.count || 0,
      totalEscrow,
      totalTransactions: txRes.count || 0,
      openDisputes: disputesRes.count || 0,
      totalRevenue,
    });
    setLoading(false);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const cards = [
    { label: "Total Users", value: stats!.totalUsers, icon: Users, color: "text-primary" },
    { label: "Clients", value: stats!.totalClients, icon: UserCheck, color: "text-blue-500" },
    { label: "Experts", value: stats!.totalExperts, icon: Users, color: "text-emerald-500" },
    { label: "Active Jobs", value: stats!.activeJobs, icon: Briefcase, color: "text-amber-500" },
    { label: "Active Contracts", value: stats!.activeContracts, icon: FileText, color: "text-purple-500" },
    { label: "Escrow Held", value: formatNaira(stats!.totalEscrow), icon: Wallet, color: "text-red-500", isNaira: true },
    { label: "Total Transactions", value: stats!.totalTransactions, icon: TrendingUp, color: "text-indigo-500" },
    { label: "Open Disputes", value: stats!.openDisputes, icon: Gavel, color: "text-destructive" },
    { label: "Platform Revenue", value: formatNaira(stats!.totalRevenue), icon: DollarSign, color: "text-emerald-600", isNaira: true },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Platform Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.isNaira ? card.value : card.value.toLocaleString()}</p>
                </div>
                <card.icon className={`h-8 w-8 ${card.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
