-- Enable RLS on tables (standard practice)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (since we are in 'simple' mode without auth)
-- Policy for 'orders'
CREATE POLICY "Enable all access for orders" ON orders
FOR ALL USING (true) WITH CHECK (true);

-- Policy for 'users'
CREATE POLICY "Enable all access for users" ON users
FOR ALL USING (true) WITH CHECK (true);

-- Policy for 'work_logs'
CREATE POLICY "Enable all access for work_logs" ON work_logs
FOR ALL USING (true) WITH CHECK (true);
