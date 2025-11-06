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
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:5173",
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

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
const wsServer = new WebSocketServer(server);

// Make wsServer available globally for broadcasting changes
global.wsServer = wsServer;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket server ready`);
});

module.exports = app;
