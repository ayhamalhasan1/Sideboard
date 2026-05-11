const express = require("express");
const router = express.Router();

// Community: Alle öffentlichen Entwürfe abrufen
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT id, name, farbe, groesse, material, finish, width_cm, height_cm, depth_cm, deckel_offen, erstellt_am FROM configurations WHERE is_public = TRUE ORDER BY erstellt_am DESC LIMIT 50"
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Laden der Community-Entwürfe" });
  }
});

// Community: Eigene Konfiguration als öffentlich markieren
router.post("/share", async (req, res) => {
  const db = req.app.locals.db;
  try {
    let { field, value } = getAuthQueryDetails(req);
    const { name } = req.body;

    const [existing] = await db.query(`SELECT id FROM configurations WHERE ${field} = ?`, [value]);
    if (existing.length === 0) return res.status(404).json({ fehler: "Keine Konfiguration gefunden" });

    await db.query(`UPDATE configurations SET is_public = TRUE, name = ? WHERE ${field} = ?`, [name || 'Community Sideboard', value]);
    res.json({ erfolg: true });
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Teilen" });
  }
});

// Community: Einzelnen Entwurf abrufen
router.get("/:id", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT farbe, groesse, material, finish, width_cm, height_cm, depth_cm, deckel_offen FROM configurations WHERE id = ? AND is_public = TRUE",
      [req.params.id]
    );
    if (rows.length === 0) return res.status(404).json({ fehler: "Entwurf nicht gefunden" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

module.exports = router;