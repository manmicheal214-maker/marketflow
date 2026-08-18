import { db } from "./db";
import { seedDemoData } from "./seed";
import {
  users, contacts, segments, campaigns, emailTemplates, emailEvents,
  automations, abTests, leadScoreEvents,
} from "@shared/schema";
import type {
  User, InsertUser, Contact, InsertContact, Segment, InsertSegment,
  Campaign, InsertCampaign, EmailTemplate, InsertTemplate,
  EmailEvent, Automation, InsertAutomation, AbTest, InsertAbTest,
  LeadScoreEvent,
} from "@shared/schema";
import { eq, desc, like, and, sql } from "drizzle-orm";

export interface IStorage {
  // User
  getUser(id: number): Promise<User | undefined>;
  getDemoUser(): Promise<User>;
  // Contacts
  getContacts(userId: number): Promise<Contact[]>;
  getContact(id: number): Promise<Contact | undefined>;
  createContact(data: InsertContact): Promise<Contact>;
  updateContact(id: number, data: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: number): Promise<void>;
  // Segments
  getSegments(userId: number): Promise<Segment[]>;
  createSegment(data: InsertSegment): Promise<Segment>;
  updateSegment(id: number, data: Partial<Segment>): Promise<Segment | undefined>;
  deleteSegment(id: number): Promise<void>;
  // Campaigns
  getCampaigns(userId: number): Promise<Campaign[]>;
  getCampaign(id: number): Promise<Campaign | undefined>;
  createCampaign(data: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, data: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: number): Promise<void>;
  // Templates
  getTemplates(userId: number): Promise<EmailTemplate[]>;
  createTemplate(data: InsertTemplate): Promise<EmailTemplate>;
  updateTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteTemplate(id: number): Promise<void>;
  // Email events
  getEmailEvents(userId: number, limit?: number): Promise<EmailEvent[]>;
  createEmailEvent(data: Partial<EmailEvent>): Promise<EmailEvent>;
  // Automations
  getAutomations(userId: number): Promise<Automation[]>;
  createAutomation(data: InsertAutomation): Promise<Automation>;
  updateAutomation(id: number, data: Partial<Automation>): Promise<Automation | undefined>;
  deleteAutomation(id: number): Promise<void>;
  // A/B tests
  getAbTests(userId: number): Promise<AbTest[]>;
  createAbTest(data: InsertAbTest): Promise<AbTest>;
  // Lead score events
  getLeadScoreEvents(contactId: number): Promise<LeadScoreEvent[]>;
  // Reset
  resetDemoData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  async getDemoUser(): Promise<User> {
    let user = db.select().from(users).where(eq(users.id, 1)).get();
    if (!user) {
      await seedDemoData();
      user = db.select().from(users).where(eq(users.id, 1)).get()!;
    }
    return user;
  }

