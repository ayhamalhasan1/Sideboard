// Shopping Cart Service — MySQL-based cart (Shopping Cart Cache via SQL API)
// cart_items table stores accessories; configurations table stores sideboard config.

const express = require("express");
const router = express.Router();

function getAuthDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

function parseSideboardItemId(id) {
  const match = /^sideboard-(\d+)$/.exec(String(id));
  return match ? Number(match[1]) : null;
}

function calculateSideboardPrice(config) {
  const basePrice = config.groesse === "gross" ? 399 : config.groesse === "mittel" ? 299 : 199;
  const matPrice = config.material === "Metall" ? 50 : config.material === "Glas" ? 100 : 0;
  const finishPrice = config.finish === "glänzend" || config.finish === "glÃ¤nzend" ? 30 : 0;
  return basePrice + matPrice + finishPrice;
}

function sideboardImageName(config) {
  const sizeByName = { klein: 120, mittel: 160, gross: 180 };
  const width = Number(config.width_cm) || sizeByName[config.groesse] || 120;
  const color = String(config.farbe || "weiss").toLowerCase();
  const finish = String(config.finish || "matt").toLowerCase();
  const isGlossy = finish !== "matt";

  let surface = "weiss-matt";
  if (color === "eiche" || color === "holzoptik") {
    surface = "holzoptik";
  } else if (color === "schwarz") {
    surface = isGlossy ? "schwarz-hochglanz" : "schwarz-matt";
  } else {
    surface = isGlossy ? "weiss-hochglanz" : "weiss-matt";
  }

  return `${surface}-${width}.jpg`;
}

function sideboardCartItem(config) {
  return {
    id: `sideboard-${config.id}`,
    menge: config.menge || 1,
    name: `Sideboard (Größe: ${config.groesse}, Farbe: ${config.farbe}, Material: ${config.material}, Finish: ${config.finish})`,
    preis: calculateSideboardPrice(config),
    bild_url: sideboardImageName(config),
  };
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
      `SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC`,
      [value]
    );

    items.unshift(...konfigs.map(sideboardCartItem));

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

    const sideboardId = parseSideboardItemId(req.params.id);
    if (sideboardId) {
      // Update quantity of one sideboard cart position.
      await db.query(
        `UPDATE configurations SET menge = ? WHERE id = ? AND ${field} = ?`,
        [menge, sideboardId, value]
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
    const sideboardId = parseSideboardItemId(req.params.id);
    if (sideboardId) {
      await db.query(`DELETE FROM configurations WHERE id = ? AND ${field} = ?`, [sideboardId, value]);
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
    await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
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

    const { farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm } = config;

    await db.query(
      "INSERT INTO configurations (session_id, user_id, farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm, menge) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)",
      [req.sessionID, req.session.userId || null, farbe, groesse, deckel_offen || false, material || "Holz", finish || "matt", width_cm || 160, height_cm || 80, depth_cm || 40]
    );

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
      `SELECT * FROM configurations WHERE ${field} = ?`,
      [value]
    );

    if (cartItems.length === 0 && konfigs.length === 0)
      return res.status(400).json({ fehler: "Warenkorb ist leer" });

    let total = cartItems.reduce((acc, i) => acc + parseFloat(i.unit_price) * i.quantity, 0);
    const sideboardItems = konfigs.map((k) => {
      const finalPrice = calculateSideboardPrice(k);
      const quantity = k.menge || 1;
      total += finalPrice * quantity;

      return {
        product_type: "sideboard",
        product_name: `Sideboard ${k.farbe}`,
        quantity: quantity,
        unit_price: finalPrice,
        config_snapshot: JSON.stringify(k),
      };
    });

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
    for (const sideboardItem of sideboardItems) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_name, quantity, unit_price, config_snapshot) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, sideboardItem.product_type, sideboardItem.product_name, sideboardItem.quantity, sideboardItem.unit_price, sideboardItem.config_snapshot]
      );
    }
    await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
    await db.query(`DELETE FROM cart_items WHERE ${field} = ?`, [value]);

    console.log(`✅ Checkout: ${orderNumber} | ${total.toFixed(2)} €`);
    res.json({ erfolg: true, order_id: orderId, order_number: orderNumber, total });
  } catch (err) {
    console.error("❌ POST /cart/checkout:", err);
    res.status(500).json({ fehler: "Checkout Fehler – bitte erneut versuchen" });
  }
});

module.exports = router;
