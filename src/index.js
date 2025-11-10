const express = require("express");
const cors = require("cors");
const http = require("http");
require("dotenv").config();

const authRoutes = require("./routes/authRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const eventRoutes = require("./routes/eventRoutes");
const attendeeRoutes = require("./routes/attendees");
const sharingRoutes = require("./routes/sharing");
const notificationRoutes = require("./routes/notifications");
const availabilityRoutes = require("./routes/availability");
const holidayRoutes = require("./routes/holidayRoutes");
const WebSocketServer = require("./websockets");
const reminderRoutes = require("./routes/reminderRoutes");

const app = express();
const PORT = process.env.PORT || 5050;

// ✅ CRITICAL: Set CORS headers BEFORE other middleware
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    process.env.CLIENT_URL,
    "https://frontend-coral-one-34.vercel.app", // Add your actual frontend domain
  ].filter(Boolean);

  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  
  // ✅ CRITICAL: Fix COOP policy for Google OAuth
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");

  // Handle preflight
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Routes
app.get("/", (req, res) => {
  res.json({ 
    message: "Google Calendar Clone API",
    status: "running",
    endpoints: {
      auth: "/api/auth",
      calendars: "/api/calendars",
      events: "/api/events",
      holidays: "/api/holidays"
    }
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/calendars", calendarRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/holidays", holidayRoutes);
app.use("/api", attendeeRoutes);
app.use("/api", sharingRoutes);
app.use("/api", notificationRoutes);
app.use("/api/availability", availabilityRoutes);
app.use("/api", reminderRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);
global.wsServer = wsServer;

const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`✅ Server running on http://${HOST}:${PORT}`);
  console.log(`✅ WebSocket server ready`);
  console.log(`✅ Auth endpoint: http://${HOST}:${PORT}/api/auth/google`);

  const networkInterfaces = require("os").networkInterfaces();
  console.log("\n📡 Server accessible at:");
  console.log(`   - http://localhost:${PORT}`);

  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((iface) => {
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`   - http://${iface.address}:${PORT}`);
      }
    });
  });
});

module.exports = app;
