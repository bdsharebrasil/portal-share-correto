-- Drop the old flight_payments table if it exists
DROP TABLE IF EXISTS public.flight_payments CASCADE;

-- Create the corrected flight_payments table with the structure expected by the app
CREATE TABLE public.flight_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_member_id UUID NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  total_hours NUMERIC(10,2) DEFAULT 0,
  calculated_amount NUMERIC(10,2) DEFAULT 0,
  final_amount NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'calculated',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (crew_member_id, month, year),
  FOREIGN KEY (crew_member_id) REFERENCES public.crew_members(id) ON DELETE CASCADE
);

-- Enable Row Level Security
ALTER TABLE public.flight_payments ENABLE ROW LEVEL SECURITY;

-- Create policies for flight_payments
CREATE POLICY "Authenticated users can view flight payments"
  ON public.flight_payments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can manage flight payments"
  ON public.flight_payments FOR ALL
  USING (auth.uid() IS NOT NULL);

-- Create indexes for better query performance
CREATE INDEX idx_flight_payments_crew_member ON public.flight_payments(crew_member_id);
CREATE INDEX idx_flight_payments_month_year ON public.flight_payments(year, month);
CREATE INDEX idx_flight_payments_crew_month_year ON public.flight_payments(crew_member_id, year, month);
