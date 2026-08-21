ALTER TABLE public.employee_payslips
  ADD COLUMN IF NOT EXISTS salario_bruto numeric,
  ADD COLUMN IF NOT EXISTS salario_liquido numeric,
  ADD COLUMN IF NOT EXISTS desconto_inss numeric,
  ADD COLUMN IF NOT EXISTS desconto_irrf numeric,
  ADD COLUMN IF NOT EXISTS outros_descontos numeric,
  ADD COLUMN IF NOT EXISTS valor_ferias numeric,
  ADD COLUMN IF NOT EXISTS total_descontos numeric,
  ADD COLUMN IF NOT EXISTS ocr_raw_text text,
  ADD COLUMN IF NOT EXISTS ocr_confidence numeric,
  ADD COLUMN IF NOT EXISTS ocr_status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS ocr_processed_at timestamptz;

ALTER TABLE public.employee_payslips
  DROP CONSTRAINT IF EXISTS employee_payslips_ocr_status_check;

ALTER TABLE public.employee_payslips
  ADD CONSTRAINT employee_payslips_ocr_status_check
  CHECK (ocr_status IN ('pendente', 'processando', 'concluido', 'erro'));
