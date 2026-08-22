import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { fetchMyWorkspaces, getCurrentWorkspaceId, setCurrentWorkspaceId, type Workspace } from "@/lib/workspace";

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(getCurrentWorkspaceId());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) { setLoading(false); return; }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setCurrentId(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const list = await fetchMyWorkspaces();
      setWorkspaces(list);
      const stillValid = list.find(w => w.id === getCurrentWorkspaceId());
      const next = stillValid ?? list[0] ?? null;
      setCurrentWorkspaceId(next?.id ?? null);
      setCurrentId(next?.id ?? null);
    } catch (err) {
      console.error("Failed to load workspaces:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!isSupabaseConfigured) return;
    // Reload whenever auth state changes (sign in / sign out / token refresh
    // after a fresh session) so workspaces are never stale for the wrong user.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => subscription.unsubscribe();
  }, [load]);

  const switchWorkspace = useCallback((id: string) => {
    if (!workspaces.some(w => w.id === id)) return;
    setCurrentWorkspaceId(id);
    setCurrentId(id);
  }, [workspaces]);

  const currentWorkspace = workspaces.find(w => w.id === currentId) ?? null;

  return (
    <WorkspaceContext.Provider value={{ workspaces, currentWorkspace, loading, switchWorkspace, refetch: load }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within a WorkspaceProvider");
  return ctx;
}
