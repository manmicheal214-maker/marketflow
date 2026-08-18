import type { Express } from "express";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  getDashboardStats, getContactGrowthSeries, getCampaignPerformance,
  getMarketingFunnel, getMarketingInsights, getEngagementBySegment,
} from "./analytics";
import { insertContactSchema, insertSegmentSchema, insertCampaignSchema, insertTemplateSchema, insertAutomationSchema, insertAbTestSchema } from "@shared/schema";

const DEMO_USER_ID = 1;

export async function registerRoutes(
  _httpServer: Server,
  app: Express
): Promise<Server> {
  // Ensure demo data is seeded on first request
  app.use(async (_req, _res, next) => {
    try {
      await storage.getDemoUser();
    } catch (e) {
      console.error("[seed] error:", e);
    }
    next();
  });

  /* ── Auth (demo) ── */
  app.get("/api/auth/me", async (_req, res) => {
    const user = await storage.getDemoUser();
    res.json(user);
  });

  app.post("/api/auth/login", async (_req, res) => {
    const user = await storage.getDemoUser();
    res.json(user);
  });

  app.post("/api/auth/logout", async (_req, res) => {
    res.json({ success: true });
  });

  /* ── Dashboard / Analytics ── */
  app.get("/api/dashboard", async (_req, res) => {
    const stats = getDashboardStats(DEMO_USER_ID);
    const growth = getContactGrowthSeries(DEMO_USER_ID);
    const performance = getCampaignPerformance(DEMO_USER_ID);
    const funnel = getMarketingFunnel(DEMO_USER_ID);
    const insights = getMarketingInsights(DEMO_USER_ID);
    const engagementBySegment = getEngagementBySegment(DEMO_USER_ID);
    const events = await storage.getEmailEvents(DEMO_USER_ID, 10);
    res.json({ stats, growth, performance, funnel, insights, engagementBySegment, events });
  });

  app.get("/api/analytics", async (_req, res) => {
    const stats = getDashboardStats(DEMO_USER_ID);
    const growth = getContactGrowthSeries(DEMO_USER_ID);
    const performance = getCampaignPerformance(DEMO_USER_ID);
    const funnel = getMarketingFunnel(DEMO_USER_ID);
    const engagementBySegment = getEngagementBySegment(DEMO_USER_ID);
    const campaigns = await storage.getCampaigns(DEMO_USER_ID);
    res.json({ stats, growth, performance, funnel, engagementBySegment, campaigns });
  });

  /* ── Contacts ── */
  app.get("/api/contacts", async (_req, res) => {
    const contacts = await storage.getContacts(DEMO_USER_ID);
    res.json(contacts);
  });

  app.get("/api/contacts/:id", async (req, res) => {
    const contact = await storage.getContact(parseInt(req.params.id));
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    const scoreEvents = await storage.getLeadScoreEvents(contact.id);
    const events = (await storage.getEmailEvents(DEMO_USER_ID, 500)).filter(e => e.contactId === contact.id).slice(0, 20);
    res.json({ contact, scoreEvents, events });
  });

  app.post("/api/contacts", async (req, res) => {
    const parsed = insertContactSchema.safeParse({ ...req.body, userId: DEMO_USER_ID });
    if (!parsed.success) return res.status(400).json({ message: "Invalid contact data", errors: parsed.error.issues });
    // Check duplicate email
    const existing = (await storage.getContacts(DEMO_USER_ID)).find(c => c.email.toLowerCase() === parsed.data.email.toLowerCase());
    if (existing) return res.status(409).json({ message: "A contact with this email already exists" });
    const contact = await storage.createContact(parsed.data);
    res.status(201).json(contact);
  });

  app.put("/api/contacts/:id", async (req, res) => {
    const id = parseInt(req.params.id);
    const contact = await storage.updateContact(id, req.body);
    if (!contact) return res.status(404).json({ message: "Contact not found" });
    res.json(contact);
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    await storage.deleteContact(parseInt(req.params.id));
    res.json({ success: true });
  });

  /* ── Segments ── */
  app.get("/api/segments", async (_req, res) => {
    const segments = await storage.getSegments(DEMO_USER_ID);
    const allContacts = await storage.getContacts(DEMO_USER_ID);
    // Compute matching count for each segment
    const result = segments.map(seg => {
      const count = computeSegmentCount(allContacts, seg);
      return { ...seg, contactCount: count };
    });
    res.json(result);
  });

  app.post("/api/segments", async (req, res) => {
    const parsed = insertSegmentSchema.safeParse({ ...req.body, userId: DEMO_USER_ID });
    if (!parsed.success) return res.status(400).json({ message: "Invalid segment data", errors: parsed.error.issues });
    const segment = await storage.createSegment(parsed.data);
    res.status(201).json(segment);
  });

  app.put("/api/segments/:id", async (req, res) => {
    const segment = await storage.updateSegment(parseInt(req.params.id), req.body);
    if (!segment) return res.status(404).json({ message: "Segment not found" });
    res.json(segment);
  });

  app.delete("/api/segments/:id", async (req, res) => {
    await storage.deleteSegment(parseInt(req.params.id));
    res.json({ success: true });
  });

  /* ── Campaigns ── */
  app.get("/api/campaigns", async (_req, res) => {
    const campaigns = await storage.getCampaigns(DEMO_USER_ID);
    res.json(campaigns);
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    const campaign = await storage.getCampaign(parseInt(req.params.id));
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(campaign);
  });

  app.post("/api/campaigns", async (req, res) => {
    const parsed = insertCampaignSchema.safeParse({ ...req.body, userId: DEMO_USER_ID });
    if (!parsed.success) return res.status(400).json({ message: "Invalid campaign data", errors: parsed.error.issues });
    const campaign = await storage.createCampaign(parsed.data);
    res.status(201).json(campaign);
  });

  app.put("/api/campaigns/:id", async (req, res) => {
    const campaign = await storage.updateCampaign(parseInt(req.params.id), req.body);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    res.json(campaign);
  });

  app.delete("/api/campaigns/:id", async (req, res) => {
    await storage.deleteCampaign(parseInt(req.params.id));
    res.json({ success: true });
  });

  // Demo send
  app.post("/api/campaigns/:id/send", async (req, res) => {
    const id = parseInt(req.params.id);
    const campaign = await storage.getCampaign(id);
    if (!campaign) return res.status(404).json({ message: "Campaign not found" });
    // Simulate sending
    const sentCount = Math.floor(Math.random() * 2000) + 500;
    const opens = Math.floor(sentCount * (0.38 + Math.random() * 0.15));
    const clicks = Math.floor(opens * (0.15 + Math.random() * 0.1));
    const updated = await storage.updateCampaign(id, {
      status: "Sent",
      sent: sentCount,
      opens,
      clicks,
      unsubscribes: Math.floor(sentCount * 0.004),
      bounces: Math.floor(sentCount * 0.012),
      sentAt: new Date().toISOString(),
    });
    // Create a sent event
    await storage.createEmailEvent({
      userId: DEMO_USER_ID,
      campaignId: id,
      eventType: "email_sent",
      metadata: JSON.stringify({ campaignName: campaign.name, count: sentCount, simulated: true }),
    });
    res.json({ campaign: updated, sentCount, message: `Demo send complete: ${sentCount} emails (simulated)` });
  });

  /* ── Templates ── */
  app.get("/api/templates", async (_req, res) => {
    const templates = await storage.getTemplates(DEMO_USER_ID);
    res.json(templates);
  });

  app.post("/api/templates", async (req, res) => {
    const parsed = insertTemplateSchema.safeParse({ ...req.body, userId: DEMO_USER_ID });
    if (!parsed.success) return res.status(400).json({ message: "Invalid template data", errors: parsed.error.issues });
    const template = await storage.createTemplate(parsed.data);
    res.status(201).json(template);
  });

  app.put("/api/templates/:id", async (req, res) => {
    const template = await storage.updateTemplate(parseInt(req.params.id), req.body);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.delete("/api/templates/:id", async (req, res) => {
    await storage.deleteTemplate(parseInt(req.params.id));
    res.json({ success: true });
  });

  /* ── Email Events ── */
  app.get("/api/email-events", async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const events = await storage.getEmailEvents(DEMO_USER_ID, limit);
    res.json(events);
  });

  /* ── Automations ── */
  app.get("/api/automations", async (_req, res) => {
    const automations = await storage.getAutomations(DEMO_USER_ID);
    res.json(automations);
  });

  app.post("/api/automations", async (req, res) => {
    const parsed = insertAutomationSchema.safeParse({ ...req.body, userId: DEMO_USER_ID });
    if (!parsed.success) return res.status(400).json({ message: "Invalid automation data", errors: parsed.error.issues });
    const automation = await storage.createAutomation(parsed.data);
    res.status(201).json(automation);
  });

  app.put("/api/automations/:id", async (req, res) => {
    const automation = await storage.updateAutomation(parseInt(req.params.id), req.body);
    if (!automation) return res.status(404).json({ message: "Automation not found" });
    res.json(automation);
  });

  app.delete("/api/automations/:id", async (req, res) => {
    await storage.deleteAutomation(parseInt(req.params.id));
    res.json({ success: true });
  });

  /* ── A/B Tests ── */
  app.get("/api/ab-tests", async (_req, res) => {
    const tests = await storage.getAbTests(DEMO_USER_ID);
    res.json(tests);
  });

  app.post("/api/ab-tests", async (req, res) => {
    const parsed = insertAbTestSchema.safeParse({ ...req.body, userId: DEMO_USER_ID });
    if (!parsed.success) return res.status(400).json({ message: "Invalid A/B test data", errors: parsed.error.issues });
    const test = await storage.createAbTest(parsed.data);
    res.status(201).json(test);
  });

  /* ── Lead Scoring ── */
  app.get("/api/lead-scoring/rules", async (_req, res) => {
    res.json([
      { event: "Email opened", points: 2, color: "blue" },
      { event: "Email clicked", points: 5, color: "blue" },
      { event: "Website visit", points: 3, color: "purple" },
      { event: "Form submitted", points: 10, color: "gold" },
      { event: "Demo requested", points: 20, color: "orange" },
      { event: "Purchase", points: 30, color: "green" },
    ]);
  });

  app.get("/api/lead-scoring/distribution", async (_req, res) => {
    const allContacts = await storage.getContacts(DEMO_USER_ID);
    const cold = allContacts.filter(c => c.engagementScore <= 10).length;
    const warm = allContacts.filter(c => c.engagementScore >= 11 && c.engagementScore <= 25).length;
    const hot = allContacts.filter(c => c.engagementScore >= 26 && c.engagementScore <= 50).length;
    const salesReady = allContacts.filter(c => c.engagementScore > 50).length;
    res.json([
      { tier: "Cold (0-10)", count: cold, color: "#94a3b8" },
      { tier: "Warm (11-25)", count: warm, color: "#f59e0b" },
      { tier: "Hot (26-50)", count: hot, color: "#f97316" },
      { tier: "Sales Ready (50+)", count: salesReady, color: "#22c55e" },
    ]);
  });

  /* ── Settings / Reset ── */
  app.post("/api/settings/reset-demo", async (_req, res) => {
    await storage.resetDemoData();
    res.json({ success: true, message: "Demo data reset complete" });
  });

  /* ── AI Assistant (demo mode) ── */
  app.post("/api/ai/subject-lines", async (req, res) => {
    const { product, discount, audience } = req.body;
    const lines = generateSubjectLines(product, discount, audience);
    res.json({ lines, demo: true });
  });

  app.post("/api/ai/email-copy", async (req, res) => {
    const { product, audience, goal } = req.body;
    const copy = generateEmailCopy(product, audience, goal);
    res.json({ copy, demo: true });
  });

  app.post("/api/ai/campaign-ideas", async (req, res) => {
    const { product, audience, goal, budget, channel } = req.body;
    const ideas = generateCampaignIdeas(product, audience, goal, budget, channel);
    res.json({ ideas, demo: true });
  });

  app.post("/api/ai/analyze", async (req, res) => {
    const { campaignId, question } = req.body;
    const analysis = analyzeCampaign(campaignId, question);
    res.json({ analysis, demo: true });
  });

  return _httpServer;
}

/* ── Segment computation ── */
function computeSegmentCount(allContacts: any[], segment: any): number {
  let rules: any[] = [];
  try { rules = JSON.parse(segment.rules); } catch { return 0; }
  if (!rules.length) return allContacts.length;
  const combinator = segment.combinator || "and";

  return allContacts.filter(contact => {
    const tags: string[] = JSON.parse(contact.tags || "[]");
    const results = rules.map((rule: any) => {
      const { field, operator, value } = rule;
      let contactValue: any;
      if (field === "tags") contactValue = tags;
      else if (field === "createdAt") {
        // days ago comparison
        const daysAgo = Math.floor((Date.now() - new Date(contact.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        contactValue = daysAgo;
        if (operator === ">=") return daysAgo <= value;
        return false;
      }
      else contactValue = contact[field];

      switch (operator) {
        case "=": return contactValue === value;
        case "!=": return contactValue !== value;
        case ">=": return Number(contactValue) >= Number(value);
        case "<=": return Number(contactValue) <= Number(value);
        case ">": return Number(contactValue) > Number(value);
        case "<": return Number(contactValue) < Number(value);
        case "in": return Array.isArray(value) && value.includes(contactValue);
        case "contains": return Array.isArray(contactValue) ? contactValue.includes(value) : String(contactValue).includes(value);
        default: return false;
      }
    });
    return combinator === "or" ? results.some(Boolean) : results.every(Boolean);
  }).length;
}

/* ── AI demo generators ── */
function generateSubjectLines(product: string, discount: string, audience: string): string[] {
  const p = product || "your product";
  const d = discount || "20%";
  return [
    `${d} Off ${p} — Today Only`,
    `Exclusive ${d} Discount on ${p} for You`,
    `Your ${p} Discount Expires Sunday`,
    `Don't Miss Out: ${d} Off ${p}`,
    `Hi {{firstName}}, Here's ${d} Off ${p}`,
    `Limited Time: Save ${d} on ${p}`,
    `${p}: Special Offer for ${audience || "Our Subscribers"}`,
    `Unlock ${d} Savings on ${p} Now`,
  ];
}

function generateEmailCopy(product: string, audience: string, goal: string): any {
  const p = product || "our product";
  return {
    subject: `${p}: A Special Offer Just for You`,
    previewText: `Exclusive deal for ${audience || "valued subscribers"}`,
    body: `Hi {{firstName}},\n\nWe thought you'd love to know about an exclusive offer on ${p}. ${goal || "Take advantage of this limited-time deal and get started today."}\n\nHere's what's included:\n- Full access to all features\n- Priority support\n- 30-day money-back guarantee\n\nDon't wait — this offer won't last long.\n\nBest regards,\nThe MarketFlow Team`,
    cta: `Get ${p} Now`,
  };
}

function generateCampaignIdeas(product: string, audience: string, goal: string, budget: string, channel: string): any[] {
  const p = product || "your product";
  const a = audience || "your audience";
  const b = budget || "moderate";
  return [
    {
      name: `${p} Launch Sequence`,
      strategy: `3-part email series targeting ${a}. Email 1: Teaser. Email 2: Launch announcement with demo. Email 3: Social proof + limited-time bonus.`,
      expectedReach: "60-70% of segment",
      estCost: b,
      channel: channel || "Email",
    },
    {
      name: `Re-engagement Campaign`,
      strategy: `Win back inactive ${a} with a 15% discount and personalized content based on past interactions.`,
      expectedReach: "20-30% reactivation",
      estCost: "Low",
      channel: channel || "Email + SMS",
    },
    {
      name: `${goal || "Conversion"} Drip`,
      strategy: `Automated 5-email drip educating ${a} about ${p}, addressing objections, and driving ${goal || "conversions"} with a strong CTA in each email.`,
      expectedReach: "Full segment nurture",
      estCost: b,
      channel: channel || "Email",
    },
  ];
}

function analyzeCampaign(campaignId: number, question: string): any {
  // Demo analysis based on campaign performance patterns
  const performance = getCampaignPerformance(DEMO_USER_ID);
  const campaign = performance.find(c => c.id === campaignId) || performance[0];
  if (!campaign) {
    return { summary: "No campaign data available for analysis.", causes: [], metrics: [], actions: [] };
  }
  const avgOpen = performance.reduce((s, c) => s + c.openRate, 0) / performance.length;
  const avgClick = performance.reduce((s, c) => s + c.clickRate, 0) / performance.length;
  const belowAvgOpen = campaign.openRate < avgOpen;
  const belowAvgClick = campaign.clickRate < avgClick;

  const causes: string[] = [];
  const metrics: { label: string; value: string }[] = [];
  const actions: string[] = [];

  metrics.push({ label: "Open Rate", value: `${campaign.openRate.toFixed(1)}% (avg: ${avgOpen.toFixed(1)}%)` });
  metrics.push({ label: "Click Rate", value: `${campaign.clickRate.toFixed(1)}% (avg: ${avgClick.toFixed(1)}%)` });
  metrics.push({ label: "Emails Sent", value: campaign.sent.toLocaleString() });

  if (belowAvgOpen) {
    causes.push("The subject line may not have resonated with this audience segment. Open rate is below your account average.");
    actions.push("A/B test 2-3 alternative subject lines with different emotional triggers (urgency, curiosity, personalization).");
  }
  if (belowAvgClick) {
    causes.push("Email content or CTA placement may not be driving action. Click rate is below average.");
    actions.push("Move the primary CTA above the fold and test a single, clearer call-to-action.");
  }
  if (!belowAvgOpen && !belowAvgClick) {
    causes.push("This campaign performed above average — engagement was strong.");
    actions.push("Document the winning subject line and content structure for reuse in future campaigns.");
  }
  if (campaign.sent < 1000) {
    causes.push("The send volume was relatively small, which can amplify metric variance.");
    actions.push("Consider expanding the target segment to increase statistical reliability.");
  }

  return {
    summary: `Analysis of "${campaign.name}": ${belowAvgOpen || belowAvgClick ? "performance is below your account average in some metrics." : "performance is above average."}`,
    causes,
    metrics,
    actions,
  };
}
