-- =====================================================
-- MIGRATION: Clean setup for NF Saída → Bank Reconciliation
-- =====================================================
-- This migration CLEANLY creates the relationship between
-- notas_fiscais_saida and bank_reconciliations tables

-- DROP old triggers if they exist (cleanup)
DROP TRIGGER IF EXISTS trigger_create_bank_reconciliation_nf_saida ON public.notas_fiscais_saida;
DROP TRIGGER IF EXISTS trigger_update_controle_bancario_from_nf_saida ON public.notas_fiscais_saida;

-- DROP old functions (cleanup)
DROP FUNCTION IF EXISTS public.create_bank_reconciliation_from_nf_saida() CASCADE;
DROP FUNCTION IF EXISTS public.update_controle_bancario_from_nf_saida() CASCADE;

-- =====================================================
-- FUNCTION 1: Create bank_reconciliation from NF Saída
-- =====================================================
CREATE OR REPLACE FUNCTION public.create_bank_reconciliation_from_nf_saida()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id uuid := '2874b45b-a3bb-4bec-8f7e-74b328f8693c'::uuid;
  v_status_br text;
  v_client_id uuid;
  v_aircraft_id uuid;
BEGIN
  -- Skip if required data is missing
  IF NEW.numero IS NULL OR NEW.cliente_nome IS NULL OR NEW.valor IS NULL OR NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Map NF status to bank_reconciliation status
  IF NEW.status = 'recebido' THEN
    v_status_br := 'recebido';
  ELSIF NEW.status = 'pendente' THEN
    v_status_br := 'pendente';
  ELSE
    -- Don't create record for other statuses
    RETURN NEW;
  END IF;

  -- Look up client by name, CNPJ, or proprietário
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE company_name = NEW.cliente_nome 
     OR cnpj = NEW.cliente_cnpj
     OR proprietario = NEW.cliente_nome
  LIMIT 1;

  -- Look up aircraft by registration
  IF NEW.aeronave IS NOT NULL AND NEW.aeronave <> '' THEN
    SELECT id INTO v_aircraft_id
    FROM public.aircraft
    WHERE registration = NEW.aeronave
    LIMIT 1;
  END IF;

  -- Only create if client found; aircraft is optional for type='cliente'
  IF v_client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if already exists (prevent duplicates)
  IF NOT EXISTS (
    SELECT 1 FROM public.bank_reconciliations
    WHERE reference_type = 'nf_saida'
    AND reference_id = NEW.id
  ) THEN
    -- Insert into bank_reconciliations
    INSERT INTO public.bank_reconciliations (
      type,
      date,
      description,
      amount,
      status,
      category,
      partner_name,
      criado_por,
      tipo_documento,
      doc,
      prazo_pagamento,
      forma_pagamento,
      afeta_caixa_empresa,
      categoria_movimentacao_id,
      reference_type,
      reference_id,
      nf_url,
      client_id,
      aircraft_id
    ) VALUES (
      'cliente',
      NEW.data_criacao,
      COALESCE(NEW.descricao, 'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome) ||
      CASE WHEN NEW.aeronave IS NOT NULL THEN ' (' || NEW.aeronave || ')' ELSE '' END,
      NEW.valor,
      v_status_br,
      'RECEITAS OPERACIONAIS',
      NEW.cliente_nome,
      NEW.criado_por,
      'nota_fiscal',
      NEW.numero,
      NEW.data_vencimento,
      'empresa_paga',
      true,
      v_categoria_id,
      'nf_saida',
      NEW.id,
      NEW.arquivo_pdf_url,
      v_client_id,
      v_aircraft_id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER 1: Create bank_reconciliation when NF is created
-- =====================================================
CREATE TRIGGER trigger_create_bank_reconciliation_nf_saida
AFTER INSERT ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION create_bank_reconciliation_from_nf_saida();

-- =====================================================
-- FUNCTION 2: Update bank_reconciliation when NF status changes
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_controle_bancario_from_nf_saida()
RETURNS TRIGGER AS $$
DECLARE
  v_status_br text;
BEGIN
  -- Only process if status changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Map NF status to bank_reconciliation status
    IF NEW.status = 'recebido' THEN
      v_status_br := 'recebido';
    ELSIF NEW.status = 'pendente' THEN
      v_status_br := 'pendente';
    ELSIF NEW.status = 'cancelado' THEN
      v_status_br := 'cancelado';
    ELSE
      v_status_br := NEW.status;
    END IF;

    -- Update bank_reconciliations
    UPDATE public.bank_reconciliations
    SET
      status = v_status_br,
      updated_at = CURRENT_TIMESTAMP
    WHERE reference_type = 'nf_saida'
      AND reference_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGER 2: Update when NF status changes
-- =====================================================
CREATE TRIGGER trigger_update_controle_bancario_from_nf_saida
AFTER UPDATE ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION update_controle_bancario_from_nf_saida();

-- =====================================================
-- CONSTRAINT: Ensure required fields for type='cliente'
-- =====================================================
-- Removida pois há múltiplas fontes inserindo dados incompletos
-- ALTER TABLE public.bank_reconciliations
-- DROP CONSTRAINT IF EXISTS cliente_fields_required;
--
-- ALTER TABLE public.bank_reconciliations
-- ADD CONSTRAINT cliente_fields_required
-- CHECK (
--   (type <> 'cliente') OR
--   (client_id IS NOT NULL AND category IS NOT NULL)
-- );

-- =====================================================
-- INDEX: Performance improvements
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_bank_reconciliations_nf_saida 
ON public.bank_reconciliations(reference_type, reference_id)
WHERE reference_type = 'nf_saida';

CREATE INDEX IF NOT EXISTS idx_controle_bancario_numero_tipo 
ON public.controle_bancario(numero_documento, tipo);
