const express = require("express");
const crypto = require("crypto");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const router = express.Router();

let geminiModel, geminiFallbackModel;
const apiKey = process.env.GEMINI_API_KEY;
if (apiKey && apiKey !== "dein-google-gemini-api-key-hier") {
  const genAI = new GoogleGenerativeAI(apiKey);
  geminiModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  geminiFallbackModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
}

function isOverloadError(err) {
  return err && (err.status === 503 || err.status === 429);
}

async function callGemini(model, systemPrompt, history, message) {
  const chat = model.startChat({
    systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
    history,
    generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
  });
  const result = await chat.sendMessage(message);
  return result.response.text();
}

function getAuthQueryDetails(req) {
  if (req.session.userId) return { field: "user_id", value: req.session.userId };
  return { field: "session_id", value: req.sessionID };
}

async function buildSideboardContext(db, field, value) {
  const [accessories] = await db.query(
    "SELECT name, preis, category, beschreibung FROM accessories WHERE is_active = TRUE ORDER BY category, name"
  );
  const accessoryLines = accessories.map(
    (a) => `- ${a.name} (${a.category}, ${parseFloat(a.preis).toFixed(2)} €): ${a.beschreibung || ""}`
  ).join("\n");

  const [konfigs] = await db.query(
    `SELECT farbe, groesse, material, finish, width_cm, height_cm, depth_cm, deckel_offen
     FROM configurations WHERE ${field} = ? ORDER BY aktualisiert_am DESC LIMIT 1`,
    [value]
  );
  const konfigText = konfigs.length > 0
    ? `Farbe: ${konfigs[0].farbe}, Größe: ${konfigs[0].groesse}, Material: ${konfigs[0].material}, Finish: ${konfigs[0].finish}, Maße: ${konfigs[0].width_cm}×${konfigs[0].height_cm}×${konfigs[0].depth_cm} cm, Deckel offen: ${konfigs[0].deckel_offen ? "ja" : "nein"}`
    : "Noch keine Konfiguration gespeichert.";

  const [cartItems] = await db.query(
    `SELECT a.name, ci.menge FROM cart_items ci
     JOIN accessories a ON ci.accessory_id = a.id
     WHERE ci.${field} = ?`,
    [value]
  );
  const cartText = cartItems.length > 0
    ? cartItems.map((i) => `${i.name} ×${i.menge}`).join(", ")
    : "leer";

  return { accessoryLines, konfigText, cartText };
}

function buildSystemPrompt({ accessoryLines, konfigText, cartText }) {
  return `Du bist der KI-Assistent der "Sideboard-Manufaktur" – eines deutschen Online-Konfigurators für Sideboards.

DEINE AUFGABE
Beantworte ausschließlich Fragen zu unseren Sideboards, dem Zubehör und dem Bestellprozess. Bei Fragen ohne Sideboard-Bezug lehne höflich in der Sprache des Nutzers ab – z. B. auf Deutsch: "Ich kann nur Fragen zu unseren Sideboards und unserem Shop beantworten." oder auf Englisch: "I can only help with questions about our sideboard products and website."

PRODUKTPALETTE – SIDEBOARDS
Größen mit Grundpreis:
- Klein: kompakt (ca. 100–140 cm Breite) – 199 €
- Mittel: Standard (ca. 140–180 cm Breite) – 299 €
- Groß: XL (ca. 180–250 cm Breite) – 399 €

Maße sind individuell anpassbar: Breite 100–250 cm, Höhe 50–120 cm, Tiefe ca. 40 cm.

Farben: Weiß, Schwarz, Eiche
Materialien: Holz (+0 €), Metall (+50 €), Glas (+100 €)
Finish: Matt (+0 €), Glänzend (+30 €)
Optional: Deckel zum Hochklappen

ZUBEHÖR (Shop-Katalog):
${accessoryLines}

AKTUELLE NUTZER-KONFIGURATION
${konfigText}

AKTUELLER WARENKORB
${cartText}

REGELN
- Antworte freundlich, knapp und hilfreich (max. 3 Sätze, außer bei Listen oder ausdrücklichen Detail-Anfragen).
- Antworte immer in der Sprache des Nutzers (Deutsch oder Englisch).
- Empfehle bei passender Gelegenheit konkrete Größen, Materialien oder Zubehör aus dem Katalog oben.
- Erfinde keine Preise, Produkte oder Eigenschaften, die nicht oben gelistet sind.
- Wenn der Nutzer nach seiner aktuellen Konfiguration oder seinem Warenkorb fragt, beziehe dich auf die Daten oben.`;
}

