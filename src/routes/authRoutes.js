// src/routes/authRoutes.js - Verify this file exists and has correct routes
const express = require("express");
const { verifyGoogleToken } = require("../controllers/googleAuthController");
const { getProfile } = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

// ✅ Test endpoint
router.get("/test", (req, res) => {
  res.json({ message: "Auth routes working!" });
});

// ✅ Google OAuth authentication
router.post("/google", (req, res, next) => {
  console.log("📥 Received Google auth request");
  console.log("Body:", req.body);
  next();
}, verifyGoogleToken);

// ✅ Get user profile (protected route)
router.get("/profile", authenticate, getProfile);

module.exports = router;
