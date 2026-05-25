// Shop Information Service: Zubehör-Katalog
// Databases: Product Information DB (MySQL via SQL API)

const express = require("express");
const router = express.Router();

// GET /api/shop/accessories
router.get("/accessories", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [rows] = await db.query(
      "SELECT * FROM accessories WHERE is_active = TRUE ORDER BY name"
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ GET /shop/accessories:", err);
    res.status(500).json({ fehler: "Konnte Zubehör nicht laden" });
  }
});

// GET /api/shop/accessories/:id
router.get("/accessories/:id", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const [[row]] = await db.query(
      "SELECT * FROM accessories WHERE id = ? AND is_active = TRUE",
      [req.params.id]
    );
    if (!row) return res.status(404).json({ fehler: "Artikel nicht gefunden" });
    res.json(row);
  } catch (err) {
    console.error("❌ GET /shop/accessories/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Laden des Artikels" });
  }
});

// GET /api/shop/search?q=... — MySQL LIKE search (Product Information DB)
router.get("/search", async (req, res) => {
  const db = req.app.locals.db;
  const { q } = req.query;
  if (!q) return res.status(400).json({ fehler: "Suchbegriff fehlt" });

  try {
    const [rows] = await db.query(
      "SELECT * FROM accessories WHERE is_active = TRUE AND (name LIKE ? OR beschreibung LIKE ?)",
      [`%${q}%`, `%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ GET /shop/search:", err);
    res.status(500).json({ fehler: "Suche fehlgeschlagen" });
  }
});

module.exports = router;
