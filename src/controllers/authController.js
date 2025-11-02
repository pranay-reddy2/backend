const UserModel = require("../models/userModel");
const CalendarModel = require("../models/calendarModel");
const { generateToken } = require("../utils/jwt");

class AuthController {
  static async register(req, res) {
    try {
      const { email, password, name, timezone } = req.body;

      // Check if user already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already registered" });
      }

      // Create user
      const user = await UserModel.create({ email, password, name, timezone });

      // Create default calendar for user
      await CalendarModel.create({
        ownerId: user.id,
        name: "Personal",
        description: "My personal calendar",
        color: "#1a73e8",
        isPrimary: true,
        timezone: timezone || "UTC",
      });

      // Generate token
      const token = generateToken({ userId: user.id, email: user.email });

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
        },
        token,
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ error: "Registration failed" });
    }
  }

  static async login(req, res) {
    try {
      const { email, password } = req.body;

      const user = await UserModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const isValid = await UserModel.verifyPassword(
        password,
        user.password_hash
      );
      if (!isValid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const token = generateToken({ userId: user.id, email: user.email });

      res.json({
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          timezone: user.timezone,
        },
        token,
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Login failed" });
    }
  }

  static async getProfile(req, res) {
    try {
      const user = await UserModel.findById(req.user.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  }
}

module.exports = {
  register: AuthController.register.bind(AuthController),
  login: AuthController.login.bind(AuthController),
  getProfile: AuthController.getProfile.bind(AuthController),
};
