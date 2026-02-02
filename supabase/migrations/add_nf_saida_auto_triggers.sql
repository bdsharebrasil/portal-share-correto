-- =====================================================
-- TRIGGER: Sincronizar Notas Fiscais de Saída com Controle Bancário
-- =====================================================
-- Quando uma nota fiscal de saída é criada com status "pendente" ou "recebido",
-- cria automaticamente um registro em controle_bancario

CREATE OR REPLACE FUNCTION create_controle_bancario_from_nf_saida()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id uuid := '2874b45b-a3bb-4bec-8f7e-74b328f8693c'::uuid;
  v_status_cb text;
BEGIN
  -- Determinar o status em controle_bancario baseado no status da NF
  -- Se status for "recebido", marca como "confirmado" no controle
  -- Se status for "pendente", marca como "pendente" no controle
  IF NEW.status = 'recebido' THEN
    v_status_cb := 'confirmado';
  ELSIF NEW.status = 'pendente' THEN
    v_status_cb := 'pendente';
  ELSE
    -- Se status for "cancelado", não cria registro
    RETURN NEW;
  END IF;

  -- Verificar se já existe registro em controle_bancario para esta NF
  IF NOT EXISTS (
    SELECT 1 FROM public.controle_bancario 
    WHERE numero_documento = NEW.numero
    AND tipo_movimento = 'entrada'
  ) THEN
    -- Inserir entrada em controle_bancario
    INSERT INTO public.controle_bancario (
      descricao,
      valor,
      data,
      data_vencimento,
      categoria_id,
      tipo_movimento,
      status,
      numero_documento,
      criado_por,
      client_name,
      client_id,
      grupo_categoria
    ) VALUES (
      'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome || 
      CASE WHEN NEW.aeronave IS NOT NULL THEN ' (' || NEW.aeronave || ')' ELSE '' END,
      NEW.valor,
      CURRENT_DATE,
      NEW.data_vencimento,
      v_categoria_id,
      'entrada',
      v_status_cb,
      NEW.numero,
      NEW.criado_por,
      NEW.cliente_nome,
      NULL, -- client_id pode ser NULL ou buscado se houver relacionamento
      'RECEITAS OPERACIONAIS'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na inserção de notas fiscais de saída
DROP TRIGGER IF EXISTS trigger_create_controle_bancario_nf_saida ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_create_controle_bancario_nf_saida
AFTER INSERT ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION create_controle_bancario_from_nf_saida();

-- =====================================================
-- TRIGGER: Sincronizar Notas Fiscais de Saída com Bank Reconciliations
-- =====================================================
-- Quando uma nota fiscal de saída é criada com status "pendente" ou "recebido",
-- cria automaticamente um registro em bank_reconciliations

CREATE OR REPLACE FUNCTION create_bank_reconciliation_from_nf_saida()
RETURNS TRIGGER AS $$
DECLARE
  v_categoria_id uuid := '2874b45b-a3bb-4bec-8f7e-74b328f8693c'::uuid;
  v_status_br text;
BEGIN
  -- Determinar o status em bank_reconciliations baseado no status da NF
  IF NEW.status = 'recebido' THEN
    v_status_br := 'recebido';
  ELSIF NEW.status = 'pendente' THEN
    v_status_br := 'pendente';
  ELSE
    -- Se status for "cancelado", não cria registro
    RETURN NEW;
  END IF;

  -- Verificar se já existe registro em bank_reconciliations para esta NF
  IF NOT EXISTS (
    SELECT 1 FROM public.bank_reconciliations 
    WHERE reference_type = 'nf_saida'
    AND reference_id = NEW.id::text
  ) THEN
    -- Inserir entrada em bank_reconciliations
    INSERT INTO public.bank_reconciliations (
      type,
      date,
      description,
      amount,
      status,
      category,
      partner_name,
      created_by,
      tipo_documento,
      doc,
      payment_term,
      forma_pagamento,
      afeta_caixa_empresa,
      categoria_movimentacao_id,
      reference_type,
      reference_id,
      nf_url
    ) VALUES (
      'cliente',
      NEW.data_criacao,
      'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome || 
      CASE WHEN NEW.aeronave IS NOT NULL THEN ' (' || NEW.aeronave || ')' ELSE '' END,
      NEW.valor,
      v_status_br,
      NEW.categoria,
      NEW.cliente_nome,
      NEW.criado_por,
      'recibo',
      NEW.numero,
      NEW.data_vencimento,
      'empresa_paga',
      true,
      v_categoria_id,
      'nf_saida',
      NEW.id::text,
      NEW.arquivo_pdf_url
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na inserção de notas fiscais de saída
DROP TRIGGER IF EXISTS trigger_create_bank_reconciliation_nf_saida ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_create_bank_reconciliation_nf_saida
AFTER INSERT ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION create_bank_reconciliation_from_nf_saida();

-- =====================================================
-- TRIGGER: Atualizar status em controle_bancario quando NF muda status
-- =====================================================

CREATE OR REPLACE FUNCTION update_controle_bancario_from_nf_saida()
RETURNS TRIGGER AS $$
DECLARE
  v_status_cb text;
BEGIN
  -- Apenas processar se o status foi alterado
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Determinar o novo status em controle_bancario
    IF NEW.status = 'recebido' THEN
      v_status_cb := 'confirmado';
    ELSIF NEW.status = 'pendente' THEN
      v_status_cb := 'pendente';
    ELSIF NEW.status = 'cancelado' THEN
      v_status_cb := 'cancelado';
    ELSE
      v_status_cb := NEW.status;
    END IF;

    -- Atualizar registros em controle_bancario
    UPDATE public.controle_bancario
    SET 
      status = v_status_cb,
      data_atualizacao = CURRENT_TIMESTAMP
    WHERE numero_documento = NEW.numero
    AND tipo_movimento = 'entrada';

    -- Atualizar registros em bank_reconciliations
    UPDATE public.bank_reconciliations
    SET 
      status = NEW.status,
      updated_at = CURRENT_TIMESTAMP
    WHERE reference_type = 'nf_saida'
    AND reference_id = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na atualização de notas fiscais de saída
DROP TRIGGER IF EXISTS trigger_update_controle_bancario_nf_saida ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_update_controle_bancario_nf_saida
AFTER UPDATE ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION update_controle_bancario_from_nf_saida();
