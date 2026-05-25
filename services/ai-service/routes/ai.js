// AI-Service: Gemini-Berater + Graph-Empfehlungen
// Migrated from backend/routes/ai.js — adds Neo4j recommendation endpoint

const express = require("express");
const crypto  = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { getDriver, runQuery } = require("../db/neo4j");
const router = express.Router();

// Gemini-Modell initialisieren (einmalig beim Laden)
let geminiModel;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey !== "dein-google-gemini-api-key-hier") {
  const genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

// POST /api/ai/advice — KI-Einrichtungsberatung (Gemini)
router.post("/advice", async (req, res) => {
  const db = req.app.locals.db;
  if (!geminiModel) return res.status(503).json({ fehler: "KI nicht konfiguriert" });

  try {
    const { type } = req.body;
    const { field, value } = getAuthQueryDetails(req);

    const [konfigs]    = await db.query(`SELECT * FROM configurations WHERE ${field} = ? LIMIT 1`, [value]);
    const [cartItems]  = await db.query(`SELECT a.name FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id WHERE ci.${field} = ?`, [value]);

    const k = konfigs.length > 0 ? konfigs[0] : { farbe: "weiss", groesse: "mittel", material: "Holz", finish: "matt" };
    const zubehoerStr = cartItems.length > 0 ? cartItems.map((i) => i.name).join(", ") : "kein Zubehör";

    const promptText = `Du bist ein freundlicher Einrichtungsberater. Ein Benutzer plant ein Sideboard (Farbe: ${k.farbe}, Größe: ${k.groesse}, Material: ${k.material}, Finish: ${k.finish}). Im Warenkorb liegt: ${zubehoerStr}. Art der Beratung: ${type || "allgemein"}. Gib einen extrem kurzen, kreativen Tipp (max. 1-2 Sätze) auf Deutsch.`;
    const promptHash  = crypto.createHash("md5").update(promptText).digest("hex");

    // Cache-Lookup (MySQL ai_cache table)
    const [cached] = await db.query(
      "SELECT response FROM ai_cache WHERE prompt_hash = ? AND expires_at > NOW()",
      [promptHash]
    );
    if (cached.length > 0) return res.json({ advice: cached[0].response, cached: true });

    // Gemini API-Aufruf
    const ergebnis = await geminiModel.generateContent(promptText);
    const antwort  = ergebnis.response.text();

    // In Cache schreiben (1 Tag TTL)
    await db.query(
      "INSERT INTO ai_cache (prompt_hash, response, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))",
      [promptHash, antwort]
    );

    res.json({ advice: antwort, cached: false });
  } catch (err) {
    console.error("❌ POST /ai/advice:", err);
    res.status(500).json({ fehler: "KI Aufruf fehlgeschlagen" });
  }
});

// GET /api/ai/recommendations — Graph-basierte Produktempfehlungen (Neo4j)
router.get("/recommendations", async (req, res) => {
  const neo4jDriver = getDriver();
  if (!neo4jDriver) {
    return res.status(503).json({
      fehler: "Graph-Empfehlungen nicht verfügbar",
      hinweis: "NEO4J_URI setzen und neo4j-Service in docker-compose aktivieren",
    });
  }

  try {
    const { product_id, product_type = "accessory" } = req.query;
    if (!product_id) return res.status(400).json({ fehler: "product_id fehlt" });

    // Cypher: Finde ähnliche Produkte über gemeinsame Käufer (collaborative filtering)
    const records = await runQuery(
      `MATCH (p:Product {id: $product_id, type: $product_type})<-[:PURCHASED]-(u:User)-[:PURCHASED]->(rec:Product)
       WHERE rec.id <> $product_id
       RETURN rec.id AS id, rec.name AS name, rec.type AS type, count(u) AS score
       ORDER BY score DESC LIMIT 5`,
      { product_id, product_type }
    );

    res.json(records.map((r) => ({
      id:    r.get("id"),
      name:  r.get("name"),
      type:  r.get("type"),
      score: r.get("score").toNumber(),
    })));
  } catch (err) {
    console.error("❌ GET /ai/recommendations:", err);
    res.status(500).json({ fehler: "Empfehlungen konnten nicht geladen werden" });
  }
});

module.exports = router;
