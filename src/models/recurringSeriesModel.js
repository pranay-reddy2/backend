const pool = require('../config/database');
const { RRule } = require('rrule');
const { v4: uuidv4 } = require('uuid');

/**
 * RecurringSeriesModel - Handles recurring event series management
 * Supports Google Calendar-style operations:
 * - Edit this event
 * - Edit this and following events
 * - Edit all events in series
 */
class RecurringSeriesModel {
  /**
   * Create a new recurring event series
   */
  static async createSeries({
    calendarId,
    creatorId,
    title,
    description,
    location,
    startTime,
    endTime,
    isAllDay = false,
    timezone = 'UTC',
    recurrenceRule,
    status = 'confirmed'
  }) {
    const seriesId = uuidv4();

    const result = await pool.query(
      `INSERT INTO events (
        calendar_id, creator_id, title, description, location,
        start_time, end_time, is_all_day, timezone,
        is_recurring, recurrence_rule, series_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12)
      RETURNING *`,
      [
        calendarId, creatorId, title, description, location,
        startTime, endTime, isAllDay, timezone,
        recurrenceRule, seriesId, status
      ]
    );

    return result.rows[0];
  }

  /**
   * Get the master event for a series
   */
  static async getSeriesMaster(seriesId) {
    const result = await pool.query(
      `SELECT * FROM events
       WHERE series_id = $1
       AND is_exception = false
       AND recurrence_id IS NULL
       LIMIT 1`,
      [seriesId]
    );
    return result.rows[0];
  }

  /**
   * Get all exceptions for a series
   */
  static async getSeriesExceptions(seriesId) {
    const result = await pool.query(
      `SELECT * FROM events
       WHERE series_id = $1
       AND is_exception = true
       ORDER BY original_start_time ASC`,
      [seriesId]
    );
    return result.rows;
  }

  /**
   * Create exception (modified instance) for a specific occurrence
   */
  static async createException(seriesId, originalStartTime, updates) {
    const master = await this.getSeriesMaster(seriesId);
    if (!master) {
      throw new Error('Series master event not found');
    }

    // Create exception event
    const result = await pool.query(
      `INSERT INTO events (
        calendar_id, creator_id, title, description, location,
        start_time, end_time, is_all_day, timezone,
        is_recurring, series_id, recurrence_id, original_start_time,
        is_exception, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, $10, $11, $12, true, $13)
      RETURNING *`,
      [
        master.calendar_id,
        master.creator_id,
        updates.title || master.title,
        updates.description !== undefined ? updates.description : master.description,
        updates.location !== undefined ? updates.location : master.location,
        updates.startTime || originalStartTime,
        updates.endTime || master.end_time,
        updates.isAllDay !== undefined ? updates.isAllDay : master.is_all_day,
        updates.timezone || master.timezone,
        seriesId,
        master.id,
        originalStartTime,
        updates.status || 'confirmed'
      ]
    );

    // Add exception date to master event
    await this.addExceptionDate(seriesId, originalStartTime);

    return result.rows[0];
  }

  /**
   * Update all events in series (including exceptions)
   */
  static async updateAllInSeries(seriesId, updates) {
    const {
      title,
      description,
      location,
      isAllDay,
      timezone,
      recurrenceRule,
      status
    } = updates;

    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           location = COALESCE($3, location),
           is_all_day = COALESCE($4, is_all_day),
           timezone = COALESCE($5, timezone),
           recurrence_rule = COALESCE($6, recurrence_rule),
           status = COALESCE($7, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE series_id = $8
       RETURNING *`,
      [title, description, location, isAllDay, timezone, recurrenceRule, status, seriesId]
    );

    return result.rows;
  }

  /**
   * Update this and future events
   * Creates a new series starting from the specified date
   */
  static async updateThisAndFuture(seriesId, fromDate, updates) {
    const master = await this.getSeriesMaster(seriesId);
    if (!master) {
      throw new Error('Series master event not found');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. End the old series by adding UNTIL to its RRULE
      const oldRule = RRule.fromString(master.recurrence_rule);
      const untilDate = new Date(fromDate);
      untilDate.setDate(untilDate.getDate() - 1); // Day before the change

      const newOldRule = new RRule({
        ...oldRule.origOptions,
        until: untilDate
      });

      await client.query(
        `UPDATE events
         SET recurrence_rule = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newOldRule.toString(), master.id]
      );

      // 2. Create new series starting from fromDate
      const newSeriesId = uuidv4();
      const duration = new Date(master.end_time) - new Date(master.start_time);
      const newStartTime = new Date(fromDate);
      const newEndTime = new Date(newStartTime.getTime() + duration);

      // Update recurrence rule to start from new date
      const newRule = new RRule({
        ...oldRule.origOptions,
        dtstart: newStartTime,
        until: oldRule.origOptions.until // Keep original end date if it exists
      });

