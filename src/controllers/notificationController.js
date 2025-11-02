const pool = require("../config/database");

// Get upcoming events for the user (today and next 7 days)
const getUpcomingEvents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const result = await pool.query(
      `SELECT DISTINCT e.*, c.name as calendar_name, c.color as calendar_color,
        ea.rsvp_status
      FROM events e
      JOIN calendars c ON e.calendar_id = c.id
      LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.user_id = $1
      WHERE e.start_time >= $2
        AND e.start_time <= $3
        AND e.status != 'cancelled'
        AND (c.owner_id = $1 OR cs.shared_with_user_id = $1 OR ea.user_id = $1)
      ORDER BY e.start_time ASC
      LIMIT 20`,
      [userId, now.toISOString(), nextWeek.toISOString()]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching upcoming events:", error);
    res.status(500).json({ error: "Failed to fetch upcoming events" });
  }
};

// Get today's events
const getTodayEvents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const result = await pool.query(
      `SELECT DISTINCT e.*, c.name as calendar_name, c.color as calendar_color,
        ea.rsvp_status
      FROM events e
      JOIN calendars c ON e.calendar_id = c.id
      LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.user_id = $1
      WHERE e.start_time >= $2
        AND e.start_time <= $3
        AND e.status != 'cancelled'
        AND (c.owner_id = $1 OR cs.shared_with_user_id = $1 OR ea.user_id = $1)
      ORDER BY e.start_time ASC`,
      [userId, startOfDay.toISOString(), endOfDay.toISOString()]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching today events:", error);
    res.status(500).json({ error: "Failed to fetch today events" });
  }
};

// Get pending reminders that should be shown now
const getPendingReminders = async (req, res) => {
  try {
    const userId = req.user.userId;
    const now = new Date();
    const futureTime = new Date();
    futureTime.setMinutes(futureTime.getMinutes() + 60); // Check reminders for next hour

    const result = await pool.query(
      `SELECT r.*, e.title, e.description, e.location, e.start_time, e.end_time,
        c.name as calendar_name, c.color as calendar_color
      FROM reminders r
      JOIN events e ON r.event_id = e.id
      JOIN calendars c ON e.calendar_id = c.id
      WHERE r.user_id = $1
        AND r.is_sent = false
        AND e.status != 'cancelled'
        AND (e.start_time - (r.minutes_before || ' minutes')::interval) <= $2
        AND (e.start_time - (r.minutes_before || ' minutes')::interval) >= $3
      ORDER BY e.start_time ASC`,
      [userId, futureTime.toISOString(), now.toISOString()]
    );

    console.log("Pending reminders query result:", result.rows);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching pending reminders:", error);
    res.status(500).json({ error: "Failed to fetch pending reminders" });
  }
};

// Mark reminder as sent
const markReminderSent = async (req, res) => {
  try {
    const { reminderId } = req.params;
    const userId = req.user.userId;

    await pool.query(
      `UPDATE reminders
       SET is_sent = true, sent_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [reminderId, userId]
    );

    res.json({ message: "Reminder marked as sent" });
  } catch (error) {
    console.error("Error marking reminder as sent:", error);
    res.status(500).json({ error: "Failed to mark reminder as sent" });
  }
};

// Advanced search with filters
const searchEvents = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      query,
      calendarIds,
      startDate,
      endDate,
      status, // attending, pending, declined
      eventType, // all, my-events, shared-events, invitations
    } = req.query;

    let sql = `
      SELECT DISTINCT e.*, c.name as calendar_name, c.color as calendar_color,
        c.owner_id, ea.rsvp_status,
        CASE
          WHEN c.owner_id = $1 THEN 'owner'
          WHEN ea.user_id = $1 THEN 'attendee'
          WHEN cs.shared_with_user_id = $1 THEN 'shared'
          ELSE 'unknown'
        END as user_relation
      FROM events e
      JOIN calendars c ON e.calendar_id = c.id
      LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id
      LEFT JOIN event_attendees ea ON e.id = ea.event_id AND ea.user_id = $1
      WHERE (c.owner_id = $1 OR cs.shared_with_user_id = $1 OR ea.user_id = $1)
        AND e.status != 'cancelled'
    `;

    const params = [userId];
    let paramCount = 1;

    // Text search
    if (query) {
      paramCount++;
      sql += ` AND (
        LOWER(e.title) LIKE LOWER($${paramCount}) OR
        LOWER(e.description) LIKE LOWER($${paramCount}) OR
        LOWER(e.location) LIKE LOWER($${paramCount})
      )`;
      params.push(`%${query}%`);
    }

    // Calendar filter
    if (calendarIds) {
      paramCount++;
      const calIds = calendarIds.split(",").map((id) => parseInt(id));
      sql += ` AND e.calendar_id = ANY($${paramCount})`;
      params.push(calIds);
    }

    // Date range filter
    if (startDate) {
      paramCount++;
      sql += ` AND e.start_time >= $${paramCount}`;
      params.push(startDate);
    }

    if (endDate) {
      paramCount++;
      sql += ` AND e.start_time <= $${paramCount}`;
      params.push(endDate);
    }

    // RSVP Status filter
    if (status && status !== "all") {
      paramCount++;
      sql += ` AND ea.rsvp_status = $${paramCount}`;
      params.push(status);
    }

    // Event type filter
    if (eventType) {
      switch (eventType) {
        case "my-events":
          sql += ` AND c.owner_id = $1`;
          break;
        case "shared-events":
          sql += ` AND cs.shared_with_user_id = $1`;
          break;
        case "invitations":
          sql += ` AND ea.user_id = $1 AND c.owner_id != $1`;
          break;
      }
    }

    sql += " ORDER BY e.start_time DESC LIMIT 100";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Error searching events:", error);
    res.status(500).json({ error: "Failed to search events" });
  }
};

module.exports = {
  getUpcomingEvents,
  getTodayEvents,
  getPendingReminders,
  markReminderSent,
  searchEvents,
};
