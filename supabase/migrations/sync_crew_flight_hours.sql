-- Sincronizar horas de crew_flight_hours a partir de logbook_entries
-- Este script atualiza todos os registros de crew_flight_hours com base nas entradas do diário de bordo

-- Limpar dados antigos de crew_flight_hours para recalcular (opcional - descomente se necessário)
-- TRUNCATE TABLE public.crew_flight_hours;

-- Inserir/Atualizar crew_flight_hours para PIC (Piloto em Comando)
INSERT INTO public.crew_flight_hours (
  crew_member_id,
  aircraft_id,
  month,
  year,
  total_hours,
  ifr_hours,
  not_hours,
  flight_day,
  created_at,
  updated_at
)
SELECT
  le.pic_canac as crew_member_id,
  le.aircraft_id,
  EXTRACT(MONTH FROM le.entry_date)::integer as month,
  EXTRACT(YEAR FROM le.entry_date)::integer as year,
  COALESCE(SUM(le.total_time), 0) as total_hours,
  COALESCE(SUM(le.ifr_time), 0) as ifr_hours,
  COALESCE(SUM(le.night_hours), 0) as not_hours,
  MAX(le.entry_date) as flight_day,
  NOW() as created_at,
  NOW() as updated_at
FROM
  public.logbook_entries le
WHERE
  le.pic_canac IS NOT NULL
  AND le.confirmed = true
GROUP BY
  le.pic_canac,
  le.aircraft_id,
  EXTRACT(MONTH FROM le.entry_date),
  EXTRACT(YEAR FROM le.entry_date)
ON CONFLICT (crew_member_id, aircraft_id, month, year) 
DO UPDATE SET
  total_hours = COALESCE(EXCLUDED.total_hours, 0),
  ifr_hours = COALESCE(EXCLUDED.ifr_hours, 0),
  not_hours = COALESCE(EXCLUDED.not_hours, 0),
  flight_day = COALESCE(EXCLUDED.flight_day, CURRENT_DATE),
  updated_at = NOW();

-- Inserir/Atualizar crew_flight_hours para SIC (Copiloto)
INSERT INTO public.crew_flight_hours (
  crew_member_id,
  aircraft_id,
  month,
  year,
  total_hours,
  ifr_hours,
  not_hours,
  flight_day,
  created_at,
  updated_at
)
SELECT
  le.sic_canac as crew_member_id,
  le.aircraft_id,
  EXTRACT(MONTH FROM le.entry_date)::integer as month,
  EXTRACT(YEAR FROM le.entry_date)::integer as year,
  COALESCE(SUM(le.total_time), 0) as total_hours,
  COALESCE(SUM(le.ifr_time), 0) as ifr_hours,
  COALESCE(SUM(le.night_hours), 0) as not_hours,
  MAX(le.entry_date) as flight_day,
  NOW() as created_at,
  NOW() as updated_at
FROM
  public.logbook_entries le
WHERE
  le.sic_canac IS NOT NULL
  AND le.confirmed = true
GROUP BY
  le.sic_canac,
  le.aircraft_id,
  EXTRACT(MONTH FROM le.entry_date),
  EXTRACT(YEAR FROM le.entry_date)
ON CONFLICT (crew_member_id, aircraft_id, month, year) 
DO UPDATE SET
  total_hours = COALESCE(EXCLUDED.total_hours, 0),
  ifr_hours = COALESCE(EXCLUDED.ifr_hours, 0),
  not_hours = COALESCE(EXCLUDED.not_hours, 0),
  flight_day = COALESCE(EXCLUDED.flight_day, CURRENT_DATE),
  updated_at = NOW();
