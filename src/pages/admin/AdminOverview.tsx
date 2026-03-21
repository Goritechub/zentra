import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminOverview } from "@/api/admin.api";
import { formatNaira } from "@/lib/nigerian-data";
import { Loader2, Users, Briefcase, FileText, Wallet, Gavel, TrendingUp, UserCheck, DollarSign, ArrowRight, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Stats {
  totalUsers: number;
  totalClients: number;
  totalExperts: number;
  activeJobs: number;
  activeContests: number;
  activeContracts: number;
  totalEscrow: number;
  totalTransactions: number;
  openDisputes: number;
  totalRevenue: number;
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    void fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await getAdminOverview();
      setStats({
        totalUsers: data.totalUsers || 0,
        totalClients: data.totalClients || 0,
        totalExperts: data.totalExperts || 0,
        activeJobs: data.activeJobs || 0,
        activeContests: data.activeContests || 0,
        activeContracts: data.activeContracts || 0,
        totalEscrow: data.totalEscrow || 0,
        totalTransactions: data.totalTransactions || 0,
        openDisputes: data.openDisputes || 0,
        totalRevenue: data.totalRevenue || 0,
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const cards = [
    { label: "Total Users", value: stats!.totalUsers, icon: Users, color: "text-primary", route: "/admin/users" },
    { label: "Clients", value: stats!.totalClients, icon: UserCheck, color: "text-blue-500", route: "/admin/users" },
    { label: "Experts", value: stats!.totalExperts, icon: Users, color: "text-emerald-500", route: "/admin/users" },
    { label: "Active Jobs", value: stats!.activeJobs, icon: Briefcase, color: "text-amber-500", route: "/admin/jobs" },
    { label: "Active Contests", value: stats!.activeContests, icon: Trophy, color: "text-orange-500", route: "/admin/contests" },
    { label: "Active Contracts", value: stats!.activeContracts, icon: FileText, color: "text-purple-500", route: "/admin/contracts" },
    { label: "Escrow Held", value: formatNaira(stats!.totalEscrow), icon: Wallet, color: "text-red-500", isNaira: true, route: "/admin/payments" },
    { label: "Total Transactions", value: stats!.totalTransactions, icon: TrendingUp, color: "text-indigo-500", route: "/admin/payments" },
    { label: "Open Disputes", value: stats!.openDisputes, icon: Gavel, color: "text-destructive", route: "/admin/disputes" },
    { label: "Platform Revenue", value: formatNaira(stats!.totalRevenue), icon: DollarSign, color: "text-emerald-600", isNaira: true, route: "/admin/payments" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">Platform Overview</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => (
          <Card
            key={card.label}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
            onClick={() => navigate(card.route)}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-bold mt-1">{card.isNaira ? card.value : card.value.toLocaleString()}</p>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <card.icon className={`h-8 w-8 ${card.color}`} />
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
