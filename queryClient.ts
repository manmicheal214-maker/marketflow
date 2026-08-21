import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabaseClient";

// ── Static data fallback for GitHub Pages ──
// Used for any endpoint NOT yet backed by a real Supabase table
// (segments, templates, ab-tests, lead-scoring, etc.)
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
        const scoreEvents = contact.scoreEvents || [];
        return { contact, scoreEvents, events };
      }
    }
    return undefined;
  }
  return undefined;
}

// ── Live Supabase adapter ──
// Tables that actually exist in Supabase get queried directly, so the
// deployed static site shows real data instead of the demo snapshot.
// Extend SUPABASE_TABLE_MAP as more tables get built.

const SUPABASE_TABLE_MAP: Record<string, string> = {
  "/api/contacts": "contacts",
  "/api/campaigns": "campaigns",
  "/api/automations": "automations",
  "/api/email-events": "email_events",
};

function isSupabaseBackedKey(queryKey: string): boolean {
  return (
    queryKey in SUPABASE_TABLE_MAP ||
    queryKey.startsWith("/api/contacts/")
  );
}

async function fetchFromSupabase(queryKey: string): Promise<any> {
  if (!supabase) throw new Error("Supabase not configured");

  // Single contact detail: /api/contacts/:id
  if (queryKey.startsWith("/api/contacts/")) {
    const id = queryKey.split("/")[3];
    const { data: contact, error: contactErr } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", id)
      .single();
    if (contactErr) throw contactErr;

    const { data: events } = await supabase
      .from("email_events")
      .select("*")
      .eq("contact_id", id)
      .order("occurred_at", { ascending: false });

    return { contact, scoreEvents: [], events: events ?? [] };
  }

  const table = SUPABASE_TABLE_MAP[queryKey];
  const { data, error } = await supabase
    .from(table)
    .select("*")
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

// ── Mutations ──
// On static hosts with Supabase configured, real mutations go straight to
// Supabase for live-backed tables. Otherwise mutations are simulated
// (matches prior demo behavior) so the UI still responds optimistically.
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
    const [, , resource, id] = url.split("/"); // "/api/contacts/123" -> ["", "api", "contacts", "123"]
    const table = SUPABASE_TABLE_MAP[`/api/${resource}`];

    if (table) {
      if (method === "POST") {
        const { data: inserted, error } = await supabase.from(table).insert(data as any).select().single();
        if (error) throw error;
        return ok(inserted);
      }
      if (method === "PATCH" || method === "PUT") {
        const { data: updated, error } = await supabase.from(table).update(data as any).eq("id", id).select().single();
        if (error) throw error;
        return ok(updated);
      }
      if (method === "DELETE") {
        const { error } = await supabase.from(table).delete().eq("id", id);
        if (error) throw error;
        return ok({ success: true });
      }
    }
  }

  // Non-Supabase-backed resource on a static host: simulate success
  if (method !== "GET" && !API_BASE) {
    return ok({ success: true, simulated: true });
  }

  // Local dev / real Express backend
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

    // 1. Prefer live Supabase data for tables we actually have
    if (isSupabaseConfigured && isSupabaseBackedKey(key)) {
      try {
        return await fetchFromSupabase(key);
      } catch (err) {
        console.warn(`Supabase query failed for ${key}, falling back to demo data:`, err);
        // fall through to demo data below
      }
    }

    // 2. Try the real API (local dev / self-hosted Express backend)
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
        // API not reachable (static host) — fall through to demo data
      }
    }

    // 3. Static demo data fallback
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
