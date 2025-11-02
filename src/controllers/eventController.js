const EventModel = require("../models/eventModel");
const CalendarModel = require("../models/calendarModel");

class EventController {
  static async createEvent(req, res) {
    try {
      const {
        calendarId,
        title,
        description,
        location,
        startTime,
        endTime,
        isAllDay,
        timezone,
        isRecurring,
        recurrenceRule,
        color,
        attendees,
        reminders,
      } = req.body;

      const hasPermission = await CalendarModel.hasPermission(
        calendarId,
        req.user.userId,
        "edit"
      );
      if (!hasPermission) {
        return res.status(403).json({ error: "Access denied" });
      }

      const event = await EventModel.create({
        calendarId,
        creatorId: req.user.userId,
        title,
        description,
        location,
        startTime,
        endTime,
        isAllDay,
        timezone,
        isRecurring,
        recurrenceRule,
        color,
      });

      // Add attendees with error handling
      if (attendees && attendees.length > 0) {
        try {
          for (const attendeeEmail of attendees) {
            // If attendees is just an array of email strings
            if (typeof attendeeEmail === "string") {
              await EventModel.addAttendee(
                event.id,
                null, // userId - will be looked up by email
                attendeeEmail,
                "pending",
                false
              );
            } else {
              // If attendees is an array of objects
              await EventModel.addAttendee(
                event.id,
                attendeeEmail.userId || null,
                attendeeEmail.email,
                attendeeEmail.status || "pending",
                attendeeEmail.isOrganizer || false
              );
            }
          }
        } catch (attendeeError) {
          console.warn(
            "Warning: Could not add some attendees:",
            attendeeError.message
          );
          // Don't throw - event is created successfully
        }
      }

      // Add reminders with error handling
      if (reminders && reminders.length > 0) {
        try {
          for (const reminder of reminders) {
            // Handle both camelCase and snake_case
            const minutesBefore =
              reminder.minutes_before || reminder.minutesBefore;
            const method = reminder.method || "notification";

            if (minutesBefore !== null && minutesBefore !== undefined) {
              await EventModel.addReminder(
                event.id,
                req.user.userId,
                parseInt(minutesBefore),
                method
              );
            }
          }
        } catch (reminderError) {
          console.warn(
            "Warning: Could not add some reminders:",
            reminderError.message
          );
          // Don't throw - event is created successfully
        }
      }

      // Fetch the complete event with attendees and reminders
      const attendeesList = await EventModel.getAttendees(event.id).catch(
        () => []
      );
      const remindersList = await EventModel.getReminders(
        event.id,
        req.user.userId
      ).catch(() => []);

      return res.status(201).json({
        success: true,
        event: {
          ...event,
          attendees: attendeesList,
          reminders: remindersList,
        },
        message: "Event created successfully",
      });
    } catch (error) {
      console.error("Event creation error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to create event",
        message: error.message,
      });
    }
  }

  static async getEvents(req, res) {
    try {
      const { calendarIds, startDate, endDate } = req.query;

      if (!calendarIds || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const calendarIdArray = calendarIds.split(",").map((id) => parseInt(id));

      // Verify access to all calendars
      for (const calendarId of calendarIdArray) {
        const hasPermission = await CalendarModel.hasPermission(
          calendarId,
          req.user.userId,
          "view"
        );
        if (!hasPermission) {
          return res
            .status(403)
            .json({ error: `Access denied to calendar ${calendarId}` });
        }
      }

      let events = await EventModel.findByDateRange(
        calendarIdArray,
        startDate,
        endDate
      );

      // Expand recurring events
      const expandedEvents = [];
      for (const event of events) {
        if (event.is_recurring) {
          const instances = EventModel.expandRecurringEvent(
            event,
            startDate,
            endDate
          );
          expandedEvents.push(...instances);
        } else {
          expandedEvents.push(event);
        }
      }

      res.json(expandedEvents);
    } catch (error) {
      console.error("Fetch events error:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  }

  static async getEvent(req, res) {
    try {
      const { id } = req.params;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const hasPermission = await CalendarModel.hasPermission(
        event.calendar_id,
        req.user.userId,
        "view"
      );
      if (!hasPermission) {
        return res.status(403).json({ error: "Access denied" });
      }

      const attendees = await EventModel.getAttendees(id);
      const reminders = await EventModel.getReminders(id, req.user.userId);

      res.json({ ...event, attendees, reminders });
    } catch (error) {
      console.error("Fetch event error:", error);
      res.status(500).json({ error: "Failed to fetch event" });
    }
  }

  static async updateEvent(req, res) {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        location,
        startTime,
        endTime,
        isAllDay,
        timezone,
        recurrenceRule,
        isRecurring,
        status,
        color,
        attendees,
        reminders,
      } = req.body;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const hasPermission = await CalendarModel.hasPermission(
        event.calendar_id,
        req.user.userId,
        "edit"
      );
      if (!hasPermission) {
        return res.status(403).json({ error: "Access denied" });
      }

      const updatedEvent = await EventModel.update(id, {
        title,
        description,
        location,
        startTime,
        endTime,
        isAllDay,
        timezone,
        recurrenceRule,
        isRecurring,
        status,
        color,
      });

      // Update attendees if provided
      if (attendees) {
        try {
          // Remove existing attendees
          await EventModel.removeAllAttendees(id);

          // Add new attendees
          for (const attendeeEmail of attendees) {
            if (typeof attendeeEmail === "string") {
              await EventModel.addAttendee(
                id,
                null,
                attendeeEmail,
                "pending",
                false
              );
            } else {
              await EventModel.addAttendee(
                id,
                attendeeEmail.userId || null,
                attendeeEmail.email,
                attendeeEmail.status || "pending",
                attendeeEmail.isOrganizer || false
              );
            }
          }
        } catch (attendeeError) {
          console.warn(
            "Warning: Could not update attendees:",
            attendeeError.message
          );
        }
      }

      // Update reminders if provided
      if (reminders) {
        try {
          // Remove existing reminders
          await EventModel.removeAllReminders(id, req.user.userId);

          // Add new reminders
          for (const reminder of reminders) {
            const minutesBefore =
              reminder.minutes_before || reminder.minutesBefore;
            const method = reminder.method || "notification";

            if (minutesBefore !== null && minutesBefore !== undefined) {
              await EventModel.addReminder(
                id,
                req.user.userId,
                parseInt(minutesBefore),
                method
              );
            }
          }
        } catch (reminderError) {
          console.warn(
            "Warning: Could not update reminders:",
            reminderError.message
          );
        }
      }

      // Fetch updated event with relations
      const attendeesList = await EventModel.getAttendees(id).catch(() => []);
      const remindersList = await EventModel.getReminders(
        id,
        req.user.userId
      ).catch(() => []);

      return res.json({
        success: true,
        event: {
          ...updatedEvent,
          attendees: attendeesList,
          reminders: remindersList,
        },
        message: "Event updated successfully",
      });
    } catch (error) {
      console.error("Update event error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update event",
        message: error.message,
      });
    }
  }

  static async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const { deleteAll } = req.query;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const hasPermission = await CalendarModel.hasPermission(
        event.calendar_id,
        req.user.userId,
        "edit"
      );
      if (!hasPermission) {
        return res.status(403).json({ error: "Access denied" });
      }

      if (deleteAll === "true" && event.is_recurring) {
        await EventModel.deleteRecurringSeries(event.recurrence_id || id);
      } else {
        await EventModel.delete(id);
      }

      res.json({
        success: true,
        message: "Event deleted successfully",
      });
    } catch (error) {
      console.error("Delete event error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete event",
        message: error.message,
      });
    }
  }

  static async updateAttendeeStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      const attendee = await EventModel.updateAttendeeStatus(
        id,
        req.user.userId,
        status
      );

      res.json({
        success: true,
        attendee,
        message: "Attendee status updated successfully",
      });
    } catch (error) {
      console.error("Update attendee status error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to update attendee status",
        message: error.message,
      });
    }
  }

  static async searchEvents(req, res) {
    try {
      const { q, calendarIds } = req.query;

      if (!q) {
        return res.status(400).json({ error: "Search query required" });
      }

      const calendarIdArray = calendarIds
        ? calendarIds.split(",").map((id) => parseInt(id))
        : null;

      const events = await EventModel.search(
        req.user.userId,
        q,
        calendarIdArray
      );

      res.json({
        success: true,
        events,
        count: events.length,
      });
    } catch (error) {
      console.error("Search events error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to search events",
        message: error.message,
      });
    }
  }
}

module.exports = EventController;
