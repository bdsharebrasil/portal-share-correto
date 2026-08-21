ALTER TABLE public.employee_vacation_config
  ALTER COLUMN total_vacation_days TYPE numeric(5,1)
  USING total_vacation_days::numeric;

ALTER TABLE public.vacation_balances
  DROP COLUMN days_available;

ALTER TABLE public.vacation_balances
  ALTER COLUMN days_earned TYPE numeric(5,1)
  USING days_earned::numeric,
  ALTER COLUMN days_used TYPE numeric(5,1)
  USING days_used::numeric;

ALTER TABLE public.vacation_balances
  ADD COLUMN days_available numeric(5,1)
  GENERATED ALWAYS AS (days_earned - days_used) STORED;
