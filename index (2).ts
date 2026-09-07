// ============================================================================
// MarketFlow: run-automations — Supabase Edge Function (scheduled, internal)
// ============================================================================
// Invoked periodically by pg_cron (see migration `schedule_automation_runner`).
// Not user-facing — authenticated via a shared secret header, not a JWT.
//
// Walks every due enrollment (status='active', next_run_at <= now()) through
// its current automation_step, advances it, and reschedules as needed:
//   - trigger  -> advance immediately, no side effect
//   - send_email -> send via Resend (single send, own unsubscribe link/headers,
//                   same signing scheme as send-campaign), log email_events
//   - wait     -> set next_run_at = now() + duration, stay active
//   - condition -> branch based on a simple check against email_events
//
// Requires: RESEND_API_KEY, UNSUBSCRIBE_SECRET, CRON_SECRET,
//           SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy with verify_jwt = false — auth is via X-Cron-Secret instead.
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const UNSUBSCRIBE_SECRET = Deno.env.get("UNSUBSCRIBE_SECRET");
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BATCH_LIMIT = 50;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function computeUnsubscribeToken(contactId: string, workspaceId: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(UNSUBSCRIBE_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${contactId}:${workspaceId}`));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

function renderMergeTags(template: string, vars: Record<string, string>): string {
  let out = template;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value ?? "");
  }
  return out;
}

Deno.serve(async (req: Request) => {
  if (req.headers.get("X-Cron-Secret") !== CRON_SECRET) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  if (!RESEND_API_KEY || !UNSUBSCRIBE_SECRET) {
    return jsonResponse({ error: "Missing RESEND_API_KEY or UNSUBSCRIBE_SECRET" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: due, error: dueErr } = await admin
    .from("automation_enrollments")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .limit(BATCH_LIMIT);

  if (dueErr) return jsonResponse({ error: dueErr.message }, 500);
  if (!due || due.length === 0) return jsonResponse({ processed: 0 });

  let processed = 0;
  let sent = 0;
  let completed = 0;
  let failed = 0;

  for (const enrollment of due) {
    try {
      const { data: step, error: stepErr } = await admin
        .from("automation_steps")
        .select("*")
        .eq("automation_id", enrollment.automation_id)
        .eq("step_key", enrollment.current_step_key)
        .single();

      if (stepErr || !step) {
        await admin.from("automation_enrollments").update({ status: "failed", last_error: "Step not found" }).eq("id", enrollment.id);
        failed++;
        continue;
      }

      if (step.type === "trigger") {
        await advance(admin, enrollment, step.next_step_key, new Date());
        processed++;
        continue;
      }

      if (step.type === "send_email") {
        const { data: contact } = await admin.from("contacts").select("*").eq("id", enrollment.contact_id).single();

        if (!contact || contact.status === "Unsubscribed") {
          await advance(admin, enrollment, step.next_step_key, new Date());
          processed++;
          continue;
        }

        const token = await computeUnsubscribeToken(contact.id, enrollment.workspace_id);
        const unsubscribeUrl = `${SUPABASE_URL}/functions/v1/unsubscribe?c=${contact.id}&w=${enrollment.workspace_id}&t=${token}`;
        const vars = { contact_name: contact.name ?? "there", unsubscribe_url: unsubscribeUrl };

        const html = renderMergeTags(step.config.html ?? "", vars) +
          `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-family:Arial,sans-serif;font-size:12px;color:#999;text-align:center;"><a href="${unsubscribeUrl}" style="color:#999;">Unsubscribe</a></div>`;

        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
          body: JSON.stringify({
            from: step.config.from,
            to: [contact.email],
            subject: renderMergeTags(step.config.subject ?? "", vars),
            html,
            headers: {
              "X-Automation-Id": enrollment.automation_id,
              "X-Contact-Id": contact.id,
              "X-Workspace-Id": enrollment.workspace_id,
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          }),
        });

        if (!res.ok) {
          await admin.from("automation_enrollments").update({ last_error: `Send failed: ${await res.text()}` }).eq("id", enrollment.id);
          failed++;
          continue;
        }

        const result = await res.json();
        await admin.from("email_events").insert({
          contact_id: contact.id,
          workspace_id: enrollment.workspace_id,
          resend_email_id: result.id ?? null,
          event_type: "sent",
        });

        await advance(admin, enrollment, step.next_step_key, new Date());
        sent++;
        processed++;
        continue;
      }

      if (step.type === "wait") {
        const seconds = step.config.duration_seconds ?? 0;
        const nextRun = new Date(Date.now() + seconds * 1000);
        await admin
          .from("automation_enrollments")
          .update({ current_step_key: step.next_step_key, next_run_at: nextRun.toISOString() })
          .eq("id", enrollment.id);
        processed++;
        continue;
      }

      if (step.type === "condition") {
        let branchKey = step.branch_no_step_key;
        if (step.config.check === "opened_since_enrollment") {
          const { data: opens } = await admin
            .from("email_events")
            .select("id")
            .eq("contact_id", enrollment.contact_id)
            .eq("event_type", "opened")
            .gte("occurred_at", enrollment.enrolled_at)
            .limit(1);
          if (opens && opens.length > 0) branchKey = step.branch_yes_step_key;
        }
        await advance(admin, enrollment, branchKey, new Date());
        processed++;
        continue;
      }
    } catch (err) {
      console.error("Enrollment processing error:", err);
      await admin.from("automation_enrollments").update({ status: "failed", last_error: String(err) }).eq("id", enrollment.id);
      failed++;
    }
  }

  return jsonResponse({ processed, sent, completed, failed });
});

async function advance(admin: ReturnType<typeof createClient>, enrollment: any, nextStepKey: string | null, now: Date) {
  if (!nextStepKey) {
    await admin.from("automation_enrollments").update({ status: "completed" }).eq("id", enrollment.id);
    return;
  }
  await admin
    .from("automation_enrollments")
    .update({ current_step_key: nextStepKey, next_run_at: now.toISOString() })
    .eq("id", enrollment.id);
}
