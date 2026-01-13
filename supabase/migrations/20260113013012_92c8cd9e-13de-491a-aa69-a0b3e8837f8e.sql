-- Add columns to rateio_despesas for category, payment date, and receipt
ALTER TABLE public.rateio_despesas 
ADD COLUMN IF NOT EXISTS categoria_id uuid REFERENCES public.expense_config(id),
ADD COLUMN IF NOT EXISTS data_pagamento date,
ADD COLUMN IF NOT EXISTS comprovante_url text;

-- Add more expense categories to expense_config
INSERT INTO public.expense_config (expense_type) VALUES 
  ('manutencao'),
  ('seguro'),
  ('hangaragem'),
  ('limpeza'),
  ('outros')
ON CONFLICT DO NOTHING;