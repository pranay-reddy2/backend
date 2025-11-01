-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendars table
CREATE TABLE IF NOT EXISTS calendars (
  id SERIAL PRIMARY KEY,
  owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#1a73e8',
  is_primary BOOLEAN DEFAULT false,
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  calendar_id INTEGER REFERENCES calendars(id) ON DELETE CASCADE,
  creator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  location VARCHAR(500),
  start_time TIMESTAMP NOT NULL,
  end_time TIMESTAMP NOT NULL,
  is_all_day BOOLEAN DEFAULT false,
  timezone VARCHAR(100) DEFAULT 'UTC',

  -- Recurrence
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT, -- RRULE format
  recurrence_id INTEGER REFERENCES events(id) ON DELETE CASCADE, -- parent event for recurring series
  original_start_time TIMESTAMP, -- for modified instances

  -- Status
  status VARCHAR(50) DEFAULT 'confirmed', -- confirmed, tentative, cancelled

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Calendar sharing/permissions
CREATE TABLE IF NOT EXISTS calendar_shares (
  id SERIAL PRIMARY KEY,
  calendar_id INTEGER REFERENCES calendars(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL, -- view, edit, manage
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(calendar_id, user_id)
);

-- Event participants/attendees
CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255), -- for external attendees
  status VARCHAR(50) DEFAULT 'pending', -- pending, accepted, declined, maybe
  is_organizer BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- Reminders
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL, -- 5, 10, 30, 60, etc.
  method VARCHAR(50) DEFAULT 'popup', -- popup, email, notification
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity/Audit log
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  calendar_id INTEGER REFERENCES calendars(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL, -- created, updated, deleted, shared, etc.
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
CREATE INDEX IF NOT EXISTS idx_events_recurrence_id ON events(recurrence_id);
CREATE INDEX IF NOT EXISTS idx_calendar_shares_user_id ON calendar_shares(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);

-- Full-text search index for events
CREATE INDEX IF NOT EXISTS idx_events_search ON events USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, '')));
