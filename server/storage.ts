import { db } from "./db";
import { seedDemoData } from "./seed";
import { currentUserId } from "./request-context";
import { users, contacts, segments, campaigns, emailTemplates, emailEvents, automations, abTests, leadScoreEvents } from "@shared/schema";
import type { User, InsertUser, Contact, InsertContact, Segment, InsertSegment, Campaign, InsertCampaign, EmailTemplate, InsertTemplate, EmailEvent, Automation, InsertAutomation, AbTest, InsertAbTest, LeadScoreEvent } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>; getDemoUser(): Promise<User>;
  getContacts(userId: number): Promise<Contact[]>; getContact(id: number): Promise<Contact | undefined>; createContact(data: InsertContact): Promise<Contact>; updateContact(id: number, data: Partial<Contact>): Promise<Contact | undefined>; deleteContact(id: number): Promise<void>;
  getSegments(userId: number): Promise<Segment[]>; createSegment(data: InsertSegment): Promise<Segment>; updateSegment(id: number, data: Partial<Segment>): Promise<Segment | undefined>; deleteSegment(id: number): Promise<void>;
  getCampaigns(userId: number): Promise<Campaign[]>; getCampaign(id: number): Promise<Campaign | undefined>; createCampaign(data: InsertCampaign): Promise<Campaign>; updateCampaign(id: number, data: Partial<Campaign>): Promise<Campaign | undefined>; deleteCampaign(id: number): Promise<void>;
  getTemplates(userId: number): Promise<EmailTemplate[]>; createTemplate(data: InsertTemplate): Promise<EmailTemplate>; updateTemplate(id: number, data: Partial<EmailTemplate>): Promise<EmailTemplate | undefined>; deleteTemplate(id: number): Promise<void>;
  getEmailEvents(userId: number, limit?: number): Promise<EmailEvent[]>; createEmailEvent(data: Partial<EmailEvent>): Promise<EmailEvent>;
  getAutomations(userId: number): Promise<Automation[]>; createAutomation(data: InsertAutomation): Promise<Automation>; updateAutomation(id: number, data: Partial<Automation>): Promise<Automation | undefined>; deleteAutomation(id: number): Promise<void>;
  getAbTests(userId: number): Promise<AbTest[]>; createAbTest(data: InsertAbTest): Promise<AbTest>;
  getLeadScoreEvents(contactId: number): Promise<LeadScoreEvent[]>; resetDemoData(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  private uid(fallback: number) { return currentUserId(fallback); }
  async getUser(id: number) { return db.select().from(users).where(eq(users.id, id)).get(); }
  async getDemoUser() { let user = db.select().from(users).where(eq(users.id, 1)).get(); if (!user) { await seedDemoData(); user = db.select().from(users).where(eq(users.id, 1)).get()!; } return user; }

  async getContacts(userId: number) { return db.select().from(contacts).where(eq(contacts.userId, this.uid(userId))).all(); }
  async getContact(id: number) { return db.select().from(contacts).where(and(eq(contacts.id, id), eq(contacts.userId, this.uid()))).get(); }
  async createContact(data: InsertContact) { return db.insert(contacts).values({ ...data, userId: this.uid(data.userId) }).returning().get(); }
  async updateContact(id: number, data: Partial<Contact>) { const uid=this.uid(); db.update(contacts).set({ ...data, userId: undefined, updatedAt: new Date().toISOString() }).where(and(eq(contacts.id,id),eq(contacts.userId,uid))).run(); return this.getContact(id); }
  async deleteContact(id: number) { const uid=this.uid(); db.delete(leadScoreEvents).where(and(eq(leadScoreEvents.contactId,id),eq(leadScoreEvents.userId,uid))).run(); db.delete(contacts).where(and(eq(contacts.id,id),eq(contacts.userId,uid))).run(); }

  async getSegments(userId: number) { return db.select().from(segments).where(eq(segments.userId,this.uid(userId))).all(); }
  async createSegment(data: InsertSegment) { return db.insert(segments).values({ ...data, userId:this.uid(data.userId) }).returning().get(); }
  async updateSegment(id: number, data: Partial<Segment>) { const uid=this.uid(); db.update(segments).set({ ...data, userId:undefined }).where(and(eq(segments.id,id),eq(segments.userId,uid))).run(); return db.select().from(segments).where(and(eq(segments.id,id),eq(segments.userId,uid))).get(); }
  async deleteSegment(id: number) { db.delete(segments).where(and(eq(segments.id,id),eq(segments.userId,this.uid()))).run(); }

  async getCampaigns(userId: number) { return db.select().from(campaigns).where(eq(campaigns.userId,this.uid(userId))).orderBy(desc(campaigns.createdAt)).all(); }
  async getCampaign(id: number) { return db.select().from(campaigns).where(and(eq(campaigns.id,id),eq(campaigns.userId,this.uid()))).get(); }
  async createCampaign(data: InsertCampaign) { return db.insert(campaigns).values({ ...data, userId:this.uid(data.userId) }).returning().get(); }
  async updateCampaign(id: number, data: Partial<Campaign>) { const uid=this.uid(); db.update(campaigns).set({ ...data, userId:undefined, updatedAt:new Date().toISOString() }).where(and(eq(campaigns.id,id),eq(campaigns.userId,uid))).run(); return this.getCampaign(id); }
  async deleteCampaign(id: number) { db.delete(campaigns).where(and(eq(campaigns.id,id),eq(campaigns.userId,this.uid()))).run(); }

  async getTemplates(userId: number) { return db.select().from(emailTemplates).where(eq(emailTemplates.userId,this.uid(userId))).all(); }
  async createTemplate(data: InsertTemplate) { return db.insert(emailTemplates).values({ ...data, userId:this.uid(data.userId) }).returning().get(); }
  async updateTemplate(id: number, data: Partial<EmailTemplate>) { const uid=this.uid(); db.update(emailTemplates).set({ ...data, userId:undefined }).where(and(eq(emailTemplates.id,id),eq(emailTemplates.userId,uid))).run(); return db.select().from(emailTemplates).where(and(eq(emailTemplates.id,id),eq(emailTemplates.userId,uid))).get(); }
  async deleteTemplate(id: number) { db.delete(emailTemplates).where(and(eq(emailTemplates.id,id),eq(emailTemplates.userId,this.uid()))).run(); }

  async getEmailEvents(userId: number, limit=100) { return db.select().from(emailEvents).where(eq(emailEvents.userId,this.uid(userId))).orderBy(desc(emailEvents.createdAt)).limit(limit).all(); }
  async createEmailEvent(data: Partial<EmailEvent>) { return db.insert(emailEvents).values({ userId:this.uid(data.userId), campaignId:data.campaignId, contactId:data.contactId, eventType:data.eventType!, metadata:data.metadata||"{}", createdAt:new Date().toISOString() }).returning().get(); }

  async getAutomations(userId: number) { return db.select().from(automations).where(eq(automations.userId,this.uid(userId))).all(); }
  async createAutomation(data: InsertAutomation) { return db.insert(automations).values({ ...data, userId:this.uid(data.userId) }).returning().get(); }
  async updateAutomation(id: number, data: Partial<Automation>) { const uid=this.uid(); db.update(automations).set({ ...data, userId:undefined }).where(and(eq(automations.id,id),eq(automations.userId,uid))).run(); return db.select().from(automations).where(and(eq(automations.id,id),eq(automations.userId,uid))).get(); }
  async deleteAutomation(id: number) { db.delete(automations).where(and(eq(automations.id,id),eq(automations.userId,this.uid()))).run(); }

  async getAbTests(userId: number) { return db.select().from(abTests).where(eq(abTests.userId,this.uid(userId))).all(); }
  async createAbTest(data: InsertAbTest) { return db.insert(abTests).values({ ...data, userId:this.uid(data.userId) }).returning().get(); }
  async getLeadScoreEvents(contactId: number) { return db.select().from(leadScoreEvents).where(and(eq(leadScoreEvents.contactId,contactId),eq(leadScoreEvents.userId,this.uid()))).orderBy(desc(leadScoreEvents.createdAt)).all(); }

  async resetDemoData() { db.delete(leadScoreEvents).run(); db.delete(emailEvents).run(); db.delete(abTests).run(); db.delete(automations).run(); db.delete(emailTemplates).run(); db.delete(campaigns).run(); db.delete(segments).run(); db.delete(contacts).run(); db.delete(users).run(); await seedDemoData(); }
}
export const storage = new DatabaseStorage();
