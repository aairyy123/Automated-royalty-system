import Database from "better-sqlite3";

export const db = new Database("royalty.db");

// CONTENT METADATA
db.prepare(`
  CREATE TABLE IF NOT EXISTS contents (
    cid TEXT PRIMARY KEY,
    creator TEXT NOT NULL,
    content_type TEXT,
    royalty_percent INTEGER,
    created_at TEXT
  )
`).run();

// PAYMENTS (SOURCE OF TRUTH)
db.prepare(`
  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cid TEXT NOT NULL,
    payer TEXT NOT NULL,
    amount INTEGER NOT NULL,       -- stroops
    paid_at TEXT NOT NULL
  )
`).run();

console.log("✅ Database initialized");
