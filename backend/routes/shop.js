const express = require("express");
const router = express.Router();

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}



// ---------------- ZUBEHÖR ----------------

router.get("/accessories", async (req, res) => {
  const db = req.app.locals.db;
  const [rows] = await db.query("SELECT * FROM accessories WHERE is_active = TRUE ORDER BY name");
  res.json(rows);
});

// ---------------- WARENKORB ----------------

router.get("/cart", async (req, res) => {
  const db = req.app.locals.db;
  try {
    let { field, value } = getAuthQueryDetails(req);
    const [items] = await db.query(
      `SELECT ci.id, ci.menge, a.name, a.preis, a.bild_url 
       FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id 
       WHERE ci.${field} = ?`, [value]
    );

    const [konfigs] = await db.query(`SELECT * FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`, [value]);
    if (konfigs.length > 0) {
      const k = konfigs[0];
      const basePrice = k.groesse === 'gross' ? 399.00 : (k.groesse === 'mittel' ? 299.00 : 199.00);
      const matPrice = k.material === 'Metall' ? 50 : (k.material === 'Glas' ? 100 : 0);
      const finishPrice = k.finish === 'glänzend' ? 30 : 0;
      
      items.unshift({
        id: "sideboard", menge: 1, 
        name: `Sideboard (Größe: ${k.groesse}, Farbe: ${k.farbe}, Material: ${k.material}, Finish: ${k.finish})`,
        preis: basePrice + matPrice + finishPrice,
        bild_url: "hero_sideboard.png"
      });
    }
    res.json(items);
  } catch (err) { res.status(500).json({ fehler: "Konnte Warenkorb nicht laden" }); }
});

router.post("/cart", async (req, res) => {
  const db = req.app.locals.db;
  try {
    let { field, value } = getAuthQueryDetails(req);
    const { accessory_id } = req.body;
    const [vorhanden] = await db.query(`SELECT id FROM cart_items WHERE ${field}=? AND accessory_id=?`, [value, accessory_id]);
    
    if (vorhanden.length > 0) {
      await db.query("UPDATE cart_items SET menge = menge + 1 WHERE id = ?", [vorhanden[0].id]);
    } else {
      await db.query("INSERT INTO cart_items (session_id, user_id, accessory_id, menge) VALUES (?, ?, ?, 1)", 
        [req.sessionID, req.session.userId || null, accessory_id]);
    }
    res.json({ erfolg: true });
  } catch (err) { res.status(500).json({ fehler: "Fehler beim Hinzufügen" }); }
});

router.delete("/cart/:id", async (req, res) => {
  const db = req.app.locals.db;
  let { field, value } = getAuthQueryDetails(req);
  if (req.params.id === "sideboard") {
    await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
    return res.json({ erfolg: true });
  }
  await db.query(`DELETE FROM cart_items WHERE id=? AND ${field}=?`, [req.params.id, value]);
  res.json({ erfolg: true });
});

router.delete("/cart", async (req, res) => {
  const db = req.app.locals.db;
  let { field, value } = getAuthQueryDetails(req);
  await db.query(`DELETE FROM cart_items WHERE ${field} = ?`, [value]);
  res.json({ erfolg: true });
});

// ---------------- CHECKOUT & ORDERS ----------------

router.post("/checkout", async (req, res) => {
  const db = req.app.locals.db;
  try {
    // 1. Get Cart
    const { field, value } = getAuthQueryDetails(req);
    const [cartItems] = await db.query(
      `SELECT ci.menge as quantity, a.id as product_id, a.name as product_name, a.preis as unit_price
       FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id WHERE ci.${field}=?`, [value]
    );

    const [konfigs] = await db.query(`SELECT * FROM configurations WHERE ${field} = ? LIMIT 1`, [value]);
    
    if(cartItems.length === 0 && konfigs.length === 0) return res.status(400).json({ fehler: "Warenkorb leer" });

    // 2. Calculate Total
    let total = cartItems.reduce((acc, item) => acc + (parseFloat(item.unit_price) * item.quantity), 0);
    let sideboardItem = null;
    
    if (konfigs.length > 0) {
      const k = konfigs[0];
      const basePrice = k.groesse === 'gross' ? 399.00 : (k.groesse === 'mittel' ? 299.00 : 199.00);
      const matPrice = k.material === 'Metall' ? 50 : (k.material === 'Glas' ? 100 : 0);
      const finalPrice = basePrice + matPrice + (k.finish === 'glänzend' ? 30 : 0);
      total += finalPrice;
      
      sideboardItem = {
        product_type: 'sideboard', product_name: `Sideboard ${k.farbe}`,
        quantity: 1, unit_price: finalPrice, config_snapshot: JSON.stringify(k)
      };
    }

    const { shipping_address } = req.body;
    const orderNumber = "ORD-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    // 3. Create Order
    const [orderResult] = await db.query(
      "INSERT INTO orders (user_id, order_number, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?)",
      [null, orderNumber, total, JSON.stringify(shipping_address || {}), "Rechnung_Mock"]
    );
    const orderId = orderResult.insertId;

    // 4. Create Order Items
    for (let item of cartItems) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_id, product_name, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, 'accessory', item.product_id, item.product_name, item.quantity, item.unit_price]
      );
    }
    if (sideboardItem) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_name, quantity, unit_price, config_snapshot) VALUES (?, ?, ?, ?, ?, ?)",
        [orderId, sideboardItem.product_type, sideboardItem.product_name, sideboardItem.quantity, sideboardItem.unit_price, sideboardItem.config_snapshot]
      );
      // Optional: Wirbel Backend ab (Lösche aktuelle Config nach Bestellung)
      await db.query(`DELETE FROM configurations WHERE ${field} = ?`, [value]);
    }
    await db.query(`DELETE FROM cart_items WHERE ${field} = ?`, [value]);

    res.json({ erfolg: true, order_id: orderId, order_number: orderNumber, total: total });
  } catch(err) {
    console.error(err);
    res.status(500).json({ fehler: "Checkout Fehler" });
  }
});

router.get("/orders", async (req, res) => {
  const db = req.app.locals.db;
  res.json([]);
});

module.exports = router;