router.post("/chat", async (req, res) => {
  const db = req.app.locals.db;
  if (!geminiModel) return res.status(503).json({ fehler: "KI nicht konfiguriert" });

  try {
    const { message, history } = req.body;
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ fehler: "Bitte Nachricht angeben" });
    }

    const { field, value } = getAuthQueryDetails(req);
    const ctx = await buildSideboardContext(db, field, value);
    const systemPrompt = buildSystemPrompt(ctx);
    const safeHistory = Array.isArray(history)
      ? history.slice(-10).filter(
          (h) => h && (h.role === "user" || h.role === "model") && typeof h.text === "string"
        )
      : [];

    const cacheKey = crypto
      .createHash("md5")
      .update(systemPrompt + "||" + JSON.stringify(safeHistory) + "||" + message)
      .digest("hex");

    const [cached] = await db.query(
      "SELECT response FROM ai_cache WHERE prompt_hash = ? AND expires_at > NOW()",
      [cacheKey]
    );
    if (cached.length > 0) {
      return res.json({ reply: cached[0].response, cached: true });
    }

    const geminiHistory = safeHistory.map((h) => ({
      role: h.role,
      parts: [{ text: h.text }],
    }));

    let reply;
    try {
      reply = await callGemini(geminiModel, systemPrompt, geminiHistory, message);
    } catch (primaryErr) {
      if (isOverloadError(primaryErr) && geminiFallbackModel) {
        console.warn("Primary Gemini overloaded, trying fallback model");
        reply = await callGemini(geminiFallbackModel, systemPrompt, geminiHistory, message);
      } else {
        throw primaryErr;
      }
    }

    await db.query(
      "INSERT INTO ai_cache (prompt_hash, response, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 HOUR))",
      [cacheKey, reply]
    );

    res.json({ reply, cached: false });
  } catch (err) {
    console.error("AI chat Fehler:", err);
    if (isOverloadError(err)) {
      return res.status(503).json({ fehler: "Die KI ist gerade stark ausgelastet. Bitte einen Moment warten und erneut senden." });
    }
    res.status(500).json({ fehler: "KI Aufruf fehlgeschlagen" });
  }
});

router.post("/advice", async (req, res) => {
  const db = req.app.locals.db;
  const redis = req.app.locals.redisClient;
  
  if (!geminiModel) return res.status(503).json({ fehler: "KI nicht konfiguriert" });

  try {
    const { type } = req.body; // 'styling' | 'deco' | 'color'
    let { field, value } = getAuthQueryDetails(req);
    
    const [konfigs] = await db.query(`SELECT * FROM configurations WHERE ${field} = ? LIMIT 1`, [value]);
    const [cartItems] = await db.query(`SELECT a.name FROM cart_items ci JOIN accessories a ON ci.accessory_id = a.id WHERE ci.${field} = ?`, [value]);

    const k = konfigs.length > 0 ? konfigs[0] : { farbe: "weiss", groesse: "mittel", material: "Holz", finish: "matt" };
    const zubehoerStr = cartItems.length > 0 ? cartItems.map(i => i.name).join(", ") : "kein Zubehör";

    const promptText = `Du bist ein freundlicher Einrichtungsberater. Ein Benutzer plant ein Sideboard (Farbe: ${k.farbe}, Größe: ${k.groesse}, Material: ${k.material}, Finish: ${k.finish}). Im Warenkorb liegt: ${zubehoerStr}. Art der Beratung: ${type || 'allgemein'}. Gib einen extrem kurzen, kreativen Tipp (max. 1-2 Sätze) auf Deutsch.`;
    const promptHash = crypto.createHash("md5").update(promptText).digest("hex");

    // Check DB Cache (wie im Anforderungsprofil)
    const [cachedOps] = await db.query("SELECT response FROM ai_cache WHERE prompt_hash = ? AND expires_at > NOW()", [promptHash]);
    if (cachedOps.length > 0) {
      return res.json({ advice: cachedOps[0].response, cached: true });
    }

    // Call Gemini
    const ergebnis = await geminiModel.generateContent(promptText);
    const antwort = ergebnis.response.text();

    // In DB cachen (1 Tag TTL)
    await db.query("INSERT INTO ai_cache (prompt_hash, response, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 1 DAY))", [promptHash, antwort]);
    
    res.json({ advice: antwort, cached: false });
  } catch (err) {
    res.status(500).json({ fehler: "KI Aufruf fehlgeschlagen" });
  }
});

module.exports = router;