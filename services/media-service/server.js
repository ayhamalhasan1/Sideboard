// Media Microservice
// Databases:
//   - Media DB → MySQL (via SQL API) — stores media file metadata
//   - Media Store → MySQL metadata + MinIO (actual media files/blobs)

require("dotenv").config();
const express = require("express");
const { createPool } = require("./db/mysql");
const { createMinioClient } = require("./db/minio");

const app = express();
const PORT = process.env.PORT || 3004;

app.use(express.json());

async function start() {
  // ── MySQL: Media DB (metadata via SQL API) ────────────────────────────────────
  const db = await createPool();
  app.locals.db = db;

  // Auto-create media_files table (Media DB schema)
  await db.query(`
    CREATE TABLE IF NOT EXISTS media_files (
      id          INT AUTO_INCREMENT PRIMARY KEY,
      filename    VARCHAR(500)  NOT NULL,
      original_name VARCHAR(500),
      content_type  VARCHAR(100),
      file_size   BIGINT,
      bucket      VARCHAR(100)  DEFAULT 'sideboard',
      minio_path  VARCHAR(1000) NOT NULL,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // ── MinIO: Media Store (binary files) ─────────────────────────────────────────
  app.locals.minioClient = createMinioClient();

  // ── Routes ──────────────────────────────────────────────────────────────────
  app.use("/api/media", require("./routes/media"));
  app.get("/api/health", (req, res) => res.json({ status: "ok", service: "media-service" }));

  app.listen(PORT, () => console.log(`\n🖼️  Media Service running on port ${PORT}`));
}

start().catch((err) => {
  console.error("❌ media-service failed to start:", err);
  process.exit(1);
});
