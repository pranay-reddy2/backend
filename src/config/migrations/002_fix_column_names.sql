-- Comprehensive migration to fix column name mismatches
-- This migration updates tables to match the backend code expectations

DO $$
BEGIN
    -- Fix calendar_shares table: rename user_id to shared_with_user_id
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'calendar_shares' AND column_name = 'user_id'
    ) THEN
        -- Drop the old unique constraint
        ALTER TABLE calendar_shares DROP CONSTRAINT IF EXISTS calendar_shares_calendar_id_user_id_key;

        -- Rename the column
        ALTER TABLE calendar_shares RENAME COLUMN user_id TO shared_with_user_id;

        -- Add new unique constraint
        ALTER TABLE calendar_shares ADD CONSTRAINT calendar_shares_calendar_id_shared_with_user_id_key
            UNIQUE (calendar_id, shared_with_user_id);

        -- Drop old index if exists
        DROP INDEX IF EXISTS idx_calendar_shares_user_id;

        -- Create new indexes
        CREATE INDEX IF NOT EXISTS idx_calendar_shares_user_id ON calendar_shares(shared_with_user_id);
        CREATE INDEX IF NOT EXISTS idx_calendar_shares_calendar_id ON calendar_shares(calendar_id);
    END IF;

    -- Fix event_attendees table: rename status to rsvp_status
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'event_attendees' AND column_name = 'status'
    ) THEN
        ALTER TABLE event_attendees RENAME COLUMN status TO rsvp_status;
    END IF;

    -- Add responded_at column to event_attendees if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'event_attendees' AND column_name = 'responded_at'
    ) THEN
        ALTER TABLE event_attendees ADD COLUMN responded_at TIMESTAMP;
    END IF;

    -- Add event_attendees indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_event_attendees_event_id ON event_attendees(event_id);

    RAISE NOTICE 'Migration completed successfully!';

EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Migration error: %', SQLERRM;
        RAISE;
END $$;
