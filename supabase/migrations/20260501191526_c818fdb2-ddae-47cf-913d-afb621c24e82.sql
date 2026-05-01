-- ============================================================
-- FASE 0: Fundação do novo fluxo financeiro centralizado
-- Adiciona vínculo genérico (reference_type + reference_id) na
-- tabela movimentacoes para rastrear a origem de cada lançamento
-- (recibo, NF, relatório de viagem, cotista, rateio, etc).
-- ============================================================

-- 1) Colunas de vínculo genérico
ALTER TABLE public.movimentacoes
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id   uuid;

COMMENT ON COLUMN public.movimentacoes.reference_type IS
  'Tipo da origem do lançamento. Valores esperados: travel_report, recibo, nota_fiscal_entrada, nota_fiscal_saida, cotista, rateio, conta_apagar_manual, conta_areceber_manual.';
COMMENT ON COLUMN public.movimentacoes.reference_id IS
  'ID do registro de origem na tabela correspondente ao reference_type.';

-- 2) Índices para idempotência e busca reversa
CREATE INDEX IF NOT EXISTS idx_movimentacoes_reference
  ON public.movimentacoes (reference_type, reference_id);

-- 3) Mesmo padrão em contas_areceber e contas_apagar
ALTER TABLE public.contas_areceber
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id   uuid;

CREATE INDEX IF NOT EXISTS idx_contas_areceber_reference
  ON public.contas_areceber (reference_type, reference_id);

ALTER TABLE public.contas_apagar
  ADD COLUMN IF NOT EXISTS reference_type text,
  ADD COLUMN IF NOT EXISTS reference_id   uuid;

CREATE INDEX IF NOT EXISTS idx_contas_apagar_reference
  ON public.contas_apagar (reference_type, reference_id);

-- 4) Constraint única para garantir idempotência por origem
--    (não bloqueia múltiplas movimentações sem reference)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_movimentacoes_reference
  ON public.movimentacoes (reference_type, reference_id)
  WHERE reference_type IS NOT NULL AND reference_id IS NOT NULL;
