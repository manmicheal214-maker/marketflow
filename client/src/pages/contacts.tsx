import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Plus, Search, Download, Upload, MoreHorizontal,
  Pencil, Trash2, Mail, Phone, Tag as TagIcon, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  Card, CardContent,
} from "@/components/ui/card";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingState, EmptyState, StatusBadge } from "@/components/shared";
import { getStatusColor, getScoreTier, formatNumber, formatDate, timeAgo, parseJSON } from "@/lib/format";

const PAGE_SIZE = 15;

export default function Contacts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [page, setPage] = useState(0);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: contacts, isLoading } = useQuery<any>({ queryKey: ["/api/contacts"] });
  const { data: detail } = useQuery<any>({
    queryKey: ["/api/contacts", detailId],
    enabled: detailId != null,
  });

  const filtered = useMemo(() => {
    if (!contacts) return [];
    let result = contacts.filter((c: any) => {
      const matchesSearch = !search ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
    result = result.sort((a: any, b: any) => {
      switch (sortBy) {
        case "name": return a.name.localeCompare(b.name);
        case "score": return b.engagementScore - a.engagementScore;
        case "recent": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default: return 0;
      }
    });
    return result;
  }, [contacts, search, statusFilter, sortBy]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact created", description: "The contact has been added successfully." });
      setAddOpen(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/contacts/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts", detailId] });
      toast({ title: "Contact updated", description: "Changes saved successfully." });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/contacts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Contact deleted", description: "The contact has been removed." });
      setDeleteId(null);
    },
  });

  function exportCSV() {
    if (!contacts) return;
    const headers = ["Name", "Email", "Phone", "Status", "Source", "Tags", "Engagement Score", "Created At"];
    const rows = contacts.map((c: any) => [
      c.name, c.email, c.phone || "", c.status, c.source,
      parseJSON(c.tags, []).join("; "), c.engagementScore, formatDate(c.createdAt),
    ]);
    const csv = [headers, ...rows].map(r => r.map((v: any) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "marketflow-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Export complete", description: `${contacts.length} contacts exported to CSV.` });
  }

  if (isLoading) return <LoadingState label="Loading contacts..." />;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search contacts..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9"
            data-testid="input-contact-search"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Lead">Lead</SelectItem>
            <SelectItem value="Interested">Interested</SelectItem>
            <SelectItem value="Customer">Customer</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
            <SelectItem value="Unsubscribed">Unsubscribed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most Recent</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
            <SelectItem value="score">Engagement Score</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} data-testid="button-export-csv">
            <Download className="mr-1.5 h-4 w-4" /> Export
          </Button>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" data-testid="button-add-contact">
                <Plus className="mr-1.5 h-4 w-4" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
              <ContactFormDialog
                onSubmit={(data) => createMutation.mutate(data)}
                loading={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge variant="secondary">{formatNumber(filtered.length)} contacts</Badge>
        {["Lead", "Interested", "Customer", "Inactive", "Unsubscribed"].map(s => {
          const count = contacts?.filter((c: any) => c.status === s).length || 0;
          return (
            <Badge key={s} variant="outline" className="text-xs">
              {s}: {count}
            </Badge>
          );
        })}
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No contacts found"
          description="Try adjusting your search or filters, or add a new contact."
          action={<Button size="sm" onClick={() => setAddOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Add Contact</Button>}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left">
                    <th className="px-4 py-3 font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Source</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground">Tags</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Score</th>
                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">Last Activity</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((contact: any) => {
                    const tags = parseJSON<string[]>(contact.tags, []);
                    const tier = getScoreTier(contact.engagementScore);
                    return (
                      <tr
                        key={contact.id}
                        className="border-b border-border/50 transition-colors hover:bg-muted/30 cursor-pointer"
                        onClick={() => setDetailId(contact.id)}
                        data-testid={`row-contact-${contact.id}`}
                      >
                        <td className="px-4 py-3 font-medium">{contact.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{contact.email}</td>
                        <td className="px-4 py-3"><StatusBadge status={contact.status} colorClass={getStatusColor(contact.status)} /></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{contact.source}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 2).map((t: string) => (
                              <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                            ))}
                            {tags.length > 2 && <Badge variant="outline" className="text-xs">+{tags.length - 2}</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${tier.color}`}>{contact.engagementScore}</span>
                          <span className="text-xs text-muted-foreground ml-1">{tier.label}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">{contact.lastActivityAt ? timeAgo(contact.lastActivityAt) : "—"}</td>
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`button-contact-menu-${contact.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditing(contact)}>
                                <Pencil className="mr-2 h-4 w-4" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setDeleteId(contact.id)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <span className="text-xs text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {formatNumber(filtered.length)}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs px-2">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit dialog */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            <ContactFormDialog
              contact={editing}
              onSubmit={(data) => updateMutation.mutate({ id: editing.id, data })}
              loading={updateMutation.isPending}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contact and all associated data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail sheet */}
      <Sheet open={detailId != null} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Contact Details</SheetTitle>
          </SheetHeader>
          {detail && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                  {detail.contact.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                </div>
                <div>
                  <h3 className="font-semibold">{detail.contact.name}</h3>
                  <p className="text-sm text-muted-foreground">{detail.contact.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={detail.contact.status} colorClass={getStatusColor(detail.contact.status)} /></div>
                <div><span className="text-muted-foreground">Source:</span> {detail.contact.source}</div>
                <div><span className="text-muted-foreground">Phone:</span> {detail.contact.phone || "—"}</div>
                <div><span className="text-muted-foreground">Score:</span> <span className={getScoreTier(detail.contact.engagementScore).color + " font-medium"}>{detail.contact.engagementScore} ({getScoreTier(detail.contact.engagementScore).label})</span></div>
                <div><span className="text-muted-foreground">Created:</span> {formatDate(detail.contact.createdAt)}</div>
                <div><span className="text-muted-foreground">Last Activity:</span> {detail.contact.lastActivityAt ? formatDate(detail.contact.lastActivityAt) : "—"}</div>
              </div>

              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1.5"><TagIcon className="h-3.5 w-3.5" /> Tags</h4>
                <div className="flex flex-wrap gap-1.5">
                  {parseJSON<string[]>(detail.contact.tags, []).map((t: string) => (
                    <Badge key={t} variant="secondary">{t}</Badge>
                  ))}
                </div>
              </div>

              {/* Lead score events */}
              <div>
                <h4 className="text-sm font-medium mb-2">Score History</h4>
                <div className="space-y-2">
                  {detail.scoreEvents.slice(0, 5).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5">
                      <span>{e.description}</span>
                      <span className="font-medium text-green-600">+{e.points}</span>
                    </div>
                  ))}
                  {detail.scoreEvents.length === 0 && <p className="text-xs text-muted-foreground">No score events recorded.</p>}
                </div>
              </div>

              {/* Activity */}
              <div>
                <h4 className="text-sm font-medium mb-2">Activity History</h4>
                <div className="space-y-2">
                  {detail.events.slice(0, 8).map((e: any) => (
                    <div key={e.id} className="flex items-center justify-between text-xs border-b border-border/50 pb-1.5">
                      <span className="capitalize">{e.eventType.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{timeAgo(e.createdAt)}</span>
                    </div>
                  ))}
                  {detail.events.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ContactFormDialog({
  contact, onSubmit, loading,
}: {
  contact?: any;
  onSubmit: (data: any) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(contact?.name || "");
  const [email, setEmail] = useState(contact?.email || "");
  const [phone, setPhone] = useState(contact?.phone || "");
  const [status, setStatus] = useState(contact?.status || "Lead");
  const [source, setSource] = useState(contact?.source || "Manual");
  const [tags, setTags] = useState(contact ? parseJSON<string[]>(contact.tags, []).join(", ") : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      name,
      email,
      phone: phone || null,
      status,
      source,
      tags: JSON.stringify(tags.split(",").map(t => t.trim()).filter(Boolean)),
      engagementScore: contact?.engagementScore ?? 0,
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{contact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-contact-name" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email Address</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required data-testid="input-contact-email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 ..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Interested">Interested</SelectItem>
                <SelectItem value="Customer">Customer</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="Unsubscribed">Unsubscribed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Manual">Manual</SelectItem>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="Social Media">Social Media</SelectItem>
              <SelectItem value="Webinar">Webinar</SelectItem>
              <SelectItem value="Cold Outreach">Cold Outreach</SelectItem>
              <SelectItem value="Event">Event</SelectItem>
              <SelectItem value="Paid Ads">Paid Ads</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="VIP, Newsletter, Dubai" />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} data-testid="button-save-contact">
            {loading ? "Saving..." : contact ? "Save Changes" : "Add Contact"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
