-- Add alert_days column to flight_documents table
ALTER TABLE public.flight_documents 
ADD COLUMN IF NOT EXISTS alert_days integer DEFAULT 30;