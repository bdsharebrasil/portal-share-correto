-- ============================================================================
-- FUNÇÃO: consolidar_rateio_historico
-- Descrição: Consolida um rateio para o histórico permanente quando pagto
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
    v_categoria.categoria_nome,
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

-- ============================================================================
-- FUNÇÃO: obter_extrato_cliente
-- Descrição: Obtém o extrato consolidado de um cliente
-- ============================================================================
CREATE OR REPLACE FUNCTION public.obter_extrato_cliente(
  p_cliente_id UUID,
  p_data_inicio DATE,
  p_data_fim DATE
)
RETURNS TABLE(
  data_competencia DATE,
  data_pagamento DATE,
  aeronave_registro TEXT,
  categoria_nome TEXT,
  categoria_grupo TEXT,
  descricao TEXT,
  tipo_rateio TEXT,
  horas_voadas NUMERIC,
  percentual_uso NUMERIC,
  valor_total_lancamento NUMERIC,
  valor_rateado NUMERIC,
  valor_pago NUMERIC,
  foi_reembolso BOOLEAN,
  documento_fiscal TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    hrc.data_competencia,
    hrc.data_pagamento,
    hrc.aeronave_registro,
    hrc.categoria_nome,
    hrc.categoria_grupo,
    hrc.descricao,
    hrc.tipo_rateio,
    hrc.horas_voadas,
    hrc.percentual_uso,
    hrc.valor_total_lancamento,
    hrc.valor_rateado,
    hrc.valor_pago,
    hrc.foi_reembolso,
    hrc.documento_fiscal
  FROM public.historico_rateio_consolidado hrc
  WHERE hrc.cliente_id = p_cliente_id
  AND hrc.data_competencia BETWEEN p_data_inicio AND p_data_fim
  AND hrc.status = 'consolidado'
  ORDER BY hrc.data_competencia DESC, hrc.data_pagamento DESC;
$$;

-- ============================================================================
-- FUNÇÃO: obter_resumo_mensal_cliente
-- Descrição: Obtém resumo mensal de custos por categoria
-- ============================================================================
CREATE OR REPLACE FUNCTION public.obter_resumo_mensal_cliente(
  p_cliente_id UUID,
  p_ano INTEGER,
  p_mes INTEGER
)
RETURNS TABLE(
  categoria_grupo TEXT,
  total_categoria NUMERIC,
  total_horas NUMERIC,
  num_lancamentos BIGINT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    hrc.categoria_grupo,
    SUM(hrc.valor_rateado) as total_categoria,
    SUM(hrc.horas_voadas) as total_horas,
    COUNT(*) as num_lancamentos
  FROM public.historico_rateio_consolidado hrc
  WHERE hrc.cliente_id = p_cliente_id
  AND EXTRACT(YEAR FROM hrc.data_competencia) = p_ano
  AND EXTRACT(MONTH FROM hrc.data_competencia) = p_mes
  AND hrc.status = 'consolidado'
  GROUP BY hrc.categoria_grupo
  ORDER BY total_categoria DESC;
$$;

-- ============================================================================
-- FUNÇÃO: comparar_uso_clientes
-- Descrição: Compara horas voadas entre clientes de uma aeronave
-- ============================================================================
CREATE OR REPLACE FUNCTION public.comparar_uso_clientes(
  p_aeronave_id UUID,
  p_ano INTEGER,
  p_mes INTEGER
)
RETURNS TABLE(
  cliente_nome TEXT,
  horas_voadas NUMERIC,
  horas_totais_aeronave NUMERIC,
  percentual_uso NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    hmc.cliente_nome,
    hmc.horas_voadas,
    hmc.horas_totais_aeronave,
    hmc.percentual_uso
  FROM public.horas_mensais_consolidadas hmc
  WHERE hmc.aeronave_id = p_aeronave_id
  AND hmc.ano = p_ano
  AND hmc.mes = p_mes
  AND hmc.validado = true
  ORDER BY hmc.horas_voadas DESC;
$$;
