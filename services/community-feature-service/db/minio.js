// MinIO client — Sideboard Configurator Picture Store (binary image files)
// MySQL stores picture metadata; MinIO stores the actual image blobs.
const Minio = require("minio");

function createMinioClient() {
  const host = process.env.MINIO_HOST || "localhost";
  const port = parseInt(process.env.MINIO_PORT) || 9000;

  const client = new Minio.Client({
    endPoint:  host,
    port:      port,
    useSSL:    false,
    accessKey: process.env.MINIO_ROOT_USER     || "minioadmin",
    secretKey: process.env.MINIO_ROOT_PASSWORD || "minioadmin",
  });

  console.log(`✅ MinIO client configured (configurator-service → ${host}:${port})`);
  return client;
}

module.exports = { createMinioClient };
