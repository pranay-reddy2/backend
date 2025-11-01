const pool = require('../config/database');
const { RRule } = require('rrule');

class EventModel {
  static async create({
    calendarId,
    creatorId,
    title,
    description,
    location,
    startTime,
    endTime,
    isAllDay = false,
    timezone = 'UTC',
    isRecurring = false,
    recurrenceRule = null,
    recurrenceId = null,
    status = 'confirmed'
  }) {
    const result = await pool.query(
      `INSERT INTO events (
        calendar_id, creator_id, title, description, location,
        start_time, end_time, is_all_day, timezone,
        is_recurring, recurrence_rule, recurrence_id, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        calendarId, creatorId, title, description, location,
        startTime, endTime, isAllDay, timezone,
        isRecurring, recurrenceRule, recurrenceId, status
      ]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM events WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByCalendar(calendarId, startDate, endDate) {
    const result = await pool.query(
      `SELECT * FROM events
       WHERE calendar_id = $1
       AND start_time >= $2
       AND start_time <= $3
       AND status != 'cancelled'
       ORDER BY start_time ASC`,
      [calendarId, startDate, endDate]
    );
    return result.rows;
  }

  static async findByDateRange(calendarIds, startDate, endDate) {
    const result = await pool.query(
      `SELECT e.*, c.name as calendar_name, c.color as calendar_color
       FROM events e
       JOIN calendars c ON e.calendar_id = c.id
       WHERE e.calendar_id = ANY($1)
       AND e.start_time >= $2
       AND e.start_time <= $3
       AND e.status != 'cancelled'
       ORDER BY e.start_time ASC`,
      [calendarIds, startDate, endDate]
    );
    return result.rows;
  }

  static async update(id, {
    title,
    description,
    location,
    startTime,
    endTime,
    isAllDay,
    timezone,
    recurrenceRule,
    status
  }) {
    const result = await pool.query(
      `UPDATE events
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           location = COALESCE($3, location),
           start_time = COALESCE($4, start_time),
           end_time = COALESCE($5, end_time),
           is_all_day = COALESCE($6, is_all_day),
           timezone = COALESCE($7, timezone),
           recurrence_rule = COALESCE($8, recurrence_rule),
           status = COALESCE($9, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [title, description, location, startTime, endTime, isAllDay, timezone, recurrenceRule, status, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM events WHERE id = $1', [id]);
  }

  static async deleteRecurringSeries(recurrenceId) {
    await pool.query('DELETE FROM events WHERE recurrence_id = $1 OR id = $1', [recurrenceId]);
  }

  static async addAttendee(eventId, userId, email, status = 'pending', isOrganizer = false) {
    const result = await pool.query(
      `INSERT INTO event_attendees (event_id, user_id, email, status, is_organizer)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (event_id, user_id)
       DO UPDATE SET status = $4
       RETURNING *`,
      [eventId, userId, email, status, isOrganizer]
    );
    return result.rows[0];
  }

  static async updateAttendeeStatus(eventId, userId, status) {
    const result = await pool.query(
      `UPDATE event_attendees
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE event_id = $2 AND user_id = $3
       RETURNING *`,
      [status, eventId, userId]
    );
    return result.rows[0];
  }

  static async getAttendees(eventId) {
    const result = await pool.query(
      `SELECT ea.*, u.name, u.email as user_email
       FROM event_attendees ea
       LEFT JOIN users u ON ea.user_id = u.id
       WHERE ea.event_id = $1`,
      [eventId]
    );
    return result.rows;
  }

  static async addReminder(eventId, userId, minutesBefore, method = 'popup') {
    const result = await pool.query(
      `INSERT INTO reminders (event_id, user_id, minutes_before, method)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [eventId, userId, minutesBefore, method]
    );
    return result.rows[0];
  }

  static async getReminders(eventId, userId) {
    const result = await pool.query(
      'SELECT * FROM reminders WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return result.rows;
  }

  static async search(userId, query, calendarIds = null) {
    let sql = `
      SELECT e.*, c.name as calendar_name, c.color as calendar_color
      FROM events e
      JOIN calendars c ON e.calendar_id = c.id
      WHERE to_tsvector('english', e.title || ' ' || COALESCE(e.description, '') || ' ' || COALESCE(e.location, ''))
      @@ plainto_tsquery('english', $1)
      AND e.status != 'cancelled'
    `;

    const params = [query];

    if (calendarIds && calendarIds.length > 0) {
      sql += ` AND e.calendar_id = ANY($2)`;
      params.push(calendarIds);
    }

    sql += ' ORDER BY e.start_time DESC LIMIT 50';

    const result = await pool.query(sql, params);
    return result.rows;
  }

  static expandRecurringEvent(event, startDate, endDate) {
    if (!event.is_recurring || !event.recurrence_rule) {
      return [event];
    }

    try {
      const rule = RRule.fromString(event.recurrence_rule);
      const occurrences = rule.between(new Date(startDate), new Date(endDate), true);

      return occurrences.map((occurrence, index) => {
        const duration = new Date(event.end_time) - new Date(event.start_time);
        return {
          ...event,
          id: `${event.id}_${index}`,
          start_time: occurrence.toISOString(),
          end_time: new Date(occurrence.getTime() + duration).toISOString(),
          is_recurring_instance: true,
          original_event_id: event.id
        };
      });
    } catch (error) {
      console.error('Error expanding recurring event:', error);
      return [event];
    }
  }
}

module.exports = EventModel;
