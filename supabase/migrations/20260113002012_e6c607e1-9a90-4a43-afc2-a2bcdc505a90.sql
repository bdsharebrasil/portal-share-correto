-- Add columns for receipt tracking on contas_areceber
ALTER TABLE public.contas_areceber 
ADD COLUMN IF NOT EXISTS data_recebimento date,
ADD COLUMN IF NOT EXISTS banco_recebimento text,
ADD COLUMN IF NOT EXISTS comprovante_recebimento_url text;