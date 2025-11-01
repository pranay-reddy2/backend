const express = require('express');
const EventController = require('../controllers/eventController');
const authMiddleware = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/', EventController.createEvent);
router.get('/', EventController.getEvents);
router.get('/search', EventController.searchEvents);
router.get('/:id', EventController.getEvent);
router.put('/:id', EventController.updateEvent);
router.delete('/:id', EventController.deleteEvent);
router.patch('/:id/attendee-status', EventController.updateAttendeeStatus);

module.exports = router;
