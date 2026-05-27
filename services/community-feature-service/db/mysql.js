const mysql = require("mysql2/promise");

// Pool factory — call twice for two logical databases (configurator DB + sideboard DB)
async function createPool(opts = {}) {
  const config = {
    host:             opts.host     || process.env.DB_HOST     || "localhost",
    user:             opts.user     || process.env.DB_USER     || "root",
    password:         opts.password || process.env.DB_PASSWORD || "sideboard123",
    database:         opts.database || process.env.DB_NAME     || "sideboard_db",
    waitForConnections: true,
    connectionLimit:  10,
  };

  let attempts = 0;
  while (attempts < 15) {
    try {
      const pool = await mysql.createPool(config);
      await pool.query("SELECT 1");
      console.log(`✅ MySQL verbunden (configurator-service → ${config.database})`);
      return pool;
    } catch (err) {
      attempts++;
      console.log(`⏳ Warte auf MySQL (${config.database})... Versuch ${attempts}/15`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  throw new Error(`MySQL nicht erreichbar nach 15 Versuchen (${config.database})`);
}

module.exports = { createPool };
