require("dotenv").config();
const express = require("express");
const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;
const { createPool } = require("./db/mysql");
const { createDriver } = require("./db/neo4j");

const app = express();
const PORT = process.env.PORT || 3005;

app.use(express.json());

async function start() {
  // ── MySQL (AI Cache + reading configurations/cart for prompt building) ────────
  app.locals.db = await createPool();

  // ── Neo4j (Graph DB — recommendation data) ───────────────────────────────────
  await createDriver(); // populates module-level driver; gracefully no-ops if URI missing

  // ── Redis Session ────────────────────────────────────────────────────────────
  const redis = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });
  redis.on("error", (err) => console.error("Redis Fehler (ai-service):", err));
  await redis.connect();
  console.log("✅ Redis verbunden (ai-service)");

  app.use(
    session({
      store: new RedisStore({ client: redis }),
      secret: process.env.SESSION_SECRET || "mein-geheimes-session-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false, httpOnly: true, maxAge: 604800000, sameSite: "lax" },
    })
  );

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use("/api/ai", require("./routes/ai"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "ai-service" }));

  app.listen(PORT, () => console.log(`\n🤖 AI Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ ai-service failed to start:", err);
  process.exit(1);
});
