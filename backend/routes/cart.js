// routes/cart.js – Warenkorb komplett über Redis (extrem schnell)
// Beim Checkout wird der finale Warenkorb in MySQL übertragen.

const express = require("express");
const router = express.Router();

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Erzeugt den Redis-Schlüssel für den Warenkorb dieser Session. */
function cartKey(sessionId) {
  return `cart:${sessionId}`;
}

/** TTL: Warenkorb bleibt 7 Tage in Redis erhalten. */
const CART_TTL_SECONDS = 60 * 60 * 24 * 7;

/**
 * Liest den kompletten Warenkorb aus Redis.
 * Struktur im Hash: Felder = "acc:<accessory_id>" oder "sideboard"
 * Wert = JSON-String { menge, ... weitere Infos }
 */
async function getCartFromRedis(redis, sessionId) {
  const key = cartKey(sessionId);
  const raw = await redis.hGetAll(key);
  const items = [];
  for (const [field, val] of Object.entries(raw)) {
    items.push({ _field: field, ...JSON.parse(val) });
  }
  return items;
}

// ─── GET /api/cart  ──────────────────────────────────────────────────────────
// Gibt den aktuellen Warenkorb zurück (mit aktuellen Preisen aus MySQL).
router.get("/", async (req, res) => {
  const redis = req.app.locals.redisClient;
  const db = req.app.locals.db;

  try {
    const key = cartKey(req.sessionID);
    const raw = await redis.hGetAll(key);

    if (!raw || Object.keys(raw).length === 0) {
      return res.json([]);
    }

    const result = [];

    for (const [field, val] of Object.entries(raw)) {
      const entry = JSON.parse(val);

      if (field === "sideboard") {
        // Sideboard-Konfiguration – Preis berechnen
        const k = entry;
        const basePrice =
          k.groesse === "gross" ? 399.0 : k.groesse === "mittel" ? 299.0 : 199.0;
        const matPrice = k.material === "Metall" ? 50 : k.material === "Glas" ? 100 : 0;
        const finishPrice = k.finish === "glänzend" ? 30 : 0;
        result.unshift({
          id: "sideboard",
          menge: 1,
          name: `Sideboard (Größe: ${k.groesse}, Farbe: ${k.farbe}, Material: ${k.material}, Finish: ${k.finish})`,
          preis: basePrice + matPrice + finishPrice,
          bild_url: "hero_sideboard.png",
        });
      } else if (field.startsWith("acc:")) {
        // Zubehör – aktuellen Preis aus MySQL nachladen
        const accessoryId = parseInt(field.replace("acc:", ""), 10);
        const [[acc]] = await db.query(
          "SELECT id, name, preis, bild_url FROM accessories WHERE id = ? AND is_active = TRUE",
          [accessoryId]
        );
        if (acc) {
          result.push({
            id: accessoryId,
            menge: entry.menge,
            name: acc.name,
            preis: acc.preis,
            bild_url: acc.bild_url,
          });
        }
      }
    }

    res.json(result);
  } catch (err) {
    console.error("❌ Redis GET /cart:", err);
    res.status(500).json({ fehler: "Warenkorb konnte nicht geladen werden" });
  }
});

// ─── POST /api/cart  ─────────────────────────────────────────────────────────
// Fügt ein Zubehör-Artikel zum Warenkorb hinzu (menge +1).
router.post("/", async (req, res) => {
  const redis = req.app.locals.redisClient;
  const db = req.app.locals.db;

  try {
    const { accessory_id } = req.body;
    if (!accessory_id) return res.status(400).json({ fehler: "accessory_id fehlt" });

    // Artikel in DB prüfen
    const [[acc]] = await db.query(
      "SELECT id FROM accessories WHERE id = ? AND is_active = TRUE",
      [accessory_id]
    );
    if (!acc) return res.status(404).json({ fehler: "Artikel nicht gefunden" });

    const key = cartKey(req.sessionID);
    const field = `acc:${accessory_id}`;

    const existing = await redis.hGet(key, field);
    const entry = existing ? JSON.parse(existing) : { menge: 0 };
    entry.menge += 1;

    await redis.hSet(key, field, JSON.stringify(entry));
    await redis.expire(key, CART_TTL_SECONDS);

    res.json({ erfolg: true, menge: entry.menge });
  } catch (err) {
    console.error("❌ Redis POST /cart:", err);
    res.status(500).json({ fehler: "Fehler beim Hinzufügen" });
  }
});

// ─── PUT /api/cart/:id  ──────────────────────────────────────────────────────
// Aktualisiert die Menge eines Artikels.
router.put("/:id", async (req, res) => {
  const redis = req.app.locals.redisClient;

  try {
    const { menge } = req.body;
    const itemId = req.params.id;

    if (itemId === "sideboard") return res.json({ erfolg: true }); // unveränderlich

    if (!menge || menge < 1)
      return res.status(400).json({ fehler: "Menge muss mindestens 1 sein" });

    const key = cartKey(req.sessionID);
    const field = `acc:${itemId}`;

    const existing = await redis.hGet(key, field);
    if (!existing) return res.status(404).json({ fehler: "Artikel nicht im Warenkorb" });

    const entry = JSON.parse(existing);
    entry.menge = parseInt(menge, 10);

    await redis.hSet(key, field, JSON.stringify(entry));
    await redis.expire(key, CART_TTL_SECONDS);

    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ Redis PUT /cart/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Aktualisieren" });
  }
});

