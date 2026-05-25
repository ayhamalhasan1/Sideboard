# Sideboard-Konfigurator

Cloud-native Webanwendung zum individuellen Konfigurieren und Kaufen eines Sideboards — mit integriertem Zubehör-Shop, KI-Einrichtungsberater (Google Gemini) und vollständiger Microservices-Architektur.

> Cloud Web Projekt — Sommersemester 2026

---

## Inhaltsverzeichnis

1. [Architekturübersicht](#architekturübersicht)
2. [Technologie-Stack](#technologie-stack)
3. [Projektstruktur](#projektstruktur)
4. [Schnellstart](#schnellstart)
5. [Betriebsmodi](#betriebsmodi)
6. [Microservices im Detail](#microservices-im-detail)
7. [API-Referenz](#api-referenz)
8. [Datenbank-Schema](#datenbank-schema)
9. [Umgebungsvariablen](#umgebungsvariablen)
10. [Skalierung](#skalierung)
11. [MinIO Bildverwaltung](#minio-bildverwaltung)

---

## Architekturübersicht

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (Port 8080)                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ HTTP
┌──────────────────────────────▼──────────────────────────────────────┐
│          Sideboard Manufacturer Service — Frontend                  │
│                    (Nginx, HTML5 / CSS / JS)                        │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────────────┐
│                     Load Balancer — Manufacturer                    │
│                           (Nginx LB)                                │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────────────┐
│          Sideboard Manufacturer Service — Backend (BFF)             │
│                  (Express, REST API, HTML5)                         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ REST API
┌──────────────────────────────▼──────────────────────────────────────┐
│                         API Gateway                                 │
│               (Routing nach Pfad-Präfix)                            │
└──────┬──────────┬──────────┬──────────┬──────────┬─────────────────┘
       │          │          │          │          │
  /api/shop  /api/cart  /api/config /api/media  /api/ai
       │          │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌───▼────────────────┐
│  LB     │ │  LB     │ │  LB   │ │  LB   │ │       LB           │
│  Shop   │ │  Cart   │ │ Conf. │ │ Media │ │       AI           │
└──────┬──┘ └────┬────┘ └───┬───┘ └───┬───┘ └───┬────────────────┘
       │          │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───────────────┐
│  Shop   │ │  Cart   │ │Config.│ │ Media │ │ AI Recommendation │
│ Service │ │ Service │ │Service│ │Service│ │    Service        │
│         │ │         │ │       │ │       │ │         │         │
│ MySQL   │ │ MySQL   │ │ MySQL │ │ MySQL │ │ MySQL   ▼         │
│ (Prod.) │ │ (Cart)  │ │+ MinIO│ │+ MinIO│ │  AI Cache Service │
│ MySQL   │ │         │ │       │ │       │ │  (REST API+MySQL)  │
│ (Rev.)  │ │         │ │       │ │       │ │                   │
└─────────┘ └─────────┘ └───────┘ └───────┘ └───────────────────┘
```

---

## Technologie-Stack

| Komponente | Technologie | Zweck |
|---|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JS | Benutzeroberfläche |
| **BFF-Backend** | Node.js + Express | Einstiegspunkt für Frontend-API-Calls |
| **API Gateway** | Node.js + Express | Routing zu Microservices |
| **Load Balancer** | Nginx (6 Instanzen) | Je ein LB pro Microservice |
| **Microservices** | Node.js + Express (5 Services) | Fachliche Trennung |
| **Datenbank** | MySQL 8.0 | Alle persistenten Daten |
| **Sessions** | express-mysql-session | Geteilter Session-Store (MySQL) |
| **Bildspeicher** | MinIO (S3-kompatibel) | Binäre Bild-/Mediendateien |
| **KI** | Google Gemini 1.5 Flash | Einrichtungsberatung |
| **Container** | Docker + Docker Compose | Orchestrierung |

---

## Projektstruktur

```
Sideboard implementierung/
│
├── backend/                          # Monolithisches Backend (Original, unveränderter Referenzstand)
│   ├── server.js                     # Express-Hauptdatei
│   ├── init.sql                      # Datenbank-Schema + Testdaten
│   ├── Dockerfile
│   ├── routes/
│   │   ├── shop.js                   # Zubehör-Shop (MySQL)
│   │   ├── cart.js                   # Warenkorb
│   │   ├── config.js                 # Sideboard-Konfigurator
│   │   ├── ai.js                     # Gemini KI-Berater
│   │   └── reviews.js                # Produktbewertungen
│   └── minio-init/                   # MinIO Bucket-Initialisierung
│
├── services/                         # Microservices-Architektur
│   ├── api-gateway/                  # Routing-Gateway (Port 3000)
│   ├── sideboard-manufacturer-backend/  # BFF-Schicht (Port 5000)
│   ├── shop-service/                 # Shop + Reviews (Port 3001)
│   ├── cart-service/                 # Warenkorb (Port 3002)
│   ├── configurator-service/         # Konfigurator (Port 3003)
│   ├── media-service/                # Medien (Port 3004)
│   ├── ai-recommendation-service/    # KI-Berater (Port 3005)
│   └── ai-cache-service/             # KI-Cache REST API (Port 3006)
│
├── load-balancers/                   # Nginx-LB-Konfigurationen
│   ├── lb-manufacturer/nginx.conf
│   ├── lb-shop/nginx.conf
│   ├── lb-cart/nginx.conf
│   ├── lb-configurator/nginx.conf
│   ├── lb-media/nginx.conf
│   └── lb-ai/nginx.conf
│
├── frontend/                         # HTML5-Frontend
│   ├── Dockerfile                    # Nginx-Container
│   ├── nginx.conf                    # Proxy → lb-manufacturer
│   ├── app.js                        # Gemeinsame Logik, Navbar
│   ├── style.css
│   ├── index.html                    # Startseite
│   ├── konfigurator.html             # Sideboard-Konfigurator
│   ├── shop.html                     # Zubehör-Shop
│   ├── warenkorb.html                # Warenkorb
│   ├── checkout.html                 # Bestellabschluss
│   ├── berater.html                  # KI-Berater
│   └── profil.html                   # Benutzerprofil
│
├── assets/                           # Produktbilder für MinIO
├── db/
│   └── init.sql                      # Gemeinsames Datenbank-Schema
├── docker-compose.yml                # Microservices-Betrieb (Standard)
├── docker-compose.legacy-monolith.yml # Monolithischer Betrieb (Archiviert & Isoliert)
└── .env                              # Umgebungsvariablen
```

---

## Schnellstart

### Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (inkl. Docker Compose)
- Gemini API Key — kostenlos unter [aistudio.google.com](https://aistudio.google.com/app/apikey)

### 1. Repository klonen

```bash
git clone <repository-url>
cd "Sideboard implementierung"
```

### 2. Umgebungsvariablen einrichten

```bash
cp .env.example .env
```

`.env` öffnen und den Gemini API Key eintragen:

```env
GEMINI_API_KEY=dein-echter-gemini-api-key
```

### 3. Starten (Standard: Microservices)

Um die vollständige Microservices-Plattform (BFF, Gateway, Load Balancer, Services, MySQL, Redis, MinIO) zu starten, verwende den normalen Docker-Befehl:

```bash
docker compose up --build
```

### 4. Im Browser öffnen

| URL | Beschreibung |
|---|---|
| [http://localhost:8080](http://localhost:8080) | Frontend (Startseite) |
| [http://localhost:9001](http://localhost:9001) | MinIO Admin-Konsole |

---

## Betriebsmodi

### Modus 1: Microservices-Architektur (`docker-compose.yml`) — [STANDARD]

Das gesamte System läuft als hochskalierbares, serviceorientiertes System.

```
Browser (8080) → Frontend → lb-manufacturer → Manufacturer-Backend
               → API Gateway → lb-{service} → Microservice → MySQL/Redis/MinIO
```

Starten:
```bash
docker compose up --build
```

Stoppen und Daten löschen:
```bash
docker compose down -v
```

---

### Modus 2: Monolith (`docker-compose.legacy-monolith.yml`) — [ARCHIVIERT & ISOLIERT]

> [!CAUTION]
> Der monolithische Betrieb wurde in eine eigene Archiv-Datei verschoben und ist vollständig isoliert. Er dient ausschließlich als historischer Referenzstand.
> 
> Starten bei Bedarf:
> ```bash
> docker compose -f docker-compose.legacy-monolith.yml up --build
> ```
> 
> Stoppen und Daten löschen:
> ```bash
> docker compose -f docker-compose.legacy-monolith.yml down -v
> ```

---

## Microservices im Detail

### Sideboard Manufacturer Service — Frontend
- **Typ:** Nginx, statische HTML5-Dateien
- **Port:** 8080 (extern)
- **Aufgabe:** Benutzeroberfläche ausliefern; API-Anfragen über `/api/*` an `lb-manufacturer` weiterleiten

### Sideboard Manufacturer Service — Backend (BFF)
- **Port:** 5000 (intern)
- **Aufgabe:** Einstiegspunkt für alle REST-API-Aufrufe des Frontends; leitet diese an den API Gateway weiter

### Load Balancer (je einer pro Service)
- **Technologie:** Nginx mit `upstream`-Block
- **Konfiguration:** `load-balancers/lb-{name}/nginx.conf`
- **Aufgabe:** Verteilt eingehende Anfragen auf mehrere Instanzen eines Microservices (Round-Robin)
- **Skalierung:** Einfach durch Hochskalieren des jeweiligen Services (siehe [Skalierung](#skalierung))

### API Gateway
- **Port:** 3000 (intern)
- **Aufgabe:** Routet Anfragen anhand des URL-Pfadpräfixes an den zuständigen Load Balancer

| Pfad | Load Balancer | Microservice |
|---|---|---|
| `/api/shop/*` | `lb-shop` | shop-service |
| `/api/reviews/*` | `lb-shop` | shop-service |
| `/api/cart/*` | `lb-cart` | cart-service |
| `/api/config/*` | `lb-configurator` | configurator-service |
| `/api/media/*` | `lb-media` | media-service |
| `/api/ai/*` | `lb-ai` | ai-recommendation-service |

### Shop Information Service (`shop-service`)
- **Port:** 3001
- **Datenbanken:**
  - Product Information DB → MySQL (`accessories`-Tabelle)
  - Product Review Store → MySQL (`reviews`-Tabelle)
- **Routen:** `/api/shop/accessories`, `/api/shop/search`, `/api/reviews`

### Shopping Cart Service (`cart-service`)
- **Port:** 3002
- **Datenbank:** Shopping Cart Cache → MySQL (`cart_items`-Tabelle, via SQL API)
- **Routen:** `/api/cart`, `/api/cart/sideboard`, `/api/cart/checkout`

### Sideboard Configurator Service (`configurator-service`)
- **Port:** 3003
- **Datenbanken:**
  - Car Configurator Service DB → MySQL (`configurations`-Tabelle)
  - Sideboard-Konfigurator DB → MySQL (`saved_sideboards`-Tabelle)
  - Picture Store → MySQL (Metadaten) + MinIO (Bilddateien)
- **Routen:** `/api/config`, `/api/config/saved`

### Media Service (`media-service`)
- **Port:** 3004
- **Datenbanken:**
  - Media DB → MySQL (`media_files`-Tabelle, Metadaten)
  - Media Store → MySQL (Metadaten) + MinIO (Binärdateien)
- **Routen:** `/api/media/assets`, `/api/media/upload`

### AI Recommendation Service (`ai-recommendation-service`)
- **Port:** 3005
- **Aufgabe:** Liest aktuelle Konfiguration und Warenkorb aus MySQL, baut den Prompt, ruft Google Gemini auf. Cache-Prüfung und -Speicherung erfolgen via REST-API beim AI Cache Service.
- **Routen:** `/api/ai/advice`

### AI Cache Service (`ai-cache-service`)
- **Port:** 3006 (intern, nur vom AI Recommendation Service erreichbar)
- **Datenbank:** MySQL (`ai_cache`-Tabelle, TTL: 1 Tag)
- **REST-Endpunkte:**
  - `GET /cache/:hash` — Cache-Eintrag prüfen
  - `POST /cache` — Neue Antwort speichern
  - `DELETE /cache/expired` — Abgelaufene Einträge bereinigen

---

## API-Referenz

Alle Anfragen gehen über: `http://localhost:8080/api/`

### Shop — Zubehör

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/shop/accessories` | Alle aktiven Zubehörartikel |
| `GET` | `/api/shop/accessories/:id` | Einzelartikel |
| `GET` | `/api/shop/search?q=...` | Volltextsuche (MySQL LIKE) |

### Bewertungen

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/reviews?product_type=...&product_id=...` | Bewertungen laden |
| `POST` | `/api/reviews` | Bewertung abgeben (Auth erforderlich) |
| `DELETE` | `/api/reviews/:id` | Eigene Bewertung löschen (Auth erforderlich) |

### Warenkorb

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/cart` | Warenkorb anzeigen |
| `POST` | `/api/cart` | Zubehör hinzufügen (`{ accessory_id }`) |
| `PUT` | `/api/cart/:id` | Menge ändern (`{ menge }`) |
| `DELETE` | `/api/cart/:id` | Artikel entfernen |
| `DELETE` | `/api/cart` | Warenkorb leeren |
| `POST` | `/api/cart/sideboard` | Sideboard-Konfiguration in Warenkorb |
| `POST` | `/api/cart/checkout` | Bestellung abschließen (`{ shipping_address }`) |

### Konfigurator

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/config` | Aktuelle Konfiguration laden |
| `POST` | `/api/config` | Konfiguration speichern |
| `GET` | `/api/config/saved` | Gespeicherte Sideboards (Auth erforderlich) |
| `POST` | `/api/config/saved` | Konfiguration als Favorit speichern |
| `POST` | `/api/config/saved/:id/load` | Favorit laden |
| `DELETE` | `/api/config/saved/:id` | Favorit löschen |

### KI-Berater

| Methode | Pfad | Beschreibung |
|---|---|---|
| `POST` | `/api/ai/advice` | Einrichtungstipp (`{ type: "styling"\|"deco"\|"color" }`) |

### Medien

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/media/assets` | Alle Medien (Metadaten aus MySQL) |
| `GET` | `/api/media/assets/:id` | Einzeldatei + Presigned MinIO-URL |
| `POST` | `/api/media/upload` | Datei registrieren + Upload-URL erhalten |
| `DELETE` | `/api/media/assets/:id` | Datei löschen (MinIO + MySQL) |

### Health Checks

Jeder Microservice stellt einen Health-Endpoint bereit:

```
GET /api/health        → shop-service, cart-service, configurator-service, media-service
GET /api/ai/health     → ai-recommendation-service
GET /health            → ai-cache-service
```

---

## Datenbank-Schema

Alle Daten liegen in einer gemeinsamen MySQL-Instanz (`sideboard_db`). Die Tabellen sind logisch den jeweiligen Microservices zugeordnet.

| Tabelle | Microservice | Beschreibung |
|---|---|---|
| `accessories` | shop-service | Zubehör-Katalog |
| `reviews` | shop-service | Produktbewertungen (1–5 Sterne) |
| `cart_items` | cart-service | Warenkorb-Einträge pro Session |
| `configurations` | configurator-service | Aktive Sideboard-Konfigurationen |
| `saved_sideboards` | configurator-service | Gespeicherte Favoriten (auth) |
| `media_files` | media-service | Mediendatei-Metadaten |
| `configurator_pictures` | configurator-service | Bild-Metadaten für Konfigurationen |
| `orders` | cart-service | Abgeschlossene Bestellungen |
| `order_items` | cart-service | Bestellpositionen |
| `users` | — | Benutzerkonten |
| `addresses` | — | Lieferadressen |
| `ai_cache` | ai-cache-service | Cache für Gemini-Antworten (TTL: 1 Tag) |
| `sessions` | alle Services | Geteilter MySQL-Session-Store |

### Preisberechnung Sideboard

| Merkmal | Wert |
|---|---|
| Kleine Größe | 199 € |
| Mittlere Größe | 299 € |
| Große Größe | 399 € |
| Material Metall (Aufpreis) | +50 € |
| Material Glas (Aufpreis) | +100 € |
| Finish glänzend (Aufpreis) | +30 € |

---

## Umgebungsvariablen

### `.env` (Projektwurzel)

```env
# MySQL
MYSQL_ROOT_PASSWORD=sideboard123

# Sessions (muss in ALLEN Services identisch sein)
SESSION_SECRET=mein-geheimes-session-secret

# Google Gemini KI
GEMINI_API_KEY=dein-gemini-api-key-hier

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin
```

### Pro Microservice (`.env.example` in jedem Service-Ordner)

Jeder Service hat eine eigene `.env.example`-Datei mit allen benötigten Variablen. Die wichtigsten:

| Variable | Beschreibung |
|---|---|
| `DB_HOST` | MySQL-Hostname (im Container: `mysql`) |
| `DB_USER` | MySQL-Benutzer |
| `DB_PASSWORD` | MySQL-Passwort |
| `DB_NAME` | Datenbankname (`sideboard_db`) |
| `SESSION_SECRET` | Muss überall gleich sein |
| `GEMINI_API_KEY` | Nur in `ai-recommendation-service` |
| `MINIO_HOST` | Nur in `configurator-service` und `media-service` |
| `AI_CACHE_SERVICE_URL` | Nur in `ai-recommendation-service` |

---

## Skalierung

Jeder Microservice kann unabhängig horizontal skaliert werden. Der vorgeschaltete Nginx-Load-Balancer verteilt Anfragen automatisch per Round-Robin.

### Beispiel: Cart-Service auf 3 Instanzen skalieren

```bash
docker compose -f docker-compose.microservices.yml up --build --scale cart-service=3
```

Der `lb-cart`-Container leitet Anfragen dann reihum an alle drei Instanzen weiter.

> **Hinweis:** Sessions liegen in MySQL — alle Instanzen eines Services teilen denselben Session-Store, kein Sticky-Session-Problem.

---

## MinIO Bildverwaltung

MinIO dient als S3-kompatibler Objektspeicher für **Binärdateien** (Bilder, Medien). Metadaten (Dateiname, Typ, Größe) werden immer in MySQL gespeichert.

### Admin-Konsole

| | |
|---|---|
| URL | [http://localhost:9001](http://localhost:9001) |
| Benutzer | `minioadmin` |
| Passwort | `minioadmin` |
| Bucket | `sideboard` |

### Neue Produktbilder hinzufügen

1. Bilddatei in `assets/` ablegen (z. B. `neues-produkt.jpg`)
2. `docker compose ... down && docker compose ... up --build` — der `minio-init`-Container lädt alle Assets automatisch hoch
3. In `backend/init.sql` die `bild_url` für den Artikel aktualisieren:
   ```sql
   INSERT INTO accessories (name, preis, bild_url, ...)
   VALUES ('Neues Produkt', 29.99, 'neues-produkt.jpg', ...);
   ```

### Bild-URLs im Frontend

Das Frontend bezieht Bilder direkt von MinIO:

```javascript
// app.js
window.MINIO_URL = "http://localhost:9000/sideboard";

// Verwendung:
const bildUrl = `${window.MINIO_URL}/${accessory.bild_url}`;
```

---

## Bekannte Einschränkungen

- **Authentifizierung:** Das Login-System ist als Grundgerüst implementiert; kein vollständiger Auth-Flow mit JWT oder OAuth.
- **Checkout-Zahlung:** Bestellungen werden als `Rechnung_Mock` gespeichert; keine echte Zahlungsanbindung (Stripe-Felder sind in der DB vorbereitet).
- **KI ohne API Key:** Der Gemini-Berater antwortet mit HTTP 503, wenn kein gültiger `GEMINI_API_KEY` gesetzt ist — alle anderen Features funktionieren weiterhin.
- **ai-service/:** Der ältere `services/ai-service/`-Ordner ist ein veralteter Stand und wird von `ai-recommendation-service/` ersetzt. Er kann gelöscht werden.
