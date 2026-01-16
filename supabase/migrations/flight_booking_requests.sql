-- Create flight_booking_requests table for client booking requests
CREATE TABLE IF NOT EXISTS public.flight_booking_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  aircraft_id UUID NOT NULL REFERENCES public.aircraft(id) ON DELETE CASCADE,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  scheduled_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  duration_days INTEGER NOT NULL DEFAULT 1,
  passenger_count INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'confirmado', 'rejeitado', 'cancelado')),
  notes TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_client_id ON public.flight_booking_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_aircraft_id ON public.flight_booking_requests(aircraft_id);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_status ON public.flight_booking_requests(status);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_scheduled_date ON public.flight_booking_requests(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_flight_booking_requests_created_at ON public.flight_booking_requests(created_at);

-- Enable RLS
ALTER TABLE public.flight_booking_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Clients can view own requests" ON public.flight_booking_requests;
DROP POLICY IF EXISTS "Clients can create own requests" ON public.flight_booking_requests;
DROP POLICY IF EXISTS "Staff can view all requests" ON public.flight_booking_requests;
DROP POLICY IF EXISTS "Staff can update requests" ON public.flight_booking_requests;

-- RLS Policies
CREATE POLICY "Clients can view own requests"
  ON public.flight_booking_requests
  FOR SELECT
  USING (client_id = auth.uid() OR auth.uid() IN (
    SELECT user_id FROM public.users WHERE role IN ('admin', 'gestor_master', 'operacional')
  ));

CREATE POLICY "Clients can create own requests"
  ON public.flight_booking_requests
  FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Staff can view all requests"
  ON public.flight_booking_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() IN (
    SELECT user_id FROM public.users WHERE role IN ('admin', 'gestor_master', 'operacional')
  ));

CREATE POLICY "Staff can update requests"
  ON public.flight_booking_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IN (
    SELECT user_id FROM public.users WHERE role IN ('admin', 'gestor_master', 'operacional')
  ))
  WITH CHECK (auth.uid() IN (
    SELECT user_id FROM public.users WHERE role IN ('admin', 'gestor_master', 'operacional')
  ));

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_flight_booking_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_flight_booking_requests_updated_at ON public.flight_booking_requests;
CREATE TRIGGER trigger_update_flight_booking_requests_updated_at
  BEFORE UPDATE ON public.flight_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_flight_booking_requests_updated_at();

-- Grant permissions
GRANT SELECT, INSERT ON public.flight_booking_requests TO authenticated;
GRANT SELECT, UPDATE ON public.flight_booking_requests TO authenticated;
GRANT ALL PRIVILEGES ON public.flight_booking_requests TO service_role;
