-- Criar view alternativa que inclui todos os clientes com horas e combustível
CREATE OR REPLACE VIEW vw_resumo_cliente_completo AS
WITH base_clientes AS (
  SELECT 
    c.id AS cliente_id,
    c.company_name AS cliente_nome,
    c.cnpj AS cliente_cnpj,
    c.partner_name AS socio1_nome,
    c.partner_cpf AS socio1_cpf,
    c.partner_percentage1 AS socio1_percentual,
    c.partner_name2 AS socio2_nome,
    c.partner_cpf2 AS socio2_cpf,
    c.partner_percentage2 AS socio2_percentual,
    c.partner_name3 AS socio3_nome,
    c.partner_cpf3 AS socio3_cpf,
    c.partner_percentage3 AS socio3_percentual,
    string_agg(DISTINCT a.registration, ', ') AS aeronaves
  FROM clients c
  LEFT JOIN client_aircraft ca ON ca.client_id = c.id
  LEFT JOIN aircraft a ON a.id = ca.aircraft_id
  GROUP BY c.id, c.company_name, c.cnpj, 
    c.partner_name, c.partner_cpf, c.partner_percentage1,
    c.partner_name2, c.partner_cpf2, c.partner_percentage2,
    c.partner_name3, c.partner_cpf3, c.partner_percentage3
),
horas_cliente AS (
  SELECT 
    cliente_id,
    ano,
    mes,
    SUM(horas_voadas) AS horas_voadas,
    SUM(horas_totais_aeronave) AS horas_totais_aeronave,
    AVG(percentual_uso) AS percentual_uso_medio
  FROM horas_mensais_consolidadas
  GROUP BY cliente_id, ano, mes
),
combustivel_cliente AS (
  SELECT 
    client_id,
    EXTRACT(YEAR FROM data)::INTEGER AS ano,
    EXTRACT(MONTH FROM data)::INTEGER AS mes,
    SUM(litros) AS litros_consumidos,
    SUM(valor_total) AS valor_combustivel,
    COUNT(*) AS qtd_abastecimentos
  FROM abastecimentos
  GROUP BY client_id, EXTRACT(YEAR FROM data), EXTRACT(MONTH FROM data)
),
despesas_cliente AS (
  SELECT 
    client_id,
    EXTRACT(YEAR FROM date)::INTEGER AS ano,
    EXTRACT(MONTH FROM date)::INTEGER AS mes,
    COUNT(*) AS total_movimentacoes,
    SUM(amount) AS total_despesas,
    SUM(CASE WHEN afeta_caixa_empresa = true THEN amount ELSE 0 END) AS valor_empresa_adiantou,
    SUM(CASE WHEN afeta_caixa_empresa = false THEN amount ELSE 0 END) AS valor_cliente_pagou_direto,
    SUM(CASE WHEN status = 'reembolsado' THEN amount ELSE 0 END) AS valor_reembolsado,
    SUM(CASE WHEN status IN ('aguardando_reembolso', 'reembolso_parcial') THEN amount - COALESCE(valor_reembolsado, 0) ELSE 0 END) AS saldo_pendente
  FROM bank_reconciliations
  WHERE type = 'cliente' AND status NOT IN ('cancelado', 'rejeitado')
  GROUP BY client_id, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
),
todos_periodos AS (
  SELECT DISTINCT cliente_id, ano, mes FROM horas_cliente
  UNION
  SELECT DISTINCT client_id, ano, mes FROM combustivel_cliente
  UNION
  SELECT DISTINCT client_id, ano, mes FROM despesas_cliente
)
SELECT 
  bc.cliente_id,
  bc.cliente_nome,
  bc.cliente_cnpj,
  bc.socio1_nome,
  bc.socio1_cpf,
  bc.socio1_percentual,
  bc.socio2_nome,
  bc.socio2_cpf,
  bc.socio2_percentual,
  bc.socio3_nome,
  bc.socio3_cpf,
  bc.socio3_percentual,
  bc.aeronaves,
  tp.ano,
  tp.mes,
  LPAD(tp.mes::TEXT, 2, '0') || '/' || tp.ano::TEXT AS mes_ano,
  COALESCE(hc.horas_voadas, 0) AS horas_voadas,
  COALESCE(hc.horas_totais_aeronave, 0) AS horas_totais_aeronave,
  COALESCE(hc.percentual_uso_medio, 0) AS percentual_uso,
  COALESCE(cc.litros_consumidos, 0) AS litros_consumidos,
  COALESCE(cc.valor_combustivel, 0) AS valor_combustivel,
  COALESCE(cc.qtd_abastecimentos, 0) AS qtd_abastecimentos,
  COALESCE(dc.total_movimentacoes, 0) AS total_movimentacoes,
  COALESCE(dc.total_despesas, 0) AS total_despesas,
  COALESCE(dc.valor_empresa_adiantou, 0) AS valor_empresa_adiantou,
  COALESCE(dc.valor_cliente_pagou_direto, 0) AS valor_cliente_pagou_direto,
  COALESCE(dc.valor_reembolsado, 0) AS valor_reembolsado,
  COALESCE(dc.saldo_pendente, 0) AS saldo_pendente
FROM base_clientes bc
INNER JOIN todos_periodos tp ON tp.cliente_id = bc.cliente_id
LEFT JOIN horas_cliente hc ON hc.cliente_id = bc.cliente_id AND hc.ano = tp.ano AND hc.mes = tp.mes
LEFT JOIN combustivel_cliente cc ON cc.client_id = bc.cliente_id AND cc.ano = tp.ano AND cc.mes = tp.mes
LEFT JOIN despesas_cliente dc ON dc.client_id = bc.cliente_id AND dc.ano = tp.ano AND dc.mes = tp.mes
ORDER BY bc.cliente_nome, tp.ano DESC, tp.mes DESC;