const pool = require('../config/database');

class CalendarModel {
  static async create({ ownerId, name, description, color = '#1a73e8', isPrimary = false, timezone = 'UTC' }) {
    const result = await pool.query(
      `INSERT INTO calendars (owner_id, name, description, color, is_primary, timezone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [ownerId, name, description, color, isPrimary, timezone]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT * FROM calendars WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async findByOwnerId(ownerId) {
    const result = await pool.query(
      'SELECT * FROM calendars WHERE owner_id = $1 ORDER BY is_primary DESC, name ASC',
      [ownerId]
    );
    return result.rows;
  }

  static async findAccessibleByUser(userId) {
    // Get calendars owned by user or shared with user
    const result = await pool.query(
      `SELECT c.*, cs.permission
       FROM calendars c
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.user_id = $1
       WHERE c.owner_id = $1 OR cs.user_id = $1
       ORDER BY c.is_primary DESC, c.name ASC`,
      [userId]
    );
    return result.rows;
  }

  static async update(id, { name, description, color, timezone }) {
    const result = await pool.query(
      `UPDATE calendars
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           color = COALESCE($3, color),
           timezone = COALESCE($4, timezone),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [name, description, color, timezone, id]
    );
    return result.rows[0];
  }

  static async delete(id) {
    await pool.query('DELETE FROM calendars WHERE id = $1', [id]);
  }

  static async shareCalendar(calendarId, userId, permission) {
    const result = await pool.query(
      `INSERT INTO calendar_shares (calendar_id, user_id, permission)
       VALUES ($1, $2, $3)
       ON CONFLICT (calendar_id, user_id)
       DO UPDATE SET permission = $3
       RETURNING *`,
      [calendarId, userId, permission]
    );
    return result.rows[0];
  }

  static async removeShare(calendarId, userId) {
    await pool.query(
      'DELETE FROM calendar_shares WHERE calendar_id = $1 AND user_id = $2',
      [calendarId, userId]
    );
  }

  static async getShares(calendarId) {
    const result = await pool.query(
      `SELECT cs.*, u.email, u.name
       FROM calendar_shares cs
       JOIN users u ON cs.user_id = u.id
       WHERE cs.calendar_id = $1`,
      [calendarId]
    );
    return result.rows;
  }

  static async hasPermission(calendarId, userId, requiredPermission = 'view') {
    const result = await pool.query(
      `SELECT c.owner_id, cs.permission
       FROM calendars c
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.user_id = $2
       WHERE c.id = $1`,
      [calendarId, userId]
    );

    if (!result.rows[0]) return false;

    const { owner_id, permission } = result.rows[0];

    // Owner has all permissions
    if (owner_id === userId) return true;

    // Check permission level
    const permissionLevels = { view: 1, edit: 2, manage: 3 };
    const required = permissionLevels[requiredPermission] || 1;
    const actual = permissionLevels[permission] || 0;

    return actual >= required;
  }
}

module.exports = CalendarModel;
