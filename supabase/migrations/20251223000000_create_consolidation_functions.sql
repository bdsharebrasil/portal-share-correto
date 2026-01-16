-- ============================================================================
-- FUNÇÃO: consolidar_rateio_historico
-- Descrição: Consolida um rateio para o histórico permanente quando pago
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consolidar_rateio_historico(
  p_lancamento_rateio_id UUID,
  p_bank_transaction_id UUID,
  p_bank_reconciliation_id UUID,
  p_horas_voadas NUMERIC,
  p_consolidado_por UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_historico_id UUID;
  v_lancamento_rateio RECORD;
  v_lancamento RECORD;
  v_cliente RECORD;
  v_aeronave RECORD;
  v_categoria RECORD;
  v_horas_totais NUMERIC;
  v_percentual_uso NUMERIC;
BEGIN
  -- Buscar dados do rateio
  SELECT lr.*, l.valor, l.descricao, l.aeronave_id, l.categoria_id, l.data_lancamento,
         c.id as cliente_id, c.company_name as cliente_nome,
         cm.grupo_categoria, cm.nome as categoria_nome
  INTO v_lancamento_rateio, v_lancamento, v_cliente, v_aeronave, v_categoria
  FROM public.lancamentos_rateio lr
  JOIN public.lancamentos l ON lr.lancamento_id = l.id
  JOIN public.clients c ON lr.cliente_id = c.id
  JOIN public.categorias_movimentacao cm ON l.categoria_id = cm.id
  WHERE lr.id = p_lancamento_rateio_id;

  IF v_lancamento_rateio IS NULL THEN
    RAISE EXCEPTION 'Lancamento rateio não encontrado';
  END IF;

  -- Buscar dados da aeronave
  SELECT a.id, a.registration
  INTO v_aeronave
  FROM public.aircraft a
  WHERE a.id = v_lancamento.aeronave_id;

  -- Calcular horas totais da aeronave no período
  SELECT COALESCE(SUM(hv.horas_voadas), 0)
  INTO v_horas_totais
  FROM public.horas_voo hv
  WHERE hv.aeronave_id = v_lancamento.aeronave_id
  AND EXTRACT(MONTH FROM hv.data_voo) = EXTRACT(MONTH FROM v_lancamento.data_lancamento)
  AND EXTRACT(YEAR FROM hv.data_voo) = EXTRACT(YEAR FROM v_lancamento.data_lancamento);

  -- Calcular percentual de uso
  IF v_horas_totais > 0 AND p_horas_voadas > 0 THEN
    v_percentual_uso := (p_horas_voadas / v_horas_totais) * 100;
  ELSE
    v_percentual_uso := 0;
  END IF;

  -- Inserir no histórico consolidado
  INSERT INTO public.historico_rateio_consolidado (
    bank_transaction_id,
    bank_reconciliation_id,
    lancamento_rateio_id,
    aeronave_id,
    aeronave_registro,
    cliente_id,
    cliente_nome,
    data_competencia,
    data_pagamento,
    data_conciliacao,
    horas_voadas,
    horas_totais_aeronave,
    percentual_uso,
    categoria_id,
    categoria_nome,
    categoria_grupo,
    descricao,
    valor_total_lancamento,
    valor_rateado,
    valor_pago,
    tipo_rateio,
    foi_reembolso,
    status,
    consolidado_por,
    consolidado_em
  ) VALUES (
    p_bank_transaction_id,
    p_bank_reconciliation_id,
    p_lancamento_rateio_id,
    v_lancamento.aeronave_id,
    v_aeronave.registration,
    v_lancamento_rateio.cliente_id,
    v_cliente.company_name,
    DATE_TRUNC('month', v_lancamento.data_lancamento)::DATE,
    CURRENT_DATE,
    now(),
    COALESCE(p_horas_voadas, 0),
    v_horas_totais,
    v_percentual_uso,
    v_lancamento.categoria_id,
    v_categoria.nome,
    v_categoria.grupo_categoria,
    v_lancamento.descricao,
    v_lancamento.valor,
    v_lancamento_rateio.valor_rateado,
    v_lancamento_rateio.valor_rateado,
    v_lancamento_rateio.tipo_rateio,
    FALSE,
    'consolidado',
    p_consolidado_por,
    now()
  ) RETURNING id INTO v_historico_id;

  -- Atualizar status do rateio para quitado
  UPDATE public.lancamentos_rateio
  SET status = 'quitado', updated_at = now()
  WHERE id = p_lancamento_rateio_id;

  -- Atualizar status da conciliação para consolidado
  UPDATE public.bank_reconciliations
  SET status = 'consolidado', historico_id = v_historico_id, updated_at = now()
  WHERE id = p_bank_reconciliation_id;

  RETURN v_historico_id;
END;
$$;

-- ============================================================================
-- FUNÇÃO: consolidar_horas_mensais
-- Descrição: Consolida horas mensais de um cliente/aeronave
-- ============================================================================
CREATE OR REPLACE FUNCTION public.consolidar_horas_mensais(
  p_cliente_id UUID,
  p_aeronave_id UUID,
  p_ano INTEGER,
  p_mes INTEGER,
  p_horas_voadas NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_horas_totais NUMERIC;
  v_cliente_nome TEXT;
  v_aeronave_registro TEXT;
  v_percentual_uso NUMERIC;
BEGIN
  -- Buscar dados do cliente e aeronave
  SELECT c.company_name INTO v_cliente_nome
  FROM public.clients c
  WHERE c.id = p_cliente_id;

  SELECT a.registration INTO v_aeronave_registro
  FROM public.aircraft a
  WHERE a.id = p_aeronave_id;

  -- Calcular horas totais da aeronave no período
  SELECT COALESCE(SUM(hv.horas_voadas), 0)
  INTO v_horas_totais
  FROM public.horas_voo hv
  WHERE hv.aeronave_id = p_aeronave_id
  AND EXTRACT(YEAR FROM hv.data_voo) = p_ano
  AND EXTRACT(MONTH FROM hv.data_voo) = p_mes;

  -- Calcular percentual
  IF v_horas_totais > 0 AND p_horas_voadas > 0 THEN
    v_percentual_uso := (p_horas_voadas / v_horas_totais) * 100;
  ELSE
    v_percentual_uso := 0;
  END IF;

  -- Inserir ou atualizar
  INSERT INTO public.horas_mensais_consolidadas (
    cliente_id,
    cliente_nome,
    aeronave_id,
    aeronave_registro,
    ano,
    mes,
    horas_voadas,
    horas_totais_aeronave,
    percentual_uso,
    consolidado_em,
    consolidado_por
  ) VALUES (
    p_cliente_id,
    v_cliente_nome,
    p_aeronave_id,
    v_aeronave_registro,
    p_ano,
    p_mes,
    p_horas_voadas,
    v_horas_totais,
    v_percentual_uso,
    now(),
    auth.uid()
  )
  ON CONFLICT (cliente_id, aeronave_id, ano, mes) DO UPDATE SET
    horas_voadas = p_horas_voadas,
    horas_totais_aeronave = v_horas_totais,
    percentual_uso = v_percentual_uso,
    updated_at = now()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
