export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatPercent(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`;
}

export function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export function parseJSON<T>(str: string, fallback: T): T {
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

export function getScoreTier(score: number): { label: string; color: string } {
  if (score <= 10) return { label: "Cold", color: "text-slate-500" };
  if (score <= 25) return { label: "Warm", color: "text-amber-500" };
  if (score <= 50) return { label: "Hot", color: "text-orange-500" };
  return { label: "Sales Ready", color: "text-green-600" };
}

export function getStatusColor(status: string): string {
  switch (status) {
    case "Customer": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "Interested": return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "Lead": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    case "Inactive": return "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400";
    case "Unsubscribed": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
    default: return "bg-slate-100 text-slate-600";
  }
}

export function getCampaignStatusColor(status: string): string {
  switch (status) {
    case "Sent": return "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "Draft": return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    case "Scheduled": return "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "Sending": return "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
    case "Cancelled": return "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400";
    default: return "bg-slate-100 text-slate-600";
  }
}
