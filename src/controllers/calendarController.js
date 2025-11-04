const CalendarModel = require("../models/calendarModel");
const UserModel = require("../models/userModel");
const { getEvents } = require("./eventController");

// Create calendar
const createCalendar = async (req, res) => {
  try {
    const { name, description, color, timezone } = req.body;
    const calendar = await CalendarModel.create({
      ownerId: req.user.userId,
      name,
      description,
      color,
      timezone,
    });

    res.status(201).json(calendar);
  } catch (error) {
    console.error("Calendar creation error:", error);
    res.status(500).json({ error: "Failed to create calendar" });
  }
};

// Get all calendars
const getCalendars = async (req, res) => {
  try {
    const calendars = await CalendarModel.findAccessibleByUser(req.user.userId);
    console.log("calendars", calendars);
    res.json(calendars);
  } catch (error) {
    console.error("Fetch calendars error:", error);
    res.status(500).json({ error: "Failed to fetch calendars" });
  }
};

// Get a specific calendar
const getCalendar = async (req, res) => {
  try {
    const { id } = req.params;

    const hasPermission = await CalendarModel.hasPermission(
      id,
      req.user.userId,
      "view"
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" });
    }

    const calendar = await CalendarModel.findById(id);
    if (!calendar) {
      return res.status(404).json({ error: "Calendar not found" });
    }

    res.json(calendar);
  } catch (error) {
    console.error("Fetch calendar error:", error);
    res.status(500).json({ error: "Failed to fetch calendar" });
  }
};

// Update a calendar
const updateCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, timezone } = req.body;

    const hasPermission = await CalendarModel.hasPermission(
      id,
      req.user.userId,
      "edit"
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" });
    }

    const calendar = await CalendarModel.update(id, {
      name,
      description,
      color,
      timezone,
    });
    res.json(calendar);
  } catch (error) {
    console.error("Update calendar error:", error);
    res.status(500).json({ error: "Failed to update calendar" });
  }
};

// Delete a calendar
const deleteCalendar = async (req, res) => {
  try {
    const { id } = req.params;

    const hasPermission = await CalendarModel.hasPermission(
      id,
      req.user.userId,
      "manage"
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" });
    }

    await CalendarModel.delete(id);
    res.json({ message: "Calendar deleted successfully" });
  } catch (error) {
    console.error("Delete calendar error:", error);
    res.status(500).json({ error: "Failed to delete calendar" });
  }
};

// Share a calendar with another user
const shareCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const { userEmail, permission } = req.body;

    const hasPermission = await CalendarModel.hasPermission(
      id,
      req.user.userId,
      "manage"
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" });
    }

    const user = await UserModel.findByEmail(userEmail);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const share = await CalendarModel.shareCalendar(id, user.id, permission);
    res.json(share);
  } catch (error) {
    console.error("Share calendar error:", error);
    res.status(500).json({ error: "Failed to share calendar" });
  }
};

// Get all shared users for a calendar
const getShares = async (req, res) => {
  try {
    const { id } = req.params;

    const hasPermission = await CalendarModel.hasPermission(
      id,
      req.user.userId,
      "manage"
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" });
    }

    const shares = await CalendarModel.getShares(id);
    res.json(shares);
  } catch (error) {
    console.error("Fetch shares error:", error);
    res.status(500).json({ error: "Failed to fetch shares" });
  }
};

// Remove a shared user from a calendar
const removeShare = async (req, res) => {
  try {
    const { id, userId } = req.params;

    const hasPermission = await CalendarModel.hasPermission(
      id,
      req.user.userId,
      "manage"
    );
    if (!hasPermission) {
      return res.status(403).json({ error: "Access denied" });
    }

    await CalendarModel.removeShare(id, userId);
    res.json({ message: "Share removed successfully" });
  } catch (error) {
    console.error("Remove share error:", error);
    res.status(500).json({ error: "Failed to remove share" });
  }
  if (attendees && attendees.length > 0) {
    try {
      for (const attendeeEmail of attendees) {
        if (typeof attendeeEmail === "string") {
          await EventModel.addAttendee(
            event.id,
            null,
            attendeeEmail,
            "pending", // rsvpStatus, not status
            false
          );
        } else {
          await EventModel.addAttendee(
            event.id,
            attendeeEmail.userId || null,
            attendeeEmail.email,
            attendeeEmail.rsvp_status || attendeeEmail.status || "pending", // Handle both field names
            attendeeEmail.isOrganizer || false
          );
        }
      }
    } catch (attendeeError) {
      console.warn(
        "Warning: Could not add some attendees:",
        attendeeError.message
      );
    }
  }
};

module.exports = {
  createCalendar,
  getCalendars,
  getCalendar,
  updateCalendar,
  deleteCalendar,
  shareCalendar,
  getShares,
  removeShare,
  getEvents,
};
