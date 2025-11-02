const RecurringSeriesModel = require("../models/recurringSeriesModel");
const EventModel = require("../models/eventModel");
const CalendarModel = require("../models/calendarModel");

const recurringSeriesController = {
  /**
   * Update a recurring event with scope (this/thisAndFuture/all)
   */
  async updateRecurringEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { scope, updates, occurrenceDate } = req.body;
      const userId = req.user.userId;

      // scope: 'this' | 'thisAndFuture' | 'all'

      const event = await EventModel.findById(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Check permissions
      const hasPermission = await CalendarModel.hasPermission(
        event.calendar_id,
        userId,
        "edit"
      );

      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "No permission to edit this event" });
      }

      let result;

      switch (scope) {
        case "this":
          // Create exception for this occurrence only
          result = await RecurringSeriesModel.createException(
            event.series_id,
            occurrenceDate,
            updates
          );
          break;

        case "thisAndFuture":
          // Update this and future events
          result = await RecurringSeriesModel.updateThisAndFuture(
            event.series_id,
            occurrenceDate,
            updates
          );
          break;

        case "all":
          // Update all events in series
          result = await RecurringSeriesModel.updateAllInSeries(
            event.series_id,
            updates
          );
          break;

        default:
          return res
            .status(400)
            .json({ error: "Invalid scope. Use: this, thisAndFuture, or all" });
      }

      res.json(result);
    } catch (error) {
      console.error("Update recurring event error:", error);
      res.status(500).json({ error: "Failed to update recurring event" });
    }
  },

  /**
   * Delete a recurring event with scope
   */
  async deleteRecurringEvent(req, res) {
    try {
      const { eventId } = req.params;
      const { scope, occurrenceDate } = req.body;
      const userId = req.user.userId;

      const event = await EventModel.findById(eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }

      // Check permissions
      const hasPermission = await CalendarModel.hasPermission(
        event.calendar_id,
        userId,
        "edit"
      );

      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "No permission to delete this event" });
      }

      let result;

      switch (scope) {
        case "this":
          // Delete this occurrence only (add to exception dates)
          result = await RecurringSeriesModel.deleteThisOccurrence(
            event.series_id,
            occurrenceDate
          );
          break;

        case "thisAndFuture":
          // Delete this and future occurrences
          result = await RecurringSeriesModel.deleteThisAndFuture(
            event.series_id,
            occurrenceDate
          );
          break;

        case "all":
          // Delete entire series
          result = await RecurringSeriesModel.deleteEntireSeries(
            event.series_id
          );
          break;

        default:
          return res
            .status(400)
            .json({ error: "Invalid scope. Use: this, thisAndFuture, or all" });
      }

      res.json(result);
    } catch (error) {
      console.error("Delete recurring event error:", error);
      res.status(500).json({ error: "Failed to delete recurring event" });
    }
  },

  /**
   * Get all occurrences of a series in a date range
   */
  async getSeriesOccurrences(req, res) {
    try {
      const { seriesId } = req.params;
      const { startDate, endDate } = req.query;
      const userId = req.user.userId;

      if (!startDate || !endDate) {
        return res
          .status(400)
          .json({ error: "startDate and endDate are required" });
      }

      const master = await RecurringSeriesModel.getSeriesMaster(seriesId);
      if (!master) {
        return res.status(404).json({ error: "Series not found" });
      }

      // Check permissions
      const hasPermission = await CalendarModel.hasPermission(
        master.calendar_id,
        userId,
        "view"
      );

      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "No permission to view this series" });
      }

      const occurrences = await RecurringSeriesModel.expandSeries(
        seriesId,
        startDate,
        endDate
      );

      res.json(occurrences);
    } catch (error) {
      console.error("Get series occurrences error:", error);
      res.status(500).json({ error: "Failed to get series occurrences" });
    }
  },

  /**
   * Get series master event
   */
  async getSeriesMaster(req, res) {
    try {
      const { seriesId } = req.params;
      const userId = req.user.userId;

      const master = await RecurringSeriesModel.getSeriesMaster(seriesId);
      if (!master) {
        return res.status(404).json({ error: "Series not found" });
      }

      // Check permissions
      const hasPermission = await CalendarModel.hasPermission(
        master.calendar_id,
        userId,
        "view"
      );

      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "No permission to view this series" });
      }

      res.json(master);
    } catch (error) {
      console.error("Get series master error:", error);
      res.status(500).json({ error: "Failed to get series master" });
    }
  },

  /**
   * Get all exceptions for a series
   */
  async getSeriesExceptions(req, res) {
    try {
      const { seriesId } = req.params;
      const userId = req.user.userId;

      const master = await RecurringSeriesModel.getSeriesMaster(seriesId);
      if (!master) {
        return res.status(404).json({ error: "Series not found" });
      }

      // Check permissions
      const hasPermission = await CalendarModel.hasPermission(
        master.calendar_id,
        userId,
        "view"
      );

      if (!hasPermission) {
        return res
          .status(403)
          .json({ error: "No permission to view this series" });
      }

      const exceptions = await RecurringSeriesModel.getSeriesExceptions(
        seriesId
      );

      res.json(exceptions);
    } catch (error) {
      console.error("Get series exceptions error:", error);
      res.status(500).json({ error: "Failed to get series exceptions" });
    }
  },
};

module.exports = recurringSeriesController;
