-- Migration: Add color field to events table
-- Date: 2025-01-02
-- Description: Adds custom color field to events table to allow individual event colors

-- Add color column to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS color VARCHAR(7);

-- Add comment for documentation
COMMENT ON COLUMN events.color IS 'Custom event color (hex format). If NULL, uses calendar default color.';
