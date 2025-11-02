const pool = require('../config/database');
const bcrypt = require('bcryptjs');

class UserModel {
  static async create({ email, password, name, timezone = 'UTC' }) {
    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, timezone)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, timezone, created_at`,
      [email, passwordHash, name, timezone]
    );

    return result.rows[0];
  }

  static async createGoogleUser({ email, googleId, name, profilePicture, timezone = 'UTC' }) {
    const result = await pool.query(
      `INSERT INTO users (email, google_id, name, auth_provider, profile_picture, timezone)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email)
       DO UPDATE SET
         google_id = EXCLUDED.google_id,
         name = EXCLUDED.name,
         profile_picture = EXCLUDED.profile_picture,
         updated_at = CURRENT_TIMESTAMP
       RETURNING id, email, name, google_id, auth_provider, profile_picture, timezone, created_at`,
      [email, googleId, name, 'google', profilePicture, timezone]
    );

    return result.rows[0];
  }

  static async findByEmail(email) {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0];
  }

  static async findByGoogleId(googleId) {
    const result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );
    return result.rows[0];
  }

  static async findById(id) {
    const result = await pool.query(
      'SELECT id, email, name, auth_provider, profile_picture, timezone, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  static async verifyPassword(plainPassword, passwordHash) {
    return bcrypt.compare(plainPassword, passwordHash);
  }

  static async updateTimezone(userId, timezone) {
    const result = await pool.query(
      'UPDATE users SET timezone = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [timezone, userId]
    );
    return result.rows[0];
  }
}

module.exports = UserModel;
