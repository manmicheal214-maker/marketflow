// ============================================================================
// MarketFlow: notify-automation-event — Supabase Edge Function
// ============================================================================
// Generic bridge: Postgres triggers (or the app itself) call this with a
// trigger name + contact info, and it forwards a matching event to Resend
// to fire whichever automation is listening for it.
//
// POST body: {
//   "eventName": "contact.added",   // must match an automations.resend_event_name
//   "contactEmail": "jane@x.com",
//   "contactName": "Jane",
//   "contactId": "<uuid>"           // optional, our internal contacts.id
// }
//
// Requires:
//   RESEND_API_KEY (same key used by send-campaign — needs event-sending access)
//
// Deployed with verify_jwt = false because Postgres (via pg_net) calls this
// with no Supabase auth token. It's low-risk: worst case someone fires a
// welcome email early: still, keep this endpoint's URL out of public docs.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  if (!RESEND_API_KEY) {
    return jsonResponse({ error: "RESEND_API_KEY is not configured" }, 500);
  }

  let body: {
    eventName?: string;
    contactEmail?: string;
    contactName?: string;
    contactId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.eventName || !body.contactEmail) {
    return jsonResponse({ error: "eventName and contactEmail are required" }, 400);
  }

  const res = await fetch("https://api.resend.com/events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      event: body.eventName,
      email: body.contactEmail,
      payload: {
        contactName: body.contactName ?? "",
        contactId: body.contactId ?? "",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Resend event send failed:", errText);
    return jsonResponse({ error: `Resend error (${res.status}): ${errText}` }, 500);
  }

  return jsonResponse({ ok: true, event: body.eventName });
});
