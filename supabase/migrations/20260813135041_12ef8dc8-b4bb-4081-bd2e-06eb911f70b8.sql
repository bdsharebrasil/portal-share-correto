ALTER TABLE public.travel_expense_reports
  ADD COLUMN IF NOT EXISTS crew2_approval_status text,
  ADD COLUMN IF NOT EXISTS crew2_approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS crew2_approval_notes text;