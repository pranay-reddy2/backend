const express = require('express');
const CalendarController = require('../controllers/calendarController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/', CalendarController.createCalendar);
router.get('/', CalendarController.getCalendars);
router.get('/:id', CalendarController.getCalendar);
router.put('/:id', CalendarController.updateCalendar);
router.delete('/:id', CalendarController.deleteCalendar);

router.post('/:id/share', CalendarController.shareCalendar);
router.get('/:id/shares', CalendarController.getShares);
router.delete('/:id/shares/:userId', CalendarController.removeShare);

module.exports = router;