      const result = await client.query(
        `INSERT INTO events (
          calendar_id, creator_id, title, description, location,
          start_time, end_time, is_all_day, timezone,
          is_recurring, recurrence_rule, series_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12)
        RETURNING *`,
        [
          master.calendar_id,
          master.creator_id,
          updates.title || master.title,
          updates.description !== undefined ? updates.description : master.description,
          updates.location !== undefined ? updates.location : master.location,
          newStartTime.toISOString(),
          newEndTime.toISOString(),
          updates.isAllDay !== undefined ? updates.isAllDay : master.is_all_day,
          updates.timezone || master.timezone,
          updates.recurrenceRule || newRule.toString(),
          newSeriesId,
          updates.status || master.status
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete this occurrence only
   */
  static async deleteThisOccurrence(seriesId, occurrenceDate) {
    await this.addExceptionDate(seriesId, occurrenceDate);
    return { deleted: true, type: 'occurrence' };
  }

  /**
   * Delete this and future occurrences
   */
  static async deleteThisAndFuture(seriesId, fromDate) {
    const master = await this.getSeriesMaster(seriesId);
    if (!master) {
      throw new Error('Series master event not found');
    }

    // Add UNTIL to the recurrence rule
    const rule = RRule.fromString(master.recurrence_rule);
    const untilDate = new Date(fromDate);
    untilDate.setDate(untilDate.getDate() - 1);

    const newRule = new RRule({
      ...rule.origOptions,
      until: untilDate
    });

    const result = await pool.query(
      `UPDATE events
       SET recurrence_rule = $1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [newRule.toString(), master.id]
    );

    // Delete any exceptions after this date
    await pool.query(
      `DELETE FROM events
       WHERE series_id = $1
       AND is_exception = true
       AND original_start_time >= $2`,
      [seriesId, fromDate]
    );

    return result.rows[0];
  }

  /**
   * Delete entire series
   */
  static async deleteEntireSeries(seriesId) {
    const result = await pool.query(
      'DELETE FROM events WHERE series_id = $1',
      [seriesId]
    );
    return { deleted: true, count: result.rowCount };
  }

  /**
   * Add exception date to series
   */
  static async addExceptionDate(seriesId, date) {
    const master = await this.getSeriesMaster(seriesId);
    if (!master) return;

    let exceptionDates = [];
    if (master.exception_dates) {
      try {
        exceptionDates = JSON.parse(master.exception_dates);
      } catch (e) {
        exceptionDates = [];
      }
    }

    const dateStr = new Date(date).toISOString();
    if (!exceptionDates.includes(dateStr)) {
      exceptionDates.push(dateStr);

      await pool.query(
        `UPDATE events
         SET exception_dates = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [JSON.stringify(exceptionDates), master.id]
      );
    }
  }

  /**
   * Expand series into individual occurrences
   */
  static async expandSeries(seriesId, startDate, endDate) {
    const master = await this.getSeriesMaster(seriesId);
    if (!master || !master.recurrence_rule) {
      return [];
    }

    try {
      const rule = RRule.fromString(master.recurrence_rule);
      const occurrences = rule.between(new Date(startDate), new Date(endDate), true);

      // Get exception dates
      let exceptionDates = [];
      if (master.exception_dates) {
        try {
          exceptionDates = JSON.parse(master.exception_dates).map(d => new Date(d).getTime());
        } catch (e) {
          exceptionDates = [];
        }
      }

      // Get all exceptions
      const exceptions = await this.getSeriesExceptions(seriesId);
      const exceptionMap = new Map();
      exceptions.forEach(exc => {
        const key = new Date(exc.original_start_time).getTime();
        exceptionMap.set(key, exc);
      });

      const duration = new Date(master.end_time) - new Date(master.start_time);

      return occurrences
        .filter(occ => !exceptionDates.includes(occ.getTime()))
        .map(occurrence => {
          const occTime = occurrence.getTime();

          // Check if there's an exception for this occurrence
          if (exceptionMap.has(occTime)) {
            return exceptionMap.get(occTime);
          }

          // Return regular occurrence
          return {
            ...master,
            id: `${master.id}_${occurrence.getTime()}`,
            start_time: occurrence.toISOString(),
            end_time: new Date(occurrence.getTime() + duration).toISOString(),
            is_recurring_instance: true,
            original_event_id: master.id,
            instance_date: occurrence.toISOString()
          };
        });
    } catch (error) {
      console.error('Error expanding series:', error);
      return [];
    }
  }

  /**
   * Check if a date is in the future relative to series start
   */
  static isInFuture(seriesStartTime, targetDate) {
    return new Date(targetDate) > new Date(seriesStartTime);
  }
}

module.exports = RecurringSeriesModel;
