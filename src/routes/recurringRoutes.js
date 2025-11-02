const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth');
const recurringSeriesController = require('../controllers/recurringSeriesController');

// Update recurring event (this/thisAndFuture/all)
router.put('/events/:eventId', authenticate, recurringSeriesController.updateRecurringEvent);

// Delete recurring event (this/thisAndFuture/all)
router.delete('/events/:eventId', authenticate, recurringSeriesController.deleteRecurringEvent);

// Get series occurrences in date range
router.get('/series/:seriesId/occurrences', authenticate, recurringSeriesController.getSeriesOccurrences);

// Get series master event
router.get('/series/:seriesId/master', authenticate, recurringSeriesController.getSeriesMaster);

// Get series exceptions (modified instances)
router.get('/series/:seriesId/exceptions', authenticate, recurringSeriesController.getSeriesExceptions);

module.exports = router;
