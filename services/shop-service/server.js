// Shop Information Microservice
// Databases: Product Information DB (MySQL) + Product Review Store (MySQL)

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const { createPool } = require("./db/mysql");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

async function start() {
  // ── MySQL: Product Information DB + Product Review Store ─────────────────────
  const db = await createPool();
  app.locals.db = db;

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
  app.use("/api/shop",    require("./routes/shop"));
  app.use("/api/reviews", require("./routes/reviews"));
  app.get("/api/health",  (req, res) => res.json({ status: "ok", service: "shop-service" }));

  app.listen(PORT, () => console.log(`\n🛍️  Shop Information Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ shop-service failed to start:", err);
  process.exit(1);
});
