import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import pkg from "pg";

import { signToken, authMiddleware } from "./auth.js";

dotenv.config();

const { Pool } = pkg;

const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const app = express();

app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

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

// ---------- HEALTH ----------
app.get("/api/health", (_, res) => {
  res.json({ ok: true });
});

// ---------- AUTH ----------
app.post("/api/auth/register", async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const password = req.body.password;

  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "Email required, password must be 8+ chars." });
  }

  const existing = await pool.query(
    "SELECT id FROM users WHERE email = $1",
    [email]
  );
  if (existing.rows.length) {
    return res.status(409).json({ error: "Email already exists." });
  }

  const hash = await bcrypt.hash(password, 10);
  const id = uid();
  const displayName = (email.split("@")[0] || "Wine Lover").slice(0, 40);

  await pool.query(
    `
    INSERT INTO users (id,email,password_hash,display_name,created_at)
    VALUES ($1,$2,$3,$4,$5)
    `,
    [id, email, hash, displayName, Date.now()]
  );

  const token = signToken({ userId: id, email }, JWT_SECRET);
  res.json({ token, email });
});

app.post("/api/auth/login", async (req, res) => {
  const email = req.body.email?.toLowerCase().trim();
  const password = req.body.password;

  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );
  if (!result.rows.length) {
    return res.status(401).json({ error: "Invalid email/password." });
  }

  const user = result.rows[0];

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid email/password." });

  const token = signToken({ userId: user.id, email: user.email }, JWT_SECRET);
  res.json({ token, email: user.email });
});

// ---------- ME ----------
app.get("/api/me", authMiddleware(JWT_SECRET), async (req, res) => {
  const result = await pool.query(
    "SELECT id,email,display_name,created_at FROM users WHERE id = $1",
    [req.user.userId]
  );

  if (!result.rows.length) {
    return res.status(404).json({ error: "User not found" });
  }

  const user = result.rows[0];

  res.json({
    id: user.id,
    email: user.email,
    displayName: user.display_name || "Wine Lover",
    createdAt: user.created_at
  });
});

// ---------- PUBLIC FEED ----------
app.get("/api/public", async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);

  const result = await pool.query(
    `
    SELECT
      r.id,
      r.wine_name,
      r.vintage,
      r.style,
      r.price,
      r.my_score,
      r.we_score,
      r.notes,
      r.source_url,
      r.favorite,
      r.tags,
      r.created_at,
      u.display_name
    FROM ratings r
    JOIN users u ON u.id = r.user_id
    WHERE r.is_public = true
    ORDER BY r.created_at DESC
    LIMIT $1
    `,
    [limit]
  );

  res.json(
    result.rows.map(r => ({
      id: r.id,
      displayName: r.display_name || "Wine Lover",
      wineName: r.wine_name,
      vintage: r.vintage || "",
      style: r.style || "",
      price: r.price || "",
      myScore: r.my_score,
      weScore: r.we_score,
      notes: r.notes || "",
      sourceUrl: r.source_url || "",
      favorite: r.favorite,
      tags: r.tags || [],
      createdAt: r.created_at
    }))
  );
});

// ---------- PRIVATE RATINGS ----------
app.get("/api/ratings", authMiddleware(JWT_SECRET), async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM ratings WHERE user_id = $1 ORDER BY created_at DESC",
    [req.user.userId]
  );

  res.json(result.rows);
});

app.post("/api/ratings", authMiddleware(JWT_SECRET), async (req, res) => {
  const b = req.body;
  const id = uid();
  const now = Date.now();

  await pool.query(
    `
    INSERT INTO ratings
    (id,user_id,wine_name,vintage,style,price,my_score,we_score,notes,source_url,favorite,tags,is_public,created_at,updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
    `,
    [
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
      b.favorite || false,
      b.tags || [],
      b.isPublic || false,
      now,
      now
    ]
  );

  const row = await pool.query(
    "SELECT * FROM ratings WHERE id = $1",
    [id]
  );

  res.json(row.rows[0]);
});

app.delete("/api/ratings/:id", authMiddleware(JWT_SECRET), async (req, res) => {
  await pool.query(
    "DELETE FROM ratings WHERE id = $1 AND user_id = $2",
    [req.params.id, req.user.userId]
  );
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});