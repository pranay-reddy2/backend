const EventModel = require("../models/eventModel");
const CalendarModel = require("../models/calendarModel");

class EventController {
  // -------------------- CREATE EVENT (with debug logging) --------------------
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

      console.log("📝 Creating event with data:", {
        title,
        calendarId,
        reminders,
      });

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

      console.log("✅ Event created with ID:", event.id);

      // --- Add Attendees ---
      if (attendees && attendees.length > 0) {
        try {
          for (const attendee of attendees) {
            if (typeof attendee === "string") {
              await EventModel.addAttendee(
                event.id,
                null,
                attendee,
                "pending",
                false
              );
            } else {
              await EventModel.addAttendee(
                event.id,
                attendee.userId || null,
                attendee.email,
                attendee.rsvp_status || attendee.status || "pending",
                attendee.isOrganizer || false
              );
            }
          }
        } catch (attendeeError) {
          console.warn(
            "⚠️ Could not add some attendees:",
            attendeeError.message
          );
        }
      }

      // --- Add Reminders ---
      if (reminders && reminders.length > 0) {
        console.log("📢 Adding reminders:", reminders);

        try {
          for (const reminder of reminders) {
            const minutesBefore =
              reminder.minutes_before || reminder.minutesBefore;
            const method = reminder.method || "notification";

            console.log("  ➕ Adding reminder:", { minutesBefore, method });

            if (minutesBefore !== null && minutesBefore !== undefined) {
              const addedReminder = await EventModel.addReminder(
                event.id,
                req.user.userId,
                parseInt(minutesBefore),
                method
              );
              console.log("  ✅ Reminder added:", addedReminder);
            } else {
              console.warn(
                "  ⚠️ Invalid reminder (no minutes_before):",
                reminder
              );
            }
          }
        } catch (reminderError) {
          console.error("❌ Error adding reminders:", reminderError);
          console.error("Stack trace:", reminderError.stack);
        }
      } else {
        console.log("ℹ️ No reminders to add");
      }

      // --- Fetch Full Event Data ---
      const attendeesList = await EventModel.getAttendees(event.id).catch(
        () => {
          console.warn("⚠️ Failed to fetch attendees");
          return [];
        }
      );

      const remindersList = await EventModel.getReminders(
        event.id,
        req.user.userId
      ).catch((err) => {
        console.warn("⚠️ Failed to fetch reminders:", err.message);
        return [];
      });

      console.log("📋 Final event data:", {
        id: event.id,
        title: event.title,
        reminders: remindersList,
        attendees: attendeesList,
      });

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
      console.error("❌ Event creation error:", error);
      console.error("Stack trace:", error.stack);
      return res.status(500).json({
        success: false,
        error: "Failed to create event",
        message: error.message,
      });
    }
  }

  // -------------------- GET EVENT BY ID --------------------
  static async getEvents(req, res) {
    try {
      const { calendarIds, startDate, endDate } = req.query;
      const userId = req.user.userId;

      if (!calendarIds || !startDate || !endDate) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const calendarIdArray = calendarIds.split(",").map((id) => parseInt(id));

      // Verify access to all calendars
      for (const calendarId of calendarIdArray) {
        const hasPermission = await CalendarModel.hasPermission(
          calendarId,
          userId,
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

      // **FIX: Fetch reminders and attendees for each event**
      const eventsWithDetails = await Promise.all(
        expandedEvents.map(async (event) => {
          // Get the base event ID (strip instance suffix if it's a recurring instance)
          const baseEventId = event.is_recurring_instance
            ? event.original_event_id
            : event.id;

          try {
            const [reminders, attendees] = await Promise.all([
              EventModel.getReminders(baseEventId, userId).catch(() => []),
              EventModel.getAttendees(baseEventId).catch(() => []),
            ]);

            return {
              ...event,
              reminders: reminders || [],
              attendees: attendees || [],
            };
          } catch (error) {
            console.error(
              `Error fetching details for event ${event.id}:`,
              error
            );
            return {
              ...event,
              reminders: [],
              attendees: [],
            };
          }
        })
      );

      res.json(eventsWithDetails);
    } catch (error) {
      console.error("Fetch events error:", error);
      res.status(500).json({ error: "Failed to fetch events" });
    }
  }

  // -------------------- UPDATE EVENT --------------------
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
          await EventModel.removeAllAttendees(id);
          for (const attendee of attendees) {
            if (typeof attendee === "string") {
              await EventModel.addAttendee(
                id,
                null,
                attendee,
                "pending",
                false
              );
            } else {
              await EventModel.addAttendee(
                id,
                attendee.userId || null,
                attendee.email,
                attendee.rsvp_status || attendee.status || "pending",
                attendee.isOrganizer || false
              );
            }
          }
        } catch (err) {
          console.warn("Warning: Could not update attendees:", err.message);
        }
      }

      // Update reminders if provided
      if (reminders) {
        try {
          await EventModel.removeAllReminders(id, req.user.userId);
          for (const reminder of reminders) {
            const minutesBefore =
              reminder.minutes_before || reminder.minutesBefore;
            const method = reminder.method || "notification";

            if (minutesBefore != null) {
              await EventModel.addReminder(
                id,
                req.user.userId,
                parseInt(minutesBefore),
                method
              );
            }
          }
        } catch (err) {
          console.warn("Warning: Could not update reminders:", err.message);
        }
      }

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

  // -------------------- DELETE EVENT --------------------
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

  // -------------------- UPDATE ATTENDEE STATUS --------------------
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

  // -------------------- SEARCH EVENTS --------------------
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