  async getContacts(userId: number): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.userId, userId)).all();
  }

  async getContact(id: number): Promise<Contact | undefined> {
    return db.select().from(contacts).where(eq(contacts.id, id)).get();
  }

  async createContact(data: InsertContact): Promise<Contact> {
    return db.insert(contacts).values(data).returning().get();
  }

  async updateContact(id: number, data: Partial<Contact>): Promise<Contact | undefined> {
    db.update(contacts).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(contacts.id, id)).run();
    return db.select().from(contacts).where(eq(contacts.id, id)).get();
  }

  async deleteContact(id: number): Promise<void> {
    db.delete(contacts).where(eq(contacts.id, id)).run();
    db.delete(leadScoreEvents).where(eq(leadScoreEvents.contactId, id)).run();
  }

  async getSegments(userId: number): Promise<Segment[]> {
    return db.select().from(segments).where(eq(segments.userId, userId)).all();
  }

  async createSegment(data: InsertSegment): Promise<Segment> {
    return db.insert(segments).values(data).returning().get();
  }

  async updateSegment(id: number, data: Partial<Segment>): Promise<Segment | undefined> {
    db.update(segments).set(data).where(eq(segments.id, id)).run();
    return db.select().from(segments).where(eq(segments.id, id)).get();
  }

  async deleteSegment(id: number): Promise<void> {
    db.delete(segments).where(eq(segments.id, id)).run();
  }

  async getCampaigns(userId: number): Promise<Campaign[]> {
    return db.select().from(campaigns).where(eq(campaigns.userId, userId)).orderBy(desc(campaigns.createdAt)).all();
  }

  async getCampaign(id: number): Promise<Campaign | undefined> {
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    return db.insert(campaigns).values(data).returning().get();
  }

  async updateCampaign(id: number, data: Partial<Campaign>): Promise<Campaign | undefined> {
    db.update(campaigns).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(campaigns.id, id)).run();
    return db.select().from(campaigns).where(eq(campaigns.id, id)).get();
  }

  async deleteCampaign(id: number): Promise<void> {
    db.delete(campaigns).where(eq(campaigns.id, id)).run();
  }

  async getTemplates(userId: number): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).where(eq(emailTemplates.userId, userId)).all();
  }

  async createTemplate(data: InsertTemplate): Promise<EmailTemplate> {
    return db.insert(emailTemplates).values(data).returning().get();
  }

  async updateTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate | undefined> {
    db.update(emailTemplates).set(data).where(eq(emailTemplates.id, id)).run();
    return db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).get();
  }

  async deleteTemplate(id: number): Promise<void> {
    db.delete(emailTemplates).where(eq(emailTemplates.id, id)).run();
  }

  async getEmailEvents(userId: number, limit = 100): Promise<EmailEvent[]> {
    return db.select().from(emailEvents).where(eq(emailEvents.userId, userId)).orderBy(desc(emailEvents.createdAt)).limit(limit).all();
  }

  async createEmailEvent(data: Partial<EmailEvent>): Promise<EmailEvent> {
    return db.insert(emailEvents).values({
      userId: data.userId!,
      campaignId: data.campaignId,
      contactId: data.contactId,
      eventType: data.eventType!,
      metadata: data.metadata || "{}",
      createdAt: new Date().toISOString(),
    }).returning().get();
  }

  async getAutomations(userId: number): Promise<Automation[]> {
    return db.select().from(automations).where(eq(automations.userId, userId)).all();
  }

  async createAutomation(data: InsertAutomation): Promise<Automation> {
    return db.insert(automations).values(data).returning().get();
  }

  async updateAutomation(id: number, data: Partial<Automation>): Promise<Automation | undefined> {
    db.update(automations).set(data).where(eq(automations.id, id)).run();
    return db.select().from(automations).where(eq(automations.id, id)).get();
  }

  async deleteAutomation(id: number): Promise<void> {
    db.delete(automations).where(eq(automations.id, id)).run();
  }

  async getAbTests(userId: number): Promise<AbTest[]> {
    return db.select().from(abTests).where(eq(abTests.userId, userId)).all();
  }

  async createAbTest(data: InsertAbTest): Promise<AbTest> {
    return db.insert(abTests).values(data).returning().get();
  }

  async getLeadScoreEvents(contactId: number): Promise<LeadScoreEvent[]> {
    return db.select().from(leadScoreEvents).where(eq(leadScoreEvents.contactId, contactId)).orderBy(desc(leadScoreEvents.createdAt)).all();
  }

  async resetDemoData(): Promise<void> {
    // Delete all demo data (tables use user_id = 1)
    db.delete(leadScoreEvents).run();
    db.delete(emailEvents).run();
    db.delete(abTests).run();
    db.delete(automations).run();
    db.delete(emailTemplates).run();
    db.delete(campaigns).run();
    db.delete(segments).run();
    db.delete(contacts).run();
    db.delete(users).run();
    await seedDemoData();
  }
}

export const storage = new DatabaseStorage();
