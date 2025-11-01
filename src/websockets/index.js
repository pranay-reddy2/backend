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
  broadcastEventChange(calendarId, eventData, action) {
    const message = JSON.stringify({
      type: 'event_change',
      action, // 'created', 'updated', 'deleted'
      calendarId,
      event: eventData
    });

    // In a production app, you would query calendar_shares to find all users with access
    // For now, broadcast to all connected users (simplified)
    this.broadcast(message);
  }

  // Broadcast calendar changes
  broadcastCalendarChange(calendarId, calendarData, action) {
    const message = JSON.stringify({
      type: 'calendar_change',
      action, // 'created', 'updated', 'deleted', 'shared'
      calendar: calendarData
    });

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
