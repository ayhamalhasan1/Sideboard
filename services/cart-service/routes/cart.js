// Shopping Cart Service — Redis-backed cart
// Accessories:        Redis Hash  cart:{field}:{value}:acc  { accessory_id → menge }
// Sideboard configs:  Redis String cart:{field}:{value}:sb   JSON array
// Sessions:           Redis (connect-redis, managed by server.js)
// MySQL:              accessories lookup (name/price) + order persistence only

const express = require("express");
const router = express.Router();

const CART_TTL = 60 * 60 * 24 * 7; // 7 days in seconds

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuthDetails(req) {
  if (req.session.userId) return { field: "user_id", value: String(req.session.userId) };
  return { field: "session_id", value: req.sessionID };
}

function cartKeys(field, value) {
  const base = `cart:${field}:${value}`;
  return { acc: `${base}:acc`, sb: `${base}:sb` };
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

  let surface;
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

// Read sideboard array from Redis (returns [])
async function getSideboards(redis, sbKey) {
  const raw = await redis.get(sbKey);
  return raw ? JSON.parse(raw) : [];
}

// Write sideboard array back to Redis with TTL
async function setSideboards(redis, sbKey, sideboards) {
  await redis.set(sbKey, JSON.stringify(sideboards));
  await redis.expire(sbKey, CART_TTL);
}

// ─── GET /api/cart ────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const { db, redis } = req.app.locals;
  try {
    const { field, value } = getAuthDetails(req);
    const { acc: accKey, sb: sbKey } = cartKeys(field, value);

    // 1. Accessories from Redis hash
    const accHash = await redis.hGetAll(accKey);
    let items = [];
    if (Object.keys(accHash).length > 0) {
      const ids = Object.keys(accHash);
      const placeholders = ids.map(() => "?").join(",");
      const [rows] = await db.query(
        `SELECT id, name, preis, bild_url FROM accessories WHERE id IN (${placeholders})`,
        ids
      );
      items = rows.map((a) => ({
        id: a.id,
        menge: parseInt(accHash[String(a.id)], 10),
        name: a.name,
        preis: a.preis,
        bild_url: a.bild_url,
      }));
    }

    // 2. Sideboard configs from Redis string
    const sideboards = await getSideboards(redis, sbKey);

    res.json([...sideboards.map(sideboardCartItem), ...items]);
  } catch (err) {
    console.error("❌ GET /cart:", err);
    res.status(500).json({ fehler: "Warenkorb konnte nicht geladen werden" });
  }
});

// ─── POST /api/cart ───────────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  const { db, redis } = req.app.locals;
  try {
    const { accessory_id } = req.body;
    if (!accessory_id) return res.status(400).json({ fehler: "accessory_id fehlt" });

    // Validate accessory exists in MySQL catalog
    const [[acc]] = await db.query(
      "SELECT id FROM accessories WHERE id = ? AND is_active = TRUE",
      [accessory_id]
    );
    if (!acc) return res.status(404).json({ fehler: "Artikel nicht gefunden" });

    const { field, value } = getAuthDetails(req);
    const { acc: accKey } = cartKeys(field, value);

    // HINCRBY atomically increments (or creates with value 1)
    await redis.hIncrBy(accKey, String(accessory_id), 1);
    await redis.expire(accKey, CART_TTL);

    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /cart:", err);
    res.status(500).json({ fehler: "Fehler beim Hinzufügen" });
  }
});

// ─── PUT /api/cart/:id ────────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  const { redis } = req.app.locals;
  try {
    const menge = parseInt(req.body.menge, 10);
    if (!menge || menge < 1) return res.status(400).json({ fehler: "Menge muss mindestens 1 sein" });

    const { field, value } = getAuthDetails(req);
    const { acc: accKey, sb: sbKey } = cartKeys(field, value);

    const sideboardId = parseSideboardItemId(req.params.id);
    if (sideboardId) {
      const sideboards = await getSideboards(redis, sbKey);
      const idx = sideboards.findIndex((s) => s.id === sideboardId);
      if (idx !== -1) {
        sideboards[idx].menge = menge;
        await setSideboards(redis, sbKey, sideboards);
      }
      return res.json({ erfolg: true });
    }

    // Accessory: set exact quantity in hash
    await redis.hSet(accKey, String(req.params.id), menge);
    await redis.expire(accKey, CART_TTL);
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ PUT /cart/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Aktualisieren" });
  }
});

// ─── DELETE /api/cart/:id ─────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  const { redis } = req.app.locals;
  try {
    const { field, value } = getAuthDetails(req);
    const { acc: accKey, sb: sbKey } = cartKeys(field, value);

    const sideboardId = parseSideboardItemId(req.params.id);
    if (sideboardId) {
      const sideboards = await getSideboards(redis, sbKey);
      await setSideboards(redis, sbKey, sideboards.filter((s) => s.id !== sideboardId));
      return res.json({ erfolg: true });
    }

    await redis.hDel(accKey, String(req.params.id));
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /cart/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Entfernen" });
  }
});

