// ============================================================================
// MarketFlow: notify-automation-event — Supabase Edge Function
// ============================================================================
// NOTE (as of the automation-runner rebuild): this function is DEAD CODE.
// handle_new_contact() now enrolls contacts directly via a SQL insert into
// automation_enrollments, and no longer calls this function via pg_net.
// Left deployed for reference/rollback only — safe to delete entirely.
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
    workspaceId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!body.eventName || !body.contactEmail) {
    return jsonResponse({ error: "eventName and contactEmail are required" }, 400);
  }

  if (!body.workspaceId) {
    console.warn("notify-automation-event: missing workspaceId for", body.contactEmail);
  }

  const res = await fetch("https://api.resend.com/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
    body: JSON.stringify({
      event: body.eventName,
      email: body.contactEmail,
      payload: {
        contactName: body.contactName ?? "",
        contactId: body.contactId ?? "",
        workspaceId: body.workspaceId ?? "",
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
