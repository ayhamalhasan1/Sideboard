#!/bin/sh
set -e

echo "⏳ Warte auf MinIO..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -f http://minio:9000/minio/health/live 2>/dev/null; then
    echo "✅ MinIO erreichbar"
    break
  fi
  echo "Versuch $i/10..."
  sleep 2
done

# MinIO Alias hinzufügen
mc alias set sideboard http://minio:9000 minioadmin minioadmin

# Bucket erstellen (falls nicht existent)
mc mb sideboard/sideboard 2>/dev/null || echo "✅ Bucket existiert bereits"

# Bucket-Policy für öffentliches Lesen setzen
echo "🔒 Setze öffentliche Read-Policy für Bucket..."
mc anonymous set download sideboard/sideboard

# Assets hochladen (falls vorhanden)
if [ -d "/assets" ]; then
  echo "📦 Lade Assets hoch..."
  mc cp --recursive /assets/* sideboard/sideboard/ || true
  echo "✅ Assets hochgeladen"
fi

echo "✅ MinIO Initialisierung abgeschlossen"
