const pool = require('../config/database');

const UserPreferencesModel = {
  // Get user preferences
  async getByUserId(userId) {
    const result = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = $1',
      [userId]
    );
    return result.rows[0];
  },

  // Create or update user preferences
  async upsert(userId, preferences) {
    const {
      default_event_duration,
      show_declined_events,
      week_start_day,
      time_format,
      date_format,
      show_week_numbers,
      auto_add_video_conferencing,
      default_reminder_minutes,
      working_hours_start,
      working_hours_end
    } = preferences;

    const result = await pool.query(
      `INSERT INTO user_preferences (
        user_id, default_event_duration, show_declined_events,
        week_start_day, time_format, date_format, show_week_numbers,
        auto_add_video_conferencing, default_reminder_minutes,
        working_hours_start, working_hours_end, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        default_event_duration = COALESCE($2, user_preferences.default_event_duration),
        show_declined_events = COALESCE($3, user_preferences.show_declined_events),
        week_start_day = COALESCE($4, user_preferences.week_start_day),
        time_format = COALESCE($5, user_preferences.time_format),
        date_format = COALESCE($6, user_preferences.date_format),
        show_week_numbers = COALESCE($7, user_preferences.show_week_numbers),
        auto_add_video_conferencing = COALESCE($8, user_preferences.auto_add_video_conferencing),
        default_reminder_minutes = COALESCE($9, user_preferences.default_reminder_minutes),
        working_hours_start = COALESCE($10, user_preferences.working_hours_start),
        working_hours_end = COALESCE($11, user_preferences.working_hours_end),
        updated_at = NOW()
      RETURNING *`,
      [
        userId,
        default_event_duration,
        show_declined_events,
        week_start_day,
        time_format,
        date_format,
        show_week_numbers,
        auto_add_video_conferencing,
        default_reminder_minutes,
        working_hours_start,
        working_hours_end
      ]
    );

    return result.rows[0];
  },

  // Delete user preferences
  async delete(userId) {
    const result = await pool.query(
      'DELETE FROM user_preferences WHERE user_id = $1 RETURNING *',
      [userId]
    );
    return result.rows[0];
  }
};

module.exports = UserPreferencesModel;
