import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Express, Request, Response, NextFunction } from "express";
import { sqlite } from "./db";
import { seedDemoData } from "./seed";

const scrypt = promisify(scryptCallback);
const COOKIE = "marketflow_session";
const SESSION_DAYS = 30;
type AuthUser = { id:number; username:string; email:string; passwordHash:string|null; fullName:string; avatarColor:string; createdAt:string };
declare global { namespace Express { interface Request { user?: AuthUser } } }

function ensureAuthSchema() {
  try { sqlite.exec("ALTER TABLE users ADD COLUMN password_hash TEXT"); } catch {}
  sqlite.exec("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
}
export async function hashPassword(password:string) { const salt=randomBytes(16).toString("hex"); const key=await scrypt(password,salt,64) as Buffer; return `${salt}:${key.toString("hex")}`; }
export async function verifyPassword(password:string,encoded:string) { const [salt,hash]=encoded.split(":"); if(!salt||!hash)return false; try { const key=await scrypt(password,salt,64) as Buffer; const expected=Buffer.from(hash,"hex"); return expected.length===key.length&&timingSafeEqual(expected,key); } catch { return false; } }
function parseCookies(header?:string) { if(!header)return {}; return Object.fromEntries(header.split(";").map(p=>{const i=p.indexOf("=");return i<0?["",""]:[p.slice(0,i).trim(),decodeURIComponent(p.slice(i+1).trim())];}).filter(([k])=>k)); }
function setCookie(res:Response,token:string) { const secure=process.env.NODE_ENV==="production"?"; Secure":""; res.setHeader("Set-Cookie",`${COOKIE}=${encodeURIComponent(token)}; Max-Age=${SESSION_DAYS*86400}; Path=/; HttpOnly; SameSite=Lax${secure}`); }
function clearCookie(res:Response) { const secure=process.env.NODE_ENV==="production"?"; Secure":""; res.setHeader("Set-Cookie",`${COOKIE}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`); }
async function hashToken(token:string) { return (await scrypt(token,"marketflow-session",32) as Buffer).toString("hex"); }
async function createSession(userId:number) { const token=randomBytes(32).toString("base64url"); sqlite.prepare("DELETE FROM sessions WHERE expires_at<=?").run(new Date().toISOString()); sqlite.prepare("INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)").run(await hashToken(token),userId,new Date(Date.now()+SESSION_DAYS*86400000).toISOString()); return token; }
async function getUserBySession(token:string|undefined) { if(!token)return undefined; return sqlite.prepare("SELECT u.id,u.username,u.email,u.password_hash AS passwordHash,u.full_name AS fullName,u.avatar_color AS avatarColor,u.created_at AS createdAt FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?").get(await hashToken(token),new Date().toISOString()) as AuthUser|undefined; }
export async function attachUser(req:Request) { const user=await getUserBySession(parseCookies(req.headers.cookie)[COOKIE]); req.user=user; return user; }
export function requireAuth(req:Request,res:Response,next:NextFunction) { attachUser(req).then(u=>u?next():res.status(401).json({message:"Authentication required"})).catch(next); }

export function registerAuthRoutes(app:Express) {
  ensureAuthSchema();
  app.get("/api/auth/me",async(req,res,next)=>{try{const user=await attachUser(req);if(!user)return res.status(401).json({message:"Not authenticated"});const {passwordHash:_,...safe}=user;res.json(safe);}catch(e){next(e);}});
  app.post("/api/auth/register",async(req,res,next)=>{try{
    const {email,password,fullName,username}=req.body??{};
    if(typeof email!=="string"||typeof password!=="string"||typeof fullName!=="string")return res.status(400).json({message:"Email, password, and full name are required"});
    if(password.length<8)return res.status(400).json({message:"Password must be at least 8 characters"});
    const normalized=email.trim().toLowerCase(); if(!/^\S+@\S+\.\S+$/.test(normalized))return res.status(400).json({message:"Invalid email address"});
    if(sqlite.prepare("SELECT id FROM users WHERE email=?").get(normalized))return res.status(409).json({message:"An account with that email already exists"});
    const base=(typeof username==="string"&&username.trim())||normalized.split("@")[0]; const uname=base.toLowerCase().replace(/[^a-z0-9_-]/g,"-").slice(0,40)||`user-${Date.now()}`;
    if(sqlite.prepare("SELECT id FROM users WHERE username=?").get(uname))return res.status(409).json({message:"That username is already taken"});
    const passwordHash=await hashPassword(password); const result=sqlite.prepare("INSERT INTO users (username,email,password_hash,full_name) VALUES (?,?,?,?)").run(uname,normalized,passwordHash,fullName.trim().slice(0,120));
    const user=sqlite.prepare("SELECT id,username,email,password_hash AS passwordHash,full_name AS fullName,avatar_color AS avatarColor,created_at AS createdAt FROM users WHERE id=?").get(result.lastInsertRowid) as AuthUser;
    setCookie(res,await createSession(user.id)); const {passwordHash:_,...safe}=user; res.status(201).json(safe);
  }catch(e){next(e);}});
  app.post("/api/auth/login",async(req,res,next)=>{try{
    const {email,password}=req.body??{}; if(typeof email!=="string"||typeof password!=="string")return res.status(400).json({message:"Email and password are required"});
    const normalized=email.trim().toLowerCase();
    let user=sqlite.prepare("SELECT id,username,email,password_hash AS passwordHash,full_name AS fullName,avatar_color AS avatarColor,created_at AS createdAt FROM users WHERE email=?").get(normalized) as AuthUser|undefined;
    if(normalized==="demo@marketflow.io"&&password==="demo"&&(!user||!user.passwordHash)){
      if(!user){await seedDemoData(); user=sqlite.prepare("SELECT id,username,email,password_hash AS passwordHash,full_name AS fullName,avatar_color AS avatarColor,created_at AS createdAt FROM users WHERE email=?").get(normalized) as AuthUser|undefined;}
      if(user&&!user.passwordHash){const passwordHash=await hashPassword(password);sqlite.prepare("UPDATE users SET password_hash=? WHERE id=?").run(passwordHash,user.id);user.passwordHash=passwordHash;}
    }
    if(!user||!user.passwordHash||!(await verifyPassword(password,user.passwordHash)))return res.status(401).json({message:"Invalid email or password"});
    setCookie(res,await createSession(user.id)); const {passwordHash:_,...safe}=user; res.json(safe);
  }catch(e){next(e);}});
  app.post("/api/auth/logout",async(req,res,next)=>{try{const token=parseCookies(req.headers.cookie)[COOKIE];if(token)sqlite.prepare("DELETE FROM sessions WHERE token_hash=?").run(await hashToken(token));clearCookie(res);res.json({success:true});}catch(e){next(e);}});
}
