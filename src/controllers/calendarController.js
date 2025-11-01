const CalendarModel = require('../models/calendarModel');

class CalendarController {
  static async createCalendar(req, res) {
    try {
      const { name, description, color, timezone } = req.body;

      const calendar = await CalendarModel.create({
        ownerId: req.userId,
        name,
        description,
        color,
        timezone
      });

      res.status(201).json(calendar);
    } catch (error) {
      console.error('Calendar creation error:', error);
      res.status(500).json({ error: 'Failed to create calendar' });
    }
  }

  static async getCalendars(req, res) {
    try {
      const calendars = await CalendarModel.findAccessibleByUser(req.userId);
      res.json(calendars);
    } catch (error) {
      console.error('Fetch calendars error:', error);
      res.status(500).json({ error: 'Failed to fetch calendars' });
    }
  }

  static async getCalendar(req, res) {
    try {
      const { id } = req.params;

      const hasPermission = await CalendarModel.hasPermission(id, req.userId, 'view');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const calendar = await CalendarModel.findById(id);
      if (!calendar) {
        return res.status(404).json({ error: 'Calendar not found' });
      }

      res.json(calendar);
    } catch (error) {
      console.error('Fetch calendar error:', error);
      res.status(500).json({ error: 'Failed to fetch calendar' });
    }
  }

  static async updateCalendar(req, res) {
    try {
      const { id } = req.params;
      const { name, description, color, timezone } = req.body;

      const hasPermission = await CalendarModel.hasPermission(id, req.userId, 'edit');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const calendar = await CalendarModel.update(id, { name, description, color, timezone });
      res.json(calendar);
    } catch (error) {
      console.error('Update calendar error:', error);
      res.status(500).json({ error: 'Failed to update calendar' });
    }
  }

  static async deleteCalendar(req, res) {
    try {
      const { id } = req.params;

      const hasPermission = await CalendarModel.hasPermission(id, req.userId, 'manage');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await CalendarModel.delete(id);
      res.json({ message: 'Calendar deleted successfully' });
    } catch (error) {
      console.error('Delete calendar error:', error);
      res.status(500).json({ error: 'Failed to delete calendar' });
    }
  }

  static async shareCalendar(req, res) {
    try {
      const { id } = req.params;
      const { userEmail, permission } = req.body;

      const hasPermission = await CalendarModel.hasPermission(id, req.userId, 'manage');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Find user by email
      const UserModel = require('../models/userModel');
      const user = await UserModel.findByEmail(userEmail);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const share = await CalendarModel.shareCalendar(id, user.id, permission);
      res.json(share);
    } catch (error) {
      console.error('Share calendar error:', error);
      res.status(500).json({ error: 'Failed to share calendar' });
    }
  }

  static async getShares(req, res) {
    try {
      const { id } = req.params;

      const hasPermission = await CalendarModel.hasPermission(id, req.userId, 'manage');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const shares = await CalendarModel.getShares(id);
      res.json(shares);
    } catch (error) {
      console.error('Fetch shares error:', error);
      res.status(500).json({ error: 'Failed to fetch shares' });
    }
  }

  static async removeShare(req, res) {
    try {
      const { id, userId } = req.params;

      const hasPermission = await CalendarModel.hasPermission(id, req.userId, 'manage');
      if (!hasPermission) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await CalendarModel.removeShare(id, userId);
      res.json({ message: 'Share removed successfully' });
    } catch (error) {
      console.error('Remove share error:', error);
      res.status(500).json({ error: 'Failed to remove share' });
    }
  }
}

module.exports = CalendarController;
