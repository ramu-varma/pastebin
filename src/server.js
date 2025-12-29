import "dotenv/config";

import express from "express";
import { nanoid } from "nanoid";
import { redis } from "./redis.js";
import { getNowMs } from "./time.js";

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ---------------- HEALTH CHECK ---------------- */
app.get("/api/healthz", async (req, res) => {
  try {
    await redis.ping();
    res.status(200).json({ ok: true });
  } catch {
    res.status(200).json({ ok: false });
  }
});

/* ---------------- HOME UI ---------------- */
app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Pastebin Lite</title>
      </head>
      <body>
        <h2>Create a Paste</h2>
        <form method="POST" action="/create">
          <textarea name="content" rows="10" cols="60" placeholder="Enter text"></textarea><br/><br/>
          <input type="number" name="ttl_seconds" placeholder="TTL (seconds)" /><br/><br/>
          <input type="number" name="max_views" placeholder="Max views" /><br/><br/>
          <button type="submit">Create Paste</button>
        </form>
      </body>
    </html>
  `);
});

/* ---------------- CREATE PASTE (API) ---------------- */
app.post("/api/pastes", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "content is required" });
  }

  if (
    ttl_seconds !== undefined &&
    (!Number.isInteger(ttl_seconds) || ttl_seconds < 1)
  ) {
    return res.status(400).json({ error: "invalid ttl_seconds" });
  }

  if (
    max_views !== undefined &&
    (!Number.isInteger(max_views) || max_views < 1)
  ) {
    return res.status(400).json({ error: "invalid max_views" });
  }

  const id = nanoid(8);
  const now = getNowMs(req);

  const paste = {
    content,
    created_at: now,
    expires_at: ttl_seconds ? now + ttl_seconds * 1000 : null,
    max_views: max_views ?? null,
    views: 0
  };

  await redis.set(`paste:${id}`, JSON.stringify(paste));

  res.status(201).json({
    id,
    url: `${process.env.BASE_URL || "http://localhost:5000"}/p/${id}`
  });
});

/* ---------------- CREATE PASTE (UI FORM) ---------------- */
app.post("/create", async (req, res) => {
  const { content, ttl_seconds, max_views } = req.body;

  if (!content || content.trim() === "") {
    return res.send("Content is required");
  }

  const id = nanoid(8);
  const now = Date.now();

  const paste = {
    content,
    created_at: now,
    expires_at: ttl_seconds ? now + Number(ttl_seconds) * 1000 : null,
    max_views: max_views ? Number(max_views) : null,
    views: 0
  };

  await redis.set(`paste:${id}`, JSON.stringify(paste));

  res.send(`
    <html>
      <body>
        <p>Paste created successfully!</p>
        <a href="/p/${id}">View Paste</a>
      </body>
    </html>
  `);
});

/* ---------------- FETCH PASTE (API – COUNTS VIEWS) ---------------- */
app.get("/api/pastes/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const raw = await redis.get(key);

  if (!raw) {
    return res.status(404).json({ error: "Not found" });
  }

  const paste = JSON.parse(raw);
  const now = getNowMs(req);

  if (paste.expires_at && now > paste.expires_at) {
    return res.status(404).json({ error: "Expired" });
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).json({ error: "View limit exceeded" });
  }

  paste.views += 1;
  await redis.set(key, JSON.stringify(paste));

  res.status(200).json({
    content: paste.content,
    remaining_views:
      paste.max_views !== null ? paste.max_views - paste.views : null,
    expires_at:
      paste.expires_at !== null
        ? new Date(paste.expires_at).toISOString()
        : null
  });
});

/* ---------------- HTML VIEW (NO VIEW COUNT) ---------------- */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

app.get("/p/:id", async (req, res) => {
  const key = `paste:${req.params.id}`;
  const raw = await redis.get(key);

  if (!raw) {
    return res.status(404).send("Paste not found");
  }

  const paste = JSON.parse(raw);
  const now = getNowMs(req);

  if (paste.expires_at && now > paste.expires_at) {
    return res.status(404).send("Paste expired");
  }

  if (paste.max_views !== null && paste.views >= paste.max_views) {
    return res.status(404).send("Paste unavailable");
  }

  res.status(200).send(`
    <html>
      <head>
        <title>Paste</title>
      </head>
      <body>
        <pre>${escapeHtml(paste.content)}</pre>
      </body>
    </html>
  `);
});

/* ---------------- START SERVER ---------------- */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
