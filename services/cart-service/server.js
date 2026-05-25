// Shopping Cart Microservice
// Database: Shopping Cart Cache → MySQL (via SQL API)

require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const { createPool } = require("./db/mysql");

const app = express();
const PORT = process.env.PORT || 3002;

app.use(express.json());

async function start() {
  // ── MySQL: Shopping Cart Cache (SQL API) ─────────────────────────────────────
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
  app.use("/api/cart", require("./routes/cart"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "cart-service" }));

  app.listen(PORT, () => console.log(`\n🛒 Shopping Cart Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ cart-service failed to start:", err);
  process.exit(1);
});
