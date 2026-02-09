-- =====================================================
-- CORREÇÃO: Incluir campo descricao na função nf_saida_insert_cascade
-- =====================================================
-- Este script corrige o problema onde a descrição digitada 
-- não estava sendo sincronizada para controle_bancario

CREATE OR REPLACE FUNCTION public.nf_saida_insert_cascade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_categoria_id UUID;
  v_grupo_categoria TEXT;
  v_controle_bancario_id UUID;
  v_descricao TEXT;
  v_status_cb TEXT;
  v_status_br TEXT;
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

  -- Status mapeado
  v_status_cb := CASE WHEN NEW.status = 'recebido' THEN 'confirmado' ELSE 'pendente' END;
  v_status_br := CASE WHEN NEW.status = 'recebido' THEN 'recebido' ELSE 'pendente' END;

  -- Buscar categoria_id pelo nome
  SELECT id, grupo_categoria INTO v_categoria_id, v_grupo_categoria
  FROM public.categorias_movimentacao
  WHERE nome = NEW.categoria
  LIMIT 1;

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
    data, data_vencimento, tipo_movimento, categoria_id, descricao, valor,
    numero_documento, status, client_id, client_name, aeronave_id,
    aeronave_registro, nf_url, criado_por, grupo_categoria
  ) VALUES (
    NEW.data_criacao, NEW.data_vencimento, 'entrada', v_categoria_id,
    v_descricao, NEW.valor, NEW.numero, v_status_cb,
    NEW.client_id, NEW.cliente_nome, NEW.aircraft_id,
    NEW.aeronave, NEW.arquivo_pdf_url, NEW.criado_por,
    COALESCE(v_grupo_categoria, 'RECEITAS OPERACIONAIS')
  )
  RETURNING id INTO v_controle_bancario_id;

  -- =============================================
  -- 2) INSERIR EM bank_reconciliations
  -- =============================================
  INSERT INTO public.bank_reconciliations (
    type, date, description, amount, status, client_id, aircraft_id,
    category, criado_por, reference_type, reference_id, prazo_pagamento,
    tipo_documento, doc, forma_pagamento, nf_url,
    controle_bancario_id, partner_name
  ) VALUES (
    'cliente', NEW.data_criacao, v_descricao, NEW.valor, v_status_br,
    NEW.client_id, NEW.aircraft_id, NEW.categoria, NEW.criado_por,
    'nf_saida', NEW.id, NEW.data_vencimento,
    'nota_fiscal', NEW.numero, NULL, NEW.arquivo_pdf_url,
    v_controle_bancario_id, NEW.cliente_nome
  );

  -- =============================================
  -- 3) INSERIR EM contas_areceber
  -- =============================================
  INSERT INTO public.contas_areceber (
    numero, cliente_nome, cliente_cnpj, data_criacao, data_vencimento,
    valor, categoria, descricao, status, aeronave, criado_por,
    nota_fiscal_url, fornecedor_tipo
  ) VALUES (
    NEW.numero, NEW.cliente_nome, NEW.cliente_cnpj, NEW.data_criacao,
    NEW.data_vencimento, NEW.valor, NEW.categoria, v_descricao,
    NEW.status, NEW.aeronave, NEW.criado_por,
    NEW.arquivo_pdf_url, NULL
  );

  RETURN NEW;
END;
$$;

-- Recriar trigger (idempotente)
DROP TRIGGER IF EXISTS trigger_nf_saida_insert_cascade ON public.notas_fiscais_saida;
CREATE TRIGGER trigger_nf_saida_insert_cascade
  AFTER INSERT ON public.notas_fiscais_saida
  FOR EACH ROW
  EXECUTE FUNCTION public.nf_saida_insert_cascade();
