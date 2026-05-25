// MinIO S3-compatible client — MediaStore (blob/file storage)
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

  console.log(`✅ MinIO client configured (${host}:${port})`);
  return client;
}

module.exports = { createMinioClient };
