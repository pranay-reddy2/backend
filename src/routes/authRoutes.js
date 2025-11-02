const express = require("express");
const { verifyGoogleToken } = require("../controllers/googleAuthController");
const { getProfile } = require("../controllers/authController");
const { authenticate } = require("../middlewares/auth");

const router = express.Router();

// Google OAuth authentication
router.post("/google", verifyGoogleToken);

// Get user profile (protected route)
router.get("/profile", authenticate, getProfile);

module.exports = router;
