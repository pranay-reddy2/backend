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

// Middleware
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  // Add your laptop's IP address
  // Replace with actual IP
  // Add production domain when deployed
  process.env.CLIENT_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (
        allowedOrigins.indexOf(origin) !== -1 ||
        process.env.NODE_ENV === "development"
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

app.use(express.json());

// Routes
// Routes
app.get("/", (req, res) => {
  res.json({ message: "Google Calendar Clone API" });
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

// Debug: Log all registered routes
app._router.stack.forEach(function (r) {
  if (r.route && r.route.path) {
    console.log(r.route.path);
  }
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong!" });
});

// server.js or app.js (before routes)
app.use((req, res, next) => {
  res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  res.setHeader("Cross-Origin-Embedder-Policy", "unsafe-none");
  next();
});


// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Make wsServer available globally for broadcasting changes
global.wsServer = wsServer;

// At the bottom of backend/src/index.js

const HOST = process.env.HOST || "0.0.0.0"; // ✅ Listen on all interfaces

server.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`WebSocket server ready`);

  // Show network addresses for easy access
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
