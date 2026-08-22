import { supabase } from "./supabase";

export interface Workspace {
  id: string;
  name: string;
  slug: string | null;
  owner_id: string;
  role: "owner" | "admin" | "member";
}

const STORAGE_KEY = "marketflow_current_workspace_id";

export function getCurrentWorkspaceId(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

export function setCurrentWorkspaceId(id: string | null) {
  try { id ? localStorage.setItem(STORAGE_KEY, id) : localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}

export async function fetchMyWorkspaces(): Promise<Workspace[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name, slug, owner_id)")
    .eq("user_id", user.id);

  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.workspaces)
    .map((row: any) => ({
      id: row.workspaces.id,
      name: row.workspaces.name,
      slug: row.workspaces.slug,
      owner_id: row.workspaces.owner_id,
      role: row.role,
    }));
}
