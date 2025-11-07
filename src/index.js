// ------------------------
// Imports and setup
// ------------------------
const express = require("express");
const cors = require("cors");
const http = require("http");
const dotenv = require("dotenv");
const os = require("os");

dotenv.config();

// ------------------------
// Routes and modules
// ------------------------
const authRoutes = require("./routes/authRoutes");
const calendarRoutes = require("./routes/calendarRoutes");
const eventRoutes = require("./routes/eventRoutes");
const attendeeRoutes = require("./routes/attendees");
const sharingRoutes = require("./routes/sharing");
const notificationRoutes = require("./routes/notifications");
const availabilityRoutes = require("./routes/availability");
const holidayRoutes = require("./routes/holidayRoutes");
const reminderRoutes = require("./routes/reminderRoutes");
const WebSocketServer = require("./websockets");

// ------------------------
// Express app
// ------------------------
const app = express();

// ------------------------
// CORS Configuration
// ------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  process.env.CLIENT_URL, // from Railway/Vercel environment variable
].filter(Boolean); // remove undefined

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true); // allow mobile/postman
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV === "development"
      ) {
        callback(null, true);
      } else {
        console.warn("❌ Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// ------------------------
// Routes
// ------------------------
app.get("/", (req, res) => {
  res.json({ message: "✅ Google Calendar Clone API Running" });
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

// ------------------------
// Error handler
// ------------------------
app.use((err, req, res, next) => {
  console.error("🔥 Error:", err.stack);
  res.status(500).json({ error: "Internal Server Error" });
});

// ------------------------
// HTTP + WebSocket Server
// ------------------------
const server = http.createServer(app);

// Initialize WebSocket server
try {
  const wsServer = new WebSocketServer(server);
  global.wsServer = wsServer;
  console.log("🌐 WebSocket server initialized");
} catch (err) {
  console.error("❌ WebSocket initialization failed:", err);
}

// ------------------------
// Start Server (Railway compatible)
// ------------------------
const PORT = process.env.PORT || 5050;
const HOST = process.env.HOST || "0.0.0.0";

server.listen(PORT, HOST, () => {
  console.log(`🚀 Server running at http://${HOST}:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);

  // Display available local network addresses
  const interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach((name) => {
    interfaces[name].forEach((iface) => {
      if (iface.family === "IPv4" && !iface.internal) {
        console.log(`🌍 Accessible at: http://${iface.address}:${PORT}`);
      }
    });
  });
});

module.exports = app;
