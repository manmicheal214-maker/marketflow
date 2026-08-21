// ============================================================================
// MarketFlow: WorkspaceSwitcher — dropdown to switch between workspaces
// ============================================================================
// Drop this into layout.tsx's header/sidebar. Shows nothing if the person
// only belongs to one workspace (no point switching between one option).
// ============================================================================

import { useWorkspace } from "../hooks/useWorkspace";

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace, loading } = useWorkspace();

  if (loading) {
    return <div className="text-sm text-muted-foreground px-3 py-2">Loading workspace…</div>;
  }

  if (workspaces.length === 0) {
    return null;
  }

  if (workspaces.length === 1) {
    return (
      <div className="text-sm font-medium px-3 py-2 truncate" title={currentWorkspace?.name}>
        {currentWorkspace?.name}
      </div>
    );
  }

  return (
    <select
      className="text-sm font-medium bg-transparent border border-border rounded-md px-3 py-2 w-full"
      value={currentWorkspace?.id ?? ""}
      onChange={(e) => switchWorkspace(e.target.value)}
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name} {w.role !== "owner" ? `(${w.role})` : ""}
        </option>
      ))}
    </select>
  );
}
