import { db } from "./db";
import { users, contacts, segments, campaigns, emailTemplates, emailEvents, automations, abTests, leadScoreEvents } from "@shared/schema";
import { eq } from "drizzle-orm";

const DEMO_USER_ID = 1;

/* Seeded pseudo-random for reproducible demo data */
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const firstNames = ["James","Mary","John","Patricia","Robert","Jennifer","Michael","Linda","David","Elizabeth","William","Barbara","Richard","Susan","Joseph","Jessica","Thomas","Sarah","Charles","Karen","Christopher","Nancy","Daniel","Lisa","Matthew","Margaret","Anthony","Betty","Mark","Sandra","Donald","Ashley","Steven","Dorothy","Paul","Kimberly","Andrew","Emily","Joshua","Donna","Kenneth","Michelle","Kevin","Carol","Brian","Amanda","George","Melissa","Edward","Deborah","Ronald","Stephanie","Timothy","Rebecca","Jason","Laura","Jeffrey","Sharon","Ryan","Cynthia","Jacob","Kathleen","Gary","Amy","Nicholas","Shirley","Eric","Angela","Jonathan","Helen","Stephen","Anna","Larry","Brenda","Justin","Pamela","Scott","Nicole","Brandon","Samantha","Benjamin","Katherine","Samuel","Christine","Gregory","Debra","Frank","Rachel","Alexander","Catherine","Raymond","Carolyn","Patrick","Ruth","Jack","Janet","Dennis","Maria","Jerry","Heather","Tyler","Diane","Joseph","Julie","Douglas","Joy","Peter","Victoria","Adam","Olivia","Henry","Kelly","Nathan","Christina","Zachary","Lauren","Walter","Joan","Kyle","Evelyn","Harold","Judith","Carl","Megan","Arthur","Andrea","Gerald","Cheryl","Roger","Hannah","Keith","Jacqueline","Jeremy","Martha","Terry","Gloria","Lawrence","Teresa","Sean","Sara","Christian","Janice","Albert","Sara","Joe","Madison","Ethan","Frances","Austin","Kathryn","Jesse","Marie","Willie","Vanessa","Billy","Theresa","Jordan","Beatrice","Bryan","Florence","Bruce","Ruby","Dylan","Nina","Ralph","Deborah","Roy","Isabel","Eugene","Veronica","Wayne","Hazel","Jordan","Marilyn","Alan","Danielle"];
const lastNames = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson","Watson","Brooks","Chavez","Wood","James","Bennett","Gray","Mendoza","Ruiz","Hughes","Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez","Powell","Jenkins","Perry","Russell","Sullivan","Bell","Coleman","Butler","Henderson","Barnes","Cole","Chong","Fisher","Edwards","Reyes","Stewart","Morris","Simpson","Webb","Ford","Stone","Cruz","Hunt","Diaz","Bryant","Norman","Reyes","Harrison","Ford","Gibson","Matthews","Rodriguez","Carter","Wallace","Owens","Reynolds","Fisher","Sutton","Dixon","Olsen","Hunter","Gordon","Lane","Andrews","Grant","Waters","Mason","Steele","Day","Cunningham","Marsh","Berry","Perkins","Meyer","Hamilton","Fowler","Dunn","Walsh","Rice","Hansen","Lynch","Payne","Bishop","Fuller","Weaver","Welch","Soto","Boyd","Rose","Hoffman","Johnston","Sandoval","Doyle","Mendoza","Pittman","Walters","King","Stout","Hogan","Boone","Forbes","Norton","Shepard","Slater","Hendrix","Foley","Howell","Pratt","Mclean","Sosa"];

const statuses = ["Lead","Interested","Customer","Inactive","Unsubscribed"];
const sources = ["Website","Referral","Social Media","Manual","Webinar","Cold Outreach","Event","Paid Ads"];
const tagPool = ["Customer","Lead","VIP","Newsletter","Dubai","Interested","Inactive","Trial","Enterprise","SMB","Newsletter","Webinar","Demo","Priority"];
const cities = ["Dubai","Abu Dhabi","Sharjah","Doha","Riyadh","London","Singapore","New York","Berlin","Tokyo"];

function pick<T>(arr: T[], rnd: () => number): T {
  return arr[Math.floor(rnd() * arr.length)];
}

