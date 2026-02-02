-- =====================================================
-- SCRIPT: Sincronizar Controle Bancário com Bank Reconciliations
-- =====================================================
-- Este script sincroniza registros existentes em controle_bancario
-- para bank_reconciliations, especialmente para entradas (receitas)

-- 1. Buscar IDs de aeronaves para mapeamento
-- CREATE TEMP TABLE IF NOT EXISTS temp_aircraft_ids AS
-- SELECT id, registration FROM public.aircraft;

-- 2. Sincronizar registros de ENTRADA (receitas) do controle_bancario
-- que ainda não existem em bank_reconciliations

INSERT INTO public.bank_reconciliations (
  type,
  date,
  description,
  amount,
  status,
  client_id,
  aircraft_id,
  categoria_movimentacao_id,
  tipo_documento,
  doc,
  payment_term,
  forma_pagamento,
  afeta_caixa_empresa,
  created_by,
  partner_name,
  recibo_url,
  nf_url,
  boleto_url,
  reference_type,
  reference_id,
  created_at,
  updated_at
)
SELECT
  'cliente' as type,
  cb.data as date,
  cb.descricao as description,
  cb.valor as amount,
  CASE 
    WHEN cb.status = 'confirmado' THEN 'recebido'
    WHEN cb.status = 'pendente' THEN 'pendente'
    WHEN cb.status = 'inadimplente' THEN 'pendente'
    ELSE cb.status
  END as status,
  cb.client_id as client_id,
  CASE 
    WHEN cb.aeronave_id IS NOT NULL THEN cb.aeronave_id
    WHEN cb.aeronave_registro IS NOT NULL THEN 
      (SELECT id FROM public.aircraft WHERE registration = cb.aeronave_registro LIMIT 1)
    ELSE NULL
  END as aircraft_id,
  cb.categoria_id as categoria_movimentacao_id,
  'recibo' as tipo_documento,
  cb.numero_documento as doc,
  cb.data_vencimento as payment_term,
  'empresa_paga' as forma_pagamento,
  true as afeta_caixa_empresa,
  cb.criado_por as created_by,
  cb.partner_name as partner_name,
  cb.recibo_url as recibo_url,
  cb.nf_url as nf_url,
  cb.boleto_url as boleto_url,
  'controle_bancario' as reference_type,
  cb.id::text as reference_id,
  cb.data_criacao as created_at,
  CURRENT_TIMESTAMP as updated_at
FROM public.controle_bancario cb
WHERE 
  -- Apenas entradas (receitas)
  cb.tipo_movimento = 'entrada'
  -- Evitar duplicatas
  AND NOT EXISTS (
    SELECT 1 FROM public.bank_reconciliations br
    WHERE br.reference_type = 'controle_bancario'
    AND br.reference_id = cb.id::text
  )
  -- Apenas registros com numero_documento preenchido (recibos/NFs)
  AND cb.numero_documento IS NOT NULL
  AND cb.numero_documento != ''
  -- Apenas registros válidos (não nulos)
  AND cb.valor > 0
ON CONFLICT DO NOTHING;

-- =====================================================
-- RESULTADO
-- =====================================================
-- Este script insere todos os registros de entrada em controle_bancario
-- que ainda não existem em bank_reconciliations, mapeando:
--
-- controle_bancario → bank_reconciliations
-- - id → reference_id
-- - data → date
-- - descricao → description
-- - valor → amount
-- - status → status (confirmado→recebido, pendente→pendente, inadimplente→pendente)
-- - numero_documento → doc
-- - data_vencimento → payment_term
-- - categoria_id → categoria_movimentacao_id
-- - client_id → client_id
-- - aeronave_id/aeronave_registro → aircraft_id
-- - partner_name → partner_name
-- - recibo_url → recibo_url
-- - nf_url → nf_url
-- - boleto_url → boleto_url
-- - criado_por → created_by
-- - data_criacao → created_at

-- =====================================================
-- VERIFICAÇÃO PÓS-SINCRONIZAÇÃO
-- =====================================================
-- Executar esta query para verificar quantos registros foram sincronizados:
--
-- SELECT COUNT(*) as registros_sincronizados
-- FROM public.bank_reconciliations
-- WHERE reference_type = 'controle_bancario';
--
-- SELECT cb.id, cb.numero_documento, cb.descricao, cb.valor, cb.status
-- FROM public.controle_bancario cb
-- WHERE cb.tipo_movimento = 'entrada'
-- AND EXISTS (
--   SELECT 1 FROM public.bank_reconciliations br
--   WHERE br.reference_type = 'controle_bancario'
--   AND br.reference_id = cb.id::text
-- )
-- ORDER BY cb.data DESC;
