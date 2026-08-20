-- Impede que lançamentos financeiros vinculados a um relatório de viagem
-- ultrapassem o total destinado à Share Brasil naquele relatório.

CREATE OR REPLACE FUNCTION public.validate_travel_report_movement_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  report_limit numeric := 0;
  already_allocated numeric := 0;
  current_amount numeric := 0;
BEGIN
  IF COALESCE(NEW.reference_type, '') NOT IN ('relatorio_viagem', 'travel_report')
     OR NEW.reference_id IS NULL
     OR lower(COALESCE(NEW.status, '')) = 'cancelado' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(total_sharebrasil, total_valor, 0)
    INTO report_limit
  FROM public.travel_expense_reports
  WHERE id = NEW.reference_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Relatório de viagem % não encontrado.', NEW.reference_id
      USING ERRCODE = '23503';
  END IF;

  current_amount := COALESCE(NEW.valor_total, NEW.valor_rateado, 0);

  SELECT COALESCE(SUM(COALESCE(m.valor_total, m.valor_rateado, 0)), 0)
    INTO already_allocated
  FROM public.movimentacoes m
  WHERE m.reference_type IN ('relatorio_viagem', 'travel_report')
    AND m.reference_id = NEW.reference_id
    AND lower(COALESCE(m.status, '')) <> 'cancelado'
    AND (TG_OP = 'INSERT' OR m.id <> NEW.id);

  IF already_allocated + current_amount > report_limit + 0.009 THEN
    RAISE EXCEPTION 'Lançamento excede o saldo do relatório de viagem. Limite: %, já abatido: %, novo valor: %.',
      report_limit, already_allocated, current_amount
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_travel_report_movement_limit
  ON public.movimentacoes;

CREATE TRIGGER trg_validate_travel_report_movement_limit
  BEFORE INSERT OR UPDATE OF reference_type, reference_id, valor_total, valor_rateado, status
  ON public.movimentacoes
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_travel_report_movement_limit();

COMMENT ON FUNCTION public.validate_travel_report_movement_limit() IS
  'Bloqueia lançamentos de movimentacoes que ultrapassem o saldo do relatório de viagem vinculado.';

CREATE INDEX IF NOT EXISTS idx_movimentacoes_travel_report_reference
  ON public.movimentacoes (reference_type, reference_id)
  WHERE reference_type IN ('relatorio_viagem', 'travel_report');

GRANT EXECUTE ON FUNCTION public.validate_travel_report_movement_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_travel_report_movement_limit() TO service_role;

ALTER TABLE public.movimentacoes
  DROP CONSTRAINT IF EXISTS movimentacoes_travel_report_reference_type_check;

ALTER TABLE public.movimentacoes
  ADD CONSTRAINT movimentacoes_travel_report_reference_type_check
  CHECK (reference_type IS NULL OR reference_type NOT IN ('relatorio_viagem', 'travel_report') OR reference_id IS NOT NULL);
-- Rollback manual:
-- DROP TRIGGER IF EXISTS trg_validate_travel_report_movement_limit ON public.movimentacoes;
-- DROP FUNCTION IF EXISTS public.validate_travel_report_movement_limit();
-- DROP INDEX IF EXISTS idx_movimentacoes_travel_report_reference;
-- ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS movimentacoes_travel_report_reference_type_check;
