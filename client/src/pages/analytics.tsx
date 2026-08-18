import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from "recharts";
import { Users, Mail, MousePointerClick, TrendingUp, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiCard, LoadingState } from "@/components/shared";
import { formatNumber, formatPercent, formatCurrency } from "@/lib/format";

export default function Analytics() {
  const { data, isLoading } = useQuery<any>({ queryKey: ["/api/analytics"] });

  if (isLoading || !data) return <LoadingState label="Loading analytics..." />;

  const { stats, growth, performance, funnel, engagementBySegment, campaigns } = data;

  // Calculate ROI metrics
  const campaignsWithROI = campaigns.filter((c: any) => c.status === "Sent" && c.budget && c.budget > 0);
  const totalBudget = campaignsWithROI.reduce((s: number, c: any) => s + (c.budget || 0), 0);
  const totalRevenue = campaignsWithROI.reduce((s: number, c: any) => s + (c.revenue || 0), 0);
  const totalConversions = campaignsWithROI.reduce((s: number, c: any) => s + (c.conversions || 0), 0);
  const roi = totalBudget > 0 ? ((totalRevenue - totalBudget) / totalBudget) * 100 : 0;
  const roas = totalBudget > 0 ? totalRevenue / totalBudget : 0;
  const cpa = totalConversions > 0 ? totalBudget / totalConversions : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Contacts" value={formatNumber(stats.totalContacts)} icon={Users} color="blue" />
        <KpiCard label="Emails Sent" value={formatNumber(stats.emailsSent)} icon={Mail} color="purple" />
        <KpiCard label="Open Rate" value={formatPercent(stats.openRate)} icon={TrendingUp} color="green" />
        <KpiCard label="Click Rate" value={formatPercent(stats.clickRate)} icon={MousePointerClick} color="orange" />
      </div>

      {/* Engagement over time */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Email Engagement Over Time</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Opens, clicks, and unsubscribes by month</p>
            </div>
            <Badge variant="secondary" className="text-xs">Simulated</Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={growth}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Line type="monotone" dataKey="opens" name="Opens" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="clicks" name="Clicks" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="unsubscribes" name="Unsubscribes" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Contact growth */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Contact Growth</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: "8px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="contacts" name="New Contacts" stroke="hsl(var(--chart-1))" fill="url(#colorGrowth)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Engagement by segment */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Engagement by Status</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={engagementBySegment}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="segment" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Bar dataKey="opens" name="Opens" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="clicks" name="Clicks" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Marketing Funnel */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-4">Marketing Funnel</h3>
          <div className="space-y-2">
            {funnel.map((stage: any, i: number) => {
              const maxCount = funnel[0].count;
              const width = maxCount > 0 ? (stage.count / maxCount) * 100 : 0;
              const colors = ["bg-blue-500", "bg-purple-500", "bg-teal-500", "bg-orange-500", "bg-green-500"];
              return (
                <div key={stage.stage} className="flex items-center gap-4">
                  <div className="w-32 text-sm font-medium shrink-0">{stage.stage}</div>
                  <div className="flex-1 relative">
                    <div className={`h-10 ${colors[i]} rounded-lg flex items-center justify-end px-3 transition-all`} style={{ width: `${Math.max(width, 15)}%` }}>
                      <span className="text-white text-sm font-semibold">{formatNumber(stage.count)}</span>
                    </div>
                  </div>
                  <div className="w-24 text-right text-sm">
                    <span className={stage.conversionRate >= 50 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                      {stage.conversionRate.toFixed(1)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Conversion rate shown is stage-to-stage.</p>
        </CardContent>
      </Card>

      {/* Campaign performance table */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-4">Campaign Performance</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Campaign</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Sent</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Open Rate</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Click Rate</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Unsub Rate</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((c: any) => (
                  <tr key={c.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{formatNumber(c.sent)}</td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={c.openRate >= stats.openRate ? "text-green-600 font-medium" : ""}>{formatPercent(c.openRate)}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <span className={c.clickRate >= stats.clickRate ? "text-green-600 font-medium" : ""}>{formatPercent(c.clickRate)}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground">{formatPercent(c.unsubRate)}</td>
                    <td className="py-2.5 text-right">
                      {c.revenue ? <span className="font-medium text-green-600">{formatCurrency(c.revenue)}</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Campaign ROI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Budget" value={formatCurrency(totalBudget)} icon={DollarSign} color="orange" />
        <KpiCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} color="green" />
        <KpiCard label="ROI" value={formatPercent(roi)} icon={TrendingUp} color={roi >= 0 ? "green" : "red"} />
        <KpiCard label="ROAS" value={`${roas.toFixed(2)}x`} icon={TrendingUp} color="purple" />
      </div>
    </div>
  );
}
