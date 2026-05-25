// Shop-Service: Produkt-Bewertungen
// Migrated from backend/routes/reviews.js (unchanged logic)

const express = require("express");
const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ fehler: "Nicht eingeloggt" });
  next();
}

// GET /api/reviews?product_type=sideboard&product_id=1
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { product_type, product_id } = req.query;
    if (!product_type || !product_id)
      return res.status(400).json({ fehler: "Produkt nicht spezifiziert" });

    const [rows] = await db.query(
      `SELECT r.*, u.username
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       WHERE r.product_type = ? AND r.product_id = ?
       ORDER BY r.created_at DESC`,
      [product_type, product_id]
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ GET /reviews:", err);
    res.status(500).json({ fehler: "Fehler beim Laden der Bewertungen" });
  }
});

// POST /api/reviews — Neue Bewertung (auth required)
router.post("/", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { product_type, product_id, rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5)
      return res.status(400).json({ fehler: "Rating muss zwischen 1 und 5 sein" });

    await db.query(
      "INSERT INTO reviews (user_id, product_type, product_id, rating, comment) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId, product_type, product_id, rating, comment || ""]
    );
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /reviews:", err);
    res.status(500).json({ fehler: "Konnte Bewertung nicht speichern" });
  }
});

// DELETE /api/reviews/:id — Eigene Bewertung löschen (auth required)
router.delete("/:id", requireAuth, async (req, res) => {
  const db = req.app.locals.db;
  try {
    await db.query("DELETE FROM reviews WHERE id = ? AND user_id = ?", [
      req.params.id,
      req.session.userId,
    ]);
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /reviews/:id:", err);
    res.status(500).json({ fehler: "Konnte Bewertung nicht löschen" });
  }
});

module.exports = router;
