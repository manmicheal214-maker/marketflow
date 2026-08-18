import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, FileText, Eye } from "lucide-react";
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
import { formatDate } from "@/lib/format";

const categoryColors: Record<string, string> = {
  Welcome: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  Promotional: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
  Newsletter: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
  "Product Announcement": "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-400",
  "Abandoned Cart": "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  Reengagement: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  Custom: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export default function Templates() {
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: templates, isLoading } = useQuery<any>({ queryKey: ["/api/templates"] });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/templates", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template created" });
      setAddOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PUT", `/api/templates/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template updated" });
      setEditing(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/templates"] });
      toast({ title: "Template deleted" });
      setDeleteId(null);
    },
  });

  if (isLoading) return <LoadingState label="Loading templates..." />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Reusable email templates for your campaigns.</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" data-testid="button-add-template"><Plus className="mr-1.5 h-4 w-4" /> New Template</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <TemplateForm onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {templates?.length === 0 ? (
        <EmptyState icon={FileText} title="No templates yet" description="Create reusable email templates to speed up campaign creation." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates?.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{formatDate(t.createdAt)}</p>
                    </div>
                  </div>
                </div>
                <Badge className={`mb-3 ${categoryColors[t.category] || categoryColors.Custom}`}>{t.category}</Badge>
                <p className="text-sm font-medium mb-1 truncate">{t.subject}</p>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{t.previewText}</p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setPreview(t)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(t)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => setDeleteId(t.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit */}
      {editing && (
        <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
          <DialogContent className="max-w-lg">
            <TemplateForm template={editing} onSubmit={(data) => updateMutation.mutate({ id: editing.id, data })} loading={updateMutation.isPending} />
          </DialogContent>
        </Dialog>
      )}

      {/* Preview */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-muted-foreground">Subject:</span> <span className="font-medium">{preview?.subject}</span></div>
              <div><span className="text-muted-foreground">Preview:</span> <span className="font-medium">{preview?.previewText}</span></div>
            </div>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground border-b border-border">Email Preview</div>
              <div className="p-4 max-h-96 overflow-y-auto" dangerouslySetInnerHTML={{ __html: preview?.content || "" }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={deleteId != null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>This template will be permanently removed.</AlertDialogDescription>
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

function TemplateForm({ template, onSubmit, loading }: { template?: any; onSubmit: (data: any) => void; loading: boolean }) {
  const [name, setName] = useState(template?.name || "");
  const [category, setCategory] = useState(template?.category || "Custom");
  const [subject, setSubject] = useState(template?.subject || "");
  const [previewText, setPreviewText] = useState(template?.previewText || "");
  const [content, setContent] = useState(template?.content || "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({ name, category, subject, previewText, content });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{template ? "Edit Template" : "New Template"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="t-name">Template Name</Label>
          <Input id="t-name" value={name} onChange={(e) => setName(e.target.value)} required data-testid="input-template-name" />
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Welcome">Welcome</SelectItem>
              <SelectItem value="Promotional">Promotional</SelectItem>
              <SelectItem value="Newsletter">Newsletter</SelectItem>
              <SelectItem value="Product Announcement">Product Announcement</SelectItem>
              <SelectItem value="Abandoned Cart">Abandoned Cart</SelectItem>
              <SelectItem value="Re-engagement">Re-engagement</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-subject">Subject Line</Label>
          <Input id="t-subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-preview">Preview Text</Label>
          <Input id="t-preview" value={previewText} onChange={(e) => setPreviewText(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="t-content">Email Content (HTML)</Label>
          <Textarea id="t-content" value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="font-mono text-xs" placeholder="<h1>Welcome!</h1><p>...</p>" />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading} data-testid="button-save-template">
            {loading ? "Saving..." : template ? "Save Changes" : "Create Template"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
}
