-- =============================================================================
-- Migration: Add SIC (Second in Command) columns to logbook_entries
-- =============================================================================
-- Purpose: Create columns for storing SIC data either as crew reference (sic_canac)
--          or as free text manual entry (sic_name)
-- Note: This must run BEFORE add_sic_validation_and_rls migration
-- =============================================================================

-- Add sic_canac column (UUID reference to crew_members, allows NULL)
ALTER TABLE public.logbook_entries
ADD COLUMN IF NOT EXISTS sic_canac UUID REFERENCES public.crew_members(id) ON DELETE SET NULL;

-- Add sic_name column (text for manual SIC entries)
ALTER TABLE public.logbook_entries
ADD COLUMN IF NOT EXISTS sic_name TEXT;

-- Create index for performance on manual SIC queries
CREATE INDEX IF NOT EXISTS idx_logbook_entries_sic_name 
ON public.logbook_entries(sic_name) 
WHERE sic_name IS NOT NULL;

-- =============================================================================
-- NOTES:
-- =============================================================================
-- 
-- 1. COLUMN USAGE:
--    - sic_canac: UUID reference to crew_members when SIC is a registered crew member
--    - sic_name: Text field for manual SIC entry (not registered in crew_members)
--
-- 2. DATA RULES (enforced by constraint in next migration):
--    - At least one must be provided (or both NULL for no SIC)
--    - sic_canac must be valid crew_members ID
--    - sic_name should use format: "Nome Completo - CANAC"
--
-- 3. FOREIGN KEY BEHAVIOR:
--    - ON DELETE SET NULL: If crew member is deleted, reference is cleared
--    - Allows manual entry even if no crew record exists
--
-- =============================================================================
