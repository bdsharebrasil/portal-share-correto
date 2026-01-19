-- Migration: Add loan fields to logbook_entries table
-- Date: 2026-01-19
-- Description: Add support for aircraft loan flights with borrower tracking and hour bank debits

ALTER TABLE logbook_entries
ADD COLUMN IF NOT EXISTS is_loan BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS loan_borrower_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- Add comments for clarity
COMMENT ON COLUMN logbook_entries.is_loan IS 'Indicates if this flight is a loan (empréstimo) to another client';
COMMENT ON COLUMN logbook_entries.loan_borrower_client_id IS 'The client ID of the borrower (who is using the aircraft on loan)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_logbook_entries_is_loan ON logbook_entries(is_loan);
CREATE INDEX IF NOT EXISTS idx_logbook_entries_loan_borrower ON logbook_entries(loan_borrower_client_id);
