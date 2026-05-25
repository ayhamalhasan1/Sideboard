// Media Service: Asset-Verwaltung
// MySQL stores metadata; MinIO stores actual binary files.

const express = require("express");
const router  = express.Router();

const BUCKET = process.env.MINIO_BUCKET || "sideboard";

// GET /api/media/assets — List all assets (metadata from MySQL)
router.get("/assets", async (req, res) => {
  const db    = req.app.locals.db;
  const minio = req.app.locals.minioClient;
  try {
    const [rows] = await db.query(
      "SELECT * FROM media_files ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("❌ GET /media/assets:", err);
    res.status(500).json({ fehler: "Konnte Assets nicht laden" });
  }
});

// GET /api/media/assets/:id — Get presigned URL for a file (MinIO) + metadata (MySQL)
router.get("/assets/:id", async (req, res) => {
  const db    = req.app.locals.db;
  const minio = req.app.locals.minioClient;
  try {
    const [[file]] = await db.query("SELECT * FROM media_files WHERE id = ?", [req.params.id]);
    if (!file) return res.status(404).json({ fehler: "Asset nicht gefunden" });

    const url = await minio.presignedGetObject(BUCKET, file.minio_path, 3600);
    res.json({ ...file, url });
  } catch (err) {
    console.error("❌ GET /media/assets/:id:", err);
    res.status(500).json({ fehler: "Fehler beim Laden des Assets" });
  }
});

// POST /api/media/upload — Register a new media file
// Returns presigned PUT URL for direct MinIO upload; saves metadata to MySQL.
router.post("/upload", async (req, res) => {
  const db    = req.app.locals.db;
  const minio = req.app.locals.minioClient;
  try {
    const { filename, original_name, content_type, file_size } = req.body;
    if (!filename) return res.status(400).json({ fehler: "filename fehlt" });

    const minio_path = filename;
    const uploadUrl  = await minio.presignedPutObject(BUCKET, minio_path, 300);

    // Save metadata to MySQL (Media DB)
    const [result] = await db.query(
      "INSERT INTO media_files (filename, original_name, content_type, file_size, bucket, minio_path) VALUES (?, ?, ?, ?, ?, ?)",
      [filename, original_name || filename, content_type || "application/octet-stream", file_size || 0, BUCKET, minio_path]
    );

    res.json({ id: result.insertId, uploadUrl, bucket: BUCKET, minio_path });
  } catch (err) {
    console.error("❌ POST /media/upload:", err);
    res.status(500).json({ fehler: "Upload fehlgeschlagen" });
  }
});

// DELETE /api/media/assets/:id — Delete file from MinIO + MySQL metadata
router.delete("/assets/:id", async (req, res) => {
  const db    = req.app.locals.db;
  const minio = req.app.locals.minioClient;
  try {
    const [[file]] = await db.query("SELECT * FROM media_files WHERE id = ?", [req.params.id]);
    if (!file) return res.status(404).json({ fehler: "Asset nicht gefunden" });

    await minio.removeObject(BUCKET, file.minio_path);
    await db.query("DELETE FROM media_files WHERE id = ?", [req.params.id]);
    res.json({ erfolg: true });
  } catch (err) {
    console.error("❌ DELETE /media/assets/:id:", err);
    res.status(500).json({ fehler: "Konnte Asset nicht löschen" });
  }
});

module.exports = router;
