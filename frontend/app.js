// ============================================
// app.js - Shared Logic & Navbar Injection mit Auth
// ============================================

window.API = "/api";
const API = window.API;
window.MINIO_URL = "http://localhost:9000/sideboard";  // MinIO Base URL
const MINIO_URL = window.MINIO_URL;

// 3. Layout Injizieren
async function injectLayout() {

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

  updateCartBadge();
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
