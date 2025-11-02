const pool = require("../config/database");

const getPendingReminders = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT er.*, e.title, e.start_time, e.end_time, e.location
       FROM event_reminders er
       JOIN events e ON er.event_id = e.id
       JOIN calendars c ON e.calendar_id = c.id
       WHERE (c.owner_id = $1 OR EXISTS (
         SELECT 1 FROM calendar_shares cs 
         WHERE cs.calendar_id = c.id AND cs.shared_with_user_id = $1
       ))
       AND er.reminder_time <= NOW()
       AND er.sent = false
       ORDER BY er.reminder_time`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching reminders:", error);
    res.status(500).json({ error: "Failed to fetch reminders" });
  }
};

module.exports = { getPendingReminders };
