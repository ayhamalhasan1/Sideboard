// AI Cache Store — REST API
// Called by ai-recommendation-service to check/store cached Gemini responses.
// Storage: MySQL ai_cache table (via SQL API).

const express = require("express");
const router = express.Router();

// GET /cache/:hash — Look up a cached response
router.get("/:hash", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT response FROM ai_cache WHERE prompt_hash = ? AND expires_at > NOW()",
      [req.params.hash]
    );
    if (rows.length === 0) return res.status(404).json({ cached: false });
    res.json({ cached: true, response: rows[0].response });
  } catch (err) {
    console.error("❌ GET /cache/:hash:", err);
    res.status(500).json({ fehler: "Cache-Lookup fehlgeschlagen" });
  }
});

// POST /cache — Store a new cache entry (1-day TTL)
router.post("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { hash, response } = req.body;
    if (!hash || !response) return res.status(400).json({ fehler: "hash und response erforderlich" });

    await db.query(
      `INSERT INTO ai_cache (prompt_hash, response, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))
       ON DUPLICATE KEY UPDATE response = VALUES(response), expires_at = VALUES(expires_at)`,
      [hash, response]
    );
    res.json({ gespeichert: true });
  } catch (err) {
    console.error("❌ POST /cache:", err);
    res.status(500).json({ fehler: "Cache-Speicherung fehlgeschlagen" });
  }
});

// DELETE /cache/expired — Clean up expired entries
router.delete("/expired", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [result] = await db.query("DELETE FROM ai_cache WHERE expires_at <= NOW()");
    res.json({ geloescht: result.affectedRows });
  } catch (err) {
    console.error("❌ DELETE /cache/expired:", err);
    res.status(500).json({ fehler: "Cleanup fehlgeschlagen" });
  }
});

module.exports = router;
