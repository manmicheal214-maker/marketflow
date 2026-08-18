import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/shared";
import { Mail, MousePointerClick, Globe, FileText, Presentation, ShoppingCart, Award } from "lucide-react";

const scoringRules = [
  { event: "Email opened", points: 2, icon: Mail, color: "text-blue-500" },
  { event: "Email clicked", points: 5, icon: MousePointerClick, color: "text-teal-500" },
  { event: "Website visit", points: 3, icon: Globe, color: "text-purple-500" },
  { event: "Form submitted", points: 10, icon: FileText, color: "text-amber-500" },
  { event: "Demo requested", points: 20, icon: Presentation, color: "text-orange-500" },
  { event: "Purchase", points: 30, icon: ShoppingCart, color: "text-green-500" },
];

const tiers = [
  { range: "0–10", label: "Cold", color: "#94a3b8", description: "Minimal engagement. Needs nurturing." },
  { range: "11–25", label: "Warm", color: "#f59e0b", description: "Showing interest. Keep engaging." },
  { range: "26–50", label: "Hot", color: "#f97316", description: "Highly engaged. Ready for outreach." },
  { range: "50+", label: "Sales Ready", color: "#22c55e", description: "Qualified. Hand off to sales." },
];

export default function LeadScoring() {
  const { data: rules } = useQuery<any>({ queryKey: ["/api/lead-scoring/rules"] });
  const { data: distribution } = useQuery<any>({ queryKey: ["/api/lead-scoring/distribution"] });
  const { data: contacts } = useQuery<any>({ queryKey: ["/api/contacts"] });

  if (!distribution || !contacts) return <LoadingState label="Loading lead scoring..." />;

  const topLeads = [...contacts]
    .sort((a: any, b: any) => b.engagementScore - a.engagementScore)
    .slice(0, 10);

  const totalContacts = distribution.reduce((s: number, d: any) => s + d.count, 0);

  return (
    <div className="space-y-6">
      {/* Scoring rules */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-4">Scoring Rules</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {scoringRules.map((rule) => {
              const Icon = rule.icon;
              return (
                <div key={rule.event} className="rounded-lg border border-border p-3 text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-2 ${rule.color}`} />
                  <div className="text-xs font-medium">{rule.event}</div>
                  <div className="text-lg font-bold text-green-600 mt-1">+{rule.points}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Distribution pie */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Score Distribution</h3>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={distribution} dataKey="count" nameKey="tier" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={(e: any) => e.count}>
                  {distribution.map((d: any, i: number) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Tier definitions */}
        <Card>
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold mb-4">Lead Tiers</h3>
            <div className="space-y-3">
              {tiers.map((tier) => {
                const dist = distribution.find((d: any) => d.tier.includes(tier.label));
                const count = dist?.count || 0;
                const pct = totalContacts > 0 ? (count / totalContacts) * 100 : 0;
                return (
                  <div key={tier.label} className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: tier.color + "20" }}>
                      <Award className="h-5 w-5" style={{ color: tier.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{tier.label} <span className="text-muted-foreground text-xs">({tier.range})</span></span>
                        <span className="text-sm font-semibold">{count.toLocaleString()} <span className="text-muted-foreground text-xs font-normal">({pct.toFixed(0)}%)</span></span>
                      </div>
                      <p className="text-xs text-muted-foreground">{tier.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top leads */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Top Leads by Score</h3>
            <Badge variant="secondary" className="text-xs">Sales Ready</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Rank</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Contact</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Email</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Status</th>
                  <th className="pb-2 font-medium text-muted-foreground text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {topLeads.map((contact: any, i: number) => {
                  const tier = tiers.find(t => {
                    if (t.label === "Cold") return contact.engagementScore <= 10;
                    if (t.label === "Warm") return contact.engagementScore >= 11 && contact.engagementScore <= 25;
                    if (t.label === "Hot") return contact.engagementScore >= 26 && contact.engagementScore <= 50;
                    return contact.engagementScore > 50;
                  });
                  return (
                    <tr key={contact.id} className="border-b border-border/50">
                      <td className="py-2.5 pr-4 font-bold text-muted-foreground">#{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium">{contact.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground text-xs">{contact.email}</td>
                      <td className="py-2.5 pr-4">
                        <Badge variant="outline" className="text-xs" style={{ color: tier?.color, borderColor: tier?.color + "40" }}>{tier?.label}</Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <span className="text-lg font-bold" style={{ color: tier?.color }}>{contact.engagementScore}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
