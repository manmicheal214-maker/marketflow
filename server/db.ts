import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

export const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");
sqlite.exec(`
  ALTER TABLE users ADD COLUMN password_hash TEXT;
`);
