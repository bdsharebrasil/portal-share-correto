-- Create travel_report_attachments table for storing images/files from travel report expenses
CREATE TABLE IF NOT EXISTS public.travel_report_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  travel_report_id UUID REFERENCES public.travel_expense_reports(id) ON DELETE CASCADE,
  expense_index INTEGER NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.travel_report_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for travel_report_attachments
CREATE POLICY "Authenticated users can view travel report attachments" ON public.travel_report_attachments
FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create travel report attachments" ON public.travel_report_attachments
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete travel report attachments" ON public.travel_report_attachments
FOR DELETE TO authenticated USING (true);

-- Create index for faster queries
CREATE INDEX idx_travel_report_attachments_report_id ON public.travel_report_attachments(travel_report_id);
CREATE INDEX idx_travel_report_attachments_expense_index ON public.travel_report_attachments(travel_report_id, expense_index);
