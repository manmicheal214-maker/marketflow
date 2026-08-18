import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import type * as z from "zod/mini";

/* ── Demo user (stand-in for Supabase Auth in demo mode) ── */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#2563eb"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── Contacts / CRM ── */
export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  status: text("status").notNull().default("Lead"),
  source: text("source").notNull().default("Manual"),
  tags: text("tags").notNull().default("[]"), // JSON array of tag strings
  engagementScore: integer("engagement_score").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
  lastActivityAt: text("last_activity_at"),
});

/* ── Segments (dynamic rule sets) ── */
export const segments = sqliteTable("segments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  rules: text("rules").notNull().default("[]"), // JSON rule groups
  combinator: text("combinator").notNull().default("and"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── Campaigns ── */
export const campaigns = sqliteTable("campaigns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  content: text("content").notNull().default(""),
  status: text("status").notNull().default("Draft"),
  segmentId: integer("segment_id"),
  scheduledAt: text("scheduled_at"),
  sentAt: text("sent_at"),
  budget: real("budget"),
  revenue: real("revenue"),
  conversions: integer("conversions"),
  // Aggregate email metrics (simulated for demo)
  sent: integer("sent").notNull().default(0),
  opens: integer("opens").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  unsubscribes: integer("unsubscribes").notNull().default(0),
  bounces: integer("bounces").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
  updatedAt: text("updated_at").notNull().default(new Date().toISOString()),
});

/* ── Email templates ── */
export const emailTemplates = sqliteTable("email_templates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  category: text("category").notNull().default("Custom"),
  subject: text("subject").notNull(),
  previewText: text("preview_text"),
  content: text("content").notNull().default(""),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── Email events ── */
export const emailEvents = sqliteTable("email_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  campaignId: integer("campaign_id"),
  contactId: integer("contact_id"),
  eventType: text("event_type").notNull(),
  metadata: text("metadata").notNull().default("{}"), // JSON
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── Automations ── */
export const automations = sqliteTable("automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  triggerType: text("trigger_type").notNull(),
  triggerConfig: text("trigger_config").notNull().default("{}"),
  steps: text("steps").notNull().default("[]"), // JSON array of steps
  status: text("status").notNull().default("active"),
  enrolledCount: integer("enrolled_count").notNull().default(0),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── A/B tests ── */
export const abTests = sqliteTable("ab_tests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  campaignId: integer("campaign_id"),
  name: text("name").notNull(),
  winningMetric: text("winning_metric").notNull().default("open_rate"),
  status: text("status").notNull().default("completed"),
  variants: text("variants").notNull().default("[]"), // JSON
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── Lead score events ── */
export const leadScoreEvents = sqliteTable("lead_score_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  contactId: integer("contact_id").notNull(),
  eventType: text("event_type").notNull(),
  points: integer("points").notNull().default(0),
  description: text("description"),
  createdAt: text("created_at").notNull().default(new Date().toISOString()),
});

/* ── Insert schemas ── */
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  fullName: true,
  avatarColor: true,
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSegmentSchema = createInsertSchema(segments).omit({
  id: true,
  createdAt: true,
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertAutomationSchema = createInsertSchema(automations).omit({
  id: true,
  createdAt: true,
});

export const insertAbTestSchema = createInsertSchema(abTests).omit({
  id: true,
  createdAt: true,
});

/* ── Types ── */
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Segment = typeof segments.$inferSelect;
export type InsertSegment = z.infer<typeof insertSegmentSchema>;
export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type EmailEvent = typeof emailEvents.$inferSelect;
export type Automation = typeof automations.$inferSelect;
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type AbTest = typeof abTests.$inferSelect;
export type InsertAbTest = z.infer<typeof insertAbTestSchema>;
export type LeadScoreEvent = typeof leadScoreEvents.$inferSelect;
