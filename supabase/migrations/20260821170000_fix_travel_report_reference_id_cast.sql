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
  WHERE id = NEW.reference_id::uuid;

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
