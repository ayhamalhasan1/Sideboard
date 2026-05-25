#!/bin/sh
set -e

MINIO_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_PASS="${MINIO_ROOT_PASSWORD:-minioadmin}"

echo "Warte auf MinIO..."
until mc alias set sideboard http://minio:9000 "$MINIO_USER" "$MINIO_PASS"; do
  sleep 2
done

echo "Erstelle Bucket..."
mc mb sideboard/sideboard || true

echo "Setze Public Policy..."
mc anonymous set download sideboard/sideboard

echo "Lade Assets hoch..."
for f in /assets/*; do
  if [ -f "$f" ]; then
    echo "Kopiere $f..."
    mc cp "$f" sideboard/sideboard/
  fi
done

echo "MinIO Init abgeschlossen."
