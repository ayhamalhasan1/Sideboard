#!/bin/sh
set -e

echo "Warte auf MinIO..."

until mc alias set sideboard http://minio:9000 minioadmin minioadmin; do
  sleep 2
done

echo "Erstelle Bucket..."
mc mb sideboard/sideboard || true

echo "Setze Public Policy..."
mc anonymous set download sideboard/sideboard

echo "Lade Assets hoch..."
mc cp --recursive /assets/* sideboard/sideboard/ || true

echo "MinIO Init abgeschlossen."