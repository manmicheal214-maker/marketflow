// ============================================================================
// MarketFlow: send-campaign — Supabase Edge Function
// ============================================================================
// POST body: { "campaignId": "<uuid>" }
//
// - Loads the campaign + its target contacts from Supabase (service role,
//   bypasses RLS since this runs server-side)
// - Sends via Resend's batch send API (up to 100 per batch, chunked)
// - Writes a 'sent' row to email_events per contact
// - Updates campaign status -> Sending -> Sent
//
// Requires these secrets set on the project:
//   RESEND_API_KEY            (sending-access key from Resend)
//   SUPABASE_URL               (auto-injected by Supabase)
//   SUPABASE_SERVICE_ROLE_KEY  (auto-injected by Supabase)
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!RESEND_API_KEY) {
    return jsonResponse(
      { error: "RESEND_API_KEY is not configured. Set it with `supabase secrets set RESEND_API_KEY=re_...`" },
      500,
    );
  }

  let body: { campaignId?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.campaignId) {
    return jsonResponse({ error: "campaignId is required" }, 400);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Load campaign
  const { data: campaign, error: campaignErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", body.campaignId)
    .single();

  if (campaignErr || !campaign) {
    return jsonResponse({ error: "Campaign not found" }, 404);
  }

  if (campaign.status === "Sent" || campaign.status === "Sending") {
    return jsonResponse({ error: `Campaign already ${campaign.status}` }, 409);
  }

  // 2. Load target contacts (optionally filtered by status)
  let query = supabase.from("contacts").select("id, email, name, status").not("email", "is", null);
  if (campaign.target_status) {
    query = query.eq("status", campaign.target_status);
  }
  const { data: contacts, error: contactsErr } = await query;

  if (contactsErr) {
    return jsonResponse({ error: `Failed to load contacts: ${contactsErr.message}` }, 500);
  }
  if (!contacts || contacts.length === 0) {
    return jsonResponse({ error: "No target contacts found for this campaign" }, 400);
  }

  // Mark as Sending
  await supabase.from("campaigns").update({ status: "Sending" }).eq("id", campaign.id);

  // 3. Send in batches of 100 via Resend batch API
  const batches = chunk(contacts, 100);
  const sentContactIds: string[] = [];
  const errors: string[] = [];

  for (const batch of batches) {
    const payload = batch.map((c) => ({
      from: campaign.from_address,
      to: [c.email],
      subject: campaign.subject,
      html: campaign.html_body,
      // Tag lets us match Resend webhook events back to this contact/campaign
      headers: {
        "X-Campaign-Id": campaign.id,
        "X-Contact-Id": c.id,
      },
    }));

    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      errors.push(`Batch failed (${res.status}): ${errText}`);
      continue;
    }

    const result = await res.json();
    const emailIds: string[] = (result.data ?? []).map((d: { id: string }) => d.id);

    // 4. Log 'sent' events, one per contact, storing the Resend email id
    const eventRows = batch.map((c, i) => ({
      campaign_id: campaign.id,
      contact_id: c.id,
      resend_email_id: emailIds[i] ?? null,
      event_type: "sent",
    }));

    const { error: insertErr } = await supabase.from("email_events").insert(eventRows);
    if (insertErr) errors.push(`Failed to log events: ${insertErr.message}`);

    sentContactIds.push(...batch.map((c) => c.id));
  }

  // 5. Mark campaign Sent
  await supabase
    .from("campaigns")
    .update({ status: "Sent", sent_at: new Date().toISOString() })
    .eq("id", campaign.id);

  return jsonResponse({
    campaignId: campaign.id,
    sentCount: sentContactIds.length,
    totalTargeted: contacts.length,
    errors: errors.length > 0 ? errors : undefined,
  });
});
