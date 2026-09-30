import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(process.env.DB_FILE || "data.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT, xp INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS solved (user_id INTEGER, puzzle_id TEXT, PRIMARY KEY (user_id, puzzle_id));
`);
export const upsertUser = (id, name) =>
  db.prepare("INSERT INTO users (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name").run(id, name);
export const getUser = (id) => db.prepare("SELECT id, name, xp FROM users WHERE id = ?").get(id);
export const solvedIds = (id) => db.prepare("SELECT puzzle_id FROM solved WHERE user_id = ?").all(id).map((r) => r.puzzle_id);
export const top = (n = 20) => db.prepare("SELECT name, xp FROM users ORDER BY xp DESC LIMIT ?").all(n);
// Bir masala uchun XP faqat bir marta beriladi
export function award(id, puzzleId, xp) {
  const r = db.prepare("INSERT OR IGNORE INTO solved (user_id, puzzle_id) VALUES (?, ?)").run(id, puzzleId);
  if (r.changes) db.prepare("UPDATE users SET xp = xp + ? WHERE id = ?").run(xp, id);
  return r.changes > 0;
}
export const addXp = (id, xp) => db.prepare("UPDATE users SET xp = xp + ? WHERE id = ?").run(xp, id);
