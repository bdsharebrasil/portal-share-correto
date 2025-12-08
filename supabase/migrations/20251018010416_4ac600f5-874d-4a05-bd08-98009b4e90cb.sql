-- Fix admin user deletion capability
-- Allow admin users to delete users via auth admin methods
CREATE POLICY "Admins can manage all user roles" ON public.user_roles
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Create travel_reports table with proper structure
CREATE TABLE IF NOT EXISTS public.travel_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_number TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id),
  client_name TEXT NOT NULL,
  aircraft_id UUID REFERENCES public.aircraft(id),
  aircraft_registration TEXT NOT NULL,
  crew_member_name TEXT NOT NULL,
  crew_member_name_2 TEXT,
  destination TEXT NOT NULL,
  route TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  observations TEXT,
  total_fuel NUMERIC DEFAULT 0,
  total_lodging NUMERIC DEFAULT 0,
  total_food NUMERIC DEFAULT 0,
  total_transport NUMERIC DEFAULT 0,
  total_other NUMERIC DEFAULT 0,
  total_crew NUMERIC DEFAULT 0,
  total_client NUMERIC DEFAULT 0,
  total_sharebrasil NUMERIC DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  pdf_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create travel_expenses table
CREATE TABLE IF NOT EXISTS public.travel_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_report_id UUID REFERENCES public.travel_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  paid_by TEXT NOT NULL,
  receipt_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create report_sequences table for client-specific numbering
CREATE TABLE IF NOT EXISTS public.report_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) UNIQUE,
  last_number INTEGER NOT NULL DEFAULT 0,
  year INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(client_id, year)
);

-- Enable RLS
ALTER TABLE public.travel_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_sequences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for travel_reports
CREATE POLICY "Authenticated users can view travel reports" ON public.travel_reports
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create travel reports" ON public.travel_reports
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update travel reports" ON public.travel_reports
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete travel reports" ON public.travel_reports
FOR DELETE TO authenticated USING (true);

-- RLS Policies for travel_expenses
CREATE POLICY "Authenticated users can view travel expenses" ON public.travel_expenses
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create travel expenses" ON public.travel_expenses
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update travel expenses" ON public.travel_expenses
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete travel expenses" ON public.travel_expenses
FOR DELETE TO authenticated USING (true);

-- RLS Policies for report_sequences
CREATE POLICY "Authenticated users can view report sequences" ON public.report_sequences
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can manage report sequences" ON public.report_sequences
FOR ALL TO authenticated USING (true);

-- Create storage bucket for travel reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('travel-reports', 'travel-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for travel-reports bucket
CREATE POLICY "Authenticated users can upload travel reports" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (bucket_id = 'travel-reports');

CREATE POLICY "Authenticated users can view travel reports" ON storage.objects
FOR SELECT TO authenticated USING (bucket_id = 'travel-reports');

CREATE POLICY "Authenticated users can update travel reports" ON storage.objects
FOR UPDATE TO authenticated USING (bucket_id = 'travel-reports');

CREATE POLICY "Authenticated users can delete travel reports" ON storage.objects
FOR DELETE TO authenticated USING (bucket_id = 'travel-reports');

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_travel_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_travel_reports_updated_at
BEFORE UPDATE ON public.travel_reports
FOR EACH ROW EXECUTE FUNCTION update_travel_report_updated_at();

CREATE TRIGGER update_travel_expenses_updated_at
BEFORE UPDATE ON public.travel_expenses
FOR EACH ROW EXECUTE FUNCTION update_travel_report_updated_at();