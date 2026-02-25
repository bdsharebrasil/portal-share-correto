-- Create travel_report_attachments table
CREATE TABLE IF NOT EXISTS public.travel_report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_report_id UUID REFERENCES public.travel_expense_reports(id) ON DELETE CASCADE,
  expense_index INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.travel_report_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for travel_report_attachments
CREATE POLICY "Authenticated users can view travel report attachments" ON public.travel_report_attachments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create travel report attachments" ON public.travel_report_attachments
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update travel report attachments" ON public.travel_report_attachments
FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete travel report attachments" ON public.travel_report_attachments
FOR DELETE TO authenticated USING (true);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_travel_report_attachments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_travel_report_attachments_updated_at
BEFORE UPDATE ON public.travel_report_attachments
FOR EACH ROW EXECUTE FUNCTION update_travel_report_attachments_updated_at();
