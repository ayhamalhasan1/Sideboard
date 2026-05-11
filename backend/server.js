// server.js – Hauptdatei für das Sideboard-Backend (Modular Refactored)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const { createClient } = require("redis");
const RedisStore = require("connect-redis").default;
const mysql = require("mysql2/promise");

const app = express();
const PORT = 3000;

// ============================================
// Middleware
// ============================================
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:8080", "http://127.0.0.1:8080"],
    credentials: true,
  })
);

// ============================================
// Redis-Client erstellen
// ============================================
async function initRedis() {
  const redisClient = createClient({
    socket: {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT) || 6379,
    },
  });

  redisClient.on("error", (err) => console.error("Redis Fehler:", err));
  await redisClient.connect();
  console.log("✅ Redis verbunden");
  app.locals.redisClient = redisClient; // Global zugänglich machen
  return redisClient;
}

// ============================================
// MySQL-Verbindungspool erstellen
// ============================================
async function initDB() {
  let versuche = 0;
  while (versuche < 15) {
    try {
      const db = await mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD || "sideboard123",
        database: process.env.DB_NAME || "sideboard_db",
        waitForConnections: true,
        connectionLimit: 10,
      });
      await db.query("SELECT 1");
      console.log("✅ MySQL verbunden");
      app.locals.db = db; // Global zugänglich machen
      return db;
    } catch (err) {
      versuche++;
      console.log(`⏳ Warte auf MySQL... Versuch ${versuche}/15`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("MySQL nicht erreichbar nach 15 Versuchen");
}

// ============================================
// Session mit Redis-Store einrichten
// ============================================
async function initSession(redisClient) {
  const store = new RedisStore({ client: redisClient });
  app.use(
    session({
      store: store,
      secret: process.env.SESSION_SECRET || "mein-geheimes-session-secret",
      resave: false,
      saveUninitialized: true,
      cookie: {
        secure: false, // Für Entwicklung
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 1 Woche
        sameSite: "lax",
      },
    })
  );
  console.log("✅ Session mit Redis-Store eingerichtet");
}

// ============================================
// Routen einbinden
// ============================================
const configRoutes = require("./routes/config");
const shopRoutes = require("./routes/shop");
const aiRoutes = require("./routes/ai");
const reviewsRoutes = require("./routes/reviews");
const communityRoutes = require("./routes/community");

function registerRoutes() {
  app.use("/api/config", configRoutes);
  app.use("/api/shop", shopRoutes);
  app.use("/api/ai", aiRoutes);
  app.use("/api/reviews", reviewsRoutes);
  app.use("/api/community", communityRoutes);

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));
}

// ============================================
// Server starten
// ============================================
async function start() {
  try {
    const redisClient = await initRedis();
    await initDB();
    await initSession(redisClient);
    registerRoutes();

    app.listen(PORT, () => {
      console.log(`\n🚀 Backend läuft auf Port ${PORT} (E-Commerce Mega Upgrade)`);
    });
  } catch (err) {
    console.error("❌ Fehler beim Starten:", err);
    process.exit(1);
  }
}

start();
