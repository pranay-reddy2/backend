const EventModel = require('../models/eventModel');
const CalendarModel = require('../models/calendarModel');

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
        attendees,
        reminders
      } = req.body;

      const hasPermission = await CalendarModel.hasPermission(calendarId, req.userId, 'edit');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const event = await EventModel.create({
        calendarId,
        creatorId: req.userId,
        title,
        description,
        location,
        startTime,
        endTime,
        isAllDay,
        timezone,
        isRecurring,
        recurrenceRule
      });

      // Add attendees
      if (attendees && attendees.length > 0) {
        for (const attendee of attendees) {
          await EventModel.addAttendee(
            event.id,
            attendee.userId,
            attendee.email,
            attendee.status || 'pending',
            attendee.isOrganizer || false
          );
        }
      }

      // Add reminders
      if (reminders && reminders.length > 0) {
        for (const reminder of reminders) {
          await EventModel.addReminder(
            event.id,
            req.userId,
            reminder.minutesBefore,
            reminder.method || 'popup'
          );
        }
      }

      res.status(201).json(event);
    } catch (error) {
      console.error('Event creation error:', error);
      res.status(500).json({ error: 'Failed to create event' });
    }
  }

  static async getEvents(req, res) {
    try {
      const { calendarIds, startDate, endDate } = req.query;

      if (!calendarIds || !startDate || !endDate) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      const calendarIdArray = calendarIds.split(',').map(id => parseInt(id));

      // Verify access to all calendars
      for (const calendarId of calendarIdArray) {
        const hasPermission = await CalendarModel.hasPermission(calendarId, req.userId, 'view');
        if (!hasPermission) {
          return res.status(403).json({ error: `Access denied to calendar ${calendarId}` });
        }
      }

      let events = await EventModel.findByDateRange(calendarIdArray, startDate, endDate);

      // Expand recurring events
      const expandedEvents = [];
      for (const event of events) {
        if (event.is_recurring) {
          const instances = EventModel.expandRecurringEvent(event, startDate, endDate);
          expandedEvents.push(...instances);
        } else {
          expandedEvents.push(event);
        }
      }

      res.json(expandedEvents);
    } catch (error) {
      console.error('Fetch events error:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  }

  static async getEvent(req, res) {
    try {
      const { id } = req.params;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const hasPermission = await CalendarModel.hasPermission(event.calendar_id, req.userId, 'view');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const attendees = await EventModel.getAttendees(id);
      const reminders = await EventModel.getReminders(id, req.userId);

      res.json({ ...event, attendees, reminders });
    } catch (error) {
      console.error('Fetch event error:', error);
      res.status(500).json({ error: 'Failed to fetch event' });
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
        status
      } = req.body;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const hasPermission = await CalendarModel.hasPermission(event.calendar_id, req.userId, 'edit');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
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
        status
      });

      res.json(updatedEvent);
    } catch (error) {
      console.error('Update event error:', error);
      res.status(500).json({ error: 'Failed to update event' });
    }
  }

  static async deleteEvent(req, res) {
    try {
      const { id } = req.params;
      const { deleteAll } = req.query;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const hasPermission = await CalendarModel.hasPermission(event.calendar_id, req.userId, 'edit');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      if (deleteAll === 'true' && event.is_recurring) {
        await EventModel.deleteRecurringSeries(event.recurrence_id || id);
      } else {
        await EventModel.delete(id);
      }

      res.json({ message: 'Event deleted successfully' });
    } catch (error) {
      console.error('Delete event error:', error);
      res.status(500).json({ error: 'Failed to delete event' });
    }
  }

  static async updateAttendeeStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      const event = await EventModel.findById(id);
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const attendee = await EventModel.updateAttendeeStatus(id, req.userId, status);
      res.json(attendee);
    } catch (error) {
      console.error('Update attendee status error:', error);
      res.status(500).json({ error: 'Failed to update attendee status' });
    }
  }

  static async searchEvents(req, res) {
    try {
      const { q, calendarIds } = req.query;

      if (!q) {
        return res.status(400).json({ error: 'Search query required' });
      }

      const calendarIdArray = calendarIds ? calendarIds.split(',').map(id => parseInt(id)) : null;

      const events = await EventModel.search(req.userId, q, calendarIdArray);
      res.json(events);
    } catch (error) {
      console.error('Search events error:', error);
      res.status(500).json({ error: 'Failed to search events' });
    }
  }
}

module.exports = EventController;
