-- ============================================================================
-- VIEW: v_resumo_mensal_cliente
-- Descrição: Resumo mensal de custos por categoria (como gráfico de custos)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_resumo_mensal_cliente AS
SELECT
  hrc.cliente_id,
  hrc.cliente_nome,
  hrc.aeronave_id,
  hrc.aeronave_registro,
  EXTRACT(YEAR FROM hrc.data_competencia) as ano,
  EXTRACT(MONTH FROM hrc.data_competencia) as mes,
  hrc.categoria_grupo,
  hrc.categoria_nome,
  COUNT(*) as num_lancamentos,
  SUM(hrc.valor_rateado) as total_categoria,
  SUM(hrc.horas_voadas) as total_horas_cliente,
  MAX(hrc.horas_totais_aeronave) as horas_totais_aeronave,
  ROUND(AVG(hrc.percentual_uso)::NUMERIC, 2) as percentual_uso_medio,
  SUM(CASE WHEN hrc.foi_reembolso THEN hrc.valor_rateado ELSE 0 END) as valor_reembolso
FROM public.historico_rateio_consolidado hrc
WHERE hrc.status = 'consolidado'
GROUP BY
  hrc.cliente_id,
  hrc.cliente_nome,
  hrc.aeronave_id,
  hrc.aeronave_registro,
  EXTRACT(YEAR FROM hrc.data_competencia),
  EXTRACT(MONTH FROM hrc.data_competencia),
  hrc.categoria_grupo,
  hrc.categoria_nome;

-- ============================================================================
-- VIEW: v_extrato_cliente
-- Descrição: Extrato detalhado por cliente (para portal do cliente)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_extrato_cliente AS
SELECT
  hrc.id,
  hrc.cliente_id,
  hrc.cliente_nome,
  hrc.aeronave_id,
  hrc.aeronave_registro,
  hrc.data_competencia,
  hrc.data_pagamento,
  hrc.data_conciliacao,
  hrc.categoria_id,
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
  hrc.documento_fiscal,
  CASE
    WHEN hrc.valor_pago >= hrc.valor_rateado THEN 'Pago'
    WHEN hrc.valor_pago = 0 THEN 'Pendente'
    ELSE 'Parcialmente Pago'
  END as status_pagamento,
  (hrc.valor_rateado - hrc.valor_pago) as saldo_devedor
FROM public.historico_rateio_consolidado hrc
WHERE hrc.status = 'consolidado'
ORDER BY hrc.data_competencia DESC, hrc.data_pagamento DESC;

-- ============================================================================
-- VIEW: v_comparativo_uso_clientes
-- Descrição: Comparativo de uso entre clientes (ranking)
-- ============================================================================
CREATE OR REPLACE VIEW public.v_comparativo_uso_clientes AS
SELECT
  hmc.aeronave_id,
  hmc.aeronave_registro,
  hmc.ano,
  hmc.mes,
  hmc.cliente_id,
  hmc.cliente_nome,
  hmc.horas_voadas,
  hmc.horas_totais_aeronave,
  hmc.percentual_uso,
  ROUND(
    (hmc.horas_voadas / NULLIF(hmc.horas_totais_aeronave, 0) * 100)::NUMERIC,
    2
  ) as percentual_exato,
  ROW_NUMBER() OVER (
    PARTITION BY hmc.aeronave_id, hmc.ano, hmc.mes
    ORDER BY hmc.horas_voadas DESC
  ) as ranking,
  COUNT(*) OVER (
    PARTITION BY hmc.aeronave_id, hmc.ano, hmc.mes
  ) as total_clientes,
  hmc.validado,
  hmc.fonte_diario_bordo,
  hmc.fonte_portal_cliente
FROM public.horas_mensais_consolidadas hmc
ORDER BY hmc.ano DESC, hmc.mes DESC, hmc.aeronave_id, hmc.horas_voadas DESC;

