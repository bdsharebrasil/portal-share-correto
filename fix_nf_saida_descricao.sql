-- =====================================================
-- CORREÇÃO: Incluir campo descricao nas funções de sincronização
-- =====================================================
-- Este script corrige o problema onde a descrição digitada 
-- não estava sendo sincronizada para controle_bancario, 
-- bank_reconciliations e contas_areceber

-- =====================================================
-- PASSO 1: Função de INSERT em cascata (CORRIGIDA)
-- =====================================================
CREATE OR REPLACE FUNCTION public.nf_saida_insert_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_categoria_id UUID;
  v_grupo_categoria TEXT;
  v_controle_bancario_id UUID;
  v_descricao TEXT;
BEGIN
  -- Só processar se status for pendente ou recebido
  IF NEW.status NOT IN ('pendente', 'recebido') THEN
    RETURN NEW;
  END IF;

  -- Montar descrição (CORRIGIDO: agora usa NEW.descricao se preenchido)
  v_descricao := COALESCE(NEW.descricao, 'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome);
  IF NEW.aeronave IS NOT NULL AND NEW.aeronave != '' THEN
    v_descricao := v_descricao || ' (' || NEW.aeronave || ')';
  END IF;

  -- Buscar categoria_id pelo nome
  SELECT id, grupo_categoria INTO v_categoria_id, v_grupo_categoria
  FROM public.categorias_movimentacao
  WHERE nome = NEW.categoria
  LIMIT 1;

  -- Fallback para categoria padrão se não encontrar
  IF v_categoria_id IS NULL THEN
    SELECT id, grupo_categoria INTO v_categoria_id, v_grupo_categoria
    FROM public.categorias_movimentacao
    WHERE tipo = 'receita'
    LIMIT 1;
  END IF;

  -- =============================================
  -- 1) INSERIR EM controle_bancario
  -- =============================================
  INSERT INTO public.controle_bancario (
    data,
    data_vencimento,
    tipo_movimento,
    categoria_id,
    descricao,
    valor,
    numero_documento,
    status,
    client_id,
    client_name,
    aeronave_id,
    aeronave_registro,
    nf_url,
    criado_por,
    grupo_categoria
  ) VALUES (
    NEW.data_criacao,                                          -- date
    NEW.data_vencimento,                                       -- date
    'entrada',                                                 -- varchar
    v_categoria_id,                                            -- uuid
    v_descricao,                                               -- text
    NEW.valor,                                                 -- numeric
    NEW.numero,                                                -- varchar
    CASE WHEN NEW.status = 'recebido' THEN 'confirmado' ELSE 'pendente' END, -- text
    NEW.client_id,                                             -- uuid
    NEW.cliente_nome,                                          -- text
    NEW.aircraft_id,                                           -- uuid
    NEW.aeronave,                                              -- text
    NEW.arquivo_pdf_url,                                       -- text → nf_url
    NEW.criado_por,                                            -- uuid
    COALESCE(v_grupo_categoria, 'RECEITAS OPERACIONAIS')       -- text
  )
  RETURNING id INTO v_controle_bancario_id;

  -- =============================================
  -- 2) INSERIR EM bank_reconciliations
  -- =============================================
  INSERT INTO public.bank_reconciliations (
    type,
    date,
    description,
    amount,
    status,
    client_id,
    aircraft_id,
    category,
    criado_por,
    reference_type,
    reference_id,
    prazo_pagamento,
    tipo_documento,
    doc,
    forma_pagamento,
    nf_url,
    controle_bancario_id,
    partner_name
  ) VALUES (
    'cliente',                                                 -- text
    NEW.data_criacao,                                          -- date
    v_descricao,                                               -- text
    NEW.valor,                                                 -- numeric
    CASE WHEN NEW.status = 'recebido' THEN 'recebido' ELSE 'pendente' END, -- text
    NEW.client_id,                                             -- uuid
    NEW.aircraft_id,                                           -- uuid
    NEW.categoria,                                             -- text
    NEW.criado_por,                                            -- uuid
    'nf_saida',                                                -- text
    NEW.id,                                                    -- uuid = uuid ✓
    NEW.data_vencimento,                                       -- date
    'nota_fiscal',                                             -- text
    NEW.numero,                                                -- text
    NULL,                                                      -- forma_pagamento = null
    NEW.arquivo_pdf_url,                                       -- text → nf_url
    v_controle_bancario_id,                                    -- uuid
    NEW.cliente_nome                                           -- text
  );

  -- =============================================
  -- 3) INSERIR EM contas_areceber
  -- =============================================
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
    nota_fiscal_url,
    fornecedor_tipo
  ) VALUES (
    NEW.numero,                                                -- varchar
    NEW.cliente_nome,                                          -- varchar
    NEW.cliente_cnpj,                                          -- varchar
    NEW.data_criacao,                                          -- date
    NEW.data_vencimento,                                       -- date
    NEW.valor,                                                 -- numeric
    NEW.categoria,                                             -- varchar
    v_descricao,                                               -- text
    NEW.status,                                                -- varchar
    NEW.aeronave,                                              -- text
    NEW.criado_por,                                            -- uuid
    NEW.arquivo_pdf_url,                                       -- varchar → nota_fiscal_url
    NULL                                                       -- fornecedor_tipo = null
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'nf_saida_insert_cascade error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- =====================================================
-- PASSO 2: Função de UPDATE em cascata (CORRIGIDA)
-- =====================================================
-- Agora também sincroniza mudanças na descrição e outros campos
CREATE OR REPLACE FUNCTION public.nf_saida_update_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_descricao TEXT;
BEGIN
  -- Montar descrição atualizada
  v_descricao := COALESCE(NEW.descricao, 'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome);
  IF NEW.aeronave IS NOT NULL AND NEW.aeronave != '' THEN
    v_descricao := v_descricao || ' (' || NEW.aeronave || ')';
  END IF;

  -- Atualizar controle_bancario (status E descricao)
  UPDATE public.controle_bancario
  SET 
    status = CASE 
      WHEN NEW.status = 'recebido' THEN 'confirmado'
      WHEN NEW.status = 'cancelado' THEN 'cancelado'
      ELSE 'pendente'
    END,
    descricao = v_descricao,
    data_atualizacao = NOW()
  WHERE numero_documento = NEW.numero
    AND tipo_movimento = 'entrada';

  -- Atualizar bank_reconciliations (status E description)
  UPDATE public.bank_reconciliations
  SET 
    status = CASE
      WHEN NEW.status = 'recebido' THEN 'recebido'
      WHEN NEW.status = 'cancelado' THEN 'cancelado'
      ELSE 'pendente'
    END,
    description = v_descricao,
    updated_at = NOW()
  WHERE reference_type = 'nf_saida'
    AND reference_id = NEW.id;

  -- Atualizar contas_areceber (status E descricao)
  UPDATE public.contas_areceber
  SET 
    status = NEW.status,
    descricao = v_descricao,
    atualizado_em = NOW()
  WHERE numero = NEW.numero;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'nf_saida_update_cascade error: % %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

-- =====================================================
-- PASSO 3: Recriar triggers (idempotente)
-- =====================================================
DROP TRIGGER IF EXISTS trigger_nf_saida_insert_cascade ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_nf_saida_insert_cascade
  AFTER INSERT ON public.notas_fiscais_saida
  FOR EACH ROW
  EXECUTE FUNCTION public.nf_saida_insert_cascade();

DROP TRIGGER IF EXISTS trigger_nf_saida_update_cascade ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_nf_saida_update_cascade
  AFTER UPDATE ON public.notas_fiscais_saida
  FOR EACH ROW
  EXECUTE FUNCTION public.nf_saida_update_cascade();
