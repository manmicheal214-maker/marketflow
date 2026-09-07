// ============================================================================
// MarketFlow: resend-webhook — Supabase Edge Function (workspace-scoped)
// ============================================================================
// Receives Resend webhook events and writes them to email_events, attributing
// each row to a workspace via the X-Workspace-Id header that send-campaign
// set at send time (echoed back by Resend on every event for that email).
//
// This endpoint has no user session (Resend calls it directly), so it can't
// do a membership check the way send-campaign does. Trust boundary instead
// relies on: (a) Svix signature verification below, so only Resend can call
// this, and (b) the workspace_id came from OUR OWN send-campaign function
// originally, not from anything Resend or a third party set independently.
//
// Requires:
//   RESEND_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// Deploy with verify_jwt = false — Resend calls this with no Supabase token.
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

async function verifySvixSignature(
  payload: string,
  svixId: string,
  svixTimestamp: string,
  svixSignature: string,
  secret: string,
): Promise<boolean> {
  const secretBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (c) => c.charCodeAt(0));
  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;

  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));

  const candidates = svixSignature.split(" ").map((s) => s.split(",")[1]);
  return candidates.includes(expected);
}

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
    const valid = await verifySvixSignature(payload, svixId, svixTimestamp, svixSignature, RESEND_WEBHOOK_SECRET);
    if (!valid) return jsonResponse({ error: "Invalid webhook signature" }, 401);
  }

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
    return jsonResponse({ ok: true, skipped: event.type });
  }

  const campaignId = event.data.headers?.["X-Campaign-Id"] ?? null;
  const contactId = event.data.headers?.["X-Contact-Id"] ?? null;
  const workspaceId = event.data.headers?.["X-Workspace-Id"] ?? null;

  if (!workspaceId) {
    console.warn("resend-webhook: event with no X-Workspace-Id header, skipping", event.data.email_id);
    return jsonResponse({ ok: true, skipped: "no workspace_id on event" });
  }

  const metadata: Record<string, unknown> = {};
  if (event.data.click?.link) metadata.link = event.data.click.link;
  if (event.data.bounce?.message) metadata.bounceReason = event.data.bounce.message;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error } = await admin.from("email_events").insert({
    campaign_id: campaignId,
    contact_id: contactId,
    workspace_id: workspaceId,
    resend_email_id: event.data.email_id,
    event_type: eventType,
    metadata,
  });

  if (error) {
    console.error("Failed to insert email_event:", error);
    return jsonResponse({ error: error.message }, 500);
  }

  if ((eventType === "complained" || event.type === "email.bounced") && contactId) {
    await admin
      .from("contacts")
      .update({ status: eventType === "complained" ? "Unsubscribed" : "Inactive" })
      .eq("id", contactId)
      .eq("workspace_id", workspaceId);
  }

  return jsonResponse({ ok: true });
});
