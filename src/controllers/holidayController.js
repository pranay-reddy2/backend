const holidayService = require("../services/holidayService");
const HolidayModel = require("../models/holidayModel");

class HolidayController {
  // Get holidays for the authenticated user
  async getHolidays(req, res) {
    try {
      const userId = req.user.userId;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: "startDate and endDate query parameters are required",
        });
      }

      const holidays = await holidayService.getHolidaysForUser(
        userId,
        startDate,
        endDate
      );

      console.log("Fetched holidays:", holidays);

      res.json({
        success: true,
        holidays: holidays.map((h) => ({
          id: h.id,
          name: h.name,
          description: h.description,
          date: h.date,
          countryCode: h.country_code,
          region: h.region,
          type: h.type,
          isNational: h.is_national,
        })),
      });
    } catch (error) {
      console.error("Error getting holidays:", error);
      res.status(500).json({
        error: "Failed to fetch holidays",
        message: error.message,
      });
    }
  }

  // Get user's holiday preferences
  async getHolidayPreferences(req, res) {
    try {
      const userId = req.user.userId;
      const preferences = await HolidayModel.getUserHolidayPreferences(userId);

      res.json({
        success: true,
        preferences: preferences.map((p) => ({
          id: p.id,
          countryCode: p.country_code,
          region: p.region,
          isEnabled: p.is_enabled,
        })),
      });
    } catch (error) {
      console.error("Error getting holiday preferences:", error);
      res.status(500).json({
        error: "Failed to fetch holiday preferences",
        message: error.message,
      });
    }
  }

  // Update user's holiday preferences
  async updateHolidayPreference(req, res) {
    try {
      const userId = req.user.userId;
      const { countryCode, region, isEnabled } = req.body;

      if (!countryCode) {
        return res.status(400).json({
          error: "countryCode is required",
        });
      }

      const preference = await HolidayModel.setUserHolidayPreference(
        userId,
        countryCode,
        region || null,
        isEnabled !== false
      );

      res.json({
        success: true,
        preference: {
          id: preference.id,
          countryCode: preference.country_code,
          region: preference.region,
          isEnabled: preference.is_enabled,
        },
      });
    } catch (error) {
      console.error("Error updating holiday preference:", error);
      res.status(500).json({
        error: "Failed to update holiday preference",
        message: error.message,
      });
    }
  }

  // Get list of supported countries
  async getSupportedCountries(req, res) {
    try {
      const countries = holidayService.getSupportedCountries();

      res.json({
        success: true,
        countries,
      });
    } catch (error) {
      console.error("Error getting supported countries:", error);
      res.status(500).json({
        error: "Failed to fetch supported countries",
        message: error.message,
      });
    }
  }

  // Manually sync holidays for a specific country and year (admin/manual sync)
  async syncHolidays(req, res) {
    try {
      const { countryCode, year } = req.body;

      if (!countryCode || !year) {
        return res.status(400).json({
          error: "countryCode and year are required",
        });
      }

      const holidays = await holidayService.syncHolidaysForCountry(
        countryCode,
        year
      );

      res.json({
        success: true,
        message: `Synced ${holidays.length} holidays for ${countryCode} ${year}`,
        count: holidays.length,
      });
    } catch (error) {
      console.error("Error syncing holidays:", error);
      res.status(500).json({
        error: "Failed to sync holidays",
        message: error.message,
      });
    }
  }
}

module.exports = new HolidayController();
