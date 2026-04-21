import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetOccupancyTrend,
  useGetRevenueBreakdown,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatINR, formatDateTime } from "@/lib/format";
import {
  Building2,
  Users,
  Bed,
  Receipt,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass = {
    default: "bg-primary/10 text-primary",
    success: "bg-emerald-500/10 text-emerald-600",
    warning: "bg-amber-500/10 text-amber-600",
    danger: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="text-2xl font-semibold mt-1">{value}</div>
            {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
          </div>
          <div className={`w-10 h-10 rounded-lg grid place-items-center ${toneClass}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const ACTIVITY_TONE: Record<string, string> = {
  payment: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  complaint: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  tenant: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  assignment: "bg-purple-500/10 text-purple-600 border-purple-500/20",
};

export function DashboardPage() {
  const { data: s } = useGetDashboardSummary();
  const { data: activity } = useGetRecentActivity();
  const { data: trend } = useGetOccupancyTrend();
  const { data: revenue } = useGetRevenueBreakdown();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Properties"
          value={String(s?.totalProperties ?? "—")}
          hint={`${s?.totalRooms ?? 0} rooms · ${s?.totalBeds ?? 0} beds`}
          icon={Building2}
        />
        <MetricCard
          label="Occupancy"
          value={`${s ? Math.round(s.occupancyRate) : 0}%`}
          hint={`${s?.occupiedBeds ?? 0} of ${s?.totalBeds ?? 0} beds`}
          icon={Bed}
          tone="success"
        />
        <MetricCard
          label="Active Tenants"
          value={String(s?.totalTenants ?? "—")}
          hint="Currently residing"
          icon={Users}
        />
        <MetricCard
          label="Monthly Revenue"
          value={formatINR(s?.monthlyRevenue ?? 0)}
          hint={`${formatINR(s?.pendingRentAmount ?? 0)} pending`}
          icon={Receipt}
          tone={s && s.overdueRentCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" /> Occupancy trend
            </CardTitle>
            <span className="text-xs text-muted-foreground">Last 6 months</span>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend ?? []}>
                  <defs>
                    <linearGradient id="occ" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="occupied"
                    stroke="hsl(var(--chart-1))"
                    fill="url(#occ)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> Quick status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusRow label="Pending payments" value={s?.pendingRentCount ?? 0} tone="warning" />
            <StatusRow label="Overdue payments" value={s?.overdueRentCount ?? 0} tone="danger" />
            <StatusRow label="Open complaints" value={s?.openComplaints ?? 0} tone="warning" />
            <StatusRow label="In-progress complaints" value={s?.inProgressComplaints ?? 0} tone="default" />
            <div className="pt-2 border-t border-border">
              <div className="text-sm text-muted-foreground">Vacant beds</div>
              <div className="text-2xl font-semibold mt-1">{s?.vacantBeds ?? 0}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenue ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                    }}
                    formatter={(v: number) => formatINR(v)}
                  />
                  <Legend />
                  <Bar dataKey="paid" stackId="a" fill="hsl(var(--chart-1))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="pending" stackId="a" fill="hsl(var(--chart-2))" />
                  <Bar dataKey="overdue" stackId="a" fill="hsl(var(--destructive))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-72 overflow-auto pr-1">
              {(activity ?? []).map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <Badge
                    variant="outline"
                    className={`shrink-0 capitalize ${ACTIVITY_TONE[a.type] ?? ""}`}
                  >
                    {a.type}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{a.description}</div>
                    <div className="text-xs text-muted-foreground mt-1">{formatDateTime(a.createdAt)}</div>
                  </div>
                </div>
              ))}
              {(!activity || activity.length === 0) && (
                <div className="text-sm text-muted-foreground text-center py-8">No recent activity yet</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: number; tone: "default" | "warning" | "danger" }) {
  const cls = { default: "text-foreground", warning: "text-amber-600", danger: "text-destructive" }[tone];
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-lg font-semibold ${cls}`}>{value}</span>
    </div>
  );
}