-- ============================================================================
-- VIEW: v_pendencias_cliente
-- Descrição: Pendências de pagamento por cliente
-- ============================================================================
CREATE OR REPLACE VIEW public.v_pendencias_cliente AS
SELECT
  hrc.cliente_id,
  hrc.cliente_nome,
  COUNT(*) as total_lancamentos_pendentes,
  SUM(hrc.valor_rateado - hrc.valor_pago) as total_pendente,
  MIN(hrc.data_competencia) as periodo_inicio,
  MAX(hrc.data_competencia) as periodo_fim,
  EXTRACT(DAY FROM (CURRENT_DATE - MAX(hrc.data_conciliacao))) as dias_pendente
FROM public.historico_rateio_consolidado hrc
WHERE hrc.status = 'consolidado'
AND hrc.valor_pago < hrc.valor_rateado
GROUP BY hrc.cliente_id, hrc.cliente_nome
ORDER BY total_pendente DESC;

-- ============================================================================
-- VIEW: v_analise_anual_cliente
-- Descrição: Análise anual de custos por cliente
-- ============================================================================
CREATE OR REPLACE VIEW public.v_analise_anual_cliente AS
SELECT
  hrc.cliente_id,
  hrc.cliente_nome,
  EXTRACT(YEAR FROM hrc.data_competencia)::INTEGER as ano,
  hrc.categoria_grupo,
  COUNT(*) as num_lancamentos,
  SUM(hrc.valor_rateado) as total_ano,
  SUM(hrc.horas_voadas) as total_horas,
  ROUND(AVG(hrc.percentual_uso)::NUMERIC, 2) as percentual_uso_medio,
  MIN(hrc.data_competencia) as primeira_despesa,
  MAX(hrc.data_competencia) as ultima_despesa
FROM public.historico_rateio_consolidado hrc
WHERE hrc.status = 'consolidado'
GROUP BY
  hrc.cliente_id,
  hrc.cliente_nome,
  EXTRACT(YEAR FROM hrc.data_competencia),
  hrc.categoria_grupo
ORDER BY ano DESC, total_ano DESC;

-- ============================================================================
-- VIEW: v_reembolsos_pendentes
-- Descrição: Reembolsos que foram pagos mas não recebidos de volta
-- ============================================================================
CREATE OR REPLACE VIEW public.v_reembolsos_pendentes AS
SELECT
  hrc.id,
  hrc.cliente_id,
  hrc.cliente_nome,
  hrc.data_competencia,
  hrc.data_pagamento,
  hrc.categoria_nome,
  hrc.descricao,
  hrc.valor_rateado,
  EXTRACT(DAY FROM (CURRENT_DATE - hrc.data_pagamento)) as dias_desde_pagamento
FROM public.historico_rateio_consolidado hrc
WHERE hrc.status = 'consolidado'
AND hrc.foi_reembolso = TRUE
AND hrc.valor_pago < hrc.valor_rateado
ORDER BY hrc.data_pagamento ASC;

-- ============================================================================
-- VIEW: v_conciliacao_status
-- Descrição: Status das conciliações bancárias
-- ============================================================================
CREATE OR REPLACE VIEW public.v_conciliacao_status AS
SELECT
  COUNT(CASE WHEN br.status = 'pendente' THEN 1 END) as pendentes,
  COUNT(CASE WHEN br.status = 'conciliado' THEN 1 END) as conciliadas,
  COUNT(CASE WHEN br.status = 'consolidado' THEN 1 END) as consolidadas,
  COUNT(*) as total,
  SUM(CASE WHEN br.status = 'pendente' THEN lr.valor_rateado ELSE 0 END) as valor_pendente,
  SUM(CASE WHEN br.status = 'conciliado' THEN lr.valor_rateado ELSE 0 END) as valor_conciliado,
  SUM(CASE WHEN br.status = 'consolidado' THEN lr.valor_rateado ELSE 0 END) as valor_consolidado
FROM public.bank_reconciliations br
JOIN public.lancamentos_rateio lr ON br.lancamento_rateio_id = lr.id;
