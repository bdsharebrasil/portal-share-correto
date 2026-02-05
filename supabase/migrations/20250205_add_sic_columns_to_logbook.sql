-- =============================================================================
-- Migration: Add SIC (Second in Command) columns for manual crew entries
-- =============================================================================
-- Purpose: Allow storing SIC data as either crew member reference (sic_canac)
--          or as free text manual entry (sic_name), without forcing a foreign key
-- =============================================================================

-- Add sic_canac column (references crew_members but allows NULL)
ALTER TABLE public.logbook_entries
ADD COLUMN IF NOT EXISTS sic_canac UUID REFERENCES public.crew_members(id) ON DELETE SET NULL;

-- Add sic_name column (free text for manual SIC entries)
ALTER TABLE public.logbook_entries
ADD COLUMN IF NOT EXISTS sic_name TEXT;

-- Create index for querying manual SIC entries
CREATE INDEX IF NOT EXISTS idx_logbook_entries_sic_name 
ON public.logbook_entries(sic_name) 
WHERE sic_name IS NOT NULL;

-- Add constraint: at least one of sic_canac or sic_name must be provided (or both NULL for no SIC)
ALTER TABLE public.logbook_entries
DROP CONSTRAINT IF EXISTS check_sic_either_canac_or_name;

ALTER TABLE public.logbook_entries
ADD CONSTRAINT check_sic_either_canac_or_name 
CHECK (
  -- Allow completely NULL (no SIC selected)
  (sic_canac IS NULL AND sic_name IS NULL) OR
  -- Or have at least one of them filled
  (sic_canac IS NOT NULL) OR
  (sic_name IS NOT NULL AND LENGTH(TRIM(sic_name)) > 0)
);

-- Add trigger to normalize sic_name (trim whitespace)
CREATE OR REPLACE FUNCTION public.validate_sic_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim and normalize sic_name
  IF NEW.sic_name IS NOT NULL THEN
    NEW.sic_name := TRIM(NEW.sic_name);
    -- Convert empty string to NULL
    IF NEW.sic_name = '' THEN
      NEW.sic_name := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger if exists
DROP TRIGGER IF EXISTS trg_validate_sic_entry ON public.logbook_entries;

-- Create trigger for validation
CREATE TRIGGER trg_validate_sic_entry
BEFORE INSERT OR UPDATE ON public.logbook_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_sic_entry();

-- Add comments for documentation
COMMENT ON COLUMN public.logbook_entries.sic_canac IS 
'SIC crew member ID (references crew_members table). Use for SIC that have a crew record. NULL if using sic_name for manual entry.';

COMMENT ON COLUMN public.logbook_entries.sic_name IS 
'SIC name for manual entry (without crew_members record). Use when SIC is not in the crew database. Format recommended: "Nome Completo - CANAC"';

-- =============================================================================
-- NOTES:
-- =============================================================================
-- 
-- 1. INSERTION RULES:
--    - For crew SIC: sic_canac = crew.id, sic_name = NULL
--    - For manual SIC: sic_canac = NULL, sic_name = "Nome - CANAC"
--    - No SIC: both NULL
--
-- 2. QUERYING:
--    - Manual SIC entries: SELECT * FROM logbook_entries WHERE sic_canac IS NULL AND sic_name IS NOT NULL
--    - Crew-linked SIC: SELECT * FROM logbook_entries WHERE sic_canac IS NOT NULL
--    - Display SIC name: COALESCE(sic_name, crew.full_name, '-')
--
-- =============================================================================
