// Shopping Cart Microservice
// Cart data (accessories + sideboard configs): Redis
// Sessions: Redis (connect-redis)
// MySQL: only for accessories lookup and order persistence

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const { createPool } = require("./db/mysql");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

async function start() {
  // ── MySQL: accessories catalog + orders ──────────────────────────────────────
  const db = await createPool();
  app.locals.db = db;

  // ── Redis: cart data + sessions ──────────────────────────────────────────────
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });

  redisClient.on("error", (err) => console.error("❌ Redis error:", err));
  await redisClient.connect();
  console.log("✅ Redis verbunden (cart-service)");

  app.locals.redis = redisClient;

  // ── Session store: Redis ─────────────────────────────────────────────────────
  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || "mein-geheimes-session-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false, httpOnly: true, maxAge: 604800000, sameSite: "lax" },
    })
  );

  // ── Routes ───────────────────────────────────────────────────────────────────
  app.use("/api/cart", require("./routes/cart"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "cart-service" }));

  app.listen(PORT, () => console.log(`\n🛒 Shopping Cart Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ cart-service failed to start:", err);
  process.exit(1);
});
