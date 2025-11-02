const express = require('express');
const { authenticate } = require('../middlewares/auth');
const {
  shareCalendar,
  getCalendarShares,
  updateSharePermission,
  removeCalendarShare,
  getSharedCalendars
} = require('../controllers/sharingController');

const router = express.Router();

// Get calendars shared with current user
router.get('/shared-calendars', authenticate, getSharedCalendars);

// Calendar sharing management
router.post('/calendars/:calendarId/share', authenticate, shareCalendar);
router.get('/calendars/:calendarId/shares', authenticate, getCalendarShares);
router.put('/calendars/:calendarId/shares/:shareId', authenticate, updateSharePermission);
router.delete('/calendars/:calendarId/shares/:shareId', authenticate, removeCalendarShare);

module.exports = router;
