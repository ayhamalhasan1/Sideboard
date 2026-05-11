const express = require("express");
const router = express.Router();

// Community: Alle öffentlichen Entwürfe abrufen
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT id, name, farbe, groesse, material, finish, width_cm, height_cm, depth_cm, deckel_offen, created_at FROM community_designs ORDER BY created_at DESC LIMIT 50"
    );
    res.json(rows);
  } catch (err) {
    console.error('Fehler beim Laden der Community-Entwürfe:', err);
    res.status(500).json({ fehler: "Fehler beim Laden der Community-Entwürfe" });
  }
});

// Community: Eigene Konfiguration als öffentlich teilen
router.post("/share", async (req, res) => {
  const db = req.app.locals.db;
  try {
    let { field, value } = getAuthQueryDetails(req);
    const { name } = req.body;

    const [existing] = await db.query(`SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`, [value]);
    if (existing.length === 0) return res.status(404).json({ fehler: "Keine Konfiguration gefunden" });

    const config = existing[0];
    const snapshot = JSON.stringify(config);

    await db.query(
      `INSERT INTO community_designs (session_id, user_id, name, config_snapshot, farbe, groesse, material, finish, width_cm, height_cm, depth_cm, deckel_offen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.sessionID, req.session.userId || null, name || 'Community Sideboard', snapshot, config.farbe, config.groesse, config.material, config.finish, config.width_cm, config.height_cm, config.depth_cm, config.deckel_offen]
    );

    res.json({ erfolg: true });
  } catch (err) {
    console.error('Fehler beim Teilen:', err);
    res.status(500).json({ fehler: "Fehler beim Teilen" });
  }
});

// Community: Einzelnen Entwurf abrufen
router.get("/:id", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT config_snapshot FROM community_designs WHERE id = ?",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ fehler: "Entwurf nicht gefunden" });

    let config;
    try {
      config = JSON.parse(rows[0].config_snapshot);
    } catch (parseErr) {
      // Fallback: Wenn es bereits ein Objekt ist
      config = rows[0].config_snapshot;
    }
    res.json(config);
  } catch (err) {
    console.error('Fehler beim Laden des Entwurfs:', err);
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

module.exports = router;