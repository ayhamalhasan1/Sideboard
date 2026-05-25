// AI Recommendation Microservice — Service 2: Cache Store (REST API)
// Provides a REST API for caching Gemini AI responses in MySQL.
// Called internally by ai-recommendation-service only.

require("dotenv").config();
const express = require("express");
const { createPool } = require("./db/mysql");

const app = express();
const PORT = process.env.PORT || 3006;

app.use(express.json());

async function start() {
  // ── MySQL: Cache Store (ai_cache table, via SQL API) ─────────────────────────
  app.locals.db = await createPool();

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use("/cache", require("./routes/cache"));
  app.get("/health", (req, res) => res.json({ status: "ok", service: "ai-cache-service" }));

  app.listen(PORT, () => console.log(`\n💾 AI Cache Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ ai-cache-service failed to start:", err);
  process.exit(1);
});
