-- Adicionar colunas para rastrear o cliente que pega emprestado e seu partner
ALTER TABLE public.logbook_entries 
ADD COLUMN IF NOT EXISTS borrower_client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS borrower_partner_name text NULL;

-- Adicionar índice para melhor performance em consultas
CREATE INDEX IF NOT EXISTS idx_logbook_entries_borrower_client ON public.logbook_entries(borrower_client_id) WHERE is_loan = true;
