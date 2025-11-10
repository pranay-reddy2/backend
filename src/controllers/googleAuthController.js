// src/controllers/googleAuthController.js
const { OAuth2Client } = require("google-auth-library");
const UserModel = require("../models/userModel");
const CalendarModel = require("../models/calendarModel");
const { generateToken } = require("../utils/jwt");

// ✅ Get client ID from environment with validation
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.error("❌ GOOGLE_CLIENT_ID is not set in environment variables!");
} else {
  console.log("✅ Google Client ID loaded:", GOOGLE_CLIENT_ID.substring(0, 20) + "...");
}

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (req, res) => {
  try {
    const { token } = req.body;

    console.log("🔍 Verifying Google token...");
    console.log("Token received:", token ? "Yes" : "No");
    console.log("Client ID configured:", GOOGLE_CLIENT_ID ? "Yes" : "No");

    if (!token) {
      console.error("❌ No token provided in request body");
      return res.status(400).json({ 
        error: "Token is required",
        details: "Google OAuth token is missing from request" 
      });
    }

    if (!GOOGLE_CLIENT_ID) {
      console.error("❌ GOOGLE_CLIENT_ID not configured on server");
      return res.status(500).json({ 
        error: "Server configuration error",
        details: "Google Client ID is not configured on the server" 
      });
    }

    // Verify the Google token
    console.log("🔐 Attempting to verify token with Google...");
    
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken: token,
        audience: GOOGLE_CLIENT_ID,
      });
    } catch (verifyError) {
      console.error("❌ Google token verification failed:", verifyError.message);
      console.error("Error details:", verifyError);
      return res.status(401).json({ 
        error: "Invalid Google token",
        details: verifyError.message 
      });
    }

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    console.log("✅ Token verified successfully!");
    console.log("Google payload:", { googleId, email, name });

    // Check if user exists by Google ID
    let user = await UserModel.findByGoogleId(googleId);
    console.log("User found by Google ID:", user ? "Yes" : "No");

    // If not found by Google ID, check by email
    if (!user) {
      console.log("Checking by email...");
      user = await UserModel.findByEmail(email);
      console.log("User found by email:", user ? "Yes" : "No");
    }

    // If user doesn't exist, create a new one
    if (!user) {
      console.log("Creating new user...");
      user = await UserModel.createGoogleUser({
        email,
        googleId,
        name,
        profilePicture: picture,
        timezone: "UTC",
      });
      console.log("✅ New user created:", user.id);

      // Create default calendar for new user
      console.log("Creating default calendar...");
      await CalendarModel.create({
        ownerId: user.id,
        name: "Personal",
        description: "My personal calendar",
        color: "#1a73e8",
        isPrimary: true,
        timezone: user.timezone,
      });
      console.log("✅ Default calendar created");
    } else if (!user.google_id) {
      // User exists but doesn't have Google ID linked - update it
      console.log("Updating existing user with Google ID...");
      await UserModel.updateGoogleId(user.id, googleId, picture);
      user.google_id = googleId;
      user.profile_picture = picture;
      console.log("✅ User updated with Google credentials");
    } else {
      console.log("✅ Existing user logged in");
    }

    // Generate JWT token
    const jwtToken = generateToken({ userId: user.id, email: user.email });
    console.log("✅ JWT token generated");

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        profilePicture: user.profile_picture,
        timezone: user.timezone,
      },
      token: jwtToken,
    });

    console.log("✅ Google authentication successful for:", email);
  } catch (error) {
    console.error("❌ Google authentication error:", error);
    console.error("Error stack:", error.stack);
    res.status(401).json({ 
      error: "Authentication failed",
      details: error.message,
      type: error.name 
    });
  }
};

module.exports = { verifyGoogleToken };
