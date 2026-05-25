const mysql = require("mysql2/promise");

async function createPool() {
  let attempts = 0;
  while (attempts < 15) {
    try {
      const pool = await mysql.createPool({
        host:             process.env.DB_HOST     || "localhost",
        user:             process.env.DB_USER     || "root",
        password:         process.env.DB_PASSWORD || "sideboard123",
        database:         process.env.DB_NAME     || "sideboard_db",
        waitForConnections: true,
        connectionLimit:  10,
      });
      await pool.query("SELECT 1");
      console.log("✅ MySQL verbunden (ai-recommendation-service)");
      return pool;
    } catch (err) {
      attempts++;
      console.log(`⏳ Warte auf MySQL... Versuch ${attempts}/15`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error("MySQL nicht erreichbar nach 15 Versuchen");
}

module.exports = { createPool };
