import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, CheckCircle2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

interface TrendPoint {
  label: string;
  earnings: number;
  contracts: number;
  isCurrent: boolean;
}

const SIDE_PAD_PCT = 3;
const TOP_PAD_PCT = 14;
const BOTTOM_PAD_PCT = 6;
const CHART_TICK_FRACTIONS = [1, 0.75, 0.5, 0.25, 0];

// Single source of truth for "where does value-fraction f sit vertically" —
// used by both the gridlines/y-axis labels and the plotted points, so the
// two can't drift apart. Padding at top/bottom leaves room for the
// contract-count badge above the highest dot.
function yFor(fraction: number) {
  return TOP_PAD_PCT + (100 - TOP_PAD_PCT - BOTTOM_PAD_PCT) * (1 - fraction);
}

export function ExpertStatsBanner() {
  const { format } = useCurrency();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [lastMonthEarnings, setLastMonthEarnings] = useState(0);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [yearlyCompleted, setYearlyCompleted] = useState(0);
  const [monthlyCompleted, setMonthlyCompleted] = useState(0);
  const [loading, setLoading] = useState(true);

  const isFreelancer = profile?.role === "freelancer";

  useEffect(() => {
    if (!user || !isFreelancer) return;

    const fetchStats = async () => {
      try {
        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        const sixMonthsAgoStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const yearStartDate = new Date(now.getFullYear(), 0, 1);

        // Earnings covering the full 6-month trend window in a single query
        const { data: earningsTx, error: earningsErr } = await supabase
          .from("wallet_transactions")
          .select("amount, created_at")
          .eq("user_id", user.id)
          .in("type", ["credit", "escrow_release"])
          .gte("created_at", sixMonthsAgoStart.toISOString());
        if (earningsErr) throw earningsErr;

        const txList = earningsTx || [];
        const sumInRange = (start: Date, end?: Date) =>
          txList.reduce((s, t) => {
            const d = new Date(t.created_at);
            return d >= start && (!end || d <= end) ? s + (t.amount || 0) : s;
          }, 0);

        setMonthlyEarnings(sumInRange(thisMonthStart));
        setLastMonthEarnings(sumInRange(lastMonthStart, lastMonthEnd));

        // Contracts completed (use completed_at, fallback to created_at)
        const { data: allCompleted, error: contractsErr } = await supabase
          .from("contracts")
          .select("id, completed_at, created_at")
          .eq("freelancer_id", user.id)
          .eq("status", "completed");
        if (contractsErr) throw contractsErr;

        const completedList = allCompleted || [];
        const completedInRange = (start: Date, end?: Date) =>
          completedList.filter(c => {
            const d = new Date(c.completed_at || c.created_at);
            return d >= start && (!end || d <= end);
          });

        setYearlyCompleted(completedInRange(yearStartDate).length);
        setMonthlyCompleted(completedInRange(thisMonthStart).length);

        // 6-month trend, bucketed from the data already fetched above
        const trendPoints: TrendPoint[] = Array.from({ length: 6 }, (_, i) => {
          const mStart = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
          const mEnd = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0, 23, 59, 59);
          return {
            label: mStart.toLocaleString("default", { month: "short" }),
            earnings: sumInRange(mStart, mEnd),
            contracts: completedInRange(mStart, mEnd).length,
            isCurrent: i === 5,
          };
        });
        setTrend(trendPoints);
      } catch (err) {
        console.error("ExpertStatsBanner: failed to load stats", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [user, isFreelancer]);

  if (!user || !isFreelancer) return null;

  const pctChange = lastMonthEarnings > 0
    ? Math.round(((monthlyEarnings - lastMonthEarnings) / lastMonthEarnings) * 100)
    : monthlyEarnings > 0 ? 100 : 0;

  const monthName = new Date().toLocaleString("default", { month: "short" });

  const hasEarningsHistory = trend.some(p => p.earnings > 0);
  const chartMax = Math.max(...trend.map(p => p.earnings), 0);
  const yAxisTicks = CHART_TICK_FRACTIONS.map(f => ({ label: format(chartMax * f), y: yFor(f) }));

  const points = trend.map((p, i, arr) => {
    const x = SIDE_PAD_PCT + (arr.length === 1
      ? (100 - SIDE_PAD_PCT * 2) / 2
      : ((100 - SIDE_PAD_PCT * 2) * i) / (arr.length - 1));
    const y = yFor(chartMax > 0 ? p.earnings / chartMax : 0);
    return { ...p, x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
  const areaPath = points.length
    ? `${linePath} L${points[points.length - 1].x.toFixed(2)},100 L${points[0].x.toFixed(2)},100 Z`
    : "";

  if (loading) return null;

  return (
    <div className="mb-6">
      <div className="grid grid-cols-2 gap-3">
        {/* Monthly Earnings Card */}
        <button
          onClick={() => navigate("/transactions")}
          className="relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30 group"
        >
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <Wallet className="h-3.5 w-3.5" />
              Earnings this month
            </div>
            <p className="text-xl font-bold text-foreground">{format(monthlyEarnings)}</p>
            {pctChange !== 0 && (
              <p className={`text-xs mt-1 font-medium ${pctChange > 0 ? "text-success" : "text-destructive"}`}>
                {pctChange > 0 ? "+" : ""}{pctChange}% from last month
              </p>
            )}
            {pctChange === 0 && lastMonthEarnings === 0 && monthlyEarnings === 0 && (
              <p className="text-xs mt-1 text-muted-foreground">No earnings yet</p>
            )}
          </div>
        </button>

        {/* Completed Contracts Card */}
        <button onClick={() => navigate("/dashboard/contracts")} className="relative overflow-hidden rounded-xl border border-border bg-card p-4 text-left transition-all hover:shadow-md hover:border-primary/30 group">
          <div className="absolute bottom-1 right-2 opacity-10">
            <CheckCircle2 className="h-14 w-14 text-primary" strokeWidth={1.2} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Contracts completed this year
            </div>
            <p className="text-xl font-bold text-foreground">{yearlyCompleted} contract{yearlyCompleted !== 1 ? "s" : ""}</p>
            <p className="text-xs mt-1 text-muted-foreground">
              {monthlyCompleted} in {monthName}
            </p>
          </div>
        </button>
      </div>

      {/* Earnings trend */}
      <div className="mt-3 rounded-xl border border-border bg-card p-4">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Earnings — last 6 months</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasEarningsHistory ? "Scaled to your best month so far" : "Appears once you have at least one paid month"}
            </p>
          </div>
          {hasEarningsHistory && (
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              number above each point = contracts completed that month
            </div>
          )}
        </div>

        {hasEarningsHistory ? (
          <div className="grid grid-cols-[44px_1fr] gap-x-2.5">
            <div className="relative h-60 text-right text-[10.5px] text-muted-foreground">
              {yAxisTicks.map((t, i) => (
                <span key={i} className="absolute right-0 -translate-y-1/2 whitespace-nowrap" style={{ top: `${t.y}%` }}>
                  {t.label}
                </span>
              ))}
            </div>
            <div className="relative h-60">
              <div className="absolute inset-0">
                {yAxisTicks.map((t, i) => (
                  <div key={i} className="absolute left-0 right-0 border-t border-dashed border-border" style={{ top: `${t.y}%` }} />
                ))}
              </div>
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
                <defs>
                  <linearGradient id="earnings-trend-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={areaPath} fill="url(#earnings-trend-fill)" stroke="none" />
                <path
                  d={linePath}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              {/* Dots and count labels are plain HTML, not SVG shapes, so the chart's
                  non-uniform x/y scaling (preserveAspectRatio="none") can't stretch them into ovals. */}
              {points.map((p, i) => (
                <div key={i} className="pointer-events-none absolute" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
                  <span
                    className={`absolute -translate-x-1/2 whitespace-nowrap rounded-full px-1.5 py-0.5 font-mono text-[10.5px] leading-none ${p.isCurrent ? "bg-accent/15 font-bold text-accent-foreground" : "font-semibold text-muted-foreground"}`}
                    style={{ bottom: "14px" }}
                  >
                    {p.contracts}
                  </span>
                  <span
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full ${p.isCurrent ? "h-2.5 w-2.5 border-2 border-accent bg-accent" : "h-[7px] w-[7px] border-2 border-primary bg-card"}`}
                  />
                </div>
              ))}
            </div>
            <div className="col-start-2 mt-2 flex justify-between px-0.5">
              {trend.map((p, i) => (
                <span key={i} className={`w-[15%] text-center text-[11px] ${p.isCurrent ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {p.label}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <EmptyState
            variant="wallet"
            title="No earnings yet"
            description="Your 6-month trend will appear here once you complete your first paid contract."
            compact
          />
        )}
      </div>
    </div>
  );
}
