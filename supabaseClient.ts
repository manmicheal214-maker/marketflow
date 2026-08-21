import { createClient } from "@supabase/supabase-js";

// These are injected at BUILD TIME by Vite from GitHub Actions secrets
// (see .github/workflows/deploy.yml). They are safe to expose in a static
// bundle — the anon/publishable key is designed for client-side use and
// is protected by Row Level Security on every table.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

// If no env vars are set (e.g. local dev without .env, or a demo-only build),
// the app falls back to demo-data.json via queryClient.ts as documented in
// the README. isSupabaseConfigured lets other code branch on this.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;

// Convenience helper for calling the AI Marketing Assistant edge function
// from the client. Throws if Supabase isn't configured.
export async function callAiMarketingAssistant(
  action: "subject_line" | "email_copy" | "campaign_ideas" | "performance_analysis",
  input: Record<string, unknown>,
) {
  if (!supabase) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    );
  }

  const { data, error } = await supabase.functions.invoke(
    "ai-marketing-assistant",
    { body: { action, input } },
  );

  if (error) throw error;
  return data as { action: string; result: Record<string, unknown> };
}
