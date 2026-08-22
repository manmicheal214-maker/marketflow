import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getCurrentWorkspaceId } from "@/lib/workspace";

// ── Static data fallback for GitHub Pages ──
// Live Supabase tables are used for the workspace-scoped resources below.
// All other resources retain the existing demo snapshot fallback.

let staticData: Record<string, any> | null = null;

const keyMap: Record<string, string> = {
  "/api/auth/me": "auth",
  "/api/dashboard": "dashboard",
  "/api/contacts": "contacts",
  "/api/segments": "segments",
  "/api/campaigns": "campaigns",
  "/api/templates": "templates",
  "/api/email-events": "emailEvents",
  "/api/automations": "automations",
  "/api/ab-tests": "abTests",
  "/api/lead-scoring/rules": "leadScoringRules",
  "/api/lead-scoring/distribution": "leadScoringDistribution",
  "/api/analytics": "analytics",
};

const SUPABASE_TABLE_MAP: Record<string, string> = {
  "/api/contacts": "contacts",
  "/api/campaigns": "campaigns",
  "/api/automations": "automations",
  "/api/email-events": "email_events",
};

async function loadStaticData(): Promise<Record<string, any>> {
  if (staticData) return staticData;
  try {
    const base = import.meta.env.BASE_URL || "/";
    const res = await fetch(`${base}demo-data.json`);
    staticData = await res.json();
    return staticData!;
  } catch {
    staticData = {};
    return staticData;
  }
}

function getStaticData(queryKey: string, data: Record<string, any>): any | undefined {
  const key = keyMap[queryKey];
  if (key && data[key] !== undefined) return data[key];
  if (queryKey.startsWith("/api/contacts/")) {
    const contacts = data["contacts"];
    if (Array.isArray(contacts)) {
      const id = queryKey.split("/")[3];
      const contact = contacts.find((c: any) => String(c.id) === id);
      if (contact) {
        const events = (data["emailEvents"] || []).filter((e: any) => String(e.contactId) === id);
        const scoreEvents = (contact.scoreEvents || []);
        return { contact, scoreEvents, events };
      }
    }
    return undefined;
  }
  return undefined;
}

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function liveTableForUrl(url: string): { table: string; id?: string } | null {
  const exact = SUPABASE_TABLE_MAP[url];
  if (exact) return { table: exact };
  if (url.startsWith("/api/contacts/")) {
    const id = url.slice("/api/contacts/".length).split("/")[0];
    if (id) return { table: "contacts", id };
  }
  return null;
}

function responseFromJson(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function apiRequest(method: string, url: string, data?: unknown | undefined): Promise<Response> {
  const live = isSupabaseConfigured ? liveTableForUrl(url) : null;

  if (live) {
    const workspaceId = getCurrentWorkspaceId();
    if (!workspaceId) {
      throw new Error("No workspace selected. Please select a workspace and try again.");
    }

    const payload = data && typeof data === "object" ? { ...(data as Record<string, unknown>) } : {};
    delete payload.workspace_id;

    if (method === "POST") {
      const { data: inserted, error } = await supabase
        .from(live.table)
        .insert({ ...payload, workspace_id: workspaceId })
        .select()
        .single();
      if (error) throw error;
      return responseFromJson(inserted, 201);
    }

    if (live.id && (method === "PATCH" || method === "PUT")) {
      const { data: updated, error } = await supabase
        .from(live.table)
        .update(payload)
        .eq("id", live.id)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
      if (error) throw error;
      return responseFromJson(updated);
    }

    if (live.id && method === "DELETE") {
      const { data: deleted, error } = await supabase
        .from(live.table)
        .delete()
        .eq("id", live.id)
        .eq("workspace_id", workspaceId)
        .select();
      if (error) throw error;
      return responseFromJson(deleted);
    }
  }

  // Preserve the existing static-host behavior for resources that are not live yet.
  if (method !== "GET" && !API_BASE) {
    return responseFromJson({ success: true, simulated: true });
  }

  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const qk = queryKey.join("/");
    const live = isSupabaseConfigured ? liveTableForUrl(qk) : null;

    if (live) {
      const workspaceId = getCurrentWorkspaceId();
      // Do not show another tenant's demo snapshot while workspace context is loading.
      if (!workspaceId) return null;

      try {
        if (live.id) {
          const [contactResult, eventsResult] = await Promise.all([
            supabase.from("contacts").select("*").eq("id", live.id).eq("workspace_id", workspaceId).single(),
            supabase.from("email_events").select("*").eq("contact_id", live.id).eq("workspace_id", workspaceId).order("occurred_at", { ascending: false }),
          ]);
          if (contactResult.error) throw contactResult.error;
          if (eventsResult.error) throw eventsResult.error;
          return { contact: contactResult.data, scoreEvents: [], events: eventsResult.data ?? [] } as T;
        }

        const { data, error } = await supabase
          .from(live.table)
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false });
        if (error) throw error;
        return (data ?? []) as T;
      } catch (error) {
        console.warn(`Supabase query failed for ${qk}; falling back to demo data.`, error);
      }
    }

    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}${qk}`);
        if (unauthorizedBehavior === "returnNull" && res.status === 401) return null;
        await throwIfResNotOk(res);
        return await res.json();
      } catch {
        // Fall through to static data.
      }
    }

    const sd = await loadStaticData();
    const result = getStaticData(qk, sd);
    if (result === undefined) throw new Error(`No static data for ${qk}`);
    return result;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: { retry: false },
  },
});
