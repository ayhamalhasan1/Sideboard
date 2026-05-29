-- init.sql – Erweitertes Schema für die E-Commerce-Plattform (Antigravity-Edition)
-- Falls die Tabellen schon existieren, werden sie nicht verändert, außer man macht 'docker-compose down -v'

-- 1. Benutzer
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) DEFAULT '',
    last_name VARCHAR(100) DEFAULT '',
    phone VARCHAR(50) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_verified BOOLEAN DEFAULT FALSE,
    reset_token VARCHAR(255) NULL
);

-- 2. Adressbuch
CREATE TABLE IF NOT EXISTS addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255) DEFAULT '',
    city VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'Deutschland',
    is_default BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Laufende Konfiguration
CREATE TABLE IF NOT EXISTS configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INT DEFAULT NULL,
    name VARCHAR(255) DEFAULT 'Mein Sideboard',
    farbe VARCHAR(50) DEFAULT 'weiss',
    groesse VARCHAR(20) DEFAULT 'mittel',
    deckel_offen BOOLEAN DEFAULT FALSE,
    width_cm INT DEFAULT 160,
    height_cm INT DEFAULT 80,
    depth_cm INT DEFAULT 40,
    material VARCHAR(100) DEFAULT 'Holz',
    finish VARCHAR(100) DEFAULT 'matt',
    menge INT DEFAULT 1,
    erstellt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aktualisiert_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_session (session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Community Entwürfe
CREATE TABLE IF NOT EXISTS community_designs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) DEFAULT NULL,
    user_id INT DEFAULT NULL,
    design_name VARCHAR(255) DEFAULT 'Community Sideboard',
    config_snapshot JSON NOT NULL,
    farbe VARCHAR(50) DEFAULT 'weiss',
    groesse VARCHAR(20) DEFAULT 'mittel',
    oberflaeche VARCHAR(100) DEFAULT 'weiss-matt',
    groesse_cm INT DEFAULT 120,
    material VARCHAR(100) DEFAULT 'Holz',
    finish VARCHAR(100) DEFAULT 'matt',
    width_cm INT DEFAULT 160,
    height_cm INT DEFAULT 80,
    depth_cm INT DEFAULT 40,
    deckel_offen BOOLEAN DEFAULT FALSE,
    preis DECIMAL(10,2) DEFAULT 129.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 4. Benutzer-Favoriten Sideboards
CREATE TABLE IF NOT EXISTS saved_sideboards (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    config_snapshot JSON NOT NULL, -- Speichert das komplette Objekt
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Zubehör & Shop-Katalog
CREATE TABLE IF NOT EXISTS accessories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    beschreibung TEXT,
    preis DECIMAL(10, 2) NOT NULL,
    bild_url VARCHAR(500) DEFAULT '',
    category VARCHAR(100) DEFAULT 'Allgemein',
    stock INT DEFAULT 100,
    is_active BOOLEAN DEFAULT TRUE
);
-- 6. Warenkorb
CREATE TABLE IF NOT EXISTS cart_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL,
    user_id INT DEFAULT NULL,
    accessory_id INT NOT NULL,
    menge INT DEFAULT 1,
    hinzugefuegt_am TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cart_session (session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (accessory_id) REFERENCES accessories(id) ON DELETE CASCADE
);

-- 7. Bestellungen
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    status ENUM('pending', 'paid', 'shipped', 'delivered', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    shipping_address JSON NOT NULL,
    payment_method VARCHAR(100) DEFAULT 'Rechnung',
    payment_status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    stripe_payment_intent_id VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 8. Bestell-Bestandteile
CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    product_type ENUM('sideboard', 'accessory') NOT NULL,
    product_id INT NULL, 
    product_name VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    config_snapshot JSON NULL, -- Speziell für bestellte Sideboards
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- 9. Bewertungen
CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    product_type ENUM('sideboard', 'accessory') NOT NULL,
    product_id INT NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 10. AI Cache
CREATE TABLE IF NOT EXISTS ai_cache (
    id INT AUTO_INCREMENT PRIMARY KEY,
    prompt_hash VARCHAR(64) UNIQUE NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);


-- Mock Data für Accessories / Shop
INSERT INTO accessories (name, preis, bild_url, beschreibung, category) VALUES
('LED-Lichtleiste 120cm', 24.99, 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300&h=200&fit=crop', 'Warmweiße LED-Leiste', 'Beleuchtung'),
('Organizer-Einsatz Holz', 14.99, 'https://images.unsplash.com/photo-1595079676339-1534801ad6cf?w=300&h=200&fit=crop', 'Bambus Facheinteilung', 'Innenausstattung'),
('Premium Kabeldurchführung', 7.99, 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=300&h=200&fit=crop', 'Aluminium', 'Elektronik'),
('Filz-Einlage (Grau)', 9.99, 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=300&h=200&fit=crop', 'Schützt empfindliche Oberflächen', 'Schutz'),
('Glasplatte (Maßanfertigung)', 39.99, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&h=200&fit=crop', 'Gehärtetes Glas als Deckplatte, 6mm', 'Oberfläche'),
('Deko-Vase (Nordic)', 19.99, 'https://images.unsplash.com/photo-1612196808214-b8e1d6145a8c?w=300&h=200&fit=crop', 'Keramik in Weiß', 'Dekoration'),
('Griffe "Klassik" (2er)', 12.99, 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=300&h=200&fit=crop', 'Messing-Look', 'Griffe');