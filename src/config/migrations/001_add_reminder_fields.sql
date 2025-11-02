-- Add is_sent and sent_at fields to reminders table
-- This migration adds tracking fields for reminder notifications

-- Check if columns don't exist before adding them
DO $$
BEGIN
    -- Add is_sent column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reminders' AND column_name = 'is_sent'
    ) THEN
        ALTER TABLE reminders ADD COLUMN is_sent BOOLEAN DEFAULT false;
    END IF;

    -- Add sent_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'reminders' AND column_name = 'sent_at'
    ) THEN
        ALTER TABLE reminders ADD COLUMN sent_at TIMESTAMP;
    END IF;
END $$;

-- Create index for querying unsent reminders efficiently
CREATE INDEX IF NOT EXISTS idx_reminders_is_sent ON reminders(is_sent);
CREATE INDEX IF NOT EXISTS idx_reminders_event_user ON reminders(event_id, user_id);
