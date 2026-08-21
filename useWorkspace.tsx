// ============================================================================
// MarketFlow: WorkspaceProvider — loads the user's workspaces, exposes switching
// ============================================================================
// Wrap the app with <WorkspaceProvider> above any page that needs
// workspace-scoped data (which, post-multi-tenant migration, is basically
// every page). Reads/writes the current workspace through workspaceStore so
// queryClient.ts can see it too.
// ============================================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabaseClient";
import {
  getCurrentWorkspaceId,
  setCurrentWorkspaceId,
} from "../lib/workspaceStore";

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  role: "owner" | "admin" | "member";
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  loading: boolean;
  error: string | null;
  switchWorkspace: (workspaceId: string) => void;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(
  undefined,
);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    getCurrentWorkspaceId(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      // Demo mode / no backend — nothing to load, but don't block the app.
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    const { data, error: fetchErr } = await supabase
      .from("workspace_members")
      .select("workspace_id, role, workspaces(id, name, slug, owner_id)")
      .eq("user_id", user.id);

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const mapped: Workspace[] = (data ?? [])
      .filter((row: any) => row.workspaces)
      .map((row: any) => ({
        id: row.workspaces.id,
        name: row.workspaces.name,
        slug: row.workspaces.slug,
        owner_id: row.workspaces.owner_id,
        role: row.role,
      }));

    setWorkspaces(mapped);

    // Pick a current workspace: keep the persisted one if it's still valid,
    // otherwise fall back to the first workspace the user belongs to.
    const stillValid = mapped.find((w) => w.id === getCurrentWorkspaceId());
    const next = stillValid ?? mapped[0] ?? null;

    if (next) {
      setCurrentWorkspaceId(next.id);
      setCurrentId(next.id);
    } else {
      setCurrentWorkspaceId(null);
      setCurrentId(null);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadWorkspaces();

    if (!supabase) return;
    // Re-load on sign-in/sign-out so switching accounts updates workspaces.
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadWorkspaces();
    });
    return () => sub.subscription.unsubscribe();
  }, [loadWorkspaces]);

  const switchWorkspace = useCallback(
    (workspaceId: string) => {
      if (!workspaces.some((w) => w.id === workspaceId)) return;
      setCurrentWorkspaceId(workspaceId);
      setCurrentId(workspaceId);
    },
    [workspaces],
  );

  const currentWorkspace =
    workspaces.find((w) => w.id === currentId) ?? null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        loading,
        error,
        switchWorkspace,
        refetch: loadWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return ctx;
}
