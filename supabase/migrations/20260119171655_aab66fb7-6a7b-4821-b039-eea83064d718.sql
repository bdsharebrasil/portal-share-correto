-- Adicionar coluna is_loan para identificar voos de empréstimo
ALTER TABLE public.logbook_entries 
ADD COLUMN IF NOT EXISTS is_loan BOOLEAN DEFAULT FALSE;

-- Criar índice para melhor performance em consultas de empréstimos
CREATE INDEX IF NOT EXISTS idx_logbook_entries_is_loan ON public.logbook_entries(is_loan) WHERE is_loan = true;