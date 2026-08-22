import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { fetchMyWorkspaces, getCurrentWorkspaceId, setCurrentWorkspaceId, type Workspace } from "@/lib/workspace";

type WorkspaceContextValue = { workspaces: Workspace[]; currentWorkspace: Workspace | null; loading: boolean; switchWorkspace: (id: string) => void; refetch: () => Promise<void> };
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setWorkspaces([]); setCurrentWorkspace(null); setCurrentWorkspaceId(null); setLoading(false); return; }
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) { setWorkspaces([]); setCurrentWorkspace(null); setCurrentWorkspaceId(null); return; }
      const fetched = await fetchMyWorkspaces();
      setWorkspaces(fetched);
      const persistedId = getCurrentWorkspaceId();
      const selected = fetched.find(w => w.id === persistedId) ?? fetched[0] ?? null;
      setCurrentWorkspace(selected);
      setCurrentWorkspaceId(selected?.id ?? null);
    } catch (error) {
      console.warn("Failed to load workspaces.", error);
      setWorkspaces([]); setCurrentWorkspace(null); setCurrentWorkspaceId(null);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    void load();
    if (!isSupabaseConfigured) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { void load(); });
    return () => subscription.unsubscribe();
  }, [load]);

  const switchWorkspace = useCallback((id: string) => {
    const selected = workspaces.find(w => w.id === id);
    if (!selected) return;
    setCurrentWorkspace(selected);
    setCurrentWorkspaceId(selected.id);
  }, [workspaces]);

  const value = useMemo(() => ({ workspaces, currentWorkspace, loading, switchWorkspace, refetch: load }), [workspaces, currentWorkspace, loading, switchWorkspace, load]);
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return context;
}
