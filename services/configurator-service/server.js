// Sideboard Configurator Microservice
// Databases:
//   - Sideboard Configurator DB → MySQL (via SQL API) — configurations & saved sideboards
//   - Sideboard Configurator Picture Store → MySQL metadata + MinIO (actual images)

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const RedisStore = require("connect-redis").default;
const { createClient } = require("redis");
const { createPool } = require("./db/mysql");
const { createMinioClient } = require("./db/minio");

const app = express();
const PORT = process.env.PORT || 3003;

app.use(express.json());

async function start() {
  // ── SQL DB 1: Car Configurator Service — active configurations ────────────────
  const db = await createPool({
    host:     process.env.DB_HOST,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "sideboard_db",
  });
  app.locals.db = db;

  // ── SQL DB 2: Sideboard-Konfigurator DB — saved sideboards ───────────────────
  // In production: separate DB instance. In dev: same instance, same schema.
  const dbSaved = await createPool({
    host:     process.env.DB_SAVED_HOST     || process.env.DB_HOST,
    user:     process.env.DB_SAVED_USER     || process.env.DB_USER,
    password: process.env.DB_SAVED_PASSWORD || process.env.DB_PASSWORD,
    database: process.env.DB_SAVED_NAME     || process.env.DB_NAME || "sideboard_db",
  });
  app.locals.dbSaved = dbSaved;

  // ── MinIO: Picture Store (binary images) ─────────────────────────────────────
  app.locals.minioClient = createMinioClient();

  // Ensure picture metadata table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS configurator_pictures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      farbe VARCHAR(100),
      groesse VARCHAR(50),
      material VARCHAR(100),
      finish VARCHAR(100),
      filename VARCHAR(500) NOT NULL,
      minio_path VARCHAR(1000) NOT NULL,
      is_primary BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── Redis: shared session store ──────────────────────────────────────────────
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });
  redisClient.on("error", (err) => console.error("❌ Redis error:", err));
  await redisClient.connect();
  console.log("✅ Redis verbunden (configurator-service)");

  app.use(
    session({
      store: new RedisStore({ client: redisClient }),
      secret: process.env.SESSION_SECRET || "mein-geheimes-session-secret",
      resave: false,
      saveUninitialized: true,
      cookie: { secure: false, httpOnly: true, maxAge: 604800000, sameSite: "lax" },
    })
  );

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use("/api/config", require("./routes/config"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "configurator-service" }));

  app.listen(PORT, () => console.log(`\n⚙️  Sideboard Configurator Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ configurator-service failed to start:", err);
  process.exit(1);
});
