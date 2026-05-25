// AI Recommendation Service — REST API
// Cache is handled by ai-cache-service (separate service, called via REST API).

const express = require("express");
const crypto  = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const router = express.Router();

let geminiModel;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey !== "dein-google-gemini-api-key-hier") {
  const genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

const CACHE_SERVICE_URL = process.env.AI_CACHE_SERVICE_URL || "http://ai-cache-service:3006";

async function checkCache(hash) {
  try {
    const res = await fetch(`${CACHE_SERVICE_URL}/cache/${hash}`);
    if (res.ok) return await res.json();
    return null;
  } catch {
    return null;
  }
}

async function storeCache(hash, response) {
  try {
    await fetch(`${CACHE_SERVICE_URL}/cache`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hash, response }),
    });
  } catch {
    // Cache write failure is non-fatal
  }
}

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

// POST /api/ai/advice — KI-Einrichtungsberatung
router.post("/advice", async (req, res) => {
  const db = req.app.locals.db;
  if (!geminiModel) return res.status(503).json({ fehler: "KI nicht konfiguriert" });

  try {
    const { type } = req.body;
    const { field, value } = getAuthQueryDetails(req);

    const [konfigs]   = await db.query(`SELECT * FROM configurations WHERE ${field} = ? LIMIT 1`, [value]);
    const [cartItems] = await db.query(`SELECT a.name FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id WHERE ci.${field} = ?`, [value]);

    const k = konfigs.length > 0 ? konfigs[0] : { farbe: "weiss", groesse: "mittel", material: "Holz", finish: "matt" };
    const zubehoerStr = cartItems.length > 0 ? cartItems.map((i) => i.name).join(", ") : "kein Zubehör";

    const promptText = `Du bist ein freundlicher Einrichtungsberater. Ein Benutzer plant ein Sideboard (Farbe: ${k.farbe}, Größe: ${k.groesse}, Material: ${k.material}, Finish: ${k.finish}). Im Warenkorb liegt: ${zubehoerStr}. Art der Beratung: ${type || "allgemein"}. Gib einen extrem kurzen, kreativen Tipp (max. 1-2 Sätze) auf Deutsch.`;
    const promptHash  = crypto.createHash("md5").update(promptText).digest("hex");

    // Check cache via ai-cache-service REST API
    const cached = await checkCache(promptHash);
    if (cached) return res.json({ advice: cached.response, cached: true });

    // Call Gemini
    const ergebnis = await geminiModel.generateContent(promptText);
    const antwort  = ergebnis.response.text();

    // Store in cache via ai-cache-service REST API
    await storeCache(promptHash, antwort);

    res.json({ advice: antwort, cached: false });
  } catch (err) {
    console.error("❌ POST /ai/advice:", err);
    res.status(500).json({ fehler: "KI Aufruf fehlgeschlagen" });
  }
});

module.exports = router;
