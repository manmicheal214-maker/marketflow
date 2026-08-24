import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Users, Filter } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { formatNumber, parseJSON } from "@/lib/format";

export default function Segments() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: segments, isLoading } = useQuery<any>({ queryKey: ["/api/segments"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/segments", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segments"] });
      toast({ title: "Segment created", description: "Your new segment is ready." });
      setAddOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/segments/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/segments"] });
      toast({ title: "Segment deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) return <LoadingState label="Loading segments..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Dynamic segments automatically update based on contact attributes and behavior.
        </p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-segment">
              <Plus className="mr-1.5 h-4 w-4" /> Create Segment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <SegmentForm onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {segments?.length === 0 ? (
        <EmptyState icon={Filter} title="No segments yet" description="Create dynamic segments to group contacts by behavior, tags, or attributes." />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments?.map((segment: any) => {
            const rules = parseJSON<any[]>(segment.rules, []);
            return (
              <Card key={segment.id} data-testid={`card-segment-${segment.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-sm">{segment.name}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">{segment.description}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => setDeleteId(segment.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xl font-bold">{formatNumber(segment.contactCount)}</div>
                      <div className="text-xs text-muted-foreground">matching contacts</div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {rules.map((rule: any, i: number) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <Badge variant="outline" className="text-[10px] px-1.5">{i === 0 ? "IF" : segment.combinator?.toUpperCase()}</Badge>
                        <span className="text-muted-foreground">{rule.field}</span>
                        <span className="font-medium">{rule.operator}</span>
                        <span className="text-muted-foreground">{Array.isArray(rule.value) ? rule.value.join(", ") : rule.value}</span>
                      </div>
                    ))}
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
            <AlertDialogTitle>Delete this segment?</AlertDialogTitle>
            <AlertDialogDescription>Contacts in this segment will not be deleted, only the segment definition.</AlertDialogDescription>
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

function SegmentForm({ onSubmit, loading }: { onSubmit: (data: any) => void; loading: boolean }) {
  const [name, setName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [description, setDescription] = useState("");

  const ruleTemplates: Record<string, any[]> = {
    "Highly Engaged": [
      { field: "engagementScore", operator: ">=", value: 26 },
      { field: "status", operator: "in", value: ["Lead", "Interested", "Customer"] },
    ],
    "Inactive": [{ field: "status", operator: "=", value: "Inactive" }],
    "VIP Customers": [
      { field: "status", operator: "=", value: "Customer" },
      { field: "tags", operator: "contains", value: "VIP" },
    ],
    "New Leads": [{ field: "status", operator: "=", value: "Lead" }],
    "Sales Ready": [{ field: "engagementScore", operator: ">=", value: 50 }],
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const rules = ruleTemplates[selectedTemplate] || [{ field: "engagementScore", operator: ">=", value: 0 }];
    onSubmit({
      name,
      description: description || `Segment: ${name}`,
      rules: JSON.stringify(rules),
      combinator: "and",
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Create Segment</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="seg-name">Segment Name</Label>
          <Input id="seg-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Highly Engaged" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="seg-desc">Description</Label>
          <Textarea id="seg-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe this segment..." rows={2} />
        </div>
        <div className="space-y-2">
          <Label>Rule Template</Label>
          <Select
            value={selectedTemplate}
            onValueChange={(value) => {
              setSelectedTemplate(value);
              if (!name.trim()) setName(value);
            }}
          >
            <SelectTrigger><SelectValue placeholder="Choose a template..." /></SelectTrigger>
            <SelectContent>
              {Object.keys(ruleTemplates).map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Select a pre-built rule template. Custom rule builder available in the full version.</p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} data-testid="button-save-segment">
            {loading ? "Creating..." : "Create Segment"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
