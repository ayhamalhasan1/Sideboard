// Shopping Cart Service — MySQL-based cart (Shopping Cart Cache via SQL API)
// cart_items table stores accessories; configurations table stores sideboard config.

const express = require("express");
const router = express.Router();

function getAuthDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

// ─── GET /api/cart ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { field, value } = getAuthDetails(req);

    // Accessories from cart_items (Shopping Cart Cache — SQL)
    // Return a.id (accessory primary key) so frontend DELETE/PUT calls work correctly
    const [items] = await db.query(
      `SELECT a.id, ci.menge, a.name, a.preis, a.bild_url
       FROM cart_items ci
       JOIN accessories a ON ci.accessory_id = a.id
       WHERE ci.${field} = ?`,
      [value]
    );

    // Sideboard config from configurations table
    const [konfigs] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
      [value]
    );

    if (konfigs.length > 0) {
      const k = konfigs[0];
      const basePrice  = k.groesse === "gross" ? 399 : k.groesse === "mittel" ? 299 : 199;
      const matPrice   = k.material === "Metall" ? 50 : k.material === "Glas" ? 100 : 0;
      const finishPrice = k.finish === "glänzend" ? 30 : 0;
      items.unshift({
        id: "sideboard",
        menge: k.menge || 1,
        name: `Sideboard (Größe: ${k.groesse}, Farbe: ${k.farbe}, Material: ${k.material}, Finish: ${k.finish})`,
        preis: basePrice + matPrice + finishPrice,
        bild_url: "hero_sideboard.png",
      });
    }

    res.json(items);
  } catch (err) {
    console.error("❌ GET /cart:", err);
    res.status(500).json({ fehler: "Warenkorb konnte nicht geladen werden" });
  }
});

// ─── POST /api/cart ───────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { accessory_id } = req.body;
    if (!accessory_id) return res.status(400).json({ fehler: "accessory_id fehlt" });

    // Validate accessory exists
    const [[acc]] = await db.query(
      "SELECT id FROM accessories WHERE id = ? AND is_active = TRUE",
      [accessory_id]
    );
    if (!acc) return res.status(404).json({ fehler: "Artikel nicht gefunden" });

    const { field, value } = getAuthDetails(req);
    const [existing] = await db.query(
      `SELECT id FROM cart_items WHERE ${field} = ? AND accessory_id = ?`,
      [value, accessory_id]
    );

    if (existing.length > 0) {
      await db.query("UPDATE cart_items SET menge = menge + 1 WHERE id = ?", [existing[0].id]);
    } else {
      await db.query(
        "INSERT INTO cart_items (session_id, user_id, accessory_id, menge) VALUES (?, ?, ?, 1)",
        [req.sessionID, req.session.userId || null, accessory_id]
      );
    }
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /cart:", err);
    res.status(500).json({ fehler: "Fehler beim Hinzufügen" });
  }
});

// ─── PUT /api/cart/:id ────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { menge } = req.body;
    if (!menge || menge < 1) return res.status(400).json({ fehler: "Menge muss mindestens 1 sein" });

    const { field, value } = getAuthDetails(req);

    if (req.params.id === "sideboard") {
      // Update quantity of sideboard in configurations table
      await db.query(
        `UPDATE configurations SET menge = ? WHERE ${field} = ?`,
        [menge, value]
      );
      return res.json({ erfolg: true });
    }

    await db.query(
      `UPDATE cart_items SET menge = ? WHERE accessory_id = ? AND ${field} = ?`,
      [menge, req.params.id, value]
    );
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ PUT /cart/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Aktualisieren" });
  }
});

// ─── DELETE /api/cart/:id ─────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { field, value } = getAuthDetails(req);
    if (req.params.id === "sideboard") {
      await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
    } else {
      await db.query(`DELETE FROM cart_items WHERE accessory_id = ? AND ${field} = ?`, [req.params.id, value]);
    }
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /cart/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Entfernen" });
  }
});

// ─── DELETE /api/cart ─────────────────────────────────────────────────────────
router.delete("/", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { field, value } = getAuthDetails(req);
    await db.query(`DELETE FROM cart_items WHERE ${field} = ?`, [value]);
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /cart:", err);
    res.status(500).json({ fehler: "Fehler beim Leeren des Warenkorbs" });
  }
});

