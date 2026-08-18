import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trophy, FlaskConical } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState } from "@/components/shared";
import { formatNumber, formatPercent, parseJSON } from "@/lib/format";

export default function AbTesting() {
  const { toast } = useToast();
  const { data: tests, isLoading } = useQuery<any>({ queryKey: ["/api/ab-tests"] });
  const { data: campaigns } = useQuery<any>({ queryKey: ["/api/campaigns"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/ab-tests", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ab-tests"] });
      toast({ title: "A/B test created" });
    },
  });

  if (isLoading) return <LoadingState label="Loading A/B tests..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Test subject lines, content, and CTAs to optimize your campaigns.
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-abtest"><Plus className="mr-1.5 h-4 w-4" /> New Test</Button>
          </DialogTrigger>
          <DialogContent>
            <AbTestForm campaigns={campaigns} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {tests?.length === 0 ? (
        <EmptyState icon={FlaskConical} title="No A/B tests yet" description="Create experiments to find what resonates with your audience." />
      ) : (
        <div className="space-y-4">
          {tests?.map((test: any) => {
            const variants = parseJSON<any[]>(test.variants, []);
            const chartData = variants.map((v: any, i: number) => ({
              name: v.name || `Variant ${String.fromCharCode(65 + i)}`,
              OpenRate: Number((v.openRate * 100).toFixed(1)),
              ClickRate: Number((v.clickRate * 100).toFixed(1)),
            }));
            return (
              <Card key={test.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FlaskConical className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">{test.name}</h3>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">Winning Metric: {test.winningMetric.replace(/_/g, " ")}</Badge>
                        <Badge variant={test.status === "completed" ? "default" : "secondary"} className="text-xs capitalize">{test.status}</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    {/* Chart */}
                    <div>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                          <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip contentStyle={{ backgroundColor: "hsl(var(--popover))", border: "1px solid hsl(var(--popover-border))", borderRadius: "8px", fontSize: "12px" }} />
                          <Legend wrapperStyle={{ fontSize: "12px" }} />
                          <Bar dataKey="OpenRate" name="Open Rate %" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="ClickRate" name="Click Rate %" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Variants detail */}
                    <div className="space-y-2">
                      {variants.map((v: any, i: number) => (
                        <div key={i} className={`rounded-lg border p-3 ${v.winner ? "border-green-300 bg-green-50 dark:bg-green-950/30" : "border-border"}`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{v.name || `Variant ${String.fromCharCode(65 + i)}`}</span>
                              {v.winner && (
                                <Badge className="bg-green-600 text-white text-xs">
                                  <Trophy className="mr-1 h-3 w-3" /> Winner
                                </Badge>
                              )}
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2 truncate">"{v.subject}"</p>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div><span className="text-muted-foreground">Sent:</span> <span className="font-medium">{formatNumber(v.sent)}</span></div>
                            <div><span className="text-muted-foreground">Opens:</span> <span className="font-medium">{formatNumber(v.opens)}</span></div>
                            <div><span className="text-muted-foreground">Open:</span> <span className="font-medium">{formatPercent(v.openRate * 100)}</span></div>
                            <div><span className="text-muted-foreground">Click:</span> <span className="font-medium">{formatPercent(v.clickRate * 100)}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AbTestForm({ campaigns, onSubmit, loading }: { campaigns?: any[]; onSubmit: (data: any) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [winningMetric, setWinningMetric] = useState("open_rate");
  const [subjectA, setSubjectA] = useState("");
  const [subjectB, setSubjectB] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Generate demo variant data
    const split = Math.floor(Math.random() * 500) + 500;
    const openA = 0.35 + Math.random() * 0.2;
    const openB = 0.35 + Math.random() * 0.2;
    const clickA = openA * (0.15 + Math.random() * 0.1);
    const clickB = openB * (0.15 + Math.random() * 0.1);
    const aWins = winningMetric === "open_rate" ? openA > openB : clickA > clickB;
    onSubmit({
      name,
      campaignId: campaignId ? parseInt(campaignId) : null,
      winningMetric,
      status: "completed",
      variants: JSON.stringify([
        { name: "Variant A", subject: subjectA, sent: split, opens: Math.floor(split * openA), clicks: Math.floor(split * clickA), unsubscribes: Math.floor(split * 0.004), openRate: openA, clickRate: clickA, winner: aWins },
        { name: "Variant B", subject: subjectB, sent: split, opens: Math.floor(split * openB), clicks: Math.floor(split * clickB), unsubscribes: Math.floor(split * 0.004), openRate: openB, clickRate: clickB, winner: !aWins },
      ]),
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create A/B Test</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ab-name">Test Name</Label>
          <Input id="ab-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-abtest-name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                {campaigns?.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Winning Metric</Label>
            <Select value={winningMetric} onValueChange={setWinningMetric}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open_rate">Open Rate</SelectItem>
                <SelectItem value="click_rate">Click Rate</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ab-a">Variant A Subject Line</Label>
          <Input id="ab-a" value={subjectA} onChange={(e) => setSubjectA(e.target.value)} required placeholder="30% Off Your Summer Order" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ab-b">Variant B Subject Line</Label>
          <Input id="ab-b" value={subjectB} onChange={(e) => setSubjectB(e.target.value)} required placeholder="Your Summer Discount Ends Sunday" />
        </div>
        <p className="text-xs text-muted-foreground">Demo metrics will be simulated upon creation.</p>
        <DialogFooter>
          <Button type="submit" disabled={loading} data-testid="button-save-abtest">
            {loading ? "Creating..." : "Create Test"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
