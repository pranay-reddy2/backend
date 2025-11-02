const pool = require('../config/database');

const AvailabilityModel = {
  // Get all availability slots for a user
  async getByUserId(userId) {
    const result = await pool.query(
      `SELECT * FROM user_availability
       WHERE user_id = $1
       ORDER BY day_of_week, start_time`,
      [userId]
    );
    return result.rows;
  },

  // Get availability for specific day
  async getByDay(userId, dayOfWeek) {
    const result = await pool.query(
      `SELECT * FROM user_availability
       WHERE user_id = $1 AND day_of_week = $2
       ORDER BY start_time`,
      [userId, dayOfWeek]
    );
    return result.rows;
  },

  // Create availability slot
  async create(userId, dayOfWeek, startTime, endTime, isAvailable = true) {
    const result = await pool.query(
      `INSERT INTO user_availability (
        user_id, day_of_week, start_time, end_time, is_available
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, day_of_week, start_time)
      DO UPDATE SET
        end_time = $4,
        is_available = $5,
        updated_at = NOW()
      RETURNING *`,
      [userId, dayOfWeek, startTime, endTime, isAvailable]
    );
    return result.rows[0];
  },

  // Bulk set availability (replaces all for user)
  async bulkSet(userId, availabilitySlots) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing availability
      await client.query('DELETE FROM user_availability WHERE user_id = $1', [userId]);

      // Insert new slots
      const insertedSlots = [];
      for (const slot of availabilitySlots) {
        const result = await client.query(
          `INSERT INTO user_availability (
            user_id, day_of_week, start_time, end_time, is_available
          ) VALUES ($1, $2, $3, $4, $5)
          RETURNING *`,
          [userId, slot.day_of_week, slot.start_time, slot.end_time, slot.is_available !== false]
        );
        insertedSlots.push(result.rows[0]);
      }

      await client.query('COMMIT');
      return insertedSlots;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },

  // Update availability slot
  async update(id, userId, updates) {
    const { start_time, end_time, is_available } = updates;

    const result = await pool.query(
      `UPDATE user_availability
       SET start_time = COALESCE($1, start_time),
           end_time = COALESCE($2, end_time),
           is_available = COALESCE($3, is_available),
           updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING *`,
      [start_time, end_time, is_available, id, userId]
    );

    return result.rows[0];
  },

  // Delete availability slot
  async delete(id, userId) {
    const result = await pool.query(
      'DELETE FROM user_availability WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );
    return result.rows[0];
  },

  // Delete all availability for user
  async deleteAll(userId) {
    const result = await pool.query(
      'DELETE FROM user_availability WHERE user_id = $1',
      [userId]
    );
    return result.rowCount;
  },

  // Check if user is available at specific time
  async isAvailable(userId, dayOfWeek, time) {
    const result = await pool.query(
      `SELECT * FROM user_availability
       WHERE user_id = $1
       AND day_of_week = $2
       AND start_time <= $3
       AND end_time > $3
       AND is_available = true`,
      [userId, dayOfWeek, time]
    );
    return result.rows.length > 0;
  }
};

module.exports = AvailabilityModel;
