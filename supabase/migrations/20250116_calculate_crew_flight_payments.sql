-- Create a function to calculate and sync flight payments for a crew member and period
CREATE OR REPLACE FUNCTION public.calculate_flight_payments(
  p_crew_member_id UUID,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE (
  id UUID,
  crew_member_id UUID,
  month INTEGER,
  year INTEGER,
  total_hours NUMERIC,
  calculated_amount NUMERIC,
  final_amount NUMERIC,
  status TEXT
) AS $$
DECLARE
  v_total_hours NUMERIC := 0;
  v_calculated_amount NUMERIC := 0;
  v_payment_id UUID;
BEGIN
  -- Get all flight hours for the crew member in the specified month/year
  -- Sum across all aircraft
  SELECT COALESCE(SUM(cfh.total_hours), 0)
  INTO v_total_hours
  FROM public.crew_flight_hours cfh
  WHERE cfh.crew_member_id = p_crew_member_id
    AND cfh.month = p_month
    AND cfh.year = p_year;

  -- Calculate total amount based on hourly rates for each aircraft
  SELECT COALESCE(SUM(cfh.total_hours * ahr.hourly_rate), 0)
  INTO v_calculated_amount
  FROM public.crew_flight_hours cfh
  LEFT JOIN public.aircraft_hourly_rates ahr ON (
    cfh.aircraft_id = ahr.aircraft_id
    AND ahr.effective_date <= CONCAT(p_year, '-', LPAD(p_month::text, 2, '0'), '-01')::DATE
  )
  WHERE cfh.crew_member_id = p_crew_member_id
    AND cfh.month = p_month
    AND cfh.year = p_year
  GROUP BY cfh.crew_member_id;

  -- If no hourly rates found, try to get from aircraft table directly
  IF v_calculated_amount = 0 AND v_total_hours > 0 THEN
    SELECT COALESCE(SUM(cfh.total_hours * COALESCE(a.hourly_price, 0)), 0)
    INTO v_calculated_amount
    FROM public.crew_flight_hours cfh
    LEFT JOIN public.aircraft a ON cfh.aircraft_id = a.id
    WHERE cfh.crew_member_id = p_crew_member_id
      AND cfh.month = p_month
      AND cfh.year = p_year;
  END IF;

  -- Upsert into flight_payments
  INSERT INTO public.flight_payments (
    crew_member_id,
    month,
    year,
    total_hours,
    calculated_amount,
    final_amount,
    status,
    created_at,
    updated_at
  )
  VALUES (
    p_crew_member_id,
    p_month,
    p_year,
    v_total_hours,
    v_calculated_amount,
    v_calculated_amount,
    'calculated',
    NOW(),
    NOW()
  )
  ON CONFLICT (crew_member_id, month, year)
  DO UPDATE SET
    total_hours = EXCLUDED.total_hours,
    calculated_amount = EXCLUDED.calculated_amount,
    final_amount = EXCLUDED.final_amount,
    status = EXCLUDED.status,
    updated_at = NOW()
  RETURNING
    flight_payments.id,
    flight_payments.crew_member_id,
    flight_payments.month,
    flight_payments.year,
    flight_payments.total_hours,
    flight_payments.calculated_amount,
    flight_payments.final_amount,
    flight_payments.status
  INTO id, crew_member_id, month, year, total_hours, calculated_amount, final_amount, status;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_flight_payments(UUID, INTEGER, INTEGER) TO authenticated;
