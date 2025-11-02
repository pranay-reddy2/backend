const ActivityModel = require("../models/activityModel");
const CalendarModel = require("../models/calendarModel");

const activityController = {
  /**
   * Get activity feed for current user
   */
  async getUserActivityFeed(req, res) {
    try {
      const userId = req.user.userId;
      const { limit = 50, offset = 0 } = req.query;

      const activities = await ActivityModel.getUserActivityFeed(
        userId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json(activities);
    } catch (error) {
      console.error("Get user activity feed error:", error);
      res.status(500).json({ error: "Failed to get activity feed" });
    }
  },

  /**
   * Get activity feed for a specific calendar
   */
  async getCalendarActivityFeed(req, res) {
    try {
      const userId = req.user.userId;
      const { calendarId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      // Check if user has access to this calendar
      const hasAccess = await CalendarModel.hasPermission(
        calendarId,
        userId,
        "view"
      );

      if (!hasAccess) {
        return res.status(403).json({ error: "No access to this calendar" });
      }

      const activities = await ActivityModel.getCalendarActivityFeed(
        calendarId,
        parseInt(limit),
        parseInt(offset)
      );

      res.json(activities);
    } catch (error) {
      console.error("Get calendar activity feed error:", error);
      res.status(500).json({ error: "Failed to get calendar activity feed" });
    }
  },

  /**
   * Get activity for a specific event
   */
  async getEventActivity(req, res) {
    try {
      const userId = req.user.userId;
      const { eventId } = req.params;

      // Get event to check calendar access
      const event = await pool.query("SELECT * FROM events WHERE id = $1", [
        eventId,
      ]);
      if (event.rows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const hasAccess = await CalendarModel.hasPermission(
        event.rows[0].calendar_id,
        userId,
        "view"
      );

      if (!hasAccess) {
        return res.status(403).json({ error: "No access to this event" });
      }

      const activities = await ActivityModel.getEventActivity(eventId);

      res.json(activities);
    } catch (error) {
      console.error("Get event activity error:", error);
      res.status(500).json({ error: "Failed to get event activity" });
    }
  },

  /**
   * Get detailed change history for an event
   */
  async getEventHistory(req, res) {
    try {
      const userId = req.user.userId;
      const { eventId } = req.params;

      // Get event to check calendar access
      const event = await pool.query("SELECT * FROM events WHERE id = $1", [
        eventId,
      ]);
      if (event.rows.length === 0) {
        return res.status(404).json({ error: "Event not found" });
      }

      const hasAccess = await CalendarModel.hasPermission(
        event.rows[0].calendar_id,
        userId,
        "view"
      );

      if (!hasAccess) {
        return res.status(403).json({ error: "No access to this event" });
      }

      const history = await ActivityModel.getEventHistory(eventId);

      res.json(history);
    } catch (error) {
      console.error("Get event history error:", error);
      res.status(500).json({ error: "Failed to get event history" });
    }
  },

  /**
   * Get recent activities (for notifications)
   */
  async getRecentActivities(req, res) {
    try {
      const userId = req.user.userId;
      const { since } = req.query;

      if (!since) {
        return res.status(400).json({ error: "since parameter is required" });
      }

      const activities = await ActivityModel.getRecentActivities(
        userId,
        new Date(since)
      );

      res.json(activities);
    } catch (error) {
      console.error("Get recent activities error:", error);
      res.status(500).json({ error: "Failed to get recent activities" });
    }
  },
};

module.exports = activityController;
