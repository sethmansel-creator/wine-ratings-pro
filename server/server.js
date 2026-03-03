import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import fs from "fs";
import crypto from "crypto";

import { openDb, run, get, all } from "./db.js";
import { signToken, authMiddleware } from "./auth.js";

dotenv.config();

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const DB_FILE = process.env.DB_FILE || "./data.sqlite";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

const db = openDb(DB_FILE);

// Initialize database
const schema = fs.readFileSync(new URL("./schema.sql", import.meta.url), "utf8");
db.exec(schema);

function uid() {
  return crypto.randomBytes(16).toString("hex");
}

function safeUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

// Health check
app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

// -------- AUTH --------
app.post("/api/auth/register", async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const password = req.body.password;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Email required, password must be 8+ chars." });
  }

  const existing = await get(db, "SELECT id FROM users WHERE email = ?", [email]);
  if (existing) return res.status(409).json({ error: "Email already exists." });

  const hash = await bcrypt.hash(password, 10);
  const id = uid();

  await run(db,
    "INSERT INTO users (id,email,password_hash,created_at) VALUES (?,?,?,?)",
    [id, email, hash, Date.now()]
  );

  const token = signToken({ userId: id, email }, JWT_SECRET);
  res.json({ token, email });
});

app.post("/api/auth/login", async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const password = req.body.password;

  const user = await get(db, "SELECT * FROM users WHERE email = ?", [email]);
  if (!user) return res.status(401).json({ error: "Invalid email/password." });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email/password." });

  const token = signToken({ userId: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, email: user.email });
});

// -------- RATINGS --------
app.get("/api/ratings", authMiddleware(JWT_SECRET), async (req, res) => {
  const rows = await all(db,
    "SELECT * FROM ratings WHERE user_id = ? ORDER BY created_at DESC",
    [req.user.userId]
  );

  res.json(rows.map(r => ({
    ...r,
    favorite: !!r.favorite,
    tags: JSON.parse(r.tags || "[]")
  })));
});

app.post("/api/ratings", authMiddleware(JWT_SECRET), async (req, res) => {
  const b = req.body;
  const id = uid();
  const now = Date.now();

  await run(db, `
    INSERT INTO ratings
    (id,user_id,wine_name,vintage,style,price,my_score,we_score,notes,source_url,favorite,tags,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `, [
    id,
    req.user.userId,
    b.wineName,
    b.vintage || "",
    b.style || "",
    b.price || "",
    b.myScore,
    b.weScore || null,
    b.notes || "",
    safeUrl(b.sourceUrl),
    b.favorite ? 1 : 0,
    JSON.stringify(b.tags || []),
    now,
    now
  ]);

  const row = await get(db, "SELECT * FROM ratings WHERE id = ?", [id]);
  res.json(row);
});

app.delete("/api/ratings/:id", authMiddleware(JWT_SECRET), async (req, res) => {
  await run(db,
    "DELETE FROM ratings WHERE id = ? AND user_id = ?",
    [req.params.id, req.user.userId]
  );
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});