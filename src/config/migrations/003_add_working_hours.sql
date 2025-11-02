-- Add working hours and availability features
-- This migration adds support for timezone management and working hours

-- Add working hours table
CREATE TABLE IF NOT EXISTS working_hours (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, day_of_week)
);

-- Add availability preferences table
CREATE TABLE IF NOT EXISTS availability_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  show_working_hours BOOLEAN DEFAULT true,
  auto_decline_outside_hours BOOLEAN DEFAULT false,
  buffer_time_minutes INTEGER DEFAULT 0, -- Buffer time between meetings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add out of office periods table
CREATE TABLE IF NOT EXISTS out_of_office (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  title VARCHAR(255) DEFAULT 'Out of office',
  message TEXT,
  auto_decline_events BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_working_hours_user_id ON working_hours(user_id);
CREATE INDEX IF NOT EXISTS idx_working_hours_day ON working_hours(day_of_week);
CREATE INDEX IF NOT EXISTS idx_out_of_office_user_id ON out_of_office(user_id);
CREATE INDEX IF NOT EXISTS idx_out_of_office_dates ON out_of_office(start_date, end_date);

-- Insert default working hours for existing users (Mon-Fri, 9 AM - 5 PM)
DO $$
DECLARE
    user_record RECORD;
    day INTEGER;
BEGIN
    FOR user_record IN SELECT id FROM users LOOP
        FOR day IN 1..5 LOOP -- Monday to Friday
            INSERT INTO working_hours (user_id, day_of_week, start_time, end_time, is_enabled)
            VALUES (user_record.id, day, '09:00:00', '17:00:00', true)
            ON CONFLICT (user_id, day_of_week) DO NOTHING;
        END LOOP;
    END LOOP;

    -- Insert default availability preferences
    INSERT INTO availability_preferences (user_id, show_working_hours)
    SELECT id, true FROM users
    ON CONFLICT (user_id) DO NOTHING;
END $$;
