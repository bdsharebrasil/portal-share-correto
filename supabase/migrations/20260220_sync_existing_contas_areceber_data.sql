-- =====================================================
-- MIGRATION: Sync existing contas_areceber data with related tables
-- =====================================================
-- This migration updates historical data in contas_areceber that were already
-- marked as "recebido" to sync with controle_bancario, bank_reconciliations, and notas_fiscais_saida

-- =====================================================
-- 1. UPDATE bank_reconciliations linked to contas_areceber
-- =====================================================
-- For each conta_areceber marked as "recebido" that has a banco_conciliacao_id,
-- update the corresponding bank_reconciliation to status "recebido"
UPDATE public.bank_reconciliations br
SET
  status = 'recebido',
  updated_at = CURRENT_TIMESTAMP
FROM public.contas_areceber cr
WHERE cr.banco_conciliacao_id = br.id
  AND cr.status = 'recebido'
  AND br.status != 'recebido';

-- =====================================================
-- 2. UPDATE notas_fiscais_saida linked to contas_areceber
-- =====================================================
-- For each conta_areceber marked as "recebido" that has a nf_saida_id,
-- update the corresponding nota_fiscal_saida to status "recebido"
UPDATE public.notas_fiscais_saida nfs
SET
  status = 'recebido',
  data_atualizacao = CURRENT_TIMESTAMP
FROM public.contas_areceber cr
WHERE cr.nf_saida_id = nfs.id
  AND cr.status = 'recebido'
  AND nfs.status != 'recebido';

-- =====================================================
-- 3. CREATE controle_bancario entries for contas_areceber marked as "recebido"
-- =====================================================
-- For each conta_areceber with status "recebido" and data_recebimento,
-- create an entry in controle_bancario if it doesn't already exist
-- Get categoria_id for "Receitas" category (you may need to adjust this ID)
WITH categoria_receita AS (
  SELECT id FROM public.categorias_movimentacao
  WHERE nome = 'Receitas' OR tipo = 'receita'
  LIMIT 1
)
INSERT INTO public.controle_bancario (
  data,
  tipo_movimento,
  categoria_id,
  descricao,
  valor,
  conta_banco,
  numero_documento,
  status,
  criado_por,
  reference_type,
  reference_id,
  data_reembolso,
  data_criacao,
  data_atualizacao
)
SELECT
  COALESCE(cr.data_recebimento::date, CURRENT_DATE),
  'entrada',
  (SELECT id FROM categoria_receita),
  'Recebimento - NF: ' || cr.numero || ' - Cliente: ' || cr.cliente_nome,
  cr.valor,
  cr.banco_recebimento,
  cr.numero,
  'recebido',
  cr.criado_por,
  'conta_areceber',
  cr.id,
  cr.data_recebimento::date,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM public.contas_areceber cr
WHERE cr.status = 'recebido'
  AND cr.data_recebimento IS NOT NULL
  AND cr.banco_recebimento IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.controle_bancario cb
    WHERE cb.reference_type = 'conta_areceber'
      AND cb.reference_id = cr.id
  )
ON CONFLICT DO NOTHING;

-- =====================================================
-- 4. UPDATE controle_bancario entries linked to contas_areceber by reference
-- =====================================================
-- For each controle_bancario that references a conta_areceber with status "recebido",
-- ensure the controle_bancario is also marked as "recebido"
UPDATE public.controle_bancario cb
SET
  status = 'recebido',
  data_atualizacao = CURRENT_TIMESTAMP
FROM public.contas_areceber cr
WHERE cb.reference_type = 'conta_areceber'
  AND cb.reference_id = cr.id
  AND cr.status = 'recebido'
  AND cb.status != 'recebido';

-- =====================================================
-- 5. UPDATE controle_bancario entries linked to bank_reconciliations
-- =====================================================
-- For each controle_bancario that references a bank_reconciliation linked to
-- a conta_areceber with status "recebido", ensure the controle_bancario is updated
UPDATE public.controle_bancario cb
SET
  status = 'recebido',
  data_atualizacao = CURRENT_TIMESTAMP
FROM public.contas_areceber cr
WHERE cb.reference_type = 'banco_conciliacao'
  AND cb.reference_id = cr.banco_conciliacao_id
  AND cr.status = 'recebido'
  AND cb.status != 'recebido'
  AND cr.banco_conciliacao_id IS NOT NULL;

-- =====================================================
-- 6. UPDATE contas_areceber to link banco_conciliacao_id where missing
-- =====================================================
-- For contas_areceber that have controle_bancario entries but don't have
-- banco_conciliacao_id set, try to find and link the bank_reconciliation
UPDATE public.contas_areceber cr
SET
  banco_conciliacao_id = br.id
FROM public.bank_reconciliations br
WHERE cr.banco_conciliacao_id IS NULL
  AND br.reference_type = 'conta_areceber'
  AND br.reference_id = cr.id
  AND cr.status = 'recebido';

-- =====================================================
-- 7. Log summary of updates
-- =====================================================
-- Show how many records were synchronized
SELECT
  'Contas Areceber Recebidas' as tipo,
  COUNT(*) as total
FROM public.contas_areceber
WHERE status = 'recebido'
UNION ALL
SELECT
  'Fluxo Caixa com status recebido',
  COUNT(*)
FROM public.controle_bancario
WHERE status = 'recebido'
UNION ALL
SELECT
  'Bank Reconciliations com status recebido',
  COUNT(*)
FROM public.bank_reconciliations
WHERE status = 'recebido'
UNION ALL
SELECT
  'Notas Fiscais Saida com status recebido',
  COUNT(*)
FROM public.notas_fiscais_saida
WHERE status = 'recebido';
