const pool = require('../config/database');

// Add attendee to event
const addAttendee = async (req, res) => {
  const { eventId } = req.params;
  const { email, name } = req.body;
  const userId = req.user.userId;

  try {
    // Check if user has permission to edit this event
    const eventCheck = await pool.query(
      `SELECT e.*, c.owner_id, cs.permission
       FROM events e
       JOIN calendars c ON e.calendar_id = c.id
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.shared_with_user_id = $1
       WHERE e.id = $2`,
      [userId, eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    const isOwner = event.owner_id === userId;
    const hasEditPermission = isOwner || ['edit', 'manage'].includes(event.permission);

    if (!hasEditPermission) {
      return res.status(403).json({ error: 'No permission to edit event' });
    }

    // Find user by email
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    const attendeeUser = userResult.rows[0];

    // Check if already an attendee
    const existingAttendee = await pool.query(
      'SELECT * FROM event_attendees WHERE event_id = $1 AND user_id = $2',
      [eventId, attendeeUser.id]
    );

    if (existingAttendee.rows.length > 0) {
      return res.status(400).json({ error: 'User is already an attendee' });
    }

    // Add attendee
    const result = await pool.query(
      `INSERT INTO event_attendees (event_id, user_id, name, email, rsvp_status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [eventId, attendeeUser.id, attendeeUser.name, attendeeUser.email]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding attendee:', error);
    res.status(500).json({ error: 'Failed to add attendee' });
  }
};

// Get event attendees
const getEventAttendees = async (req, res) => {
  const { eventId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user has view permission
    const eventCheck = await pool.query(
      `SELECT e.*, c.owner_id, cs.permission
       FROM events e
       JOIN calendars c ON e.calendar_id = c.id
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.shared_with_user_id = $1
       WHERE e.id = $2`,
      [userId, eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const result = await pool.query(
      `SELECT ea.*, u.name as user_name, u.email as user_email
       FROM event_attendees ea
       LEFT JOIN users u ON ea.user_id = u.id
       WHERE ea.event_id = $1
       ORDER BY ea.created_at`,
      [eventId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching attendees:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
};

// Update RSVP status
const updateRsvpStatus = async (req, res) => {
  const { eventId } = req.params;
  const { status } = req.body;
  const userId = req.user.userId;

  if (!['accepted', 'declined', 'maybe', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid RSVP status' });
  }

  try {
    const result = await pool.query(
      `UPDATE event_attendees
       SET rsvp_status = $1, responded_at = CURRENT_TIMESTAMP
       WHERE event_id = $2 AND user_id = $3
       RETURNING *`,
      [status, eventId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee record not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating RSVP:', error);
    res.status(500).json({ error: 'Failed to update RSVP status' });
  }
};

// Remove attendee
const removeAttendee = async (req, res) => {
  const { eventId, attendeeId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user has permission to edit this event
    const eventCheck = await pool.query(
      `SELECT e.*, c.owner_id, cs.permission
       FROM events e
       JOIN calendars c ON e.calendar_id = c.id
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.shared_with_user_id = $1
       WHERE e.id = $2`,
      [userId, eventId]
    );

    if (eventCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventCheck.rows[0];
    const isOwner = event.owner_id === userId;
    const hasEditPermission = isOwner || ['edit', 'manage'].includes(event.permission);

    if (!hasEditPermission) {
      return res.status(403).json({ error: 'No permission to edit event' });
    }

    const result = await pool.query(
      'DELETE FROM event_attendees WHERE id = $1 AND event_id = $2 RETURNING *',
      [attendeeId, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    res.json({ message: 'Attendee removed successfully' });
  } catch (error) {
    console.error('Error removing attendee:', error);
    res.status(500).json({ error: 'Failed to remove attendee' });
  }
};

// Get user's events as attendee
const getMyInvitations = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT e.*, ea.rsvp_status, ea.responded_at,
              c.name as calendar_name, c.color as calendar_color,
              u.name as organizer_name, u.email as organizer_email
       FROM event_attendees ea
       JOIN events e ON ea.event_id = e.id
       JOIN calendars c ON e.calendar_id = c.id
       JOIN users u ON c.owner_id = u.id
       WHERE ea.user_id = $1
       ORDER BY e.start_time`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching invitations:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
};

module.exports = {
  addAttendee,
  getEventAttendees,
  updateRsvpStatus,
  removeAttendee,
  getMyInvitations
};
