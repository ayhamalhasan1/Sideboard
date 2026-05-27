const express = require("express");
const router = express.Router();

// Community: Alle öffentlichen Entwürfe abrufen
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [columns] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'community_designs' AND COLUMN_NAME IN ('design_name', 'name')"
    );
    const columnName = columns.some(col => col.COLUMN_NAME === 'design_name') ? 'design_name' : 'name';

    const [rows] = await db.query(
      `SELECT id, ${columnName} AS design_name, farbe, groesse_cm, oberflaeche, material, finish, width_cm, height_cm, depth_cm, deckel_offen, created_at FROM community_designs ORDER BY created_at DESC LIMIT 50`
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
    const payload = req.body;
    const designName = payload.design_name || payload.name || 'Community Sideboard';

    const [columns] = await db.query(
      "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'community_designs' AND COLUMN_NAME IN ('design_name', 'name')"
    );
    const columnName = columns.some(col => col.COLUMN_NAME === 'design_name') ? 'design_name' : 'name';

    const sql = `INSERT INTO community_designs (session_id, user_id, ${columnName}, config_snapshot, farbe, groesse, oberflaeche, groesse_cm, material, finish, width_cm, height_cm, depth_cm, deckel_offen, preis)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await db.query(sql, [
      req.sessionID,
      req.session.userId || null,
      designName,
      JSON.stringify(payload),
      payload.farbe,
      payload.groesse,
      payload.oberflaeche,
      payload.groesse_cm,
      payload.material,
      payload.finish,
      payload.width_cm,
      payload.height_cm,
      payload.depth_cm,
      payload.deckel_offen,
      payload.preis
    ]);

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