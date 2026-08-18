import { db } from "./db";
import { contacts, campaigns, emailEvents, automations, leadScoreEvents } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

export interface DashboardStats {
  totalContacts: number;
  emailsSent: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  totalCampaigns: number;
  engagedContacts: number;
  activeAutomations: number;
  avgEngagementScore: number;
}

export interface TimeSeriesPoint {
  month: string;
  contacts: number;
  emailsSent: number;
  opens: number;
  clicks: number;
  unsubscribes: number;
}

export interface CampaignPerformance {
  id: number;
  name: string;
  sent: number;
  openRate: number;
  clickRate: number;
  unsubRate: number;
  status: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
  conversionRate: number;
}

export interface MarketingInsight {
  title: string;
  description: string;
  metric: string;
  value: string;
  recommendation: string;
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function getDashboardStats(userId: number): DashboardStats {
  const allContacts = db.select().from(contacts).where(eq(contacts.userId, userId)).all();
  const allCampaigns = db.select().from(campaigns).where(eq(campaigns.userId, userId)).all();
  const allAutomations = db.select().from(automations).where(eq(automations.userId, userId)).all();

  const totalContacts = allContacts.length;
  const sentCampaigns = allCampaigns.filter(c => c.status === "Sent");
  const emailsSent = sentCampaigns.reduce((sum, c) => sum + c.sent, 0);
  const totalOpens = sentCampaigns.reduce((sum, c) => sum + c.opens, 0);
  const totalClicks = sentCampaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalUnsubscribes = sentCampaigns.reduce((sum, c) => sum + c.unsubscribes, 0);

  const openRate = emailsSent > 0 ? (totalOpens / emailsSent) * 100 : 0;
  const clickRate = emailsSent > 0 ? (totalClicks / emailsSent) * 100 : 0;
  const unsubscribeRate = emailsSent > 0 ? (totalUnsubscribes / emailsSent) * 100 : 0;
  const engagedContacts = allContacts.filter(c => c.engagementScore >= 26).length;
  const avgEngagementScore = totalContacts > 0
    ? allContacts.reduce((sum, c) => sum + c.engagementScore, 0) / totalContacts
    : 0;

  return {
    totalContacts,
    emailsSent,
    openRate,
    clickRate,
    unsubscribeRate,
    totalCampaigns: allCampaigns.length,
    engagedContacts,
    activeAutomations: allAutomations.filter(a => a.status === "active").length,
    avgEngagementScore,
  };
}

export function getContactGrowthSeries(userId: number): TimeSeriesPoint[] {
  const allContacts = db.select().from(contacts).where(eq(contacts.userId, userId)).all();
  const allCampaigns = db.select().from(campaigns).where(eq(campaigns.userId, userId)).all();
  const sentCampaigns = allCampaigns.filter(c => c.status === "Sent" && c.sentAt);

  // Build last 12 months
  const now = new Date();
  const months: { date: Date; label: string; contacts: number; emailsSent: number; opens: number; clicks: number; unsubscribes: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ date: d, label: monthLabel(d), contacts: 0, emailsSent: 0, opens: 0, clicks: 0, unsubscribes: 0 });
  }

  // Bin contacts by created month
  for (const contact of allContacts) {
    const cd = new Date(contact.createdAt);
    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      const next = i < months.length - 1 ? months[i + 1].date : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      if (cd >= m.date && cd < next) {
        m.contacts++;
        break;
      }
    }
  }

  // Bin campaign metrics by sent month
  for (const c of sentCampaigns) {
    if (!c.sentAt) continue;
    const cd = new Date(c.sentAt);
    for (let i = 0; i < months.length; i++) {
      const m = months[i];
      const next = i < months.length - 1 ? months[i + 1].date : new Date(now.getFullYear(), now.getMonth() + 1, 1);
      if (cd >= m.date && cd < next) {
        m.emailsSent += c.sent;
        m.opens += c.opens;
        m.clicks += c.clicks;
        m.unsubscribes += c.unsubscribes;
        break;
      }
    }
  }

  return months.map(m => ({
    month: m.label,
    contacts: m.contacts,
    emailsSent: m.emailsSent,
    opens: m.opens,
    clicks: m.clicks,
    unsubscribes: m.unsubscribes,
  }));
}

