// ============================================================================
// MarketFlow: resend-webhook — Supabase Edge Function
// ============================================================================
// Receives Resend webhook events (email.delivered, email.opened,
// email.clicked, email.bounced, email.complained, email.delivery_delayed)
// and writes them to email_events, matched back to campaign/contact via the
// X-Campaign-Id / X-Contact-Id headers set at send time in send-campaign.
//
// Verifies the Svix signature Resend attaches to every webhook so random
// POSTs to this URL can't inject fake events.
//
// Requires these secrets set on the project:
//   RESEND_WEBHOOK_SECRET       (whsec_... from Resend webhook settings)
//   SUPABASE_URL                (auto-injected)
//   SUPABASE_SERVICE_ROLE_KEY   (auto-injected)
//
// IMPORTANT: this function must be deployed with verify_jwt = false, since
// Resend calls it directly without a Supabase auth token — the Svix
// signature check below is what authenticates the request instead.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_WEBHOOK_SECRET = Deno.env.get("RESEND_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// --- Svix signature verification (no external deps) ---
async function verifySvixSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const secretBytes = Uint8Array.from(
    atob(secret.replace(/^whsec_/, "")),
    (c) => c.charCodeAt(0),
  );
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signedContent),
  );
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  // svix-signature header format: "v1,<sig> v1,<sig2> ..."
  const candidates = svixSignature.split(" ").map((s) => s.split(",")[1]);
  return candidates.includes(expected);
}

// Map Resend event types -> our email_events.event_type values
const EVENT_TYPE_MAP: Record<string, string> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "failed",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const payload = await req.text();
  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (RESEND_WEBHOOK_SECRET) {
    if (!svixId || !svixTimestamp || !svixSignature) {
      return jsonResponse({ error: "Missing Svix signature headers" }, 401);
    }
    const valid = await verifySvixSignature(
      payload,
      svixId,
      svixTimestamp,
      svixSignature,
      RESEND_WEBHOOK_SECRET,
    );
    if (!valid) {
      return jsonResponse({ error: "Invalid webhook signature" }, 401);
    }
  }
  // If no secret is configured yet, we still accept events (useful while
  // wiring things up) — but you should set RESEND_WEBHOOK_SECRET ASAP.

  let event: {
    type: string;
    data: {
      email_id: string;
      headers?: Record<string, string>;
      click?: { link?: string };
      bounce?: { message?: string };
    };
  };
  try {
    event = JSON.parse(payload);
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const eventType = EVENT_TYPE_MAP[event.type];
  if (!eventType) {
    // Not an event type we track (e.g. contact.created) — acknowledge and skip
    return jsonResponse({ ok: true, skipped: event.type });
  }

  const campaignId = event.data.headers?.["X-Campaign-Id"] ?? null;
  const contactId = event.data.headers?.["X-Contact-Id"] ?? null;

  const metadata: Record<string, unknown> = {};
  if (event.data.click?.link) metadata.link = event.data.click.link;
  if (event.data.bounce?.message) metadata.bounceReason = event.data.bounce.message;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await supabase.from("email_events").insert({
    campaign_id: campaignId,
    contact_id: contactId,
    resend_email_id: event.data.email_id,
    event_type: eventType,
    metadata,
  });

  if (error) {
    console.error("Failed to insert email_event:", error);
    return jsonResponse({ error: error.message }, 500);
  }

  // Auto-update contact status on unsubscribe/complaint
  if ((eventType === "complained" || event.type === "email.bounced") && contactId) {
    await supabase
      .from("contacts")
      .update({ status: eventType === "complained" ? "Unsubscribed" : "Inactive" })
      .eq("id", contactId);
  }

  return jsonResponse({ ok: true });
});
