const pool = require("../config/database");
const AvailabilityModel = require("../models/availabilityModel");

// Get user's working hours
const getWorkingHours = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;

    const result = await pool.query(
      `SELECT * FROM user_availability
       WHERE user_id = $1
       ORDER BY day_of_week, start_time`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching working hours:", error);
    res.status(500).json({ error: "Failed to fetch working hours" });
  }
};

// Update working hours
const updateWorkingHours = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { workingHours } = req.body; // Array of { day_of_week, start_time, end_time, is_available }

    if (!Array.isArray(workingHours)) {
      return res.status(400).json({ error: "workingHours must be an array" });
    }

    // Use the model's bulk set method
    const slots = workingHours.map((wh) => ({
      day_of_week: wh.day_of_week,
      start_time: wh.start_time,
      end_time: wh.end_time,
      is_available: wh.is_available !== false,
    }));

    const result = await AvailabilityModel.bulkSet(userId, slots);

    res.json(result);
  } catch (error) {
    console.error("Error updating working hours:", error);
    res.status(500).json({ error: "Failed to update working hours" });
  }
};

// Get availability preferences
const getAvailabilityPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const UserPreferencesModel = require("../models/userPreferencesModel");

    let preferences = await UserPreferencesModel.getByUserId(userId);

    // Create default preferences if they don't exist
    if (!preferences) {
      preferences = await UserPreferencesModel.upsert(userId, {});
    }

    res.json(preferences);
  } catch (error) {
    console.error("Error fetching availability preferences:", error);
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
};

// Update availability preferences
const updateAvailabilityPreferences = async (req, res) => {
  try {
    const userId = req.user.userId;
    const UserPreferencesModel = require("../models/userPreferencesModel");

    const result = await UserPreferencesModel.upsert(userId, req.body);

    res.json(result);
  } catch (error) {
    console.error("Error updating availability preferences:", error);
    res.status(500).json({ error: "Failed to update preferences" });
  }
};

// Check if user is available at a specific time
const checkAvailability = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startTime, endTime } = req.query;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: "Start and end time required" });
    }

    const startDate = new Date(startTime);
    const dayOfWeek = startDate.getDay();

    // Check working hours
    const workingHoursResult = await pool.query(
      `SELECT * FROM user_availability
       WHERE user_id = $1 AND day_of_week = $2 AND is_available = true`,
      [userId, dayOfWeek]
    );

    let isWithinWorkingHours = false;
    if (workingHoursResult.rows.length > 0) {
      const eventStart = startDate.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });
      const eventEnd = new Date(endTime).toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
      });

      // Check if time falls within any availability slot
      isWithinWorkingHours = workingHoursResult.rows.some(
        (wh) => eventStart >= wh.start_time && eventEnd <= wh.end_time
      );
    }

    // Check for existing events (conflicts)
    const eventsResult = await pool.query(
      `SELECT e.* FROM events e
       JOIN calendars c ON e.calendar_id = c.id
       WHERE c.owner_id = $1
       AND e.start_time < $3
       AND e.end_time > $2
       AND e.status != 'cancelled'`,
      [userId, startTime, endTime]
    );

    const hasConflict = eventsResult.rows.length > 0;

    res.json({
      available: isWithinWorkingHours && !hasConflict,
      withinWorkingHours: isWithinWorkingHours,
      hasConflict,
      conflicts: eventsResult.rows,
    });
  } catch (error) {
    console.error("Error checking availability:", error);
    res.status(500).json({ error: "Failed to check availability" });
  }
};

// Get user timezone
const getUserTimezone = async (req, res) => {
  try {
    const userId = req.params.userId || req.user.userId;

    const result = await pool.query(
      "SELECT timezone FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ timezone: result.rows[0].timezone });
  } catch (error) {
    console.error("Error fetching timezone:", error);
    res.status(500).json({ error: "Failed to fetch timezone" });
  }
};

// Update user timezone
const updateUserTimezone = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { timezone } = req.body;

    if (!timezone) {
      return res.status(400).json({ error: "Timezone is required" });
    }

    const UserModel = require("../models/userModel");
    const result = await UserModel.updateTimezone(userId, timezone);

    res.json({ timezone: result.timezone });
  } catch (error) {
    console.error("Error updating timezone:", error);
    res.status(500).json({ error: "Failed to update timezone" });
  }
};

module.exports = {
  getWorkingHours,
  updateWorkingHours,
  getAvailabilityPreferences,
  updateAvailabilityPreferences,
  checkAvailability,
  getUserTimezone,
  updateUserTimezone,
};
