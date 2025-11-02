const pool = require("../config/database");

class HolidayModel {
  // Create or update holidays
  static async upsertHolidays(holidays) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const holiday of holidays) {
        await client.query(
          `INSERT INTO holidays (name, description, date, country_code, region, type, is_national)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (date, country_code, name) DO UPDATE
           SET description = $2, region = $5, type = $6, is_national = $7, updated_at = CURRENT_TIMESTAMP`,
          [
            holiday.name,
            holiday.description,
            holiday.date,
            holiday.countryCode,
            holiday.region || null,
            holiday.type || "public",
            holiday.isNational !== false,
          ]
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Get holidays for a specific date range
  static async getHolidaysForDateRange(
    startDate,
    endDate,
    countryCodes = ["US"]
  ) {
    const result = await pool.query(
      `SELECT * FROM holidays
       WHERE date >= $1 AND date <= $2
       AND country_code = ANY($3)
       ORDER BY date ASC`,
      [startDate, endDate, countryCodes]
    );
    return result.rows;
  }

  // Get holidays for a specific country and year
  static async getHolidaysByCountryAndYear(countryCode, year) {
    const result = await pool.query(
      `SELECT * FROM holidays
       WHERE country_code = $1
       AND EXTRACT(YEAR FROM date) = $2
       ORDER BY date ASC`,
      [countryCode, year]
    );
    return result.rows;
  }

  // User holiday preferences
  static async getUserHolidayPreferences(userId) {
    const result = await pool.query(
      `SELECT * FROM user_holiday_preferences
       WHERE user_id = $1 AND is_enabled = true`,
      [userId]
    );
    return result.rows;
  }

  static async setUserHolidayPreference(
    userId,
    countryCode,
    region = null,
    isEnabled = true
  ) {
    const result = await pool.query(
      `INSERT INTO user_holiday_preferences (user_id, country_code, region, is_enabled)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, country_code, region)
     DO UPDATE SET is_enabled = $4
     RETURNING *`,
      [userId, countryCode, region, isEnabled]
    );
    return result.rows[0];
  }
  // Get holidays for user based on preferences
  static async getHolidaysForUser(userId, startDate, endDate) {
    const result = await pool.query(
      `SELECT h.* FROM holidays h
       JOIN user_holiday_preferences uhp ON h.country_code = uhp.country_code
       WHERE uhp.user_id = $1 AND uhp.is_enabled = true
       AND h.date >= $2 AND h.date <= $3
       AND (uhp.region IS NULL OR h.region IS NULL OR h.region = uhp.region)
       ORDER BY h.date ASC`,
      [userId, startDate, endDate]
    );
    return result.rows;
  }
}

// --- Safely add unique constraint only if table exists ---
const initHolidayConstraints = async () => {
  try {
    // Check if the holidays table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'holidays'
      );
    `);

    const tableExists = tableCheck.rows[0].exists;

    if (!tableExists) {
      console.warn(
        '⚠️  Skipping constraint: "holidays" table does not exist yet.'
      );
      return;
    }

    // Add constraint if missing
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'holidays_date_country_name_key'
        ) THEN
          ALTER TABLE holidays
          ADD CONSTRAINT holidays_date_country_name_key
          UNIQUE (date, country_code, name);
        END IF;
      END $$;
    `);

    console.log("✅ Holiday constraints verified.");
  } catch (error) {
    console.error("Error adding holiday constraints:", error);
  }
};

initHolidayConstraints();

module.exports = HolidayModel;
