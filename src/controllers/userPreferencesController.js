const UserPreferencesModel = require("../models/userPreferencesModel");

const userPreferencesController = {
  // Get user preferences
  async getPreferences(req, res) {
    try {
      const userId = req.user.userId;

      let preferences = await UserPreferencesModel.getByUserId(userId);

      // If no preferences exist, create default ones
      if (!preferences) {
        preferences = await UserPreferencesModel.upsert(userId, {});
      }

      res.json(preferences);
    } catch (error) {
      console.error("Get preferences error:", error);
      res.status(500).json({ error: "Failed to get preferences" });
    }
  },

  // Update user preferences
  async updatePreferences(req, res) {
    try {
      const userId = req.user.userId;
      const preferences = req.body;

      // Validate time format
      if (
        preferences.time_format &&
        !["12h", "24h"].includes(preferences.time_format)
      ) {
        return res
          .status(400)
          .json({ error: "Invalid time format. Must be 12h or 24h" });
      }

      // Validate week start day
      if (
        preferences.week_start_day !== undefined &&
        (preferences.week_start_day < 0 || preferences.week_start_day > 6)
      ) {
        return res
          .status(400)
          .json({ error: "Invalid week start day. Must be 0-6" });
      }

      const updated = await UserPreferencesModel.upsert(userId, preferences);

      res.json(updated);
    } catch (error) {
      console.error("Update preferences error:", error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  },

  // Delete user preferences (reset to defaults)
  async deletePreferences(req, res) {
    try {
      const userId = req.user.userId;

      await UserPreferencesModel.delete(userId);

      // Create new default preferences
      const newPreferences = await UserPreferencesModel.upsert(userId, {});

      res.json(newPreferences);
    } catch (error) {
      console.error("Delete preferences error:", error);
      res.status(500).json({ error: "Failed to reset preferences" });
    }
  },
};

module.exports = userPreferencesController;
