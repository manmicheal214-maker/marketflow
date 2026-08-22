import { supabase } from "@/lib/supabase";

export type Workspace = {
  id: string;
  name: string;
  slug?: string | null;
  created_at?: string;
};

const STORAGE_KEY = "marketflow_current_workspace_id";

export function getCurrentWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function setCurrentWorkspaceId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(STORAGE_KEY, id);
  else window.localStorage.removeItem(STORAGE_KEY);
}

export async function fetchMyWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(id,name,slug,created_at)")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<{ workspace: Workspace | Workspace[] | null }>)
    .flatMap(({ workspace }) => Array.isArray(workspace) ? workspace : workspace ? [workspace] : []);
}
