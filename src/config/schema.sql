-- ===============================
-- USERS TABLE
-- ===============================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- Nullable for OAuth users
  name VARCHAR(255) NOT NULL,
  google_id VARCHAR(255) UNIQUE, -- Google OAuth ID
  auth_provider VARCHAR(50) DEFAULT 'email', -- 'email' or 'google'
  profile_picture VARCHAR(500),
  timezone VARCHAR(100) DEFAULT 'UTC',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- CALENDARS TABLE
-- ===============================
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

-- ===============================
-- EVENTS TABLE
-- ===============================
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
  recurrence_rule TEXT,
  recurrence_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  original_start_time TIMESTAMP,
  is_exception BOOLEAN DEFAULT false,
  series_id VARCHAR(100),
  exception_dates TEXT,

  -- Status & Appearance
  status VARCHAR(50) DEFAULT 'confirmed',
  color VARCHAR(7),

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- CALENDAR SHARES
-- ===============================
CREATE TABLE IF NOT EXISTS calendar_shares (
  id SERIAL PRIMARY KEY,
  calendar_id INTEGER REFERENCES calendars(id) ON DELETE CASCADE,
  shared_with_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(50) NOT NULL, -- view, edit, manage
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(calendar_id, shared_with_user_id)
);

-- ===============================
-- EVENT ATTENDEES
-- ===============================
CREATE TABLE IF NOT EXISTS event_attendees (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255),
  rsvp_status VARCHAR(50) DEFAULT 'pending',
  is_organizer BOOLEAN DEFAULT false,
  responded_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, user_id)
);

-- ===============================
-- REMINDERS
-- ===============================
CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  minutes_before INTEGER NOT NULL,
  method VARCHAR(50) DEFAULT 'popup',
  is_sent BOOLEAN DEFAULT false,
  sent_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- ACTIVITY LOG
-- ===============================
CREATE TABLE IF NOT EXISTS activity_log (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  calendar_id INTEGER REFERENCES calendars(id) ON DELETE CASCADE,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  changes JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- EVENT HISTORY
-- ===============================
CREATE TABLE IF NOT EXISTS event_history (
  id SERIAL PRIMARY KEY,
  event_id INTEGER REFERENCES events(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL,
  field_name VARCHAR(100),
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- USER AVAILABILITY
-- ===============================
CREATE TABLE IF NOT EXISTS user_availability (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, day_of_week, start_time)
);

-- ===============================
-- USER PREFERENCES
-- ===============================
CREATE TABLE IF NOT EXISTS user_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  default_event_duration INTEGER DEFAULT 60,
  show_declined_events BOOLEAN DEFAULT false,
  week_start_day INTEGER DEFAULT 0 CHECK (week_start_day BETWEEN 0 AND 6),
  time_format VARCHAR(10) DEFAULT '12h',
  date_format VARCHAR(50) DEFAULT 'MM/DD/YYYY',
  show_week_numbers BOOLEAN DEFAULT false,
  auto_add_video_conferencing BOOLEAN DEFAULT false,
  default_reminder_minutes INTEGER DEFAULT 30,
  working_hours_start TIME DEFAULT '09:00:00',
  working_hours_end TIME DEFAULT '17:00:00',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================
-- HOLIDAYS
-- ===============================
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  region VARCHAR(100),
  type VARCHAR(50) DEFAULT 'public',
  is_national BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT holidays_date_country_name_key UNIQUE (date, country_code, name)
);

-- ===============================
-- USER HOLIDAY PREFERENCES
-- ===============================
CREATE TABLE IF NOT EXISTS user_holiday_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  country_code VARCHAR(2) NOT NULL,
  region VARCHAR(100),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, country_code, region)
);

-- ===============================
-- INDEXES FOR PERFORMANCE
-- ===============================
CREATE INDEX IF NOT EXISTS idx_events_calendar_id ON events(calendar_id);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_end_time ON events(end_time);
CREATE INDEX IF NOT EXISTS idx_events_recurrence_id ON events(recurrence_id);
CREATE INDEX IF NOT EXISTS idx_events_series_id ON events(series_id);
CREATE INDEX IF NOT EXISTS idx_events_is_recurring ON events(is_recurring);

CREATE INDEX IF NOT EXISTS idx_calendar_shares_user_id ON calendar_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_calendar_shares_calendar_id ON calendar_shares(calendar_id);

CREATE INDEX IF NOT EXISTS idx_event_attendees_user_id ON event_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);

CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_calendar_id ON activity_log(calendar_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_event_id ON activity_log(event_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_event_history_event_id ON event_history(event_id);
CREATE INDEX IF NOT EXISTS idx_event_history_created_at ON event_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_availability_user_id ON user_availability(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
CREATE INDEX IF NOT EXISTS idx_holidays_country_code ON holidays(country_code);
CREATE INDEX IF NOT EXISTS idx_user_holiday_preferences_user_id ON user_holiday_preferences(user_id);

-- Full-text search for events
CREATE INDEX IF NOT EXISTS idx_events_search
  ON events USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '') || ' ' || COALESCE(location, '')));
