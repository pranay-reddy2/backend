const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const {
  getWorkingHours,
  updateWorkingHours,
  getAvailabilityPreferences,
  updateAvailabilityPreferences,
  checkAvailability,
  getUserTimezone,
  updateUserTimezone
} = require('../controllers/availabilityController');
const userPreferencesController = require('../controllers/userPreferencesController');

// Working hours routes
router.get('/working-hours', authenticate, getWorkingHours);
router.get('/working-hours/:userId', authenticate, getWorkingHours);
router.put('/working-hours', authenticate, updateWorkingHours);

// Availability preferences routes
router.get('/availability-preferences', authenticate, getAvailabilityPreferences);
router.put('/availability-preferences', authenticate, updateAvailabilityPreferences);

// User preferences routes
router.get('/preferences', authenticate, userPreferencesController.getPreferences);
router.put('/preferences', authenticate, userPreferencesController.updatePreferences);
router.delete('/preferences', authenticate, userPreferencesController.deletePreferences);

// Availability check
router.get('/check-availability/:userId', authenticate, checkAvailability);

// Timezone routes
router.get('/timezone', authenticate, getUserTimezone);
router.get('/timezone/:userId', authenticate, getUserTimezone);
router.put('/timezone', authenticate, updateUserTimezone);

module.exports = router;
