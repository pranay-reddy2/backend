const pool = require('../config/database');

/**
 * ActivityModel - Track all user activities and changes
 * Google Calendar-style activity feed and audit trail
 */
class ActivityModel {
  /**
   * Log an activity
   */
  static async log({
    userId,
    calendarId = null,
    eventId = null,
    action,
    entityType,
    changes = null,
    metadata = null
  }) {
    const result = await pool.query(
      `INSERT INTO activity_log (
        user_id, calendar_id, event_id, action, entity_type, changes, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [userId, calendarId, eventId, action, entityType, changes, metadata]
    );

    return result.rows[0];
  }

  /**
   * Log event change with detailed field tracking
   */
  static async logEventChange({
    eventId,
    userId,
    action,
    fieldName = null,
    oldValue = null,
    newValue = null
  }) {
    const result = await pool.query(
      `INSERT INTO event_history (
        event_id, user_id, action, field_name, old_value, new_value
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [eventId, userId, action, fieldName, oldValue, newValue]
    );

    return result.rows[0];
  }

  /**
   * Get activity feed for a user (all calendars they have access to)
   */
  static async getUserActivityFeed(userId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT
        al.*,
        u.name as user_name,
        u.email as user_email,
        c.name as calendar_name,
        c.color as calendar_color,
        e.title as event_title,
        e.start_time as event_start_time
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN calendars c ON al.calendar_id = c.id
      LEFT JOIN events e ON al.event_id = e.id
      WHERE al.calendar_id IN (
        -- User's own calendars
        SELECT id FROM calendars WHERE owner_id = $1
        UNION
        -- Calendars shared with user
        SELECT calendar_id FROM calendar_shares WHERE shared_with_user_id = $1
      )
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get activity feed for a specific calendar
   */
  static async getCalendarActivityFeed(calendarId, limit = 50, offset = 0) {
    const result = await pool.query(
      `SELECT
        al.*,
        u.name as user_name,
        u.email as user_email,
        e.title as event_title,
        e.start_time as event_start_time
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN events e ON al.event_id = e.id
      WHERE al.calendar_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2 OFFSET $3`,
      [calendarId, limit, offset]
    );

    return result.rows;
  }

  /**
   * Get activity for a specific event
   */
  static async getEventActivity(eventId) {
    const result = await pool.query(
      `SELECT
        al.*,
        u.name as user_name,
        u.email as user_email
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.event_id = $1
      ORDER BY al.created_at DESC`,
      [eventId]
    );

    return result.rows;
  }

  /**
   * Get detailed change history for an event
   */
  static async getEventHistory(eventId) {
    const result = await pool.query(
      `SELECT
        eh.*,
        u.name as user_name,
        u.email as user_email
      FROM event_history eh
      LEFT JOIN users u ON eh.user_id = u.id
      WHERE eh.event_id = $1
      ORDER BY eh.created_at DESC`,
      [eventId]
    );

    return result.rows;
  }

  /**
   * Get recent activities (for notifications)
   */
  static async getRecentActivities(userId, since, limit = 20) {
    const result = await pool.query(
      `SELECT
        al.*,
        u.name as user_name,
        u.email as user_email,
        c.name as calendar_name,
        e.title as event_title
      FROM activity_log al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN calendars c ON al.calendar_id = c.id
      LEFT JOIN events e ON al.event_id = e.id
      WHERE al.calendar_id IN (
        SELECT id FROM calendars WHERE owner_id = $1
        UNION
        SELECT calendar_id FROM calendar_shares WHERE shared_with_user_id = $1
      )
      AND al.created_at > $2
      AND al.user_id != $1  -- Don't show user's own actions
      ORDER BY al.created_at DESC
      LIMIT $3`,
      [userId, since, limit]
    );

    return result.rows;
  }

  /**
   * Track event creation
   */
  static async trackEventCreated(event, userId) {
    await this.log({
      userId,
      calendarId: event.calendar_id,
      eventId: event.id,
      action: 'event_created',
      entityType: 'event',
      changes: {
        title: { old: null, new: event.title },
        start_time: { old: null, new: event.start_time },
        end_time: { old: null, new: event.end_time }
      }
    });

    await this.logEventChange({
      eventId: event.id,
      userId,
      action: 'created',
      fieldName: 'event',
      oldValue: null,
      newValue: event.title
    });
  }

  /**
   * Track event update with field-level changes
   */
  static async trackEventUpdated(eventId, oldEvent, newEvent, userId) {
    const changes = {};
    const fieldsToTrack = [
      'title', 'description', 'location',
      'start_time', 'end_time', 'status', 'is_all_day'
    ];

    fieldsToTrack.forEach(field => {
      if (oldEvent[field] !== newEvent[field]) {
        changes[field] = {
          old: oldEvent[field],
          new: newEvent[field]
        };

        // Log individual field change
        this.logEventChange({
          eventId,
          userId,
          action: `${field}_changed`,
          fieldName: field,
          oldValue: String(oldEvent[field] || ''),
          newValue: String(newEvent[field] || '')
        });
      }
    });

    if (Object.keys(changes).length > 0) {
      await this.log({
        userId,
        calendarId: oldEvent.calendar_id,
        eventId,
        action: 'event_updated',
        entityType: 'event',
        changes
      });
    }
  }

  /**
   * Track event deletion
   */
  static async trackEventDeleted(event, userId) {
    await this.log({
      userId,
      calendarId: event.calendar_id,
      eventId: event.id,
      action: 'event_deleted',
      entityType: 'event',
      changes: {
        title: { old: event.title, new: null },
        status: { old: event.status, new: 'deleted' }
      }
    });

    await this.logEventChange({
      eventId: event.id,
      userId,
      action: 'deleted',
      fieldName: 'event',
      oldValue: event.title,
      newValue: null
    });
  }

  /**
   * Track calendar sharing
   */
  static async trackCalendarShared(calendarId, sharedWithUserId, permission, userId) {
    await this.log({
      userId,
      calendarId,
      eventId: null,
      action: 'calendar_shared',
      entityType: 'calendar',
      changes: {
        shared_with: { old: null, new: sharedWithUserId },
        permission: { old: null, new: permission }
      }
    });
  }

  /**
   * Track permission change
   */
  static async trackPermissionChanged(calendarId, sharedWithUserId, oldPermission, newPermission, userId) {
    await this.log({
      userId,
      calendarId,
      eventId: null,
      action: 'permission_changed',
      entityType: 'calendar',
      changes: {
        shared_with: { old: sharedWithUserId, new: sharedWithUserId },
        permission: { old: oldPermission, new: newPermission }
      }
    });
  }

  /**
   * Track RSVP status change
   */
  static async trackRSVPChanged(eventId, userId, oldStatus, newStatus) {
    const event = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    if (event.rows.length === 0) return;

    await this.log({
      userId,
      calendarId: event.rows[0].calendar_id,
      eventId,
      action: 'rsvp_changed',
      entityType: 'event',
      changes: {
        rsvp_status: { old: oldStatus, new: newStatus }
      }
    });
  }

  /**
   * Delete old activity logs (cleanup)
   */
  static async deleteOldLogs(olderThanDays = 90) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const result = await pool.query(
      `DELETE FROM activity_log WHERE created_at < $1`,
      [cutoffDate]
    );

    return result.rowCount;
  }
}

module.exports = ActivityModel;
