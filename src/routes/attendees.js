// attendees.js (routes)
const express = require("express");
const { authenticate } = require("../middlewares/auth"); // Ensure correct path
const {
  addAttendee,
  getEventAttendees,
  updateRsvpStatus,
  removeAttendee,
  getMyInvitations,
} = require("../controllers/attendeeController"); // Ensure correct path

const router = express.Router();

// Get user's event invitations
router.get("/my-invitations", authenticate, getMyInvitations);

// Event attendee management
router.post("/events/:eventId/attendees", authenticate, addAttendee);
router.get("/events/:eventId/attendees", authenticate, getEventAttendees);
router.put("/events/:eventId/rsvp", authenticate, updateRsvpStatus);
router.delete(
  "/events/:eventId/attendees/:attendeeId",
  authenticate,
  removeAttendee
);

module.exports = router;
