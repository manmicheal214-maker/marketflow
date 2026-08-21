import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response, NextFunction } from "express";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db";
import { sessions, users } from "@shared/schema";

const scrypt = promisify(scryptCallback);
const COOKIE = "marketflow_session";
const DAYS = 30;
type AuthUser = typeof users.$inferSelect;

declare global { namespace Express { interface Request { user?: AuthUser } } }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [salt, hash] = encoded.split(":");
  if (!salt || !hash) return false;
  try {
    const key = await scrypt(password, salt, 64) as Buffer;
    const expected = Buffer.from(hash, "hex");
    return expected.length === key.length && timingSafeEqual(expected, key);
  } catch { return false; }
}

function cookies(header?: string): Record<string,string> {
  if (!header) return {};
  return Object.fromEntries(header.split(";").map(p => {
    const i = p.indexOf("=");
    return i < 0 ? ["", ""] : [p.slice(0,i).trim(), decodeURIComponent(p.slice(i+1).trim())];
  }).filter(([k]) => k));
}

function setCookie(res: Response, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=${encodeURIComponent(token)}; Max-Age=${DAYS*86400}; Path=/; HttpOnly; SameSite=Lax${secure}`);
}
function clearCookie(res: Response) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`);
}
async function sessionToken(token: string): Promise<string> {
  return (await scrypt(token, "marketflow-session", 32) as Buffer).toString("hex");
}
async function createSession(userId: number): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  db.insert(sessions).values({ tokenHash: await sessionToken(token), userId, expiresAt: new Date(Date.now()+DAYS*86400000).toISOString() }).run();
  return token;
}
export async function attachUser(req: Request): Promise<AuthUser|undefined> {
  const token = cookies(req.headers.cookie)[COOKIE];
  if (!token) return undefined;
  const row = db.select({ user: users }).from(sessions).innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, await sessionToken(token)), gt(sessions.expiresAt, new Date().toISOString()))).get();
  req.user = row?.user;
  return row?.user;
}
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  attachUser(req).then(user => user ? next() : res.status(401).json({message:"Authentication required"})).catch(next);
}

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/me", async (req,res,next) => {
    try { const user = await attachUser(req); if (!user) return res.status(401).json({message:"Not authenticated"}); const {passwordHash:_,...safe}=user; res.json(safe); } catch(e){next(e);}
  });
  app.post("/api/auth/register", async (req,res,next) => {
    try {
      const {email,password,fullName,username}=req.body??{};
      if(typeof email!=="string"||typeof password!=="string"||typeof fullName!=="string") return res.status(400).json({message:"Email, password, and full name are required"});
      if(password.length<8) return res.status(400).json({message:"Password must be at least 8 characters"});
      const normalized=email.trim().toLowerCase();
      if(!/^\S+@\S+\.\S+$/.test(normalized)) return res.status(400).json({message:"Invalid email address"});
      if(db.select().from(users).where(eq(users.email,normalized)).get()) return res.status(409).json({message:"An account with that email already exists"});
      const base=(typeof username==="string"&&username.trim())||normalized.split("@")[0];
      const uname=base.toLowerCase().replace(/[^a-z0-9_-]/g,"-").slice(0,40)||`user-${Date.now()}`;
      if(db.select().from(users).where(eq(users.username,uname)).get()) return res.status(409).json({message:"That username is already taken"});
      const user=db.insert(users).values({username:uname,email:normalized,fullName:fullName.trim().slice(0,120),passwordHash:await hashPassword(password)}).returning().get();
      setCookie(res,await createSession(user.id)); const {passwordHash:_,...safe}=user; res.status(201).json(safe);
    } catch(e){next(e);}
  });
  app.post("/api/auth/login", async (req,res,next) => {
    try { const {email,password}=req.body??{}; if(typeof email!=="string"||typeof password!=="string") return res.status(400).json({message:"Email and password are required"}); const user=db.select().from(users).where(eq(users.email,email.trim().toLowerCase())).get(); if(!user||!user.passwordHash||!(await verifyPassword(password,user.passwordHash))) return res.status(401).json({message:"Invalid email or password"}); setCookie(res,await createSession(user.id)); const {passwordHash:_,...safe}=user; res.json(safe); } catch(e){next(e);}
  });
  app.post("/api/auth/logout", async (req,res,next) => {
    try { const token=cookies(req.headers.cookie)[COOKIE]; if(token) db.delete(sessions).where(eq(sessions.tokenHash,await sessionToken(token))).run(); clearCookie(res); res.json({success:true}); } catch(e){next(e);}
  });
}
