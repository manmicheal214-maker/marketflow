import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, Mail, Lightbulb, BarChart3, Send, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";

const tabs = [
  { value: "subject-lines", label: "Subject Lines", icon: Mail },
  { value: "email-copy", label: "Email Copy", icon: Sparkles },
  { value: "campaign-ideas", label: "Campaign Ideas", icon: Lightbulb },
  { value: "analyze", label: "Analytics Analysis", icon: BarChart3 },
];

export default function AiAssistant() {
  return (
    <div className="space-y-4">
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">AI Marketing Assistant</h3>
              <p className="text-xs text-muted-foreground">Generate subject lines, email copy, campaign ideas, and analyze performance.</p>
            </div>
            <Badge variant="secondary" className="ml-auto text-xs">Demo Mode</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="subject-lines">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          {tabs.map((t) => {
            const Icon = t.icon;
            return <TabsTrigger key={t.value} value={t.value} className="flex items-center gap-1.5 text-xs"><Icon className="h-3.5 w-3.5" />{t.label}</TabsTrigger>;
          })}
        </TabsList>

        <TabsContent value="subject-lines"><SubjectLinesGenerator /></TabsContent>
        <TabsContent value="email-copy"><EmailCopyGenerator /></TabsContent>
        <TabsContent value="campaign-ideas"><CampaignIdeasGenerator /></TabsContent>
        <TabsContent value="analyze"><AnalyticsAnalyzer /></TabsContent>
      </Tabs>
    </div>
  );
}

function SubjectLinesGenerator() {
  const [product, setProduct] = useState("");
  const [discount, setDiscount] = useState("");
  const [audience, setAudience] = useState("");
  const [results, setResults] = useState<string[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/subject-lines", { product, discount, audience });
      return res.json();
    },
    onSuccess: (data) => setResults(data.lines),
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Product</Label>
            <Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Summer Sale" />
          </div>
          <div className="space-y-2">
            <Label>Discount</Label>
            <Input value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="30%" />
          </div>
          <div className="space-y-2">
            <Label>Audience</Label>
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Existing customers" />
          </div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-generate-subjects">
          {mutation.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-1.5 h-4 w-4" /> Generate Subject Lines</>}
        </Button>
        {results.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Generated Subject Lines:</p>
            {results.map((line, i) => (
              <div key={i} className="flex items-center gap-2 rounded-lg border border-border p-3 hover:bg-muted/30 cursor-pointer group">
                <span className="text-xs text-muted-foreground font-mono">{String.fromCharCode(65 + (i % 26))}{i >= 26 ? i : ""}</span>
                <span className="text-sm flex-1">{line}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => navigator.clipboard?.writeText(line)}>
                  <Send className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmailCopyGenerator() {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/email-copy", { product, audience, goal });
      return res.json();
    },
    onSuccess: (data) => setResult(data.copy),
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2"><Label>Product</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="MarketFlow Pro" /></div>
          <div className="space-y-2"><Label>Audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Free trial users" /></div>
          <div className="space-y-2"><Label>Goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Drive conversions" /></div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating...</> : <><Sparkles className="mr-1.5 h-4 w-4" /> Generate Email Copy</>}
        </Button>
        {result && (
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div><span className="text-xs text-muted-foreground">Subject:</span> <span className="text-sm font-medium">{result.subject}</span></div>
            <div><span className="text-xs text-muted-foreground">Preview:</span> <span className="text-sm">{result.previewText}</span></div>
            <div><span className="text-xs text-muted-foreground">CTA:</span> <span className="text-sm font-medium text-primary">{result.cta}</span></div>
            <div className="border-t border-border pt-3">
              <span className="text-xs text-muted-foreground">Email Body:</span>
              <pre className="mt-2 text-sm whitespace-pre-wrap font-sans">{result.body}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignIdeasGenerator() {
  const [product, setProduct] = useState("");
  const [audience, setAudience] = useState("");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");
  const [channel, setChannel] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/campaign-ideas", { product, audience, goal, budget, channel });
      return res.json();
    },
    onSuccess: (data) => setResults(data.ideas),
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2"><Label>Product</Label><Input value={product} onChange={(e) => setProduct(e.target.value)} placeholder="SaaS tool" /></div>
          <div className="space-y-2"><Label>Audience</Label><Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Small businesses" /></div>
          <div className="space-y-2"><Label>Goal</Label><Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Sign-ups" /></div>
          <div className="space-y-2"><Label>Budget</Label><Input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="$500" /></div>
          <div className="space-y-2"><Label>Channel</Label><Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Email" /></div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
          {mutation.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Generating...</> : <><Lightbulb className="mr-1.5 h-4 w-4" /> Generate Campaign Ideas</>}
        </Button>
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((idea, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">{idea.name}</h4>
                  <Badge variant="outline" className="text-xs">{idea.estCost}</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{idea.strategy}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-muted-foreground">Reach: <span className="font-medium text-foreground">{idea.expectedReach}</span></span>
                  <span className="text-muted-foreground">Channel: <span className="font-medium text-foreground">{idea.channel}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AnalyticsAnalyzer() {
  const { data: campaigns } = useQuery<any>({ queryKey: ["/api/campaigns"] });
  const [campaignId, setCampaignId] = useState("");
  const [question, setQuestion] = useState("Why did this campaign perform poorly?");
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/analyze", { campaignId: parseInt(campaignId), question });
      return res.json();
    },
    onSuccess: (data) => setResult(data.analysis),
  });

  return (
    <Card className="mt-4">
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Campaign</Label>
            <Select value={campaignId} onValueChange={setCampaignId}>
              <SelectTrigger><SelectValue placeholder="Select campaign..." /></SelectTrigger>
              <SelectContent>
                {campaigns?.filter((c: any) => c.status === "Sent").map((c: any) => (
                  <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Question</Label>
            <Input value={question} onChange={(e) => setQuestion(e.target.value)} />
          </div>
        </div>
        <Button onClick={() => mutation.mutate()} disabled={mutation.isPending || !campaignId}>
          {mutation.isPending ? <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Analyzing...</> : <><BarChart3 className="mr-1.5 h-4 w-4" /> Analyze Campaign</>}
        </Button>
        {result && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div>
              <Badge variant="secondary" className="text-xs mb-2">AI Analysis</Badge>
              <p className="text-sm">{result.summary}</p>
            </div>
            {result.causes?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1.5">Possible Causes</h4>
                <ul className="space-y-1">
                  {result.causes.map((c: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-orange-500 mt-0.5">•</span> {c}</li>)}
                </ul>
              </div>
            )}
            {result.metrics?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1.5">Supporting Metrics</h4>
                <div className="grid grid-cols-3 gap-2">
                  {result.metrics.map((m: any, i: number) => (
                    <div key={i} className="rounded-lg bg-muted/50 p-2 text-center">
                      <div className="text-xs text-muted-foreground">{m.label}</div>
                      <div className="text-sm font-medium">{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {result.actions?.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold mb-1.5">Recommended Actions</h4>
                <ul className="space-y-1">
                  {result.actions.map((a: string, i: number) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="text-green-500 mt-0.5">→</span> {a}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
