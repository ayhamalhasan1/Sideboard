// ============================================
// app.js - Shared Logic & Navbar Injection mit Auth
// ============================================

window.API = "/api";
const API = window.API;
window.MINIO_URL = "http://localhost:9000/sideboard";  // MinIO Base URL
const MINIO_URL = window.MINIO_URL;

// 1. Globale State für User
window.currentUser = null;

// 2. Auth-Modals ins HTML injizieren
function injectAuthModals() {
  const modalsHTML = `
    <!-- Overlay -->
    <div id="authOverlay" class="auth-overlay" style="display:none;" onclick="closeAuthModals()"></div>

    <!-- Login Modal -->
    <div id="loginModal" class="auth-modal" style="display:none;">
      <h2>Login</h2>
      <input type="email" id="loginEmail" placeholder="E-Mail">
      <input type="password" id="loginPass" placeholder="Passwort">
      <button class="btn-primary" onclick="doLogin()">Einloggen</button>
      <p style="margin-top:1rem; font-size:0.9rem;">
        Noch kein Konto? <a href="#" onclick="showRegister()">Jetzt registrieren</a>
      </p>
    </div>

    <!-- Register Modal -->
    <div id="registerModal" class="auth-modal" style="display:none;">
      <h2>Registrieren</h2>
      <input type="text" id="regUser" placeholder="Benutzername">
      <input type="email" id="regEmail" placeholder="E-Mail">
      <input type="password" id="regPass" placeholder="Passwort">
      <button class="btn-primary" onclick="doRegister()">Konto erstellen</button>
      <p style="margin-top:1rem; font-size:0.9rem;">
        Bereits ein Konto? <a href="#" onclick="showLogin()">Jetzt einloggen</a>
      </p>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalsHTML);
}

// 3. Layout Injizieren
async function injectLayout() {
  // Check auth status first
  try {
    const res = await fetch(`${API}/auth/me`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      window.currentUser = data.profile;
    }
  } catch(err) {}

  const authLink = window.currentUser 
    ? `<a href="profil.html" class="nav-link" style="color:var(--ikea-blue);">👤 ${window.currentUser.username}</a>`
    : `<a href="#" onclick="showLogin(); return false;" class="nav-link">Login</a>`;

  const navHTML = `
    <nav class="navbar">
      <a href="index.html" class="nav-brand">
        <span style="color: var(--ikea-blue);">Sideboard</span>
        <span style="color: var(--ikea-yellow);">Konfigurator</span>
      </a>
      <div class="nav-links">
        <a href="konfigurator.html" class="nav-link">Konfigurator</a>
        <a href="shop.html" class="nav-link">Zubehör</a>
        <a href="berater.html" class="nav-link">KI Berater</a>
        ${authLink}
        <a href="warenkorb.html" class="cart-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="9" cy="21" r="1"></circle>
            <circle cx="20" cy="21" r="1"></circle>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
          </svg>
          <span class="cart-badge" id="cartBadge" style="display:none;">0</span>
        </a>
      </div>
    </nav>
  `;
  document.body.insertAdjacentHTML('afterbegin', navHTML);

  const footerHTML = `
    <footer>
      <p>&copy; 2026 Sideboard-Konfigurator - Antigravity Auth-Feature</p>
    </footer>
  `;
  document.body.insertAdjacentHTML('beforeend', footerHTML);

  // Mark active link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    if (currentPath.includes(link.getAttribute('href'))) {
      link.classList.add('active');
    }
  });

  injectAuthModals();
  updateCartBadge();
}

// 4. Modal CSS/Logic
function showLogin() {
  document.getElementById('authOverlay').style.display = 'block';
  document.getElementById('registerModal').style.display = 'none';
  document.getElementById('loginModal').style.display = 'block';
}

function showRegister() {
  document.getElementById('authOverlay').style.display = 'block';
  document.getElementById('loginModal').style.display = 'none';
  document.getElementById('registerModal').style.display = 'block';
}

function closeAuthModals() {
  document.getElementById('authOverlay').style.display = 'none';
  document.getElementById('loginModal').style.display = 'none';
  document.getElementById('registerModal').style.display = 'none';
}

// 5. Auth API Logic
async function doLogin() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPass').value;
  try {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(res.ok) {
      showToast("Erfolgreich eingeloggt!");
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.fehler, true);
    }
  } catch(err) { showToast("Login fehlgeschlagen", true); }
}

async function doRegister() {
  const user = document.getElementById('regUser').value;
  const email = document.getElementById('regEmail').value;
  const password = document.getElementById('regPass').value;
  try {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ email, username: user, password })
    });
    const data = await res.json();
    if(res.ok) {
      showToast("Registrierung erfolgreich!");
      setTimeout(() => location.reload(), 800);
    } else {
      showToast(data.fehler, true);
    }
  } catch(err) { showToast("Registrierung fehlgeschlagen", true); }
}

async function doLogout() {
  await fetch(`${API}/auth/logout`, { method: "POST", credentials: "include" });
  location.href = "index.html";
}


// 6. Toast System
function showToast(message, isError = false) {
  let container = document.getElementById("toastContainer");
  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    document.body.appendChild(container);
  }

  const toast = document.createElement("div");
  toast.className = "toast" + (isError ? " error" : "");
  toast.innerHTML = (isError ? "⚠️ " : "✅ ") + message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(100%)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 7. Cart
async function updateCartBadge() {
  try {
    const res = await fetch(`${API}/shop/cart`, { credentials: "include" });
    if (!res.ok) return;
    const items = await res.json();
    const count = items.reduce((acc, item) => acc + item.menge, 0);
    const badge = document.getElementById('cartBadge');
    if (badge) {
      badge.textContent = count;
      badge.style.display = count > 0 ? "flex" : "none";
    }
  } catch (err) {}
}

async function addToCart(accessoryId) {
  try {
    const res = await fetch(`${API}/shop/cart`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify({ accessory_id: accessoryId }),
    });
    const data = await res.json();
    if (data.erfolg) {
      showToast("Zum Warenkorb hinzugefügt");
      updateCartBadge();
      if (typeof window.loadWarenkorb === 'function') window.loadWarenkorb();
    }
  } catch (err) {
    showToast("Fehler beim Hinzufügen", true);
  }
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  injectLayout();
});
