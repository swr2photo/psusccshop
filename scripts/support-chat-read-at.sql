-- Add read_at column to support_messages table
ALTER TABLE support_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- Create index for read_at
CREATE INDEX IF NOT EXISTS idx_support_messages_read_at ON support_messages(read_at);
