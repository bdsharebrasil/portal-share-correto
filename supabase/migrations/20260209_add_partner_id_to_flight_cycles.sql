-- Add partner_id column to flight_cycles table
ALTER TABLE public.flight_cycles 
ADD COLUMN partner_id UUID REFERENCES public.client_partners(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX idx_flight_cycles_partner ON public.flight_cycles(partner_id);
