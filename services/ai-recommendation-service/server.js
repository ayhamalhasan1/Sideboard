// AI Recommendation Microservice — Service 1: AI Recommendation Service (REST API)
// Connects to: MySQL (reads config & cart for prompt), ai-cache-service (REST API)

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const { createPool } = require("./db/mysql");

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

async function start() {
  // ── MySQL (reads configurations + cart_items to build AI prompt) ──────────────
  app.locals.db = await createPool();

  // ── Session via MySQL Store ──────────────────────────────────────────────────
  const sessionStore = new MySQLStore({
    host:     process.env.DB_HOST     || "localhost",
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || "root",
    password: process.env.DB_PASSWORD || "sideboard123",
    database: process.env.DB_NAME     || "sideboard_db",
  });

  app.use(
    session({
      store: sessionStore,
      secret: process.env.SESSION_SECRET || "mein-geheimes-session-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false, httpOnly: true, maxAge: 604800000, sameSite: "lax" },
    })
  );

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use("/api/ai", require("./routes/ai"));
  app.get("/api/health", (req, res) =>
    res.json({ status: "ok", service: "ai-recommendation-service", cacheService: process.env.AI_CACHE_SERVICE_URL })
  );

  app.listen(PORT, () => console.log(`\n🤖 AI Recommendation Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ ai-recommendation-service failed to start:", err);
  process.exit(1);
});
