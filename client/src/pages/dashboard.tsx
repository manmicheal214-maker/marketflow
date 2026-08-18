import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users, Mail, MousePointerClick, TrendingUp,
  UserPlus, FilePlus, Workflow, Tags as TagsIcon,
  Lightbulb, ArrowRight, Activity,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Legend,
} from "recharts";
import { KpiCard, LoadingState } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { apiRequest, queryClient } from "@/lib/queryClient";

const eventTypeColors: Record<string, string> = {
  email_sent: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  email_delivered: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  email_opened: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  email_clicked: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
  email_bounced: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  email_unsubscribed: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const quickActions = [
  { label: "Add Contact", icon: UserPlus, href: "/contacts", color: "bg-blue-500" },
  { label: "Create Campaign", icon: FilePlus, href: "/campaigns", color: "bg-green-500" },
  { label: "Create Automation", icon: Workflow, href: "/automations", color: "bg-purple-500" },
  { label: "Create Segment", icon: TagsIcon, href: "/segments", color: "bg-orange-500" },
];

export default function Dashboard() {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/dashboard"],
  });

  if (isLoading || !data) return <LoadingState label="Loading dashboard..." />;

  const { stats, growth, performance, insights, events } = data;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total Contacts" value={formatNumber(stats.totalContacts)} change={{ value: "12.4%", positive: true }} icon={Users} color="blue" />
        <KpiCard label="Emails Sent" value={formatNumber(stats.emailsSent)} change={{ value: "8.1%", positive: true }} icon={Mail} color="purple" />
        <KpiCard label="Open Rate" value={formatPercent(stats.openRate)} change={{ value: "2.3%", positive: true }} icon={TrendingUp} color="green" />
        <KpiCard label="Click Rate" value={formatPercent(stats.clickRate)} change={{ value: "0.5%", positive: false }} icon={MousePointerClick} color="orange" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Contact growth + engagement */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">Contact Growth & Email Engagement</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Last 12 months</p>
              </div>
              <Badge variant="secondary" className="text-xs">Simulated</Badge>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="colorContacts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOpens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--popover-border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area type="monotone" dataKey="contacts" name="New Contacts" stroke="hsl(var(--chart-1))" fill="url(#colorContacts)" strokeWidth={2} />
                <Area type="monotone" dataKey="opens" name="Opens" stroke="hsl(var(--chart-2))" fill="url(#colorOpens)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.label} href={action.href}>
                    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 transition-colors hover:border-primary hover:bg-muted/50 cursor-pointer" data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, "-")}`}>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-medium text-center">{action.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="mt-5 border-t border-border pt-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <div className="text-xl font-bold text-green-600">{stats.engagedContacts.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">Engaged Contacts</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-purple-600">{stats.activeAutomations}</div>
                  <div className="text-xs text-muted-foreground">Active Automations</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign performance + Insights */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Campaign Performance</h3>
              <Link href="/analytics">
                <Button variant="ghost" size="sm" className="text-xs" data-testid="button-view-all-analytics">
                  View All <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">Campaign</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Sent</th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground text-right">Open Rate</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Click Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.slice(0, 5).map((c: any) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-medium">{c.name}</td>
                      <td className="py-2.5 pr-4 text-right tabular-nums">{formatNumber(c.sent)}</td>
                      <td className="py-2.5 pr-4 text-right">
                        <span className={c.openRate >= stats.openRate ? "text-green-600 font-medium" : ""}>{formatPercent(c.openRate)}</span>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className={c.clickRate >= stats.clickRate ? "text-green-600 font-medium" : ""}>{formatPercent(c.clickRate)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Marketing Insight */}
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400">
                <Lightbulb className="h-4 w-4" />
              </div>
              <h3 className="text-sm font-semibold">Marketing Insight</h3>
            </div>
            {insights[0] && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{insights[0].title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{insights[0].description}</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
                  <span className="text-xs text-muted-foreground">{insights[0].metric}:</span>
                  <span className="text-sm font-bold text-green-600">{insights[0].value}</span>
                </div>
                <div className="border-l-2 border-primary pl-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Recommendation: </span>
                    {insights[0].recommendation}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Recent Activity</h3>
            <Badge variant="secondary" className="text-xs ml-auto">Simulated</Badge>
          </div>
          <div className="space-y-2">
            {events.slice(0, 8).map((event: any) => {
              const meta = typeof event.metadata === "string" ? JSON.parse(event.metadata) : event.metadata;
              return (
                <div key={event.id} className="flex items-center gap-3 py-2 border-b border-border/50 last:border-0">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${eventTypeColors[event.eventType] || "bg-muted"}`}>
                    {event.eventType.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm text-muted-foreground flex-1 truncate">
                    {meta?.campaignName || "Campaign"} · Contact #{event.contactId}
                  </span>
                  <span className="text-xs text-muted-foreground">{timeAgo(event.createdAt)}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
