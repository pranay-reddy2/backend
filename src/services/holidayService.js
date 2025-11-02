const axios = require("axios");
const HolidayModel = require("../models/holidayModel");

class HolidayService {
  constructor() {
    this.calendarificApiKey = process.env.CALENDARIFIC_API_KEY;
    this.useNagerDate = !this.calendarificApiKey;
  }

  // Fetch holidays from Nager.Date API (completely free, no API key required)
  async fetchHolidaysFromNagerDate(countryCode, year) {
    try {
      const response = await axios.get(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`,
        { timeout: 10000 }
      );

      return response.data.map((holiday) => ({
        name: holiday.name,
        description:
          holiday.localName !== holiday.name ? holiday.localName : null,
        date: holiday.date,
        countryCode: countryCode,
        region:
          holiday.counties && holiday.counties.length > 0
            ? holiday.counties.join(",")
            : null,
        type:
          holiday.types && holiday.types.length > 0
            ? holiday.types[0].toLowerCase()
            : "public",
        isNational: holiday.global !== false,
      }));
    } catch (error) {
      console.error(
        `Error fetching holidays from Nager.Date for ${countryCode}:`,
        error.message
      );
      throw error;
    }
  }

  // Fetch holidays from Calendarific API (requires API key)
  async fetchHolidaysFromCalendarific(countryCode, year) {
    try {
      const response = await axios.get(
        "https://calendarific.com/api/v2/holidays",
        {
          params: {
            api_key: this.calendarificApiKey,
            country: countryCode,
            year: year,
          },
          timeout: 10000,
        }
      );

      if (
        response.data &&
        response.data.response &&
        response.data.response.holidays
      ) {
        return response.data.response.holidays.map((holiday) => ({
          name: holiday.name,
          description: holiday.description,
          date: holiday.date.iso,
          countryCode: countryCode,
          region:
            holiday.states && holiday.states.length > 0
              ? holiday.states[0].name
              : null,
          type: holiday.primary_type || holiday.type || "public",
          isNational: !holiday.states || holiday.states.length === 0,
        }));
      }

      return [];
    } catch (error) {
      console.error(
        `Error fetching holidays from Calendarific for ${countryCode}:`,
        error.message
      );
      throw error;
    }
  }

  // Main method to fetch and cache holidays
  async syncHolidaysForCountry(countryCode, year) {
    try {
      let holidays;

      if (this.useNagerDate) {
        holidays = await this.fetchHolidaysFromNagerDate(countryCode, year);
      } else {
        holidays = await this.fetchHolidaysFromCalendarific(countryCode, year);
      }

      // Save to database
      if (holidays && holidays.length > 0) {
        await HolidayModel.upsertHolidays(holidays);
        console.log(
          `Synced ${holidays.length} holidays for ${countryCode} ${year}`
        );
      }

      return holidays;
    } catch (error) {
      console.error(
        `Error syncing holidays for ${countryCode} ${year}:`,
        error.message
      );
      // Return from database if API fails
      return await HolidayModel.getHolidaysByCountryAndYear(countryCode, year);
    }
  }

  // Get holidays for user (from DB or sync if needed)
  async getHolidaysForUser(userId, startDate, endDate) {
    try {
      // First, get user's holiday preferences
      const preferences = await HolidayModel.getUserHolidayPreferences(userId);

      // If no preferences, set default (US holidays)
      if (preferences.length === 0) {
        await HolidayModel.setUserHolidayPreference(userId, "US", null, true);
        preferences.push({ country_code: "US" });
      }

      // Check if we need to sync holidays for the requested year
      const startYear = new Date(startDate).getFullYear();
      const endYear = new Date(endDate).getFullYear();

      for (const pref of preferences) {
        for (let year = startYear; year <= endYear; year++) {
          // Check if we have holidays for this country/year
          const existing = await HolidayModel.getHolidaysByCountryAndYear(
            pref.country_code,
            year
          );

          // Sync if we have no data for this year
          if (existing.length === 0) {
            await this.syncHolidaysForCountry(pref.country_code, year);
          }
        }
      }

      // Return holidays from database
      return await HolidayModel.getHolidaysForUser(userId, startDate, endDate);
    } catch (error) {
      console.error("Error getting holidays for user:", error);
      return [];
    }
  }

  // List of supported countries (Nager.Date supports these)
  getSupportedCountries() {
    return [
      { code: "US", name: "United States" },
      { code: "GB", name: "United Kingdom" },
      { code: "IN", name: "India" },
      { code: "CA", name: "Canada" },
      { code: "AU", name: "Australia" },
      { code: "DE", name: "Germany" },
      { code: "FR", name: "France" },
      { code: "IT", name: "Italy" },
      { code: "ES", name: "Spain" },
      { code: "JP", name: "Japan" },
      { code: "CN", name: "China" },
      { code: "BR", name: "Brazil" },
      { code: "MX", name: "Mexico" },
      { code: "NL", name: "Netherlands" },
      { code: "SE", name: "Sweden" },
      { code: "NO", name: "Norway" },
      { code: "DK", name: "Denmark" },
      { code: "FI", name: "Finland" },
      { code: "PL", name: "Poland" },
      { code: "AT", name: "Austria" },
      { code: "BE", name: "Belgium" },
      { code: "CH", name: "Switzerland" },
      { code: "IE", name: "Ireland" },
      { code: "NZ", name: "New Zealand" },
      { code: "SG", name: "Singapore" },
      { code: "ZA", name: "South Africa" },
      { code: "AR", name: "Argentina" },
      { code: "CL", name: "Chile" },
      { code: "CO", name: "Colombia" },
      { code: "PT", name: "Portugal" },
    ];
  }
}

module.exports = new HolidayService();
