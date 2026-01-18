-- Criar view completa de balanço cliente com horas voadas e combustível
CREATE OR REPLACE VIEW vw_balanco_cliente_completo AS
WITH horas_cliente AS (
  SELECT 
    cliente_id,
    date_trunc('month', data_referencia) AS mes_ref,
    SUM(horas_voadas) AS horas_voadas,
    SUM(horas_totais_aeronave) AS horas_totais_aeronave,
    AVG(percentual_uso) AS percentual_uso_medio
  FROM horas_mensais_consolidadas
  GROUP BY cliente_id, date_trunc('month', data_referencia)
),
combustivel_cliente AS (
  SELECT 
    client_id,
    date_trunc('month', data::timestamp) AS mes_ref,
    SUM(litros) AS litros_consumidos,
    SUM(valor_total) AS valor_combustivel,
    COUNT(*) AS qtd_abastecimentos
  FROM abastecimentos
  GROUP BY client_id, date_trunc('month', data::timestamp)
),
categoria_agregada AS (
  SELECT 
    bank_reconciliations.client_id,
    date_trunc('month'::text, bank_reconciliations.date::timestamp with time zone) AS mes_ref,
    bank_reconciliations.category,
    sum(bank_reconciliations.amount) AS total_categoria,
    count(*) AS qtd_categoria
  FROM bank_reconciliations
  WHERE bank_reconciliations.type = 'cliente' 
    AND bank_reconciliations.status NOT IN ('cancelado', 'rejeitado')
    AND bank_reconciliations.category IS NOT NULL
  GROUP BY bank_reconciliations.client_id, date_trunc('month', bank_reconciliations.date::timestamp with time zone), bank_reconciliations.category
),
movimentacoes_mes AS (
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
    date_trunc('month', br.date::timestamp with time zone) AS mes_referencia,
    to_char(br.date::timestamp with time zone, 'MM/YYYY') AS mes_ano,
    string_agg(DISTINCT a.registration, ', ') AS aeronaves,
    count(DISTINCT br.id) AS total_movimentacoes,
    sum(br.amount) AS total_despesas,
    sum(CASE WHEN br.afeta_caixa_empresa = true THEN br.amount ELSE 0 END) AS valor_empresa_adiantou,
    sum(CASE WHEN br.afeta_caixa_empresa = false THEN br.amount ELSE 0 END) AS valor_cliente_pagou_direto,
    sum(CASE WHEN br.status = 'reembolsado' THEN br.amount ELSE 0 END) AS valor_reembolsado,
    sum(CASE WHEN br.status IN ('aguardando_reembolso', 'reembolso_parcial') THEN br.amount - COALESCE(br.valor_reembolsado, 0) ELSE 0 END) AS saldo_pendente,
    count(*) FILTER (WHERE br.status = 'aguardando_reembolso') AS qtd_aguardando,
    count(*) FILTER (WHERE br.status = 'reembolsado') AS qtd_reembolsado,
    count(*) FILTER (WHERE br.status = 'lancado_aeronave') AS qtd_processado
  FROM clients c
  LEFT JOIN bank_reconciliations br ON br.client_id = c.id
  LEFT JOIN aircraft a ON br.aircraft_id = a.id
  WHERE br.type = 'cliente' AND br.status NOT IN ('cancelado', 'rejeitado')
  GROUP BY c.id, c.company_name, c.cnpj, 
    c.partner_name, c.partner_cpf, c.partner_percentage1,
    c.partner_name2, c.partner_cpf2, c.partner_percentage2,
    c.partner_name3, c.partner_cpf3, c.partner_percentage3,
    date_trunc('month', br.date::timestamp with time zone),
    to_char(br.date::timestamp with time zone, 'MM/YYYY')
)
SELECT 
  mm.cliente_id,
  mm.cliente_nome,
  mm.cliente_cnpj,
  mm.socio1_nome,
  mm.socio1_cpf,
  mm.socio1_percentual,
  mm.socio2_nome,
  mm.socio2_cpf,
  mm.socio2_percentual,
  mm.socio3_nome,
  mm.socio3_cpf,
  mm.socio3_percentual,
  mm.mes_referencia,
  mm.mes_ano,
  mm.aeronaves,
  mm.total_movimentacoes,
  mm.total_despesas,
  mm.valor_empresa_adiantou,
  mm.valor_cliente_pagou_direto,
  mm.valor_reembolsado,
  mm.saldo_pendente,
  mm.qtd_aguardando,
  mm.qtd_reembolsado,
  mm.qtd_processado,
  COALESCE(hc.horas_voadas, 0) AS horas_voadas,
  COALESCE(hc.horas_totais_aeronave, 0) AS horas_totais_aeronave,
  COALESCE(hc.percentual_uso_medio, 0) AS percentual_uso,
  COALESCE(cc.litros_consumidos, 0) AS litros_consumidos,
  COALESCE(cc.valor_combustivel, 0) AS valor_combustivel,
  COALESCE(cc.qtd_abastecimentos, 0) AS qtd_abastecimentos,
  (SELECT json_agg(json_build_object(
    'categoria', ca.category, 
    'valor', ca.total_categoria, 
    'quantidade', ca.qtd_categoria
  ) ORDER BY ca.total_categoria DESC)
  FROM categoria_agregada ca
  WHERE ca.client_id = mm.cliente_id AND ca.mes_ref = mm.mes_referencia) AS despesas_por_categoria
FROM movimentacoes_mes mm
LEFT JOIN horas_cliente hc ON hc.cliente_id = mm.cliente_id AND hc.mes_ref = mm.mes_referencia
LEFT JOIN combustivel_cliente cc ON cc.client_id = mm.cliente_id AND cc.mes_ref = mm.mes_referencia
ORDER BY mm.cliente_nome, mm.mes_referencia DESC;