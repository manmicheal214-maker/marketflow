import { useState } from "react";
import { Plus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/hooks/use-workspace";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, loading, switchWorkspace, refetch } = useWorkspace();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const close = () => { if (!submitting) { setOpen(false); setName(""); setError(""); } };

  async function createWorkspace() {
    const trimmedName = name.trim();
    if (!trimmedName) { setError("Workspace name is required."); return; }
    setError(""); setSubmitting(true);
    try {
      const { data: newId, error: rpcError } = await supabase.rpc("create_workspace", { workspace_name: trimmedName });
      if (rpcError) throw rpcError;
      if (!newId) throw new Error("Workspace was created but no workspace ID was returned.");
      await refetch();
      switchWorkspace(String(newId));
      toast({ title: "Workspace created", description: `${trimmedName} is now active.` });
      close();
    } catch (e) {
      toast({ title: "Could not create workspace", description: e instanceof Error ? e.message : "Unable to create workspace.", variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  return <div className="px-3 pb-3">
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-2">
      <Label htmlFor="workspace-switcher" className="px-1 text-[10px] font-medium uppercase tracking-wider text-slate-400">Workspace</Label>
      <div className="mt-1 flex gap-1">
        <select id="workspace-switcher" value={currentWorkspace?.id ?? ""} disabled={loading || workspaces.length === 0} onChange={e => switchWorkspace(e.target.value)} className="min-w-0 flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1.5 text-sm text-slate-200 outline-none focus:ring-1 focus:ring-primary">
          {workspaces.length === 0 && <option value="">{loading ? "Loading…" : "No workspace"}</option>}
          {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-slate-300 hover:bg-sidebar-accent hover:text-white" title="Create new workspace" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="new-workspace-title">
      <div className="w-full max-w-md rounded-xl border bg-background p-6 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4"><div><h2 id="new-workspace-title" className="text-lg font-semibold">Create new workspace</h2><p className="mt-1 text-sm text-muted-foreground">Add another client or brand to MarketFlow.</p></div><Button type="button" variant="ghost" size="icon" onClick={close} disabled={submitting} aria-label="Close"><X className="h-4 w-4" /></Button></div>
        <div className="space-y-2"><Label htmlFor="new-workspace-name">Workspace name</Label><Input id="new-workspace-name" autoFocus value={name} onChange={e => { setName(e.target.value); if (error) setError(""); }} onKeyDown={e => { if (e.key === "Enter" && !submitting) void createWorkspace(); }} placeholder="e.g. ABC Shoes" disabled={submitting} />{error && <p className="text-sm text-destructive">{error}</p>}</div>
        <div className="mt-6 flex justify-end gap-2"><Button type="button" variant="outline" onClick={close} disabled={submitting}>Cancel</Button><Button type="button" onClick={() => void createWorkspace()} disabled={submitting || !name.trim()}>{submitting ? "Creating…" : <><Check className="mr-1.5 h-4 w-4" />Create</>}</Button></div>
      </div>
    </div>}
  </div>;
}
