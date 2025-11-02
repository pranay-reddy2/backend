const { OAuth2Client } = require("google-auth-library");
const UserModel = require("../models/userModel");
const CalendarModel = require("../models/calendarModel");
const { generateToken } = require("../utils/jwt");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const verifyGoogleToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token is required" });
    }

    // Verify the Google token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    console.log("Google payload:", { googleId, email, name }); // Debug log

    // Check if user exists by Google ID
    let user = await UserModel.findByGoogleId(googleId);

    // If not found by Google ID, check by email
    if (!user) {
      user = await UserModel.findByEmail(email);
    }

    // If user doesn't exist, create a new one
    if (!user) {
      user = await UserModel.createGoogleUser({
        email,
        googleId,
        name,
        profilePicture: picture,
        timezone: "UTC",
      });

      // Create default calendar for new user
      await CalendarModel.create({
        ownerId: user.id,
        name: "Personal",
        description: "My personal calendar",
        color: "#1a73e8",
        isPrimary: true,
        timezone: user.timezone,
      });
    } else if (!user.google_id) {
      // User exists but doesn't have Google ID linked - update it
      await UserModel.updateGoogleId(user.id, googleId, picture);
      user.google_id = googleId;
      user.profile_picture = picture;
    }

    // Generate JWT token
    const jwtToken = generateToken({ userId: user.id, email: user.email });

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
  } catch (error) {
    console.error("Google authentication error:", error);
    res
      .status(401)
      .json({ error: "Invalid Google token", details: error.message });
  }
};

module.exports = { verifyGoogleToken };
