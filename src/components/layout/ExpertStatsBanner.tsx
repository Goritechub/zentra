import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, CheckCircle2 } from "lucide-react";

function formatNaira(amount: number) {
  return "₦" + amount.toLocaleString();
}

function MiniTrendChart({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 120;
  const h = 48;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  });
  const areaPoints = [...points, `${w},${h}`, `0,${h}`].join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="absolute bottom-0 right-0 w-28 h-12 opacity-25" preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.6" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color})`} />
      <polyline points={points.join(" ")} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ExpertStatsBanner() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [lastMonthEarnings, setLastMonthEarnings] = useState(0);
  const [earningsTrend, setEarningsTrend] = useState<number[]>([]);
  const [yearlyCompleted, setYearlyCompleted] = useState(0);
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  const isFreelancer = profile?.role === "freelancer";

  useEffect(() => {
    if (!user || !isFreelancer) return;

    const fetchStats = async () => {
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();

      // Monthly earnings (wallet_transactions credits this month)
      const { data: thisMonthTx } = await supabase
        .from("wallet_transactions")
        .select("amount, created_at")
        .eq("user_id", user.id)
        .in("type", ["credit", "escrow_release"])
        .gte("created_at", thisMonthStart);

      const currentEarnings = (thisMonthTx || []).reduce((s, t) => s + (t.amount || 0), 0);
      setMonthlyEarnings(currentEarnings);

      // Last month earnings
      const { data: lastMonthTx } = await supabase
        .from("wallet_transactions")
        .select("amount")
        .eq("user_id", user.id)
        .in("type", ["credit", "escrow_release"])
        .gte("created_at", lastMonthStart)
        .lte("created_at", lastMonthEnd);

      const prevEarnings = (lastMonthTx || []).reduce((s, t) => s + (t.amount || 0), 0);
      setLastMonthEarnings(prevEarnings);

      // Trend: last 6 months earnings
      const trend: number[] = [];
      for (let i = 5; i >= 0; i--) {
        const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString();
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59).toISOString();
        const { data: mTx } = await supabase
          .from("wallet_transactions")
          .select("amount")
          .eq("user_id", user.id)
          .in("type", ["credit", "escrow_release"])
          .gte("created_at", mStart)
          .lte("created_at", mEnd);
        trend.push((mTx || []).reduce((s, t) => s + (t.amount || 0), 0));
      }
      setEarningsTrend(trend);

      // Contracts completed this year
      const { count: yearCount } = await supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("freelancer_id", user.id)
        .eq("status", "completed")
        .gte("completed_at", yearStart);

      setYearlyCompleted(yearCount || 0);

      // Contracts completed this month
      const { count: monthCount } = await supabase
        .from("contracts")
        .select("id", { count: "exact", head: true })
        .eq("freelancer_id", user.id)
        .eq("status", "completed")
        .gte("completed_at", thisMonthStart);

      setMonthlyCompleted(monthCount || 0);
      setLoading(false);
    };

    fetchStats();
  }, [user, isFreelancer]);

  if (!user || !isFreelancer) return null;

  const pctChange = lastMonthEarnings > 0
    ? Math.round(((monthlyEarnings - lastMonthEarnings) / lastMonthEarnings) * 100)
    : monthlyEarnings > 0 ? 100 : 0;

  const monthName = new Date().toLocaleString("default", { month: "short" });

  if (loading) return null;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3">
        {/* Monthly Earnings Card */}
        <button
          onClick={() => navigate("/transactions")}
          className="relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30 group"
        >
          <MiniTrendChart data={earningsTrend} color="hsl(142, 71%, 45%)" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" />
              Earnings this month
            </div>
            <p className="text-xl font-bold text-foreground">{formatNaira(monthlyEarnings)}</p>
            {pctChange !== 0 && (
              <p className={`text-xs mt-1 font-medium ${pctChange > 0 ? "text-green-500" : "text-destructive"}`}>
                {pctChange > 0 ? "+" : ""}{pctChange}% from last month
              </p>
            )}
            {pctChange === 0 && lastMonthEarnings === 0 && monthlyEarnings === 0 && (
              <p className="text-xs mt-1 text-muted-foreground">No earnings yet</p>
            )}
          </div>
        </button>

        {/* Completed Contracts Card */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md">
          <div className="absolute bottom-1 right-2 opacity-10">
            <CheckCircle2 className="h-14 w-14 text-primary" strokeWidth={1.2} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completed this year
            </div>
            <p className="text-xl font-bold text-foreground">{yearlyCompleted}</p>
            <p className="text-xs mt-1 text-muted-foreground">
              {monthlyCompleted} in {monthName}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
