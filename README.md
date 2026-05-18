# 🪑 Sideboard-Konfigurator

Cloud-native Webanwendung zum Konfigurieren eines Sideboards mit integriertem Deko- und Raum-Berater (Google Gemini KI).

## Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| Frontend   | HTML, CSS, JavaScript (Vanilla) |
| Backend    | Node.js + Express |
| Datenbank  | MySQL 8.0 |
| Cache      | Redis 7 |
| Datenspeicher | MinIO (S3-kompatibel) |
| KI         | Google Gemini (gemini-1.5-flash) |
| Container  | Docker + Docker Compose |

## Projektstruktur

```
project/
├── frontend/
│   ├── Dockerfile          # Nginx-Container
│   ├── nginx.conf          # Reverse-Proxy-Konfig
│   └── *.html              # Frontend-Seiten
├── backend/
│   ├── Dockerfile          # Node.js-Container
│   ├── package.json        # Dependencies
│   ├── server.js           # Alle Routen und Logik
│   ├── init.sql            # Datenbank-Schema + Beispieldaten
│   ├── minio-init/         # MinIO Initialisierung
│   │   ├── Dockerfile      # MinIO Client
│   │   └── init-minio.sh   # Script zum Hochladen von Assets
│   └── routes/             # API-Routen
├── assets/                 # Bilder & Dateien für MinIO
│   ├── hero_sideboard.png
│   ├── led-leiste.jpg
│   ├── organizer-holz.jpg
│   └── ...
├── docker-compose.yml      # Alle Services
├── .env.example            # Projekt-weite Umgebungsvariablen
└── README.md
```

## Schnellstart

### 1. Repository klonen und `.env` erstellen

```bash
cp .env.example .env
```

### 2. Gemini API Key eintragen

Bearbeite die `.env` Datei und trage deinen [Google Gemini API Key](https://aistudio.google.com/app/apikey) ein:

```
GEMINI_API_KEY=dein-echter-api-key
```

### 3. Starten mit Docker Compose

```bash
docker-compose up --build
```

Falls Änderungen an Docker-abhängigen Dateien wie `backend/init.sql` oder `Dockerfile` nicht übernommen werden, stoppe die Compose-Umgebung komplett und lösche das Datenvolumen:

```bash
docker-compose down -v
docker-compose up --build
```

### 4. Im Browser öffnen

- **Frontend:** [http://localhost:8080](http://localhost:8080)
- **Backend API:** [http://localhost:3000](http://localhost:3000)

## Features

### ⚙️ Sideboard-Konfigurator
- **Farbe:** Weiß, Schwarz, Eiche
- **Größe:** Klein, Mittel, Groß
- **Deckel:** Auf-/Zuklappen mit CSS-Animation
- Live-Vorschau im Browser
- Speicherung in MySQL pro Session

### 🛍️ Zubehör-Shop
- Zubehörliste aus MySQL (Name, Preis, Bild)
- Warenkorb (Session-basiert)
- Mengenerhöhung bei Doppelklick

### 🤖 KI Deko-Berater
- Sendet aktuelle Konfiguration + Warenkorb an Google Gemini
- Personalisierter Einrichtungstipp (deutsch, max. 2 Sätze)
- Antworten werden in Redis gecacht (TTL: 1 Stunde)

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---------|------|--------------|
| GET     | `/api/konfiguration` | Aktuelle Konfiguration laden |
| POST    | `/api/konfiguration` | Konfiguration speichern |
| GET     | `/api/zubehoer` | Alle Zubehörteile laden |
| GET     | `/api/warenkorb` | Warenkorb anzeigen |
| POST    | `/api/warenkorb` | Artikel zum Warenkorb hinzufügen |
| DELETE  | `/api/warenkorb/:id` | Artikel aus Warenkorb entfernen |
| POST    | `/api/deko-berater` | KI-Tipp anfordern |

## Umgebungsvariablen

| Variable | Beschreibung | Standard |
|----------|-------------|----------|
| `MYSQL_ROOT_PASSWORD` | MySQL Root-Passwort | `sideboard123` |
| `SESSION_SECRET` | Session-Geheimnis | `mein-geheimes-session-secret` |
| `GEMINI_API_KEY` | Google Gemini API Key | – (erforderlich für KI) |

## Datenbank-Schema

- **configurations** – Gespeicherte Sideboard-Konfigurationen (Farbe, Größe, Deckel)
- **accessories** – Verfügbare Zubehörartikel (Name, Preis, Bild)
- **cart_items** – Warenkorb-Einträge pro Session
- **users** – Benutzerkonten mit Auth
- **orders** – Bestellungen mit Bestelldetails

## MinIO S3-Objektspeicher

Das Projekt nutzt **MinIO** als S3-kompatiblen Objektspeicher für Bilder und Assets.

### Bilder hinzufügen

1. **Bilder im `assets/`-Ordner ablegen:**
   ```
   assets/
   ├── hero_sideboard.png      # Hero-Bild auf Startseite
   ├── led-leiste.jpg          # Zubehör-Bilder für Shop
   ├── organizer-holz.jpg
   ├── kabel-durchfuehrung.jpg
   ├── filz-einlage.jpg
   ├── glasplatte.jpg
   ├── deko-vase.jpg
   └── griffe.jpg
   ```

2. **Projekt mit `docker-compose up --build` starten**
   - Der `minio-init` Container lädt automatisch alle Bilder in das MinIO-Bucket hoch
   - Die Bucket-Policy wird auf öffentlich gesetzt (Download-Zugriff)

3. **Bild-URLs verwenden**
   - In `init.sql`: `http://localhost:9000/sideboard/led-leiste.jpg`
   - Im Frontend `index.html`: `http://localhost:9000/sideboard/hero_sideboard.png`
   - Dynamisch im JavaScript: `${MINIO_URL}/bildname.jpg`

### MinIO Admin-Console

- **URL:** [http://localhost:9001](http://localhost:9001)
- **Benutzer:** `minioadmin`
- **Passwort:** `minioadmin` (aus `.env`)

Hier können Sie Buckets, Bilder und Zugriffspolicies verwalten.

### Bilder aus URLs konvertieren

Wenn Sie Bilder von externen URLs (z.B. Unsplash) verwenden möchten, laden Sie diese zunächst herunter und speichern sie im `assets/`-Ordner. Beim nächsten `docker-compose up --build` werden sie automatisch synchronisiert.

## Team

Cloud Web Projekt – HFT Stuttgart, Sommersemester 2026
