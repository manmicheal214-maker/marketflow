import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, MoreHorizontal, Pencil, Trash2, Copy, Send, Mail, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
import { LoadingState, EmptyState } from "@/components/shared";
import { formatNumber, formatPercent, formatCurrency, formatDate, getCampaignStatusColor } from "@/lib/format";

const mutationError = (toast: ReturnType<typeof useToast>["toast"]) => (error: any) => toast({ title: "Something went wrong", description: error?.message || "Please try again.", variant: "destructive" });

export default function Campaigns() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [sendId, setSendId] = useState<string | null>(null);
  const { data: campaigns, isLoading } = useQuery<any>({ queryKey: ["/api/campaigns"] });
  const { data: segments } = useQuery<any>({ queryKey: ["/api/segments"] });

  const createMutation = useMutation({ mutationFn: async (data: any) => (await apiRequest("POST", "/api/campaigns", data)).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] }); toast({ title: "Campaign created", description: "Your campaign has been saved as a draft." }); setAddOpen(false); }, onError: mutationError(toast) });
  const updateMutation = useMutation({ mutationFn: async ({ id, data }: { id: number; data: any }) => (await apiRequest("PUT", `/api/campaigns/${id}`, data)).json(), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] }); toast({ title: "Campaign updated" }); setEditing(null); }, onError: mutationError(toast) });
  const deleteMutation = useMutation({ mutationFn: async (id: number) => apiRequest("DELETE", `/api/campaigns/${id}`), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] }); toast({ title: "Campaign deleted" }); setDeleteId(null); }, onError: mutationError(toast) });
  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("send-campaign", { body: { campaignId: id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-events"] });
      toast({ title: "Campaign sent", description: `Sent to ${data.sentCount} of ${data.totalTargeted} contacts.` + (data.errors ? ` ${data.errors.length} batch(es) had errors.` : "") });
      setSendId(null);
    },
    onError: mutationError(toast),
  });
  const duplicateMutation = useMutation({
    mutationFn: async (campaign: any) => {
      const { id, createdAt, sentAt, scheduledAt, sent, opens, clicks, unsubscribes, bounces, ...rest } = campaign;
      return (await apiRequest("POST", "/api/campaigns", { ...rest, name: `${campaign.name} (Copy)`, htmlBody: campaign.htmlBody, status: "Draft", sentAt: null, scheduledAt: null })).json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] }); toast({ title: "Campaign duplicated" }); },
    onError: mutationError(toast),
  });

  if (isLoading) return <LoadingState label="Loading campaigns..." />;
  return <div className="space-y-4">
    <div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{campaigns?.length || 0} campaigns · {campaigns?.filter((c: any) => c.status === "Sent").length || 0} sent</p><Button size="sm" onClick={() => setAddOpen(true)} data-testid="button-add-campaign"><Plus className="mr-1.5 h-4 w-4" /> Create Campaign</Button></div>
    {campaigns?.length === 0 ? <EmptyState icon={Mail} title="No campaigns yet" description="Create your first email campaign to get started." action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Create Campaign</Button>} /> : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{campaigns?.map((c: any) => <Card key={c.id} data-testid={`card-campaign-${c.id}`}><CardContent className="p-5"><div className="flex items-start justify-between mb-3"><div className="flex-1 min-w-0"><h3 className="font-semibold text-sm truncate">{c.name}</h3><p className="text-xs text-muted-foreground mt-0.5 truncate">{c.subject}</p></div><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setEditing(c)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem><DropdownMenuItem onClick={() => duplicateMutation.mutate(c)}><Copy className="mr-2 h-4 w-4" /> Duplicate</DropdownMenuItem>{c.status === "Draft" && <DropdownMenuItem onClick={() => setSendId(String(c.id))}><Send className="mr-2 h-4 w-4" /> Send</DropdownMenuItem>}<DropdownMenuItem onClick={() => setDeleteId(c.id)} className="text-red-600"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div><div className="mb-3"><span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getCampaignStatusColor(c.status)}`}>{c.status}</span></div>{c.status === "Sent" ? <div className="grid grid-cols-2 gap-3 text-sm"><div><div className="text-xs text-muted-foreground">Sent</div><div className="font-semibold">{formatNumber(c.sent ?? 0)}</div></div><div><div className="text-xs text-muted-foreground">Open Rate</div><div className="font-semibold text-green-600">{formatPercent(c.sent > 0 ? (c.opens / c.sent) * 100 : 0)}</div></div><div><div className="text-xs text-muted-foreground">Click Rate</div><div className="font-semibold">{formatPercent(c.sent > 0 ? (c.clicks / c.sent) * 100 : 0)}</div></div><div><div className="text-xs text-muted-foreground">Sent Date</div><div className="font-semibold text-xs">{formatDate(c.sentAt)}</div></div>{c.revenue != null && c.revenue > 0 && <div><div className="text-xs text-muted-foreground">Revenue</div><div className="font-semibold text-green-600">{formatCurrency(c.revenue)}</div></div>}{c.conversions != null && c.conversions > 0 && <div><div className="text-xs text-muted-foreground">Conversions</div><div className="font-semibold">{c.conversions}</div></div>}</div> : <div className="flex items-center gap-2 text-xs text-muted-foreground"><Calendar className="h-3.5 w-3.5" />{c.scheduledAt ? `Scheduled for ${formatDate(c.scheduledAt)}` : "Draft — not scheduled"}</div>}</CardContent></Card>)}</div>}
    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="max-w-lg"><CampaignForm segments={segments} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} /></DialogContent></Dialog>
    {editing && <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}><DialogContent className="max-w-lg"><CampaignForm campaign={editing} segments={segments} onSubmit={(data) => updateMutation.mutate({ id: editing.id, data })} loading={updateMutation.isPending} /></DialogContent></Dialog>}
    <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this campaign?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone. Campaign data will be permanently removed.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={sendId != null} onOpenChange={(open) => !open && setSendId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Send this campaign?</AlertDialogTitle><AlertDialogDescription>This will send the campaign to all matching contacts in this workspace via email. This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => sendId && sendMutation.mutate(sendId)} disabled={sendMutation.isPending}>{sendMutation.isPending ? "Sending..." : "Send Campaign"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function CampaignForm({ campaign, segments, onSubmit, loading }: { campaign?: any; segments?: any[]; onSubmit: (data: any) => void; loading: boolean }) {
  const [name, setName] = useState(campaign?.name || ""); const [subject, setSubject] = useState(campaign?.subject || ""); const [previewText, setPreviewText] = useState(campaign?.previewText || ""); const [content, setContent] = useState(campaign?.htmlBody || ""); const [segmentId, setSegmentId] = useState(campaign?.segmentId ? String(campaign.segmentId) : ""); const [budget, setBudget] = useState(campaign?.budget ? String(campaign.budget) : "");
  function handleSubmit(e: React.FormEvent) { e.preventDefault(); onSubmit({ name, subject, previewText, htmlBody: content, status: campaign?.status || "Draft", segmentId: segmentId ? segmentId : null, budget: budget ? parseFloat(budget) : null }); }
  return <><DialogHeader><DialogTitle>{campaign ? "Edit Campaign" : "Create Campaign"}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-4"><div className="space-y-2"><Label htmlFor="c-name">Campaign Name</Label><Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-campaign-name" /></div><div className="space-y-2"><Label htmlFor="c-subject">Subject Line</Label><Input id="c-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required data-testid="input-campaign-subject" /></div><div className="space-y-2"><Label htmlFor="c-preview">Preview Text</Label><Input id="c-preview" value={previewText} onChange={(e) => setPreviewText(e.target.value)} placeholder="Preview text shown in inbox..." /></div><div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Target Segment</Label><Select value={segmentId} onValueChange={setSegmentId}><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent>{segments?.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label htmlFor="c-budget">Budget ($)</Label><Input id="c-budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="0" /></div></div><div className="space-y-2"><Label htmlFor="c-content">Email Content (HTML)</Label><Textarea id="c-content" value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="<h1>Hello!</h1><p>Your message here...</p>" className="font-mono text-xs" /></div><DialogFooter><Button type="submit" disabled={loading} data-testid="button-save-campaign">{loading ? "Saving..." : campaign ? "Save Changes" : "Save Draft"}</Button></DialogFooter></form></>;
}
