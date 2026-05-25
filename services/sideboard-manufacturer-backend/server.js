// Sideboard Manufacturer Service — Backend
// Sits between the Sideboard Manufacturer Frontend and the API Gateway.
// Acts as the primary REST API entry point for the frontend.

require("dotenv").config();
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");

const app = express();
const PORT = process.env.PORT || 5000;
const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "http://api-gateway:3000";

// Request logging
app.use((req, res, next) => {
  console.log(`[Manufacturer-Backend] ${req.method} ${req.originalUrl}`);
  next();
});

// Forward all /api/* requests to the API Gateway
app.use(
  createProxyMiddleware({
    target: API_GATEWAY_URL,
    changeOrigin: true,
    pathFilter: "/api",
    on: {
      error: (err, req, res) => {
        console.error(`[Manufacturer-Backend] Proxy error: ${err.message}`);
        res.status(502).json({ fehler: "API Gateway nicht erreichbar", detail: err.message });
      },
    },
  })
);

app.get("/health", (req, res) =>
  res.json({ status: "ok", service: "sideboard-manufacturer-backend", gateway: API_GATEWAY_URL })
);

app.listen(PORT, () =>
  console.log(`\n🏭 Sideboard Manufacturer Service Backend running on port ${PORT}\n   → API Gateway: ${API_GATEWAY_URL}`)
);
