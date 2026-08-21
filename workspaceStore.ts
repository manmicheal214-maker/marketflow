// ============================================================================
// MarketFlow: workspaceStore — current workspace ID, readable outside React
// ============================================================================
// queryClient.ts's query/mutation functions aren't React components, so they
// can't call useContext(). This gives them a plain getter, while
// WorkspaceProvider (React) stays the single writer.
//
// Persisted to localStorage so a refresh doesn't lose which workspace the
// person was looking at.
// ============================================================================

const STORAGE_KEY = "marketflow_current_workspace_id";

let currentWorkspaceId: string | null = null;
try {
  currentWorkspaceId = localStorage.getItem(STORAGE_KEY);
} catch {
  // localStorage unavailable (SSR, privacy mode) — fine, just start null
}

type Listener = (workspaceId: string | null) => void;
const listeners = new Set<Listener>();

export function getCurrentWorkspaceId(): string | null {
  return currentWorkspaceId;
}

export function setCurrentWorkspaceId(id: string | null) {
  currentWorkspaceId = id;
  try {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l(id));
}

export function subscribeToWorkspaceChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
