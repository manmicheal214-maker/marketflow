import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Trash2, Play, Pause, Mail, Clock, GitBranch,
  Tag as TagIcon, UserCheck, ArrowRight, Zap, Workflow,
} from "lucide-react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState } from "@/components/shared";
import { formatDate, parseJSON } from "@/lib/format";

const stepIcons: Record<string, any> = {
  send_email: Mail,
  wait: Clock,
  condition: GitBranch,
  add_tag: TagIcon,
  remove_tag: TagIcon,
  update_status: UserCheck,
};

const triggerLabels: Record<string, string> = {
  contact_added: "New Contact Added",
  enters_segment: "Contact Enters Segment",
  tag_added: "Tag Added",
  campaign_clicked: "Campaign Clicked",
  campaign_opened: "Campaign Opened",
};

export default function Automations() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: automations, isLoading } = useQuery<any>({ queryKey: ["/api/automations"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/automations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({ title: "Automation created" });
      setAddOpen(false);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await apiRequest("PUT", `/api/automations/${id}`, { status });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/automations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/automations"] });
      toast({ title: "Automation deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) return <LoadingState label="Loading automations..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {automations?.filter((a: any) => a.status === "active").length || 0} active · {automations?.length || 0} total
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-automation"><Plus className="mr-1.5 h-4 w-4" /> Create Automation</Button>
          </DialogTrigger>
          <DialogContent>
            <AutomationForm onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {automations?.length === 0 ? (
        <EmptyState icon={Workflow} title="No automations yet" description="Build automated workflows to nurture leads and engage contacts on autopilot." />
      ) : (
        <div className="space-y-4">
          {automations?.map((automation: any) => {
            const steps = parseJSON<any[]>(automation.steps, []);
            return (
              <Card key={automation.id} data-testid={`card-automation-${automation.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
                        <Zap className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold">{automation.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">Trigger: {triggerLabels[automation.triggerType] || automation.triggerType}</Badge>
                          <Badge variant={automation.status === "active" ? "default" : "secondary"} className="text-xs">
                            {automation.status === "active" ? "Active" : "Paused"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right mr-2">
                        <div className="text-lg font-bold">{automation.enrolledCount}</div>
                        <div className="text-xs text-muted-foreground">enrolled</div>
                      </div>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => toggleMutation.mutate({ id: automation.id, status: automation.status === "active" ? "paused" : "active" })}>
                        {automation.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteId(automation.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Workflow visualization */}
                  <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    {steps.map((step: any, i: number) => {
                      const Icon = stepIcons[step.type] || Mail;
                      const isCondition = step.type === "condition";
                      return (
                        <div key={step.id} className="flex items-center gap-2 shrink-0">
                          <div className={`flex flex-col items-center gap-1 rounded-lg border px-3 py-2 min-w-[120px] ${isCondition ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30" : "border-border bg-muted/30"}`}>
                            <Icon className={`h-4 w-4 ${isCondition ? "text-amber-500" : "text-muted-foreground"}`} />
                            <span className="text-xs font-medium text-center">{step.label}</span>
                          </div>
                          {i < steps.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this automation?</AlertDialogTitle>
            <AlertDialogDescription>Enrolled contacts will stop receiving this workflow.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AutomationForm({ onSubmit, loading }: { onSubmit: (data: any) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("contact_added");

  // Pre-built workflow templates
  const workflows: Record<string, any> = {
    "Welcome Series": {
      triggerType: "contact_added",
      steps: [
        { id: 1, type: "send_email", label: "Send Welcome Email", config: { templateId: 1 } },
        { id: 2, type: "wait", label: "Wait 2 Days", config: { days: 2 } },
        { id: 3, type: "condition", label: "Did contact open email?", config: {} },
        { id: 4, type: "send_email", label: "Send Product Email", config: { templateId: 4 } },
      ],
    },
    "Re-engagement": {
      triggerType: "enters_segment",
      steps: [
        { id: 1, type: "send_email", label: "Send Re-engagement Email", config: {} },
        { id: 2, type: "wait", label: "Wait 3 Days", config: { days: 3 } },
        { id: 3, type: "send_email", label: "Send Final Reminder", config: {} },
      ],
    },
    "Tag-based Follow-up": {
      triggerType: "tag_added",
      steps: [
        { id: 1, type: "send_email", label: "Send Tagged Email", config: {} },
        { id: 2, type: "add_tag", label: "Add Follow-up Tag", config: {} },
      ],
    },
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const wf = workflows[name] || workflows["Welcome Series"];
    onSubmit({
      name,
      triggerType: wf.triggerType,
      triggerConfig: JSON.stringify({}),
      steps: JSON.stringify(wf.steps),
      status: "active",
      enrolledCount: 0,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Automation</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="a-name">Automation Name</Label>
          <Input id="a-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-automation-name" />
        </div>
        <div className="space-y-2">
          <Label>Workflow Template</Label>
          <Select value={name} onValueChange={setName}>
            <SelectTrigger><SelectValue placeholder="Choose a workflow..." /></SelectTrigger>
            <SelectContent>
              {Object.keys(workflows).map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Select a pre-built workflow template. Custom step builder available in the full version.</p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} data-testid="button-save-automation">
            {loading ? "Creating..." : "Create Automation"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
