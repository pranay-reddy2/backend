const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const {
  getUpcomingEvents,
  getTodayEvents,
  getPendingReminders,
  markReminderSent,
  searchEvents
} = require('../controllers/notificationController');

// Get upcoming events (next 7 days)
router.get('/upcoming-events', authenticate, getUpcomingEvents);

// Get today's events
router.get('/today-events', authenticate, getTodayEvents);

// Get pending reminders
router.get('/pending-reminders', authenticate, getPendingReminders);

// Mark reminder as sent
router.put('/reminders/:reminderId/sent', authenticate, markReminderSent);

// Advanced search with filters
router.get('/search-events', authenticate, searchEvents);

module.exports = router;
