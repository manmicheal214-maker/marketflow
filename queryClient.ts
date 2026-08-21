import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabaseClient";
import { getCurrentWorkspaceId } from "./workspaceStore";

// ── Static data fallback for GitHub Pages ──
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
        const events = (data["emailEvents"] || []).filter(
          (e: any) => String(e.contactId) === id
        );
        return { contact, scoreEvents: contact.scoreEvents || [], events };
      }
    }
    return undefined;
  }
  return undefined;
}

// ── Live Supabase adapter, scoped by workspace ──
const SUPABASE_TABLE_MAP: Record<string, string> = {
  "/api/contacts": "contacts",
  "/api/campaigns": "campaigns",
  "/api/automations": "automations",
  "/api/email-events": "email_events",
};

function isSupabaseBackedKey(queryKey: string): boolean {
  return queryKey in SUPABASE_TABLE_MAP || queryKey.startsWith("/api/contacts/");
}

class NoWorkspaceError extends Error {
  constructor() {
    super("No current workspace selected");
    this.name = "NoWorkspaceError";
  }
}

async function fetchFromSupabase(queryKey: string): Promise<any> {
  if (!supabase) throw new Error("Supabase not configured");

  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) throw new NoWorkspaceError();

  // Single contact detail: /api/contacts/:id
  if (queryKey.startsWith("/api/contacts/")) {
    const id = queryKey.split("/")[3];
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .eq("workspace_id", workspaceId) // belt-and-suspenders on top of RLS
      .single();
    if (contactErr) throw contactErr;

    const { data: events } = await supabase
      .from("email_events")
      .select("*")
      .eq("contact_id", id)
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false });

    return { contact, scoreEvents: [], events: events ?? [] };
  }

  const table = SUPABASE_TABLE_MAP[queryKey];
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

// ── Mutations, workspace-scoped ──
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const ok = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  if (isSupabaseConfigured && supabase && method !== "GET") {
    const [, , resource, id] = url.split("/");
    const table = SUPABASE_TABLE_MAP[`/api/${resource}`];

    if (table) {
      const workspaceId = getCurrentWorkspaceId();
      if (!workspaceId) {
        throw new NoWorkspaceError();
      }

      if (method === "POST") {
        // Stamp workspace_id on every insert — never trust the caller to
        // have included it, and never let it be overridden by request data.
        const payload = { ...(data as object), workspace_id: workspaceId };
        const { data: inserted, error } = await supabase
          .from(table)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return ok(inserted);
      }
      if (method === "PATCH" || method === "PUT") {
        const { data: updated, error } = await supabase
          .from(table)
          .update(data as any)
          .eq("id", id)
          .eq("workspace_id", workspaceId) // can't accidentally patch another workspace's row
          .select()
          .single();
        if (error) throw error;
        return ok(updated);
      }
      if (method === "DELETE") {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq("id", id)
          .eq("workspace_id", workspaceId);
        if (error) throw error;
        return ok({ success: true });
      }
    }
  }

  if (method !== "GET" && !API_BASE) {
    return ok({ success: true, simulated: true });
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
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const key = queryKey[0] as string;

    if (isSupabaseConfigured && isSupabaseBackedKey(key)) {
      try {
        return await fetchFromSupabase(key);
      } catch (err) {
        if (err instanceof NoWorkspaceError) {
          // Don't fall back to demo data here — an empty/loading state is
          // more honest than showing another tenant's shape of data while
          // workspace membership is still loading.
          return null;
        }
        console.warn(`Supabase query failed for ${key}, falling back to demo data:`, err);
      }
    }

    if (API_BASE || !isSupabaseConfigured) {
      try {
        const res = await fetch(`${API_BASE}${key}`);
        if (res.status === 401) {
          if (unauthorizedBehavior === "returnNull") return null;
          throw new Error("401: Unauthorized");
        }
        await throwIfResNotOk(res);
        return await res.json();
      } catch {
        // fall through to demo data
      }
    }

    const data = await loadStaticData();
    const result = getStaticData(key, data);
    if (result === undefined && unauthorizedBehavior === "throw") {
      throw new Error(`No data available for ${key}`);
    }
    return result ?? null;
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
    mutations: {
      retry: false,
    },
  },
});