export function getCampaignPerformance(userId: number): CampaignPerformance[] {
  const allCampaigns = db.select().from(campaigns).where(eq(campaigns.userId, userId)).all();
  return allCampaigns
    .filter(c => c.status === "Sent")
    .map(c => ({
      id: c.id,
      name: c.name,
      sent: c.sent,
      openRate: c.sent > 0 ? (c.opens / c.sent) * 100 : 0,
      clickRate: c.sent > 0 ? (c.clicks / c.sent) * 100 : 0,
      unsubRate: c.sent > 0 ? (c.unsubscribes / c.sent) * 100 : 0,
      status: c.status,
    }))
    .sort((a, b) => b.sent - a.sent);
}

export function getMarketingFunnel(userId: number): FunnelStage[] {
  const allContacts = db.select().from(contacts).where(eq(contacts.userId, userId)).all();
  const visitors = allContacts.length;
  const leads = allContacts.filter(c => c.status !== "Unsubscribed").length;
  const engagedLeads = allContacts.filter(c => c.engagementScore >= 11).length;
  const qualifiedLeads = allContacts.filter(c => c.engagementScore >= 26).length;
  const customers = allContacts.filter(c => c.status === "Customer").length;

  const stages = [
    { stage: "Visitors", count: visitors },
    { stage: "Leads", count: leads },
    { stage: "Engaged Leads", count: engagedLeads },
    { stage: "Qualified Leads", count: qualifiedLeads },
    { stage: "Customers", count: customers },
  ];

  return stages.map((s, i) => ({
    ...s,
    conversionRate: i === 0 ? 100 : (stages[i - 1].count > 0 ? (s.count / stages[i - 1].count) * 100 : 0),
  }));
}

export function getMarketingInsights(userId: number): MarketingInsight[] {
  const performance = getCampaignPerformance(userId);
  const stats = getDashboardStats(userId);

  if (performance.length === 0) {
    return [{
      title: "No data yet",
      description: "Send your first campaign to see insights.",
      metric: "",
      value: "",
      recommendation: "Create a campaign and send it to your audience.",
    }];
  }

  // Find best performing campaign by open rate
  const byOpenRate = [...performance].sort((a, b) => b.openRate - a.openRate);
  const bestOpen = byOpenRate[0];
  const byClickRate = [...performance].sort((a, b) => b.clickRate - a.clickRate);
  const bestClick = byClickRate[0];
  const worstOpen = byOpenRate[byOpenRate.length - 1];

  const insights: MarketingInsight[] = [];

  insights.push({
    title: `${bestOpen.name} has the highest engagement`,
    description: `Open rate: ${bestOpen.openRate.toFixed(1)}% — ${(bestOpen.openRate - stats.openRate).toFixed(1)}% above your average of ${stats.openRate.toFixed(1)}%.`,
    metric: "Open Rate",
    value: `${bestOpen.openRate.toFixed(1)}%`,
    recommendation: "Use similar subject-line and content strategies for future campaigns targeting the same audience segments.",
  });

  if (bestClick.name !== bestOpen.name) {
    insights.push({
      title: `${bestClick.name} drives the most clicks`,
      description: `Click rate: ${bestClick.clickRate.toFixed(1)}% — well above the platform average of ${stats.clickRate.toFixed(1)}%.`,
      metric: "Click Rate",
      value: `${bestClick.clickRate.toFixed(1)}%`,
      recommendation: "Analyze the CTA placement and email copy — replicate this structure in upcoming promotional campaigns.",
    });
  }

  if (worstOpen.openRate < stats.openRate * 0.7) {
    insights.push({
      title: `${worstOpen.name} underperformed`,
      description: `Open rate of ${worstOpen.openRate.toFixed(1)}% is ${(stats.openRate - worstOpen.openRate).toFixed(1)}% below average. Subject line or send timing may need adjustment.`,
      metric: "Open Rate",
      value: `${worstOpen.openRate.toFixed(1)}%`,
      recommendation: "A/B test alternative subject lines and experiment with different send times for similar audience segments.",
    });
  }

  return insights;
}

export function getEngagementBySegment(userId: number): { segment: string; opens: number; clicks: number }[] {
  // Derive engagement by contact status (as a proxy for segment)
  const allContacts = db.select().from(contacts).where(eq(contacts.userId, userId)).all();
  const result: Record<string, { opens: number; clicks: number }> = {};
  for (const c of allContacts) {
    if (!result[c.status]) result[c.status] = { opens: 0, clicks: 0 };
    // Estimate engagement contribution from score
    result[c.status].opens += Math.floor(c.engagementScore / 3);
    result[c.status].clicks += Math.floor(c.engagementScore / 8);
  }
  return Object.entries(result).map(([segment, v]) => ({ segment, ...v }));
}
