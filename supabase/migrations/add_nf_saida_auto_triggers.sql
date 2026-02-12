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
      COALESCE(NEW.descricao, 'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome) ||
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
    AND reference_id::text = NEW.id::text
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
      criado_por,
      tipo_documento,
      doc,
      prazo_pagamento,
      forma_pagamento,
      afeta_caixa_empresa,
      categoria_movimentacao_id,
      reference_type,
      reference_id,
      nf_url
    ) VALUES (
      'cliente',
      NEW.data_criacao,
      COALESCE(NEW.descricao, 'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome) ||
      CASE WHEN NEW.aeronave IS NOT NULL THEN ' (' || NEW.aeronave || ')' ELSE '' END,
      NEW.valor,
      v_status_br,
      v_categoria_id,
      NEW.cliente_nome,
      NEW.criado_por,
      'recibo',
      NEW.numero,
      NEW.data_vencimento,
      'empresa_paga',
      true,
      v_categoria_id,
      'nf_saida',
      NEW.id,
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
    AND reference_id::text = NEW.id::text;
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

-- =====================================================
-- TRIGGER: Sincronizar Notas Fiscais de Saída com Contas a Receber
-- =====================================================
-- Quando uma nota fiscal de saída é criada com status "pendente" ou "recebido",
-- cria automaticamente um registro em contas_areceber

CREATE OR REPLACE FUNCTION create_contas_areceber_from_nf_saida()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o status é válido (não criar para cancelado)
  IF NEW.status = 'cancelado' THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe registro em contas_areceber para esta NF
  IF NOT EXISTS (
    SELECT 1 FROM public.contas_areceber
    WHERE numero = NEW.numero
  ) THEN
    -- Inserir entrada em contas_areceber
    INSERT INTO public.contas_areceber (
      numero,
      cliente_nome,
      cliente_cnpj,
      data_criacao,
      data_vencimento,
      valor,
      categoria,
      descricao,
      status,
      aeronave,
      criado_por,
      arquivo_pdf_url
    ) VALUES (
      NEW.numero,
      NEW.cliente_nome,
      NEW.cliente_cnpj,
      NEW.data_criacao,
      NEW.data_vencimento,
      NEW.valor,
      NEW.categoria,
      COALESCE(NEW.descricao, 'NF Saída - ' || NEW.numero),
      CASE
        WHEN NEW.status = 'recebido' THEN 'recebido'
        WHEN NEW.status = 'pendente' THEN 'pendente'
        ELSE NEW.status
      END,
      NEW.aeronave,
      NEW.criado_por,
      NEW.arquivo_pdf_url
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na inserção de notas fiscais de saída
DROP TRIGGER IF EXISTS trigger_create_contas_areceber_nf_saida ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_create_contas_areceber_nf_saida
AFTER INSERT ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION create_contas_areceber_from_nf_saida();

-- =====================================================
-- TRIGGER: Atualizar status em contas_areceber quando NF muda status
-- =====================================================

CREATE OR REPLACE FUNCTION update_contas_areceber_from_nf_saida()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas processar se o status foi alterado
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Atualizar registros em contas_areceber
    UPDATE public.contas_areceber
    SET
      status = CASE
        WHEN NEW.status = 'recebido' THEN 'recebido'
        WHEN NEW.status = 'pendente' THEN 'pendente'
        WHEN NEW.status = 'cancelado' THEN 'cancelado'
        ELSE NEW.status
      END,
      atualizado_em = CURRENT_TIMESTAMP
    WHERE numero = NEW.numero;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na atualização de notas fiscais de saída
DROP TRIGGER IF EXISTS trigger_update_contas_areceber_nf_saida ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_update_contas_areceber_nf_saida
AFTER UPDATE ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION update_contas_areceber_from_nf_saida();

-- =====================================================
-- TRIGGER: Sincronizar Controle Bancário com Bank Reconciliations
-- =====================================================
-- Quando um registro de entrada é criado em controle_bancario,
-- sincroniza automaticamente para bank_reconciliations

CREATE OR REPLACE FUNCTION create_bank_reconciliation_from_controle_bancario()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas processar entradas (receitas)
  IF NEW.tipo_movimento != 'entrada' THEN
    RETURN NEW;
  END IF;

  -- Validar dados obrigatórios
  IF NEW.valor IS NULL OR NEW.valor <= 0 OR NEW.numero_documento IS NULL OR NEW.criado_por IS NULL THEN
    RETURN NEW;
  END IF;

  -- Verificar se já existe registro em bank_reconciliations
  IF NOT EXISTS (
    SELECT 1 FROM public.bank_reconciliations
    WHERE reference_type = 'controle_bancario'
    AND reference_id::text = NEW.id::text
  ) THEN
    -- Buscar aircraft_id se houver aeronave_registro
    DECLARE
      v_aircraft_id uuid;
    BEGIN
      IF NEW.aeronave_registro IS NOT NULL THEN
        SELECT id INTO v_aircraft_id
        FROM public.aircraft
        WHERE registration = NEW.aeronave_registro
        LIMIT 1;
      ELSIF NEW.aeronave_id IS NOT NULL THEN
        v_aircraft_id := NEW.aeronave_id;
      END IF;

      -- Inserir em bank_reconciliations
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
        prazo_pagamento,
        forma_pagamento,
        afeta_caixa_empresa,
        criado_por,
        partner_name,
        comprovante_url,
        nf_url,
        boleto_url,
        reference_type,
        reference_id,
        created_at,
        updated_at
      ) VALUES (
        'cliente',
        NEW.data,
        NEW.descricao,
        NEW.valor,
        CASE
          WHEN NEW.status = 'confirmado' THEN 'recebido'
          WHEN NEW.status = 'pendente' THEN 'pendente'
          WHEN NEW.status = 'inadimplente' THEN 'pendente'
          ELSE NEW.status
        END,
        NEW.client_id,
        v_aircraft_id,
        NEW.categoria_id,
        'recibo',
        NEW.numero_documento,
        NEW.data_vencimento,
        'empresa_paga',
        true,
        NEW.criado_por,
        NEW.partner_name,
        NEW.comprovante_url,
        NEW.nf_url,
        NEW.boleto_url,
        'controle_bancario',
        NEW.id,
        NEW.data_criacao,
        CURRENT_TIMESTAMP
      );
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na inserção em controle_bancario
DROP TRIGGER IF EXISTS trigger_create_bank_reconciliation_from_controle_bancario ON public.controle_bancario;
CREATE TRIGGER trigger_create_bank_reconciliation_from_controle_bancario
AFTER INSERT ON public.controle_bancario
FOR EACH ROW
EXECUTE FUNCTION create_bank_reconciliation_from_controle_bancario();

-- =====================================================
-- TRIGGER: Atualizar Bank Reconciliations quando Controle Bancário é atualizado
-- =====================================================

CREATE OR REPLACE FUNCTION update_bank_reconciliation_from_controle_bancario()
RETURNS TRIGGER AS $$
BEGIN
  -- Apenas processar entradas
  IF NEW.tipo_movimento != 'entrada' THEN
    RETURN NEW;
  END IF;

  -- Apenas atualizar se o registro existe em bank_reconciliations
  IF EXISTS (
    SELECT 1 FROM public.bank_reconciliations
    WHERE reference_type = 'controle_bancario'
    AND reference_id::text = NEW.id::text
  ) THEN
    UPDATE public.bank_reconciliations
    SET
      description = NEW.descricao,
      amount = NEW.valor,
      status = CASE
        WHEN NEW.status = 'confirmado' THEN 'recebido'
        WHEN NEW.status = 'pendente' THEN 'pendente'
        WHEN NEW.status = 'inadimplente' THEN 'pendente'
        ELSE NEW.status
      END,
      prazo_pagamento = NEW.data_vencimento,
      partner_name = NEW.partner_name,
      comprovante_url = NEW.comprovante_url,
      nf_url = NEW.nf_url,
      boleto_url = NEW.boleto_url,
      updated_at = CURRENT_TIMESTAMP
    WHERE reference_type = 'controle_bancario'
    AND reference_id::text = NEW.id::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger na atualização em controle_bancario
DROP TRIGGER IF EXISTS trigger_update_bank_reconciliation_from_controle_bancario ON public.controle_bancario;
CREATE TRIGGER trigger_update_bank_reconciliation_from_controle_bancario
AFTER UPDATE ON public.controle_bancario
FOR EACH ROW
EXECUTE FUNCTION update_bank_reconciliation_from_controle_bancario();
