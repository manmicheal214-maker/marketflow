// ============================================================================
// MarketFlow: AI Marketing Assistant — Supabase Edge Function
// ============================================================================
// Handles four actions (matches README spec):
//   - subject_line        { product, discount?, audience }
//   - email_copy          { product, discount?, audience, goal? }
//   - campaign_ideas       { product, audience, goal, budget, channel }
//   - performance_analysis { campaignName, metrics: { openRate, clickRate,
//                             unsubscribeRate, sent, ... }, benchmark? }
//
// Requires the OPENAI_API_KEY secret to be set on the project:
//   supabase secrets set OPENAI_API_KEY=sk-...
//
// Call it with:
//   POST /functions/v1/ai-marketing-assistant
//   Authorization: Bearer <user JWT or anon key>
//   { "action": "subject_line", "input": { ... } }
// ============================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-4o-mini";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Action =
  | "subject_line"
  | "email_copy"
  | "campaign_ideas"
  | "performance_analysis";

interface RequestBody {
  action: Action;
  input: Record<string, unknown>;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Builds the system + user prompt per action, and tells the model to return JSON only.
function buildPrompt(action: Action, input: Record<string, unknown>) {
  switch (action) {
    case "subject_line":
      return {
        system:
          "You are an email marketing copywriter. Return ONLY valid JSON, no markdown, no preamble.",
        user: `Generate 5 email subject lines for this campaign.
Product: ${input.product}
Discount: ${input.discount ?? "none"}
Audience: ${input.audience}

Respond as JSON: { "subjectLines": string[] }`,
      };
    case "email_copy":
      return {
        system:
          "You are an email marketing copywriter. Return ONLY valid JSON, no markdown, no preamble.",
        user: `Write marketing email copy.
Product: ${input.product}
Discount: ${input.discount ?? "none"}
Audience: ${input.audience}
Goal: ${input.goal ?? "drive conversions"}

Respond as JSON: { "subject": string, "preview": string, "body": string, "cta": string }`,
      };
    case "campaign_ideas":
      return {
        system:
          "You are a digital marketing strategist. Return ONLY valid JSON, no markdown, no preamble.",
        user: `Generate 3 campaign ideas.
Product: ${input.product}
Audience: ${input.audience}
Goal: ${input.goal}
Budget: ${input.budget}
Channel: ${input.channel}

Respond as JSON: { "ideas": [{ "title": string, "description": string, "estimatedImpact": string }] }`,
      };
    case "performance_analysis":
      return {
        system:
          "You are a marketing analyst. Return ONLY valid JSON, no markdown, no preamble.",
        user: `Analyze this campaign's performance and explain likely causes.
Campaign: ${input.campaignName}
Metrics: ${JSON.stringify(input.metrics)}
Benchmark (if any): ${JSON.stringify(input.benchmark ?? {})}

Respond as JSON: { "summary": string, "possibleCauses": string[], "supportingMetrics": string[], "recommendedActions": string[] }`,
      };
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function callOpenAI(action: Action, input: Record<string, unknown>) {
  const { system, user } = buildPrompt(action, input);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? "{}";

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Model did not return valid JSON");
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse(
      {
        error:
          "OPENAI_API_KEY is not configured. Set it with `supabase secrets set OPENAI_API_KEY=sk-...`",
      },
      500,
    );
  }

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { action, input } = body;
  const validActions: Action[] = [
    "subject_line",
    "email_copy",
    "campaign_ideas",
    "performance_analysis",
  ];

  if (!action || !validActions.includes(action)) {
    return jsonResponse(
      { error: `action must be one of: ${validActions.join(", ")}` },
      400,
    );
  }

  if (!input || typeof input !== "object") {
    return jsonResponse({ error: "input object is required" }, 400);
  }

  try {
    const result = await callOpenAI(action, input);
    return jsonResponse({ action, result });
  } catch (err) {
    console.error(err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Unknown error" },
      500,
    );
  }
});
