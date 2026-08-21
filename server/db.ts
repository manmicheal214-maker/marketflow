import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

export const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
try { sqlite.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`); } catch { /* column already exists */ }
sqlite.exec(`CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, token_hash TEXT NOT NULL UNIQUE, user_id INTEGER NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

export const db = drizzle(sqlite);
