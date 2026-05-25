// Konfigurator-Service: Sideboard-Konfigurationen
// Migrated from backend/routes/config.js (unchanged logic)

const express = require("express");
const router = express.Router();

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ fehler: "Nicht eingeloggt" });
  next();
}

// GET /api/config — Aktuelle Konfiguration laden
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { field, value } = getAuthQueryDetails(req);
    const [rows] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
      [value]
    );
    if (rows.length > 0) return res.json(rows[0]);
    res.json({ farbe: "weiss", groesse: "mittel", deckel_offen: false, width_cm: 160, height_cm: 80, depth_cm: 40, material: "Holz", finish: "matt" });
  } catch (err) {
    console.error("❌ GET /config:", err);
    res.status(500).json({ fehler: "Fehler beim Laden" });
  }
});

// POST /api/config — Konfiguration speichern
router.post("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { field, value } = getAuthQueryDetails(req);
    const { farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm } = req.body;

    const [existing] = await db.query(`SELECT id FROM configurations WHERE ${field} = ?`, [value]);
    if (existing.length > 0) {
      await db.query(
        `UPDATE configurations SET farbe=?, groesse=?, deckel_offen=?, material=?, finish=?, width_cm=?, height_cm=?, depth_cm=? WHERE ${field}=?`,
        [farbe, groesse, deckel_offen, material || "Holz", finish || "matt", width_cm || 160, height_cm || 80, depth_cm || 40, value]
      );
    } else {
      await db.query(
        `INSERT INTO configurations (session_id, user_id, farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [req.sessionID, req.session.userId || null, farbe, groesse, deckel_offen, material || "Holz", finish || "matt", width_cm || 160, height_cm || 80, depth_cm || 40]
      );
    }
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /config:", err);
    res.status(500).json({ fehler: "Fehler beim Speichern" });
  }
});

// GET /api/config/saved — Gespeicherte Sideboards (auth required)
router.get("/saved", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT * FROM saved_sideboards WHERE user_id = ? ORDER BY created_at DESC",
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ GET /config/saved:", err);
    res.status(500).json({ fehler: "Fehler beim Laden der Favoriten" });
  }
});

// POST /api/config/saved — Konfiguration als Favorit speichern (auth required)
router.post("/saved", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { name } = req.body;
    const { field, value } = getAuthQueryDetails(req);
    const [konfigs] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
      [value]
    );
    if (konfigs.length === 0) return res.status(404).json({ fehler: "Keine Konfig" });

    await db.query(
      "INSERT INTO saved_sideboards (user_id, name, config_snapshot) VALUES (?, ?, ?)",
      [req.session.userId, name, JSON.stringify(konfigs[0])]
    );
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /config/saved:", err);
    res.status(500).json({ fehler: "Fehler beim Speichern" });
  }
});

// POST /api/config/saved/:id/load — Favorit laden (auth required)
router.post("/saved/:id/load", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [boards] = await db.query(
      "SELECT * FROM saved_sideboards WHERE id = ? AND user_id = ?",
      [req.params.id, req.session.userId]
    );
    if (boards.length === 0) return res.status(404).json({ fehler: "Nicht gefunden" });

    const snap = boards[0].config_snapshot;
    const { field, value } = getAuthQueryDetails(req);
    const [vorhandene] = await db.query(`SELECT id FROM configurations WHERE ${field} = ?`, [value]);

    if (vorhandene.length > 0) {
      await db.query(
        `UPDATE configurations SET farbe=?, groesse=?, deckel_offen=?, material=?, finish=?, width_cm=?, height_cm=?, depth_cm=? WHERE ${field}=?`,
        [snap.farbe, snap.groesse, snap.deckel_offen, snap.material, snap.finish, snap.width_cm, snap.height_cm, snap.depth_cm, value]
      );
    } else {
      await db.query(
        `INSERT INTO configurations (session_id, user_id, farbe, groesse, deckel_offen) VALUES (?, ?, ?, ?, ?)`,
        [req.sessionID, req.session.userId, snap.farbe, snap.groesse, snap.deckel_offen]
      );
    }
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /config/saved/:id/load:", err);
    res.status(500).json({ fehler: "Ladefehler" });
  }
});

// DELETE /api/config/saved/:id — Favorit löschen (auth required)
router.delete("/saved/:id", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await db.query("DELETE FROM saved_sideboards WHERE id = ? AND user_id = ?", [
      req.params.id,
      req.session.userId,
    ]);
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /config/saved/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Löschen" });
  }
});

module.exports = router;
