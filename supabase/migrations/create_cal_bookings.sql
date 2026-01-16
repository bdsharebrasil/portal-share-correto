-- Create cal_bookings table for storing Cal.com bookings
CREATE TABLE IF NOT EXISTS public.cal_bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cal_id TEXT UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  client_name TEXT NOT NULL,
  client_email TEXT,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  event_type TEXT,
  status TEXT DEFAULT 'confirmado' CHECK (status IN ('confirmado', 'cancelado', 'pendente')),
  notes TEXT,
  raw_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_cal_bookings_status ON public.cal_bookings(status);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_start_time ON public.cal_bookings(start_time);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_created_at ON public.cal_bookings(created_at);
CREATE INDEX IF NOT EXISTS idx_cal_bookings_cal_id ON public.cal_bookings(cal_id);

-- Enable RLS (Row Level Security)
ALTER TABLE public.cal_bookings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to read cal_bookings" ON public.cal_bookings;
DROP POLICY IF EXISTS "Allow service role to insert cal_bookings" ON public.cal_bookings;
DROP POLICY IF EXISTS "Allow service role to update cal_bookings" ON public.cal_bookings;

-- Create policies to allow authenticated users to read bookings
CREATE POLICY "Allow authenticated users to read cal_bookings"
  ON public.cal_bookings
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policy for inserting (webhook only - backend)
CREATE POLICY "Allow service role to insert cal_bookings"
  ON public.cal_bookings
  FOR INSERT
  WITH CHECK (true);

-- Create policy for updating (webhook only - backend)
CREATE POLICY "Allow service role to update cal_bookings"
  ON public.cal_bookings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_cal_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at field
DROP TRIGGER IF EXISTS trigger_update_cal_bookings_updated_at ON public.cal_bookings;
CREATE TRIGGER trigger_update_cal_bookings_updated_at
  BEFORE UPDATE ON public.cal_bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_cal_bookings_updated_at();

-- Grant permissions
GRANT SELECT ON public.cal_bookings TO authenticated;
GRANT ALL PRIVILEGES ON public.cal_bookings TO service_role;