function randomEmail(name: string, rnd: () => number): string {
  const domains = ["gmail.com","outlook.com","yahoo.com","proton.me","company.com","hotmail.com","icloud.com"];
  const handle = name.toLowerCase().replace(/[^a-z]/g, ".").replace(/\.+/g, ".");
  const num = Math.floor(rnd() * 999);
  return `${handle}${num}@${pick(domains, rnd)}`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function hoursAgoISO(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

const campaignData = [
  { name: "Summer Sale 2025", subject: "30% Off Your Summer Order — Today Only", category: "Promotional", sent: 2450, openRate: 0.482, clickRate: 0.104, status: "Sent", budget: 500, revenue: 12400, conversions: 186, ageDays: 45 },
  { name: "Welcome Series", subject: "Welcome to MarketFlow — Let's get started", category: "Welcome", sent: 1820, openRate: 0.521, clickRate: 0.128, status: "Sent", budget: 0, revenue: 3200, conversions: 94, ageDays: 30 },
  { name: "Product Launch: Pro Plan", subject: "Introducing MarketFlow Pro", category: "Product Announcement", sent: 3210, openRate: 0.394, clickRate: 0.072, status: "Sent", budget: 800, revenue: 8900, conversions: 142, ageDays: 60 },
  { name: "Black Friday Deals", subject: "Your Black Friday Discount Ends Sunday", category: "Promotional", sent: 4100, openRate: 0.447, clickRate: 0.098, status: "Sent", budget: 1200, revenue: 21500, conversions: 312, ageDays: 120 },
  { name: "Re-engagement Campaign", subject: "We miss you — here's 15% off", category: "Re-engagement", sent: 980, openRate: 0.318, clickRate: 0.045, status: "Sent", budget: 100, revenue: 1800, conversions: 28, ageDays: 75 },
  { name: "Weekly Newsletter #42", subject: "This week in digital marketing", category: "Newsletter", sent: 5600, openRate: 0.456, clickRate: 0.081, status: "Sent", budget: 0, revenue: 0, conversions: 0, ageDays: 14 },
  { name: "Abandoned Cart Recovery", subject: "You left something behind", category: "Abandoned Cart", sent: 740, openRate: 0.498, clickRate: 0.151, status: "Sent", budget: 0, revenue: 4200, conversions: 67, ageDays: 21 },
  { name: "New Year Promo", subject: "Start the year with 20% off", category: "Promotional", sent: 2900, openRate: 0.411, clickRate: 0.067, status: "Sent", budget: 600, revenue: 7600, conversions: 98, ageDays: 150 },
  { name: "Webinar Invitation", subject: "Join our free marketing masterclass", category: "Newsletter", sent: 1650, openRate: 0.503, clickRate: 0.119, status: "Sent", budget: 200, revenue: 0, conversions: 124, ageDays: 38 },
  { name: "Q1 Customer Survey", subject: "Tell us what you think (2 min)", category: "Newsletter", sent: 1200, openRate: 0.387, clickRate: 0.215, status: "Sent", budget: 0, revenue: 0, conversions: 0, ageDays: 90 },
  { name: "Holiday Greetings", subject: "Happy holidays from MarketFlow", category: "Promotional", sent: 6200, openRate: 0.534, clickRate: 0.038, status: "Sent", budget: 0, revenue: 0, conversions: 0, ageDays: 200 },
  { name: "Feature Update: Segments", subject: "Smarter segmentation is here", category: "Product Announcement", sent: 2100, openRate: 0.442, clickRate: 0.092, status: "Sent", budget: 0, revenue: 1500, conversions: 41, ageDays: 52 },
  { name: "Spring Collection Launch", subject: "Fresh looks for the new season", category: "Product Announcement", sent: 3400, openRate: 0.418, clickRate: 0.085, status: "Sent", budget: 700, revenue: 9800, conversions: 156, ageDays: 100 },
  { name: "Loyalty Rewards", subject: "You've earned exclusive rewards", category: "Promotional", sent: 1850, openRate: 0.475, clickRate: 0.112, status: "Sent", budget: 150, revenue: 6200, conversions: 88, ageDays: 65 },
  { name: "Back to School Sale", subject: "Gear up with 25% off", category: "Promotional", sent: 2700, openRate: 0.403, clickRate: 0.076, status: "Sent", budget: 500, revenue: 7100, conversions: 103, ageDays: 110 },
  { name: "Autumn Newsletter", subject: "5 marketing trends this fall", category: "Newsletter", sent: 4800, openRate: 0.429, clickRate: 0.069, status: "Sent", budget: 0, revenue: 0, conversions: 0, ageDays: 80 },
  { name: "VIP Early Access", subject: "Be the first to shop our new line", category: "Promotional", sent: 920, openRate: 0.587, clickRate: 0.143, status: "Sent", budget: 100, revenue: 5400, conversions: 79, ageDays: 25 },
  { name: "Draft: Holiday Campaign", subject: "Your exclusive holiday offer", category: "Promotional", sent: 0, openRate: 0, clickRate: 0, status: "Draft", budget: 300, revenue: 0, conversions: 0, ageDays: 5 },
];

export async function seedDemoData() {
  // Check if demo user already exists
  const existing = db.select().from(users).where(eq(users.id, DEMO_USER_ID)).get();
  if (existing) return; // already seeded

  const rnd = seededRandom(42);

  // Create demo user
  db.insert(users).values({
    id: DEMO_USER_ID,
    username: "demo",
    email: "demo@marketflow.io",
    fullName: "Alex Morgan",
    avatarColor: "#2563eb",
    createdAt: daysAgoISO(365),
  }).run();

  // ── Contacts (1,284) ──
  const CONTACT_COUNT = 1284;
  const contactRows = [];
  const usedEmails = new Set<string>();
  for (let i = 0; i < CONTACT_COUNT; i++) {
    const first = pick(firstNames, rnd);
    const last = pick(lastNames, rnd);
    const name = `${first} ${last}`;
    let email = randomEmail(`${first}.${last}`, rnd);
    let attempts = 0;
    while (usedEmails.has(email) && attempts < 5) {
      email = randomEmail(`${first}.${last}${i}`, rnd);
      attempts++;
    }
    usedEmails.add(email);

    const statusRoll = rnd();
    let status: string;
    if (statusRoll < 0.35) status = "Lead";
    else if (statusRoll < 0.6) status = "Interested";
    else if (statusRoll < 0.82) status = "Customer";
    else if (statusRoll < 0.93) status = "Inactive";
    else status = "Unsubscribed";

    const source = pick(sources, rnd);
    const ageDays = Math.floor(rnd() * 365);
    const lastActivityDays = status === "Unsubscribed" ? Math.floor(rnd() * 200) + 60 : Math.floor(rnd() * 90);
    const hasPhone = rnd() > 0.3;

    // Tags (1-4)
    const tagCount = 1 + Math.floor(rnd() * 4);
    const tags: string[] = [];
    const tagSet = new Set<string>();
    if (status === "Customer") tagSet.add("Customer");
    if (status === "Lead") tagSet.add("Lead");
    if (status === "Interested") tagSet.add("Interested");
    if (rnd() > 0.85) tagSet.add("VIP");
    if (rnd() > 0.6) tagSet.add("Newsletter");
    if (rnd() > 0.7) tagSet.add(pick(cities, rnd));
    while (tagSet.size < tagCount) tagSet.add(pick(tagPool, rnd));
    tags.push(...Array.from(tagSet));

    // Engagement score based on status and recency
    let score = 0;
    if (status === "Customer") score = 20 + Math.floor(rnd() * 35);
    else if (status === "Interested") score = 10 + Math.floor(rnd() * 25);
    else if (status === "Lead") score = Math.floor(rnd() * 15);
    else if (status === "Inactive") score = Math.floor(rnd() * 10);
    else score = 0;
    if (tags.includes("VIP")) score += 10;
    score = Math.min(score, 99);

    const phone = hasPhone ? `+971 5${Math.floor(rnd() * 10)} ${String(Math.floor(rnd() * 10000000)).padStart(7, "0")}` : null;

    contactRows.push({
      userId: DEMO_USER_ID,
      name,
      email,
      phone,
      status,
      source,
      tags: JSON.stringify(tags),
      engagementScore: score,
      createdAt: daysAgoISO(ageDays),
      updatedAt: daysAgoISO(Math.max(0, ageDays - Math.floor(rnd() * 10))),
      lastActivityAt: daysAgoISO(lastActivityDays),
    });
  }
  // Bulk insert in chunks
  const chunkSize = 200;
  for (let i = 0; i < contactRows.length; i += chunkSize) {
    db.insert(contacts).values(contactRows.slice(i, i + chunkSize)).run();
  }

  // ── Segments ──
  const segmentDefs = [
    { name: "Highly Engaged", description: "Contacts who opened 3+ emails and clicked recently", rules: JSON.stringify([{ field: "engagementScore", operator: ">=", value: 26 }, { field: "status", operator: "in", value: ["Lead","Interested","Customer"] }]), combinator: "and" },
    { name: "Inactive Contacts", description: "No activity in the last 60 days", rules: JSON.stringify([{ field: "status", operator: "=", value: "Inactive" }]), combinator: "and" },
    { name: "VIP Customers", description: "Customers tagged VIP", rules: JSON.stringify([{ field: "status", operator: "=", value: "Customer" }, { field: "tags", operator: "contains", value: "VIP" }]), combinator: "and" },
    { name: "Dubai Leads", description: "Leads located in Dubai", rules: JSON.stringify([{ field: "status", operator: "=", value: "Lead" }, { field: "tags", operator: "contains", value: "Dubai" }]), combinator: "and" },
    { name: "Newsletter Subscribers", description: "Subscribed to newsletter", rules: JSON.stringify([{ field: "tags", operator: "contains", value: "Newsletter" }]), combinator: "and" },
    { name: "Sales Ready", description: "Engagement score above 50", rules: JSON.stringify([{ field: "engagementScore", operator: ">=", value: 50 }]), combinator: "and" },
    { name: "New Leads (30d)", description: "Leads added in the last 30 days", rules: JSON.stringify([{ field: "status", operator: "=", value: "Lead" }, { field: "createdAt", operator: ">=", value: 30 }]), combinator: "and" },
  ];
  for (const s of segmentDefs) {
    db.insert(segments).values({ userId: DEMO_USER_ID, ...s, createdAt: daysAgoISO(Math.floor(rnd() * 100) + 10) }).run();
  }

  // ── Campaigns ──
  for (const c of campaignData) {
    const opens = Math.floor(c.sent * c.openRate);
    const clicks = Math.floor(c.sent * c.clickRate);
    const unsubscribes = Math.floor(c.sent * 0.004);
    const bounces = Math.floor(c.sent * 0.012);
    const isSent = c.status === "Sent";
    db.insert(campaigns).values({
      userId: DEMO_USER_ID,
      name: c.name,
      subject: c.subject,
      previewText: c.category === "Welcome" ? "Get started in under 2 minutes" : "Don't miss out on this offer",
      content: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h1 style="color:#2563eb;">${c.subject}</h1><p>Hi there,</p><p>We're excited to share this with you. ${c.category} campaign for MarketFlow subscribers.</p><a href="#" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">Learn More</a></div>`,
      status: c.status,
      segmentId: 1 + Math.floor(rnd() * 7),
      scheduledAt: isSent ? null : daysAgoISO(-7),
      sentAt: isSent ? daysAgoISO(c.ageDays) : null,
      budget: c.budget || null,
      revenue: c.revenue || null,
      conversions: c.conversions || null,
      sent: c.sent,
      opens,
      clicks,
      unsubscribes,
      bounces,
      createdAt: daysAgoISO(c.ageDays + 2),
      updatedAt: daysAgoISO(c.ageDays),
    }).run();
  }

  // ── Email templates ──
  const templateDefs = [
    { name: "Welcome Email", category: "Welcome", subject: "Welcome to MarketFlow", previewText: "Let's get you started", content: "<h1>Welcome aboard!</h1><p>We're thrilled to have you. Here's how to get started in 3 steps.</p>" },
    { name: "Promotional Email", category: "Promotional", subject: "Special Offer Inside", previewText: "Limited time deal", content: "<h1>30% Off Everything</h1><p>Shop now before the sale ends this Sunday.</p>" },
    { name: "Monthly Newsletter", category: "Newsletter", subject: "This Month in Marketing", previewText: "Trends, tips & updates", content: "<h1>Marketing Monthly</h1><p>Here are the top 5 trends we're tracking this month.</p>" },
    { name: "Product Announcement", category: "Product Announcement", subject: "Something New Is Here", previewText: "Discover our latest feature", content: "<h1>Introducing Pro</h1><p>Our new premium plan is now available with advanced automation.</p>" },
    { name: "Abandoned Cart", category: "Abandoned Cart", subject: "You Left Something Behind", previewText: "Your cart is waiting", content: "<h1>Still Thinking?</h1><p>Complete your purchase now and get free shipping.</p>" },
    { name: "Re-engagement", category: "Re-engagement", subject: "We Miss You", previewText: "Come back for 15% off", content: "<h1>It's Been a While</h1><p>We'd love to see you again. Here's 15% off your next order.</p>" },
  ];
  for (const t of templateDefs) {
    db.insert(emailTemplates).values({ userId: DEMO_USER_ID, ...t, createdAt: daysAgoISO(Math.floor(rnd() * 60) + 5) }).run();
  }

  // ── Email events (sample — recent activity) ──
  const eventTypes = ["email_sent","email_delivered","email_opened","email_clicked","email_bounced","email_unsubscribed"];
  const allContacts = db.select().from(contacts).where(eq(contacts.userId, DEMO_USER_ID)).all();
  const sentCampaigns = campaignData.filter(c => c.status === "Sent");
  // Generate ~800 sample events spread over last 30 days
  for (let i = 0; i < 800; i++) {
    const campaignIdx = Math.floor(rnd() * sentCampaigns.length);
    const contact = pick(allContacts, rnd);
    let eventType: string;
    const roll = rnd();
    if (roll < 0.35) eventType = "email_sent";
    else if (roll < 0.6) eventType = "email_delivered";
    else if (roll < 0.82) eventType = "email_opened";
    else if (roll < 0.93) eventType = "email_clicked";
    else if (roll < 0.97) eventType = "email_bounced";
    else eventType = "email_unsubscribed";

    db.insert(emailEvents).values({
      userId: DEMO_USER_ID,
      campaignId: 1 + campaignIdx,
      contactId: contact.id,
      eventType,
      metadata: JSON.stringify({ campaignName: sentCampaigns[campaignIdx].name }),
      createdAt: hoursAgoISO(Math.floor(rnd() * 24 * 30)),
    }).run();
  }

  // ── Automations ──
  const automationDefs = [
    {
      name: "New Contact Welcome Flow",
      triggerType: "contact_added",
      triggerConfig: JSON.stringify({}),
      steps: JSON.stringify([
        { id: 1, type: "send_email", config: { templateId: 1, subject: "Welcome to MarketFlow" }, label: "Send Welcome Email" },
        { id: 2, type: "wait", config: { days: 2 }, label: "Wait 2 Days" },
        { id: 3, type: "condition", config: { field: "emailOpened", value: true }, label: "Did contact open email?" },
        { id: 4, type: "send_email", config: { templateId: 4, subject: "Explore MarketFlow Pro" }, label: "Send Product Email (Yes)" },
        { id: 5, type: "send_email", config: { templateId: 6, subject: "Still interested?" }, label: "Send Reminder (No)" },
      ]),
      status: "active",
      enrolledCount: 412,
    },
    {
      name: "VIP Customer Onboarding",
      triggerType: "tag_added",
      triggerConfig: JSON.stringify({ tag: "VIP" }),
      steps: JSON.stringify([
        { id: 1, type: "send_email", config: { templateId: 6, subject: "Welcome VIP" }, label: "Send VIP Welcome" },
        { id: 2, type: "add_tag", config: { tag: "Priority" }, label: "Add Priority Tag" },
        { id: 3, type: "wait", config: { days: 1 }, label: "Wait 1 Day" },
        { id: 4, type: "update_status", config: { status: "Customer" }, label: "Update to Customer" },
      ]),
      status: "active",
      enrolledCount: 87,
    },
    {
      name: "Re-engagement Flow",
      triggerType: "enters_segment",
      triggerConfig: JSON.stringify({ segmentId: 2 }),
      steps: JSON.stringify([
        { id: 1, type: "send_email", config: { templateId: 6, subject: "We miss you" }, label: "Send Re-engagement Email" },
        { id: 2, type: "wait", config: { days: 3 }, label: "Wait 3 Days" },
        { id: 3, type: "condition", config: { field: "emailClicked", value: true }, label: "Did contact click?" },
        { id: 4, type: "remove_tag", config: { tag: "Inactive" }, label: "Remove Inactive Tag (Yes)" },
      ]),
      status: "active",
      enrolledCount: 156,
    },
    {
      name: "Post-Purchase Follow-up",
      triggerType: "tag_added",
      triggerConfig: JSON.stringify({ tag: "Customer" }),
      steps: JSON.stringify([
        { id: 1, type: "send_email", config: { templateId: 1, subject: "Thanks for your purchase" }, label: "Send Thank You" },
        { id: 2, type: "wait", config: { days: 7 }, label: "Wait 7 Days" },
        { id: 3, type: "send_email", config: { templateId: 3, subject: "How was your experience?" }, label: "Send Review Request" },
      ]),
      status: "paused",
      enrolledCount: 203,
    },
  ];
  for (const a of automationDefs) {
    db.insert(automations).values({ userId: DEMO_USER_ID, ...a, createdAt: daysAgoISO(Math.floor(rnd() * 90) + 10) }).run();
  }

  // ── A/B tests ──
  const abTestDefs = [
    {
      name: "Summer Sale Subject Line Test",
      campaignId: 1,
      winningMetric: "open_rate",
      status: "completed",
      variants: JSON.stringify([
        { name: "Variant A", subject: "30% Off Your Summer Order", sent: 1225, opens: 612, clicks: 128, unsubscribes: 4, openRate: 0.5, clickRate: 0.105, winner: false },
        { name: "Variant B", subject: "Your Summer Discount Ends Sunday", sent: 1225, opens: 568, clicks: 127, unsubscribes: 6, openRate: 0.464, clickRate: 0.104, winner: true },
      ]),
    },
    {
      name: "Welcome Email CTA Test",
      campaignId: 2,
      winningMetric: "click_rate",
      status: "completed",
      variants: JSON.stringify([
        { name: "Variant A", subject: "Welcome to MarketFlow", sent: 910, opens: 482, clicks: 110, unsubscribes: 2, openRate: 0.53, clickRate: 0.121, winner: false },
        { name: "Variant B", subject: "Let's Get You Started", sent: 910, opens: 467, clicks: 123, unsubscribes: 3, openRate: 0.513, clickRate: 0.135, winner: true },
      ]),
    },
    {
      name: "Product Launch Preview Test",
      campaignId: 3,
      winningMetric: "open_rate",
      status: "completed",
      variants: JSON.stringify([
        { name: "Variant A", subject: "Introducing MarketFlow Pro", sent: 1605, opens: 645, clicks: 118, unsubscribes: 5, openRate: 0.402, clickRate: 0.073, winner: true },
        { name: "Variant B", subject: "The New Way to Do Email Marketing", sent: 1605, opens: 620, clicks: 113, unsubscribes: 7, openRate: 0.386, clickRate: 0.07, winner: false },
      ]),
    },
  ];
  for (const t of abTestDefs) {
    db.insert(abTests).values({ userId: DEMO_USER_ID, ...t, createdAt: daysAgoISO(Math.floor(rnd() * 50) + 5) }).run();
  }

  // ── Lead score events (sample) ──
  const scoreEventTypes = [
    { type: "Email opened", points: 2 },
    { type: "Email clicked", points: 5 },
    { type: "Website visit", points: 3 },
    { type: "Form submitted", points: 10 },
    { type: "Demo requested", points: 20 },
    { type: "Purchase", points: 30 },
  ];
  const sampleContacts = allContacts.filter((c) => rnd() > 0.7).slice(0, 300);
  for (const contact of sampleContacts) {
    const eventCount = 1 + Math.floor(rnd() * 4);
    for (let j = 0; j < eventCount; j++) {
      const evt = pick(scoreEventTypes, rnd);
      db.insert(leadScoreEvents).values({
        userId: DEMO_USER_ID,
        contactId: contact.id,
        eventType: evt.type,
        points: evt.points,
        description: `${evt.type} — ${evt.points} points`,
        createdAt: hoursAgoISO(Math.floor(rnd() * 24 * 45)),
      }).run();
    }
  }

  console.log("[seed] Demo data inserted: 1,284 contacts, 17 campaigns, 7 segments, 6 templates, 4 automations, 3 A/B tests, 800 email events, lead score events");
}
