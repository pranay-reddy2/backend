const express = require("express");
const router = express.Router();
const holidayController = require("../controllers/holidayController");
const { authenticate } = require("../middlewares/auth");

// All holiday routes require authentication
router.use(authenticate);

// Get holidays for date range
router.get("/", holidayController.getHolidays.bind(holidayController));

// Get user's holiday preferences
router.get(
  "/preferences",
  holidayController.getHolidayPreferences.bind(holidayController)
);

// Update user's holiday preference
router.post(
  "/preferences",
  holidayController.updateHolidayPreference.bind(holidayController)
);

// Get supported countries
router.get(
  "/countries",
  holidayController.getSupportedCountries.bind(holidayController)
);

// Manually sync holidays (for admin or manual refresh)
router.post("/sync", holidayController.syncHolidays.bind(holidayController));

module.exports = router;