// ─── DELETE /api/cart/:id  ───────────────────────────────────────────────────
// Entfernt einen einzelnen Artikel aus dem Warenkorb.
router.delete("/:id", async (req, res) => {
  const redis = req.app.locals.redisClient;

  try {
    const key = cartKey(req.sessionID);
    const itemId = req.params.id;

    if (itemId === "sideboard") {
      await redis.hDel(key, "sideboard");
    } else {
      await redis.hDel(key, `acc:${itemId}`);
    }

    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ Redis DELETE /cart/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Entfernen" });
  }
});

// ─── DELETE /api/cart  ───────────────────────────────────────────────────────
// Leert den kompletten Warenkorb.
router.delete("/", async (req, res) => {
  const redis = req.app.locals.redisClient;
  try {
    await redis.del(cartKey(req.sessionID));
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ Redis DELETE /cart:", err);
    res.status(500).json({ fehler: "Fehler beim Leeren des Warenkorbs" });
  }
});

// ─── POST /api/cart/sideboard  ───────────────────────────────────────────────
// Speichert eine Sideboard-Konfiguration in den Warenkorb (Redis).
router.post("/sideboard", async (req, res) => {
  const redis = req.app.locals.redisClient;

  try {
    const config = req.body; // { groesse, farbe, material, finish, ... }
    if (!config || !config.groesse)
      return res.status(400).json({ fehler: "Konfiguration unvollständig" });

    const key = cartKey(req.sessionID);
    await redis.hSet(key, "sideboard", JSON.stringify(config));
    await redis.expire(key, CART_TTL_SECONDS);

    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ Redis POST /cart/sideboard:", err);
    res.status(500).json({ fehler: "Fehler beim Speichern der Konfiguration" });
  }
});

// ─── POST /api/cart/checkout  ────────────────────────────────────────────────
// Überträgt den Redis-Warenkorb in MySQL und erstellt die finale Bestellung.
router.post("/checkout", async (req, res) => {
  const redis = req.app.locals.redisClient;
  const db = req.app.locals.db;

  try {
    const key = cartKey(req.sessionID);
    const raw = await redis.hGetAll(key);

    if (!raw || Object.keys(raw).length === 0) {
      return res.status(400).json({ fehler: "Warenkorb ist leer" });
    }

    const { shipping_address } = req.body;
    let total = 0;
    const orderLines = []; // Wird in order_items eingetragen
    let sideboardItem = null;

    // ── Alle Positionen auflösen ────────────────────────────────────────
    for (const [field, val] of Object.entries(raw)) {
      const entry = JSON.parse(val);

      if (field === "sideboard") {
        const k = entry;
        const basePrice =
          k.groesse === "gross" ? 399.0 : k.groesse === "mittel" ? 299.0 : 199.0;
        const matPrice = k.material === "Metall" ? 50 : k.material === "Glas" ? 100 : 0;
        const finalPrice = basePrice + matPrice + (k.finish === "glänzend" ? 30 : 0);
        total += finalPrice;
        sideboardItem = {
          product_type: "sideboard",
          product_name: `Sideboard ${k.farbe}`,
          quantity: 1,
          unit_price: finalPrice,
          config_snapshot: JSON.stringify(k),
        };
      } else if (field.startsWith("acc:")) {
        const accessoryId = parseInt(field.replace("acc:", ""), 10);
        const [[acc]] = await db.query(
          "SELECT id, name, preis FROM accessories WHERE id = ?",
          [accessoryId]
        );
        if (acc) {
          const lineTotal = parseFloat(acc.preis) * entry.menge;
          total += lineTotal;
          orderLines.push({
            product_type: "accessory",
            product_id: acc.id,
            product_name: acc.name,
            quantity: entry.menge,
            unit_price: acc.preis,
          });
        }
      }
    }

    if (orderLines.length === 0 && !sideboardItem) {
      return res.status(400).json({ fehler: "Keine gültigen Artikel im Warenkorb" });
    }

    // ── Bestellung in MySQL persistieren ────────────────────────────────
    const orderNumber =
      "ORD-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    const [orderResult] = await db.query(
      "INSERT INTO orders (user_id, order_number, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?)",
      [null, orderNumber, total, JSON.stringify(shipping_address || {}), "Rechnung_Mock"]
    );
    const orderId = orderResult.insertId;

    // Zubehör-Positionen eintragen
    for (const item of orderLines) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, item.product_type, item.product_id, item.product_name, item.quantity, item.unit_price]
      );
    }

    // Sideboard eintragen
    if (sideboardItem) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_name, quantity, unit_price, config_snapshot) VALUES (?, ?, ?, ?, ?, ?)",
        [
          orderId,
          sideboardItem.product_type,
          sideboardItem.product_name,
          sideboardItem.quantity,
          sideboardItem.unit_price,
          sideboardItem.config_snapshot,
        ]
      );
    }

    // ── Redis-Warenkorb leeren (atomisch) ───────────────────────────────
    await redis.del(key);

    console.log(
      `✅ Checkout abgeschlossen: ${orderNumber} | Gesamt: ${total.toFixed(2)} € | Redis-Warenkorb gelöscht`
    );

    res.json({
      erfolg: true,
      order_id: orderId,
      order_number: orderNumber,
      total: total,
    });
  } catch (err) {
    console.error("❌ Checkout Fehler:", err);
    res.status(500).json({ fehler: "Checkout Fehler – bitte erneut versuchen" });
  }
});

module.exports = router;
