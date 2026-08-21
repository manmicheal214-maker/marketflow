export const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export function apiUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  return fetch(apiUrl(path), { ...init, credentials: "include", headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...(init.headers || {}) } });
}

export async function readApiResponse<T = any>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error(response.ok ? "The API returned an unexpected response." : `API request failed (${response.status}). Check the backend URL.`);
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "API request failed");
  return body;
}
