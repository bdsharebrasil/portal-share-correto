-- =====================================================
-- MIGRATION: Sync contas_areceber status changes to fluxo_caixa and related tables
-- =====================================================
-- This migration ensures that when a conta_areceber is marked as "recebido",
-- it automatically syncs with controle_bancario, bank_reconciliations, and notas_fiscais_saida

-- =====================================================
-- FUNCTION: Sync contas_areceber status change to related tables
-- =====================================================
CREATE OR REPLACE FUNCTION sync_contas_areceber_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_controle_id UUID;
  v_bank_rec_id UUID;
  v_nf_saida_id UUID;
  v_entrada_id UUID;
BEGIN
  -- Only process when status changes to "recebido"
  IF NEW.status = 'recebido' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- 1. Check if this conta_areceber is linked to a bank_reconciliation
    IF NEW.banco_conciliacao_id IS NOT NULL THEN
      -- Update the bank_reconciliation status
      UPDATE public.bank_reconciliations
      SET
        status = 'recebido',
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.banco_conciliacao_id;

      -- Update the associated controle_bancario if it exists
      UPDATE public.controle_bancario
      SET
        status = 'recebido',
        data_atualizacao = CURRENT_TIMESTAMP,
        conta_banco = NEW.banco_recebimento,
        data_reembolso = NEW.data_recebimento
      WHERE reference_type = 'banco_conciliacao'
        AND reference_id = NEW.banco_conciliacao_id;
    END IF;

    -- 2. Check if this conta_areceber is linked to a notas_fiscais_saida
    IF NEW.nf_saida_id IS NOT NULL THEN
      -- Update the notas_fiscais_saida status
      UPDATE public.notas_fiscais_saida
      SET
        status = 'recebido',
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = NEW.nf_saida_id;
    END IF;

    -- 3. Create entrada in controle_bancario if it doesn't already exist
    -- Check if there's already a controle_bancario entry for this conta_areceber
    IF NOT EXISTS (
      SELECT 1 FROM public.controle_bancario
      WHERE reference_type = 'conta_areceber'
        AND reference_id = NEW.id
    ) THEN
      -- Create entrada in controle_bancario
      INSERT INTO public.controle_bancario (
        data,
        tipo_movimento,
        categoria,
        descricao,
        valor,
        conta_banco,
        numero_documento,
        status,
        criado_por,
        aeronave,
        reference_type,
        reference_id,
        data_reembolso,
        data_atualizacao
      ) VALUES (
        COALESCE(NEW.data_recebimento, CURRENT_DATE),
        'entrada',
        NEW.categoria,
        'Recebimento - NF: ' || NEW.numero || ' - Cliente: ' || NEW.cliente_nome,
        NEW.valor,
        NEW.banco_recebimento,
        NEW.numero,
        'recebido',
        NEW.criado_por,
        NEW.aeronave,
        'conta_areceber',
        NEW.id,
        NEW.data_recebimento,
        CURRENT_TIMESTAMP
      );
    END IF;

    -- 4. Update bank_reconciliation status if linked via reference
    UPDATE public.bank_reconciliations
    SET
      status = 'recebido',
      updated_at = CURRENT_TIMESTAMP
    WHERE reference_type = 'conta_areceber'
      AND reference_id = NEW.id;

  -- Handle other status changes
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Update related bank_reconciliations
    IF NEW.banco_conciliacao_id IS NOT NULL THEN
      UPDATE public.bank_reconciliations
      SET
        status = NEW.status,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.banco_conciliacao_id;
    END IF;

    -- Update related notas_fiscais_saida
    IF NEW.nf_saida_id IS NOT NULL THEN
      UPDATE public.notas_fiscais_saida
      SET
        status = NEW.status,
        data_atualizacao = CURRENT_TIMESTAMP
      WHERE id = NEW.nf_saida_id;
    END IF;

    -- Update controle_bancario entries
    UPDATE public.controle_bancario
    SET
      status = NEW.status,
      data_atualizacao = CURRENT_TIMESTAMP
    WHERE reference_type = 'conta_areceber'
      AND reference_id = NEW.id;

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
-- Add columns if they don't exist (for linking to related tables)
-- =====================================================
ALTER TABLE public.contas_areceber
ADD COLUMN IF NOT EXISTS nf_saida_id UUID REFERENCES public.notas_fiscais_saida(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reference_type TEXT,
ADD COLUMN IF NOT EXISTS reference_id UUID;

-- =====================================================
-- FUNCTION: Sync controle_bancario status change to contas_areceber
-- =====================================================
CREATE OR REPLACE FUNCTION sync_controle_bancario_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_conta_areceber_id UUID;
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

    -- 2. Also check if there's a corresponding bank_reconciliation entry
    IF NEW.reference_type = 'banco_conciliacao' AND NEW.reference_id IS NOT NULL THEN
      -- Update related bank_reconciliation
      UPDATE public.bank_reconciliations
      SET
        status = NEW.status,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = NEW.reference_id;

      -- Also update related contas_areceber if linked
      UPDATE public.contas_areceber
      SET
        status = NEW.status,
        atualizado_em = CURRENT_TIMESTAMP
      WHERE banco_conciliacao_id = NEW.reference_id;
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
CREATE INDEX IF NOT EXISTS idx_contas_areceber_nf_saida_id
ON public.contas_areceber(nf_saida_id)
WHERE nf_saida_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_areceber_banco_conciliacao_id
ON public.contas_areceber(banco_conciliacao_id)
WHERE banco_conciliacao_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contas_areceber_status
ON public.contas_areceber(status);

CREATE INDEX IF NOT EXISTS idx_controle_bancario_reference
ON public.controle_bancario(reference_type, reference_id)
WHERE reference_type IN ('conta_areceber', 'banco_conciliacao');

CREATE INDEX IF NOT EXISTS idx_controle_bancario_status
ON public.controle_bancario(status);
