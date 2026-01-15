-- Add status column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS status text DEFAULT 'Erfasst';

-- Create work_logs table
CREATE TABLE IF NOT EXISTS work_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
    user_name text, -- Storing name directly for simplicity as we don't have a rigid users table/ID system yet
    start_time timestamptz DEFAULT now(),
    end_time timestamptz,
    quantity_produced integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_work_logs_order_id ON work_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_work_logs_user_name ON work_logs(user_name);
