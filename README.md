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
  /api/shop  /api/cart  /api/config  /api/ai  /api/community
       │          │          │          │          │
┌──────▼──┐ ┌────▼────┐ ┌───▼───┐ ┌───▼─────────┐ ┌───▼────────────┐
│  LB     │ │  LB     │ │  LB   │ │     LB      │ │      LB        │
│  Shop   │ │  Cart   │ │ Conf. │ │     AI      │ │   Community    │
└──────┬──┘ └────┬────┘ └───┬───┘ └───┬────────┘ └───┬───────────┘
       │          │          │          │              │
┌──────▼──┐ ┌────▼────┐ ┌───▼───┐ ┌───▼──────────┐ ┌──▼──────────────┐
│  Shop   │ │  Cart   │ │Config.│ │     AI       │ │   Community     │
│ Service │ │ Service │ │Service│ │ Recommend.  │ │ Feature Service │
│         │ │         │ │       │ │   Service   │ │       +         │
│ MySQL   │ │ MySQL   │ │ MySQL │ │     │       │ │   MinIO (Media) │
│ (Prod.) │ │ (Cart)  │ │+ MinIO│ │ MySQL ▼     │ │       +         │
│ MySQL   │ │         │ │       │ │ AI Cache    │ │      MySQL      │
│ (Rev.)  │ │         │ │       │ │ Service     │ │                 │
│         │ │         │ │       │ │(REST API)   │ │                 │
└─────────┘ └─────────┘ └───────┘ └─────────────┘ └─────────────────┘
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
Sideboard/
│
├── services/                         # Microservices-Architektur
│   ├── api-gateway/                  # Routing-Gateway (Port 3000)
│   ├── sideboard-manufacturer-backend/  # BFF-Schicht (Port 5000)
│   ├── shop-service/                 # Shop + Reviews (Port 3001)
│   ├── cart-service/                 # Warenkorb (Port 3002)
│   ├── configurator-service/         # Konfigurator (Port 3003)
│   ├── ai-service/                   # KI-Berater (Port 3005)
│   └── community-feature-service/    # Community (Port 3006)
│
├── load-balancers/                   # Nginx-LB-Konfigurationen
│   ├── lb-manufacturer/nginx.conf
│   ├── lb-shop/nginx.conf
│   ├── lb-cart/nginx.conf
│   ├── lb-configurator/nginx.conf
│   ├── lb-ai/nginx.conf
│   └── lb-community/nginx.conf
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
├── infrastructure/                   # Initialisierungsskripte
│   ├── db-init/
│   │   └── init.sql                  # Datenbank-Schema + Testdaten
│   └── minio-init/
│       ├── Dockerfile
│       └── init-minio.sh
│
├── assets/                           # Produktbilder für MinIO
├── docker-compose.yml                # Microservices-Betrieb (Standard)
├── .env                              # Umgebungsvariablen
├── .env.example                      # Umgebungsvariablen (Template)
└── README.md                         # Diese Datei
```

---

## Schnellstart

### Voraussetzungen

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (inkl. Docker Compose)
- Gemini API Key — kostenlos unter [aistudio.google.com](https://aistudio.google.com/app/apikey)

### 1. Repository klonen

```bash
git clone <repository-url>
cd Sideboard
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
| [http://localhost:9000](http://localhost:9000) | MinIO Admin-Konsole |

---

## Betriebsmodi

### Microservices-Architektur (`docker-compose.yml`)

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
| `/api/ai/*` | `lb-ai` | ai-service |
| `/api/community/*` | `lb-community` | community-feature-service |

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

### AI Recommendation Service (`ai-service`)
- **Port:** 3005
- **Aufgabe:** Liest aktuelle Konfiguration und Warenkorb aus MySQL, baut den Prompt, ruft Google Gemini auf. Cache-Speicherung erfolgt direkt in der MySQL-Datenbank.
- **Routen:** `/api/ai/advice`

### Community Feature Service (`community-feature-service`)
- **Port:** 3006
- **Datenbanken:**
  - Community DB → MySQL (`community_projects`-Tabelle, Benutzer-Entwürfe)
  - Community Bilder → MinIO + MySQL (Metadaten)
- **Routen:** `/api/community`, `/api/community/:id`, `/api/community/upload`, `/api/community/:id/like`
- **Features:** Benutzer können ihre Sideboard-Konfigurationen als Entwürfe teilen, Bilder hochladen, andere Entwürfe bewerten/liken

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
### Community — Benutzer-Entwürfe

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/community` | Alle Community-Projekte |
| `GET` | `/api/community/:id` | Einzelnes Projekt laden |
| `POST` | `/api/community` | Neues Projekt hochladen (`{ title, description, config_json, image_url }`) |
### Health Checks

Jeder Microservice stellt einen Health-Endpoint bereit:

```
GET /api/health        → shop-service, cart-service, configurator-service
GET /api/ai/health     → ai-recommendation-service
GET /api/community/health → community-feature-service
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
| `community_designs` | community-feature-service | Benutzer-Entwürfe für Community |
| `orders` | cart-service | Abgeschlossene Bestellungen |
| `order_items` | cart-service | Bestellpositionen |
| `users` | — | Benutzerkonten |
| `addresses` | — | Lieferadressen |
| `ai_cache` | ai-service | Cache für Gemini-Antworten (TTL: 1 Tag) |

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
| `GEMINI_API_KEY` | Nur in `ai-service` |
| `MINIO_HOST` | Nur in `configurator-service` und `community-feature-service` |

---

## Skalierung

Jeder Microservice kann unabhängig horizontal skaliert werden. Der vorgeschaltete Nginx-Load-Balancer verteilt Anfragen automatisch per Round-Robin.

### Beispiel: Cart-Service auf 3 Instanzen skalieren

```bash
docker compose up --build --scale cart-service=3
```

Der `lb-cart`-Container leitet Anfragen dann reihum an alle drei Instanzen weiter.

> **Hinweis:** Sessions liegen in MySQL — alle Instanzen eines Services teilen denselben Session-Store, kein Sticky-Session-Problem.

---

## MinIO Bildverwaltung

MinIO dient als S3-kompatibler Objektspeicher für **Binärdateien** (Bilder, Medien). Metadaten (Dateiname, Typ, Größe) werden immer in MySQL gespeichert.

### Admin-Konsole

| | |
|---|---|
| URL | [http://localhost:9000](http://localhost:9000) |
| Benutzer | `minioadmin` |
| Passwort | `minioadmin` |
| Bucket | `sideboard` |

### Neue Produktbilder hinzufügen

1. Bilddatei in `assets/` ablegen (z. B. `neues-produkt.jpg`)
2. `docker compose down -v && docker compose up --build` — der `minio-init`-Container lädt alle Assets automatisch hoch
3. In `infrastructure/db-init/init.sql` die `bild_url` für den Artikel aktualisieren:
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