// ─── DELETE /api/cart ─────────────────────────────────────────────────────────
router.delete("/", async (req, res) => {
  const { redis } = req.app.locals;
  try {
    const { field, value } = getAuthDetails(req);
    const { acc: accKey, sb: sbKey } = cartKeys(field, value);
    await redis.del([accKey, sbKey]);
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /cart:", err);
    res.status(500).json({ fehler: "Fehler beim Leeren des Warenkorbs" });
  }
});

// ─── POST /api/cart/sideboard ─────────────────────────────────────────────────
router.post("/sideboard", async (req, res) => {
  const { redis } = req.app.locals;
  try {
    const config = req.body;
    if (!config || !config.groesse) return res.status(400).json({ fehler: "Konfiguration unvollständig" });

    const { field, value } = getAuthDetails(req);
    const { sb: sbKey } = cartKeys(field, value);

    const { farbe, groesse, deckel_offen, material, finish, width_cm, height_cm, depth_cm } = config;

    const sideboards = await getSideboards(redis, sbKey);

    // Each configuration gets a unique numeric ID (used by frontend as sideboard-{id})
    const newConfig = {
      id: Date.now(),
      farbe:        farbe       || "weiss",
      groesse:      groesse,
      deckel_offen: deckel_offen || false,
      material:     material    || "Holz",
      finish:       finish      || "matt",
      width_cm:     width_cm    || 160,
      height_cm:    height_cm   || 80,
      depth_cm:     depth_cm    || 40,
      menge:        config.menge || 1,
    };

    sideboards.push(newConfig);
    await setSideboards(redis, sbKey, sideboards);

    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ POST /cart/sideboard:", err);
    res.status(500).json({ fehler: "Fehler beim Speichern der Konfiguration" });
  }
});

// ─── POST /api/cart/checkout ──────────────────────────────────────────────────
router.post("/checkout", async (req, res) => {
  const { db, redis } = req.app.locals;
  try {
    const { field, value } = getAuthDetails(req);
    const { acc: accKey, sb: sbKey } = cartKeys(field, value);

    // 1. Accessories from Redis → details from MySQL
    const accHash = await redis.hGetAll(accKey);
    let cartItems = [];
    if (Object.keys(accHash).length > 0) {
      const ids = Object.keys(accHash);
      const placeholders = ids.map(() => "?").join(",");
      const [rows] = await db.query(
        `SELECT id, name, preis FROM accessories WHERE id IN (${placeholders})`,
        ids
      );
      cartItems = rows.map((a) => ({
        product_id:   a.id,
        product_name: a.name,
        unit_price:   parseFloat(a.preis),
        quantity:     parseInt(accHash[String(a.id)], 10),
      }));
    }

    // 2. Sideboard configs from Redis
    const sideboards = await getSideboards(redis, sbKey);

    if (cartItems.length === 0 && sideboards.length === 0)
      return res.status(400).json({ fehler: "Warenkorb ist leer" });

    // 3. Calculate total
    let total = cartItems.reduce((acc, i) => acc + i.unit_price * i.quantity, 0);
    const sideboardItems = sideboards.map((k) => {
      const finalPrice = calculateSideboardPrice(k);
      const quantity = k.menge || 1;
      total += finalPrice * quantity;
      return {
        product_name:    `Sideboard ${k.farbe}`,
        quantity,
        unit_price:      finalPrice,
        config_snapshot: JSON.stringify(k),
      };
    });

    // 4. Persist order in MySQL
    const { shipping_address } = req.body;
    const orderNumber = "ORD-" + Math.random().toString(36).substr(2, 9).toUpperCase();

    const [orderResult] = await db.query(
      "INSERT INTO orders (user_id, order_number, total_amount, shipping_address, payment_method) VALUES (?, ?, ?, ?, ?)",
      [req.session.userId || null, orderNumber, total, JSON.stringify(shipping_address || {}), "Rechnung_Mock"]
    );
    const orderId = orderResult.insertId;

    for (const item of cartItems) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_id, product_name, quantity, unit_price) VALUES (?, 'accessory', ?, ?, ?, ?)",
        [orderId, item.product_id, item.product_name, item.quantity, item.unit_price]
      );
    }
    for (const item of sideboardItems) {
      await db.query(
        "INSERT INTO order_items (order_id, product_type, product_name, quantity, unit_price, config_snapshot) VALUES (?, 'sideboard', ?, ?, ?, ?)",
        [orderId, item.product_name, item.quantity, item.unit_price, item.config_snapshot]
      );
    }

    // 5. Clear cart from Redis
    await redis.del([accKey, sbKey]);

    console.log(`✅ Checkout: ${orderNumber} | ${total.toFixed(2)} €`);
    res.json({ erfolg: true, order_id: orderId, order_number: orderNumber, total });
  } catch (err) {
    console.error("❌ POST /cart/checkout:", err);
    res.status(500).json({ fehler: "Checkout Fehler – bitte erneut versuchen" });
  }
});

module.exports = router;