// ─── POST /api/cart/sideboard ─────────────────────────────────────────────────
// Saves sideboard configuration to configurations table (Shopping Cart Cache — SQL)
router.post("/sideboard", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const config = req.body;
    if (!config || !config.groesse) return res.status(400).json({ fehler: "Konfiguration unvollständig" });

    const { field, value } = getAuthDetails(req);
    const { farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm } = config;

    const [existing] = await db.query(`SELECT id FROM configurations WHERE ${field} = ?`, [value]);
    if (existing.length > 0) {
      await db.query(
        `UPDATE configurations SET farbe=?, groesse=?, deckel_offen=?, material=?, finish=?, width_cm=?, height_cm=?, depth_cm=? WHERE ${field}=?`,
        [farbe, groesse, deckel_offen || false, material || "Holz", finish || "matt", width_cm || 160, height_cm || 80, depth_cm || 40, value]
      );
    } else {
      await db.query(
        "INSERT INTO configurations (session_id, user_id, farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [req.sessionID, req.session.userId || null, farbe, groesse, deckel_offen || false, material || "Holz", finish || "matt", width_cm || 160, height_cm || 80, depth_cm || 40]
      );
    }
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /cart/sideboard:", err);
    res.status(500).json({ fehler: "Fehler beim Speichern der Konfiguration" });
  }
});

// ─── POST /api/cart/checkout ──────────────────────────────────────────────────
router.post("/checkout", async (req, res) => {
  const db = req.app.locals.db;
  try {
    const { field, value } = getAuthDetails(req);

    const [cartItems] = await db.query(
      `SELECT ci.menge AS quantity, a.id AS product_id, a.name AS product_name, a.preis AS unit_price
       FROM cart_items ci
       JOIN accessories a ON ci.accessory_id = a.id
       WHERE ci.${field} = ?`,
      [value]
    );
    const [konfigs] = await db.query(
      `SELECT * FROM configurations WHERE ${field} = ? LIMIT 1`,
      [value]
    );

    if (cartItems.length === 0 && konfigs.length === 0)
      return res.status(400).json({ fehler: "Warenkorb ist leer" });

    let total = cartItems.reduce((acc, i) => acc + parseFloat(i.unit_price) * i.quantity, 0);
    let sideboardItem = null;

    if (konfigs.length > 0) {
      const k = konfigs[0];
      const basePrice  = k.groesse === "gross" ? 399 : k.groesse === "mittel" ? 299 : 199;
      const matPrice   = k.material === "Metall" ? 50 : k.material === "Glas" ? 100 : 0;
      const finalPrice = basePrice + matPrice + (k.finish === "glänzend" ? 30 : 0);
      const quantity = k.menge || 1;
      total += finalPrice * quantity;
      sideboardItem = {
        product_type: "sideboard",
        product_name: `Sideboard ${k.farbe}`,
        quantity: quantity,
        unit_price: finalPrice,
        config_snapshot: JSON.stringify(k),
      };
    }

    const { shipping_address } = req.body;
    const orderNumber = "ORD-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    const [orderResult] = await db.query(
      "INSERT INTO orders (user_id, order_number, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId || null, orderNumber, total, JSON.stringify(shipping_address || {}), "Rechnung_Mock"]
    );
    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, "accessory", item.product_id, item.product_name, item.quantity, item.unit_price]
      );
    }
    if (sideboardItem) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_name, quantity, unit_price, config_snapshot) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, sideboardItem.product_type, sideboardItem.product_name, sideboardItem.quantity, sideboardItem.unit_price, sideboardItem.config_snapshot]
      );
      await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
    }
    await db.query(`DELETE FROM cart_items WHERE ${field} = ?`, [value]);

    console.log(`✅ Checkout: ${orderNumber} | ${total.toFixed(2)} €`);
    res.json({ erfolg: true, order_id: orderId, order_number: orderNumber, total });
  } catch (err) {
    console.error("❌ POST /cart/checkout:", err);
    res.status(500).json({ fehler: "Checkout Fehler – bitte erneut versuchen" });
  }
});

module.exports = router;
