-- =====================================================
-- MIGRATION: Sync contas_areceber status changes to related tables
-- =====================================================
-- This migration ensures that when a conta_areceber is marked as "recebido",
-- it automatically syncs with controle_bancario, bank_reconciliations, and notas_fiscais_saida

-- =====================================================
-- ADD COLUMNS: Ensure reference fields exist
-- =====================================================
ALTER TABLE public.controle_bancario
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id UUID;

ALTER TABLE public.contas_areceber
ADD COLUMN IF NOT EXISTS banco_conciliacao_id UUID,
ADD COLUMN IF NOT EXISTS nf_saida_id UUID,
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id UUID,
ADD COLUMN IF NOT EXISTS metodo_pagamento TEXT;

-- =====================================================
-- FUNCTION: Sync contas_areceber status change to related tables
-- =====================================================
CREATE OR REPLACE FUNCTION sync_contas_areceber_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    
    -- 1. Update bank_reconciliation if linked
    IF NEW.banco_conciliacao_id IS NOT NULL THEN
      UPDATE public.bank_reconciliations
      SET
        status = NEW.status,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.banco_conciliacao_id;
    END IF;

    -- 2. Update notas_fiscais_saida if linked
    IF NEW.nf_saida_id IS NOT NULL THEN
      UPDATE public.notas_fiscais_saida
      SET
        status = NEW.status,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = NEW.nf_saida_id;
    END IF;

    -- 3. Update controle_bancario entries linked by reference
    UPDATE public.controle_bancario
    SET
      status = NEW.status,
      data_atualizacao = CURRENT_TIMESTAMP
    WHERE reference_type = 'conta_areceber'
      AND reference_id = NEW.id;

    -- 4. Update controle_bancario entries linked to bank_reconciliation
    IF NEW.banco_conciliacao_id IS NOT NULL THEN
      UPDATE public.controle_bancario
      SET
        status = NEW.status,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE reference_type = 'banco_conciliacao'
        AND reference_id = NEW.banco_conciliacao_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Sync contas_areceber status changes
-- =====================================================
DROP TRIGGER IF EXISTS trigger_sync_contas_areceber_status ON public.contas_areceber;

CREATE TRIGGER trigger_sync_contas_areceber_status
AFTER UPDATE ON public.contas_areceber
FOR EACH ROW
EXECUTE FUNCTION sync_contas_areceber_status_change();

-- =====================================================
-- FUNCTION: Sync controle_bancario status change to contas_areceber
-- =====================================================
CREATE OR REPLACE FUNCTION sync_controle_bancario_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process when status changes
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- 1. Update contas_areceber if this controle_bancario references one
    IF NEW.reference_type = 'conta_areceber' AND NEW.reference_id IS NOT NULL THEN
      UPDATE public.contas_areceber
      SET
        status = NEW.status,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE id = NEW.reference_id;
    END IF;

    -- 2. Update contas_areceber linked via banco_conciliacao_id
    IF NEW.reference_type = 'banco_conciliacao' AND NEW.reference_id IS NOT NULL THEN
      UPDATE public.contas_areceber
      SET
        status = NEW.status,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE banco_conciliacao_id = NEW.reference_id;

      -- Also update bank_reconciliation
      UPDATE public.bank_reconciliations
      SET
        status = NEW.status,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.reference_id;
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER: Sync controle_bancario status changes
-- =====================================================
DROP TRIGGER IF EXISTS trigger_sync_controle_bancario_status ON public.controle_bancario;

CREATE TRIGGER trigger_sync_controle_bancario_status
AFTER UPDATE ON public.controle_bancario
FOR EACH ROW
EXECUTE FUNCTION sync_controle_bancario_status_change();

-- =====================================================
-- INDEX: Performance improvements for lookups
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contas_areceber_banco_conciliacao_id
ON public.contas_areceber(banco_conciliacao_id)
WHERE banco_conciliacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_areceber_nf_saida_id
ON public.contas_areceber(nf_saida_id)
WHERE nf_saida_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_areceber_status
ON public.contas_areceber(status);

CREATE INDEX IF NOT EXISTS idx_controle_bancario_reference
ON public.controle_bancario(reference_type, reference_id)
WHERE reference_type IN ('conta_areceber', 'banco_conciliacao');

CREATE INDEX IF NOT EXISTS idx_controle_bancario_status
ON public.controle_bancario(status);
