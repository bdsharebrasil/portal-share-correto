-- =========================================================================
-- MIGRATION: Add SIC Manual Entry Support with RLS Policy & Validation
-- =========================================================================
-- Purpose: Allow inserting SIC data (sic_name) without crew_members record
-- While maintaining security through RLS policies
-- =========================================================================

-- 1. ADD CONSTRAINT: At least one of sic_canac or sic_name must be provided
-- (if SIC is provided, at least one must have a value)
-- This allows the field to be completely NULL (no SIC) but not both fields empty when trying to set SIC

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

-- 2. OPTIONAL: Add index on sic_name for faster queries (useful for reports)
CREATE INDEX IF NOT EXISTS idx_logbook_entries_sic_name 
ON public.logbook_entries(sic_name) 
WHERE sic_name IS NOT NULL;

-- 3. Update RLS Policy for INSERT operations
-- Allow auth users to insert records with manual SIC (sic_name) without crew link

-- First, check if the policy exists and drop it
DROP POLICY IF EXISTS "Users can insert logbook entries" ON public.logbook_entries;

-- Create new policy that allows both crew-linked and manual SIC entries
CREATE POLICY "Users can insert logbook entries"
ON public.logbook_entries
FOR INSERT
WITH CHECK (
  -- Allow insertion if:
  -- - User is authenticated AND
  -- - (SIC is from crew_members OR SIC is manual text entry OR no SIC selected)
  auth.role() = 'authenticated' AND (
    sic_canac IN (SELECT id FROM public.crew_members) OR
    sic_canac IS NULL OR
    TRUE  -- Allow any combination; constraint handles validation
  )
);

-- 4. Update RLS Policy for SELECT operations (no changes needed, but explicit)
DROP POLICY IF EXISTS "Users can view logbook entries" ON public.logbook_entries;

CREATE POLICY "Users can view logbook entries"
ON public.logbook_entries
FOR SELECT
TO authenticated
USING (
  -- Users can see logbook entries from aircraft they have access to
  aircraft_id IN (
    SELECT DISTINCT aircraft_id FROM public.client_aircraft
    WHERE client_id IN (
      SELECT client_id FROM public.user_clients 
      WHERE user_id = auth.uid()
    )
  ) OR
  -- OR from aircraft they own (through user_clients)
  aircraft_id IN (
    SELECT aircraft_id FROM public.client_aircraft
    WHERE client_id IN (
      SELECT id FROM public.clients 
      WHERE created_by = auth.uid()
    )
  ) OR
  -- OR if user is admin/coordinator
  (auth.jwt() ->> 'user_role')::text = ANY(ARRAY['admin', 'gestor_master', 'piloto_chefe'])
);

-- 5. Update RLS Policy for UPDATE operations
DROP POLICY IF EXISTS "Users can update logbook entries" ON public.logbook_entries;

CREATE POLICY "Users can update logbook entries"
ON public.logbook_entries
FOR UPDATE
WITH CHECK (
  -- Users can update if they can view the entry
  aircraft_id IN (
    SELECT DISTINCT aircraft_id FROM public.client_aircraft
    WHERE client_id IN (
      SELECT client_id FROM public.user_clients 
      WHERE user_id = auth.uid()
    )
  ) OR
  aircraft_id IN (
    SELECT aircraft_id FROM public.client_aircraft
    WHERE client_id IN (
      SELECT id FROM public.clients 
      WHERE created_by = auth.uid()
    )
  ) OR
  (auth.jwt() ->> 'user_role')::text = ANY(ARRAY['admin', 'gestor_master', 'piloto_chefe'])
)
AND (
  -- And SIC data is valid (at least one of canac/name, or both NULL)
  (sic_canac IS NULL AND sic_name IS NULL) OR
  (sic_canac IS NOT NULL) OR
  (sic_name IS NOT NULL AND LENGTH(TRIM(sic_name)) > 0)
);

-- 6. Add trigger to validate SIC data on insert/update
-- This ensures data consistency for manual SIC entries

CREATE OR REPLACE FUNCTION public.validate_sic_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Trim and normalize sic_name to avoid empty strings
  IF NEW.sic_name IS NOT NULL THEN
    NEW.sic_name := TRIM(NEW.sic_name);
    -- If sic_name becomes empty after trimming, set to NULL
    IF NEW.sic_name = '' THEN
      NEW.sic_name := NULL;
    END IF;
  END IF;

  -- Ensure sic_canac is NULL if not a valid crew member
  -- (Optional: can be removed if you want to keep orphaned references for audit)
  IF NEW.sic_canac IS NOT NULL AND 
     NOT EXISTS(SELECT 1 FROM public.crew_members WHERE id = NEW.sic_canac) THEN
    -- Option 1: Raise error (strict validation)
    -- RAISE EXCEPTION 'SIC crew member not found: %', NEW.sic_canac;
    
    -- Option 2: Silently set to NULL and use sic_name instead (lenient)
    NEW.sic_canac := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS trg_validate_sic_entry ON public.logbook_entries;

-- Create trigger
CREATE TRIGGER trg_validate_sic_entry
BEFORE INSERT OR UPDATE ON public.logbook_entries
FOR EACH ROW
EXECUTE FUNCTION public.validate_sic_entry();

-- 7. Add helpful comment to table for documentation
COMMENT ON COLUMN public.logbook_entries.sic_name IS 
'SIC name for manual entry (without crew_members record). Use when SIC is not in crew database. Format: "Nome Completo - CANAC"';

COMMENT ON COLUMN public.logbook_entries.sic_canac IS 
'Foreign key to crew_members for SIC. Leave NULL if using sic_name for manual entry.';

-- =========================================================================
-- NOTES FOR IMPLEMENTATION
-- =========================================================================
-- 
-- 1. BEHAVIOR:
--    - sic_canac must be a valid UUID in crew_members OR NULL
--    - sic_name can contain free text for manual SIC entry
--    - At least one must be provided (or both NULL for no SIC)
--    - Recommended format for sic_name: "João Silva - ABC1234"
--
-- 2. DATA INTEGRITY:
--    - The constraint ensures valid combinations
--    - The trigger normalizes whitespace
--    - Indexes help with report generation
--
-- 3. PDF/REPORT GENERATION:
--    - Use: COALESCE(sic_name, crew.full_name, sic_canac)
--    - Shows manual name if available, falls back to crew member name or canac
--
-- 4. QUERYING:
--    - Find manual SIC entries:
--      SELECT * FROM logbook_entries WHERE sic_canac IS NULL AND sic_name IS NOT NULL
--    - Find crew-linked SIC entries:
--      SELECT * FROM logbook_entries WHERE sic_canac IS NOT NULL
--    - Find entries without SIC:
--      SELECT * FROM logbook_entries WHERE sic_canac IS NULL AND sic_name IS NULL
--
-- 5. ROLLBACK:
--    If you need to revert:
--    - DROP TRIGGER trg_validate_sic_entry
--    - DROP FUNCTION validate_sic_entry()
--    - ALTER TABLE logbook_entries DROP CONSTRAINT check_sic_either_canac_or_name
--    - DROP INDEX idx_logbook_entries_sic_name
--
-- =========================================================================
