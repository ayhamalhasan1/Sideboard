// API Gateway
// Receives requests from Sideboard Manufacturer Service Backend.
// Routes traffic to each microservice via its dedicated Load Balancer.
//
// NOTE: We use pathFilter-based proxying so Express does NOT strip the
// mount path.  The downstream microservices therefore receive the full
// original URL (e.g. /api/shop/accessories) exactly as the client sent it.

require("dotenv").config();
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Route → Load Balancer mapping ────────────────────────────────────────────
// Each entry points to the nginx Load Balancer in front of that microservice.
const loadBalancers = {
  shop:         process.env.LB_SHOP_URL         || "http://lb-shop:80",
  cart:         process.env.LB_CART_URL         || "http://lb-cart:80",
  configurator: process.env.LB_CONFIGURATOR_URL || "http://lb-configurator:80",
  media:        process.env.LB_MEDIA_URL        || "http://lb-media:80",
  ai:           process.env.LB_AI_URL           || "http://lb-ai:80",
  community:    process.env.LB_COMMUNITY_URL    || "http://lb-community:80",
};

function proxy(pathPrefix, target) {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathFilter: pathPrefix,
    on: {
      error: (err, req, res) => {
        console.error(`[Gateway] Proxy error → ${target}: ${err.message}`);
        res.status(502).json({ fehler: "Service nicht erreichbar", detail: err.message });
      },
    },
  });
}

// ─── Route → Load Balancer ─────────────────────────────────────────────────────
// pathFilter-based: mounted at root, so the full path is preserved.
app.use(proxy("/api/shop",    loadBalancers.shop));
app.use(proxy("/api/reviews", loadBalancers.shop));       // reviews hosted in shop-service
app.use(proxy("/api/cart",    loadBalancers.cart));
app.use(proxy("/api/config",  loadBalancers.configurator));
app.use(proxy("/api/media",   loadBalancers.media));
app.use(proxy("/api/ai",      loadBalancers.ai));
app.use(proxy("/api/community", loadBalancers.community));

app.get("/api/health", (req, res) =>
  res.json({ status: "ok", service: "api-gateway", routes: loadBalancers })
);

app.listen(PORT, () => {
  console.log(`\n🚀 API Gateway running on port ${PORT}`);
  Object.entries(loadBalancers).forEach(([name, url]) =>
    console.log(`   ↳ /api/${name.padEnd(12)} → LB → ${url}`)
  );
});
