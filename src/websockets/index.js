const WebSocket = require('ws');
const { verifyToken } = require('../utils/jwt');

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // Map userId to WebSocket connections

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
  }

  handleConnection(ws, req) {
    // Extract token from query or headers
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Token required');
      return;
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      ws.close(1008, 'Invalid token');
      return;
    }

    const userId = decoded.userId;

    // Store connection
    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }
    this.clients.get(userId).add(ws);

    console.log(`User ${userId} connected via WebSocket`);

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        this.handleMessage(userId, data);
      } catch (error) {
        console.error('Invalid WebSocket message:', error);
      }
    });

    ws.on('close', () => {
      const userConnections = this.clients.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          this.clients.delete(userId);
        }
      }
      console.log(`User ${userId} disconnected from WebSocket`);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    ws.send(JSON.stringify({ type: 'connected', userId }));
  }

  handleMessage(userId, data) {
    console.log(`Message from user ${userId}:`, data);
    // Handle different message types if needed
  }

  // Broadcast event changes to all users with access to a calendar
  async broadcastEventChange(calendarId, eventData, action, userId = null) {
    const message = {
      type: 'event_change',
      action, // 'created', 'updated', 'deleted', 'rescheduled'
      calendarId,
      event: eventData,
      timestamp: new Date().toISOString(),
      userId // User who made the change
    };

    // Get all users who have access to this calendar
    const pool = require('../config/database');
    const result = await pool.query(
      `SELECT DISTINCT user_id FROM (
        SELECT owner_id as user_id FROM calendars WHERE id = $1
        UNION
        SELECT shared_with_user_id as user_id FROM calendar_shares WHERE calendar_id = $1
      ) AS users`,
      [calendarId]
    );

    // Send to each user with access
    result.rows.forEach(row => {
      this.sendToUser(row.user_id, message);
    });
  }

  // Broadcast calendar changes
  async broadcastCalendarChange(calendarId, calendarData, action, userId = null) {
    const message = {
      type: 'calendar_change',
      action, // 'created', 'updated', 'deleted', 'shared'
      calendar: calendarData,
      timestamp: new Date().toISOString(),
      userId
    };

    // Get all users who have access
    const pool = require('../config/database');
    const result = await pool.query(
      `SELECT DISTINCT user_id FROM (
        SELECT owner_id as user_id FROM calendars WHERE id = $1
        UNION
        SELECT shared_with_user_id as user_id FROM calendar_shares WHERE calendar_id = $1
      ) AS users`,
      [calendarId]
    );

    result.rows.forEach(row => {
      this.sendToUser(row.user_id, message);
    });
  }

  // Broadcast activity/notification
  broadcastActivity(userIds, activity) {
    const message = {
      type: 'activity',
      activity,
      timestamp: new Date().toISOString()
    };

    userIds.forEach(userId => {
      this.sendToUser(userId, message);
    });
  }

  // Send typing indicator (for collaborative editing)
  broadcastTyping(calendarId, eventId, userId, isTyping) {
    const message = {
      type: 'typing',
      calendarId,
      eventId,
      userId,
      isTyping,
      timestamp: new Date().toISOString()
    };

    this.broadcast(message);
  }

  // Send message to specific user
  sendToUser(userId, message) {
    const userConnections = this.clients.get(userId);
    if (userConnections) {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      userConnections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  }

  // Broadcast to all connected users
  broadcast(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    this.clients.forEach((connections) => {
      connections.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(messageStr);
        }
      });
    });
  }
}
module.exports = WebSocketServer;
