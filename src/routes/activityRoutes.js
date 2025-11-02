const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const activityController = require('../controllers/activityController');

// Get user's activity feed (all calendars they have access to)
router.get('/feed', authenticate, activityController.getUserActivityFeed);

// Get activity feed for specific calendar
router.get('/calendar/:calendarId', authenticate, activityController.getCalendarActivityFeed);

// Get activity for specific event
router.get('/event/:eventId', authenticate, activityController.getEventActivity);

// Get detailed change history for event
router.get('/event/:eventId/history', authenticate, activityController.getEventHistory);

// Get recent activities (for notifications)
router.get('/recent', authenticate, activityController.getRecentActivities);

module.exports = router;
