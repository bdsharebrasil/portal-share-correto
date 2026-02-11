-- Add bank_name field to partner_expenses table if it doesn't exist
ALTER TABLE public.partner_expenses 
ADD COLUMN IF NOT EXISTS bank_name TEXT DEFAULT NULL;

-- Create index for bank_name if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_partner_expenses_bank_name 
ON public.partner_expenses(bank_name);

-- Add comment to the column
COMMENT ON COLUMN public.partner_expenses.bank_name IS 'Nome da instituição bancária associada à despesa';
