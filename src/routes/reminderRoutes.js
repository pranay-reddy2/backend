const express = require("express");
const { authenticate } = require("../middlewares/auth");
const { getPendingReminders } = require("../controllers/reminderController");

const router = express.Router();

router.get("/pending-reminders", authenticate, getPendingReminders);

module.exports = router;
