// ============================================================================
// MarketFlow: send-campaign — Supabase Edge Function
// ============================================================================
// Adds merge-tag rendering ({{name}}, {{contact_name}}, {{email}},
// {{company_name}}, {{unsubscribe_url}}) on top of the existing
// workspace-authorization + atomic-claim + unsubscribe-header logic.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function computeUnsubscribeToken(contactId: string, workspaceId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(UNSUBSCRIBE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${contactId}:${workspaceId}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function buildUnsubscribeUrl(contactId: string, workspaceId: string, token: string): string {
  return `${SUPABASE_URL}/functions/v1/unsubscribe?c=${contactId}&w=${workspaceId}&t=${token}`;
}

function renderMergeTags(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, tag) => {
    const key = tag.toLowerCase();
    return key in vars ? vars[key] : match;
  });
}

function injectUnsubscribeLink(html: string, unsubscribeUrl: string): string {
  if (html.includes("{{unsubscribe_url}}")) return html;
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#999;text-align:center;">
    <a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a> from these emails.
  </div>`;
  return html + footer;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!RESEND_API_KEY) return jsonResponse({ error: "RESEND_API_KEY is not configured" }, 500);
  if (!UNSUBSCRIBE_SECRET) return jsonResponse({ error: "UNSUBSCRIBE_SECRET is not configured" }, 500);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Missing Authorization header" }, 401);

  let body: { campaignId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }
  if (!body.campaignId) return jsonResponse({ error: "campaignId is required" }, 400);

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) return jsonResponse({ error: "Invalid or expired session" }, 401);

  const { data: campaignCheck, error: checkErr } = await userClient
    .from("campaigns").select("id, workspace_id, status").eq("id", body.campaignId).single();

  if (checkErr || !campaignCheck) return jsonResponse({ error: "Campaign not found" }, 404);
  if (!campaignCheck.workspace_id) return jsonResponse({ error: "Campaign has no workspace_id set" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: claimed, error: claimErr } = await admin
    .from("campaigns").update({ status: "Sending" }).eq("id", body.campaignId).eq("status", "Draft").select("*").maybeSingle();

  if (claimErr) return jsonResponse({ error: `Failed to claim campaign: ${claimErr.message}` }, 500);
  if (!claimed) return jsonResponse({ error: "Campaign is not in Draft status — already sent, sending, or cancelled" }, 409);

  const campaign = claimed;

  const { data: workspace } = await admin.from("workspaces").select("name").eq("id", campaign.workspace_id).single();
  const companyName = workspace?.name ?? "";

  let query = admin.from("contacts").select("id, email, name, status")
    .eq("workspace_id", campaign.workspace_id).not("email", "is", null).neq("status", "Unsubscribed");
  if (campaign.target_status) query = query.eq("status", campaign.target_status);

  const { data: contacts, error: contactsErr } = await query;

  if (contactsErr) {
    await admin.from("campaigns").update({ status: "Draft" }).eq("id", campaign.id);
    return jsonResponse({ error: `Failed to load contacts: ${contactsErr.message}` }, 500);
  }
  if (!contacts || contacts.length === 0) {
    await admin.from("campaigns").update({ status: "Draft" }).eq("id", campaign.id);
    return jsonResponse({ error: "No target contacts found in this workspace for this campaign" }, 400);
  }

  const batches = chunk(contacts, 100);
  const sentContactIds: string[] = [];
  const errors: string[] = [];

  for (const batch of batches) {
    const payload = await Promise.all(
      batch.map(async (c) => {
        const token = await computeUnsubscribeToken(c.id, campaign.workspace_id);
        const unsubscribeUrl = buildUnsubscribeUrl(c.id, campaign.workspace_id, token);

        const mergeVars: Record<string, string> = {
          name: c.name ?? "there",
          contact_name: c.name ?? "there",
          first_name: (c.name ?? "there").split(" ")[0],
          email: c.email,
          company_name: companyName,
          unsubscribe_url: unsubscribeUrl,
          login_url: SUPABASE_URL,
        };

        const renderedHtml = injectUnsubscribeLink(renderMergeTags(campaign.html_body, mergeVars), unsubscribeUrl);
        const renderedSubject = renderMergeTags(campaign.subject, mergeVars);

        return {
          from: campaign.from_address,
          to: [c.email],
          subject: renderedSubject,
          html: renderedHtml,
          headers: {
            "X-Campaign-Id": campaign.id,
            "X-Contact-Id": c.id,
            "X-Workspace-Id": campaign.workspace_id,
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        };
      }),
    );

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      errors.push(`Batch failed (${res.status}): ${await res.text()}`);
      continue;
    }

    const result = await res.json();
    const emailIds: string[] = (result.data ?? []).map((d: { id: string }) => d.id);

    const eventRows = batch.map((c, i) => ({
      campaign_id: campaign.id, contact_id: c.id, workspace_id: campaign.workspace_id,
      resend_email_id: emailIds[i] ?? null, event_type: "sent",
    }));

    const { error: insertErr } = await admin.from("email_events").insert(eventRows);
    if (insertErr) errors.push(`Failed to log events: ${insertErr.message}`);

    sentContactIds.push(...batch.map((c) => c.id));
  }

  const finalStatus = sentContactIds.length > 0 ? "Sent" : "Draft";
  await admin.from("campaigns")
    .update({ status: finalStatus, sent_at: finalStatus === "Sent" ? new Date().toISOString() : null })
    .eq("id", campaign.id);

  return jsonResponse({
    campaignId: campaign.id, workspaceId: campaign.workspace_id,
    sentCount: sentContactIds.length, totalTargeted: contacts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
