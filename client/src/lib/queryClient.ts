import { QueryClient, QueryFunction } from "@tanstack/react-query";

// ── Static data fallback for GitHub Pages ──
// When deployed to GitHub Pages (or any static host), there's no backend.
// This module loads a static JSON snapshot of all demo data and serves
// it as query results when API calls fail.

let staticData: Record<string, any> | null = null;

// Query key → static data key mapping
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
    // Determine base path (GitHub Pages serves at /repo-name/)
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
  // Check if it's a sub-resource (e.g., /api/contacts/123)
  if (queryKey.startsWith("/api/contacts/")) {
    const contacts = data["contacts"];
    if (Array.isArray(contacts)) {
      const id = queryKey.split("/")[3];
      const contact = contacts.find((c: any) => String(c.id) === id);
      if (contact) {
        // Build a contact detail object
        const events = (data["emailEvents"] || []).filter(
          (e: any) => String(e.contactId) === id
        );
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

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // On static hosts, simulate mutations locally
  if (method !== "GET" && !API_BASE) {
    return new Response(JSON.stringify({ success: true, simulated: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
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
    const qk = queryKey.join("/");

    // Try real API first (works when backend is running)
    if (API_BASE) {
      try {
        const res = await fetch(`${API_BASE}${qk}`);
        if (unauthorizedBehavior === "returnNull" && res.status === 401) {
          return null;
        }
        await throwIfResNotOk(res);
        return await res.json();
      } catch {
        // Fall through to static data
      }
    }

    // Fall back to static data (GitHub Pages / static hosting)
    const sd = await loadStaticData();
    const result = getStaticData(qk, sd);
    if (result === undefined) {
      throw new Error(`No static data for ${qk}`);
    }
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
    mutations: {
      retry: false,
    },
  },
});
