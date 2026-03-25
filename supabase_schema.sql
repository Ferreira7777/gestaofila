-- Create the customers table for the queue management system
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    adults INTEGER DEFAULT 1,
    children INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'notified', 'seated', 'cancelled')),
    arrival_time TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime for the customers table (Postgres extension)
-- Note: Replications are usually handled via Supabase Dashboard settings:
-- ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Add basic security
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Allow all public access for this application (demo)
CREATE POLICY "Allow all access" ON public.customers FOR ALL USING (true);
