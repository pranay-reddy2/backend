const pool = require('../config/database');

// Share calendar with user
const shareCalendar = async (req, res) => {
  const { calendarId } = req.params;
  const { email, permission } = req.body;
  const userId = req.user.userId;

  if (!['view', 'edit', 'manage'].includes(permission)) {
    return res.status(400).json({ error: 'Invalid permission level' });
  }

  try {
    // Check if user owns the calendar or has manage permission
    const calendarCheck = await pool.query(
      `SELECT c.*, cs.permission
       FROM calendars c
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.shared_with_user_id = $1
       WHERE c.id = $2`,
      [userId, calendarId]
    );

    if (calendarCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    const calendar = calendarCheck.rows[0];
    const isOwner = calendar.owner_id === userId;
    const hasManagePermission = isOwner || calendar.permission === 'manage';

    if (!hasManagePermission) {
      return res.status(403).json({ error: 'No permission to share this calendar' });
    }

    // Find user to share with
    const userResult = await pool.query(
      'SELECT id, name, email FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    const shareWithUser = userResult.rows[0];

    if (shareWithUser.id === calendar.owner_id) {
      return res.status(400).json({ error: 'Cannot share calendar with owner' });
    }

    // Check if already shared
    const existingShare = await pool.query(
      'SELECT * FROM calendar_shares WHERE calendar_id = $1 AND shared_with_user_id = $2',
      [calendarId, shareWithUser.id]
    );

    if (existingShare.rows.length > 0) {
      // Update existing share permission
      const result = await pool.query(
        `UPDATE calendar_shares
         SET permission = $1
         WHERE calendar_id = $2 AND shared_with_user_id = $3
         RETURNING *`,
        [permission, calendarId, shareWithUser.id]
      );
      return res.json(result.rows[0]);
    }

    // Create new share
    const result = await pool.query(
      `INSERT INTO calendar_shares (calendar_id, shared_with_user_id, permission)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [calendarId, shareWithUser.id, permission]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error sharing calendar:', error);
    res.status(500).json({ error: 'Failed to share calendar' });
  }
};

// Get calendar shares
const getCalendarShares = async (req, res) => {
  const { calendarId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user has access to this calendar
    const calendarCheck = await pool.query(
      `SELECT c.*, cs.permission
       FROM calendars c
       LEFT JOIN calendar_shares cs ON c.id = cs.calendar_id AND cs.shared_with_user_id = $1
       WHERE c.id = $2`,
      [userId, calendarId]
    );

    if (calendarCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Calendar not found' });
    }

    const calendar = calendarCheck.rows[0];
    const isOwner = calendar.owner_id === userId;

    if (!isOwner && calendar.permission !== 'manage') {
      return res.status(403).json({ error: 'No permission to view shares' });
    }

    const result = await pool.query(
      `SELECT cs.*, u.name, u.email
       FROM calendar_shares cs
       JOIN users u ON cs.shared_with_user_id = u.id
       WHERE cs.calendar_id = $1
       ORDER BY cs.created_at DESC`,
      [calendarId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching calendar shares:', error);
    res.status(500).json({ error: 'Failed to fetch shares' });
  }
};

// Update share permission
const updateSharePermission = async (req, res) => {
  const { calendarId, shareId } = req.params;
  const { permission } = req.body;
  const userId = req.user.userId;

  if (!['view', 'edit', 'manage'].includes(permission)) {
    return res.status(400).json({ error: 'Invalid permission level' });
  }

  try {
    // Check if user owns the calendar
    const calendarCheck = await pool.query(
      'SELECT * FROM calendars WHERE id = $1 AND owner_id = $2',
      [calendarId, userId]
    );

    if (calendarCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Only calendar owner can update permissions' });
    }

    const result = await pool.query(
      `UPDATE calendar_shares
       SET permission = $1
       WHERE id = $2 AND calendar_id = $3
       RETURNING *`,
      [permission, shareId, calendarId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating share permission:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
};

// Remove calendar share
const removeCalendarShare = async (req, res) => {
  const { calendarId, shareId } = req.params;
  const userId = req.user.userId;

  try {
    // Check if user owns the calendar or is the shared user
    const calendarCheck = await pool.query(
      'SELECT * FROM calendars WHERE id = $1 AND owner_id = $2',
      [calendarId, userId]
    );

    const shareCheck = await pool.query(
      'SELECT * FROM calendar_shares WHERE id = $1 AND shared_with_user_id = $2',
      [shareId, userId]
    );

    const isOwner = calendarCheck.rows.length > 0;
    const isSharedUser = shareCheck.rows.length > 0;

    if (!isOwner && !isSharedUser) {
      return res.status(403).json({ error: 'No permission to remove this share' });
    }

    const result = await pool.query(
      'DELETE FROM calendar_shares WHERE id = $1 AND calendar_id = $2 RETURNING *',
      [shareId, calendarId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Share not found' });
    }

    res.json({ message: 'Share removed successfully' });
  } catch (error) {
    console.error('Error removing share:', error);
    res.status(500).json({ error: 'Failed to remove share' });
  }
};

// Get shared calendars (calendars shared with current user)
const getSharedCalendars = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT c.*, cs.permission, u.name as owner_name, u.email as owner_email
       FROM calendar_shares cs
       JOIN calendars c ON cs.calendar_id = c.id
       JOIN users u ON c.owner_id = u.id
       WHERE cs.shared_with_user_id = $1
       ORDER BY c.name`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching shared calendars:', error);
    res.status(500).json({ error: 'Failed to fetch shared calendars' });
  }
};

module.exports = {
  shareCalendar,
  getCalendarShares,
  updateSharePermission,
  removeCalendarShare,
  getSharedCalendars
};
