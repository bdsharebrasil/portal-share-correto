-- Fix fn_reordenar_sequential function
-- Issue: Missing PARTITION BY aircraft_id, logbook_month_id causing wrong sequential numbers
-- Also adding explicit INTEGER cast for type safety

CREATE OR REPLACE FUNCTION public.fn_reordenar_sequential()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_aircraft_id UUID;
  v_logbook_month_id UUID;
BEGIN
  -- Determine which aircraft/month to reorder
  IF TG_OP = 'DELETE' THEN
    v_aircraft_id := OLD.aircraft_id;
    v_logbook_month_id := OLD.logbook_month_id;
  ELSE
    v_aircraft_id := NEW.aircraft_id;
    v_logbook_month_id := NEW.logbook_month_id;
  END IF;

  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY aircraft_id, logbook_month_id
             ORDER BY entry_date ASC, created_at ASC
           ) AS new_seq
    FROM logbook_entries
    WHERE aircraft_id = v_aircraft_id
      AND logbook_month_id = v_logbook_month_id
  )
  UPDATE logbook_entries le
  SET sequential_number = ranked.new_seq::integer
  FROM ranked
  WHERE le.id = ranked.id
    AND le.sequential_number IS DISTINCT FROM ranked.new_seq;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$
