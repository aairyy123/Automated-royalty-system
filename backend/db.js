import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const db = new Database(path.join(__dirname, "royalty.db"));

function ensureColumn(tableName, columnName, definition) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
  const exists = columns.some((column) => column.name === columnName);

  if (!exists) {
    db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
  }
}

// CONTENT METADATA
db.prepare(`
  CREATE TABLE IF NOT EXISTS contents (
    cid TEXT PRIMARY KEY,
    creator TEXT NOT NULL,
    username TEXT,
    title TEXT,
    hashtags TEXT,
    content_type TEXT,
    royalty_percent INTEGER,
    created_at TEXT
  )
`).run();

ensureColumn("contents", "username", "TEXT");
ensureColumn("contents", "title", "TEXT");
ensureColumn("contents", "hashtags", "TEXT");

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
