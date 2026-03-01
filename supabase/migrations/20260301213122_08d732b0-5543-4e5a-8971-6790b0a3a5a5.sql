CREATE OR REPLACE FUNCTION public.auto_create_contas_from_bank_reconciliation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_numero TEXT;
  v_cliente_nome TEXT;
  v_cliente_cnpj TEXT;
  v_fornecedor_nome TEXT;
  v_fornecedor_cnpj TEXT;
BEGIN
  IF TG_OP != 'INSERT' THEN
    RETURN NEW;
  END IF;

  v_numero := 'BR-' || SUBSTRING(NEW.id::text, 1, 8);

  IF NEW.type = 'cliente' AND NEW.client_id IS NOT NULL THEN
    SELECT COALESCE(company_name, 'Cliente'), COALESCE(cnpj, '')
    INTO v_cliente_nome, v_cliente_cnpj
    FROM clients WHERE id = NEW.client_id;

    INSERT INTO contas_areceber (
      numero, cliente_nome, cliente_cnpj, categoria, valor,
      data_criacao, data_vencimento, status, descricao,
      aeronave, banco_conciliacao_id, criado_por,
      reference_id, reference_type,
      boleto_url, nota_fiscal_url
    ) VALUES (
      v_numero,
      COALESCE(v_cliente_nome, 'Cliente'),
      COALESCE(v_cliente_cnpj, ''),
      COALESCE(NEW.category, 'Receita'),
      NEW.amount,
      COALESCE(NEW.date, CURRENT_DATE),
      COALESCE(NEW.prazo_pagamento, NEW.date, CURRENT_DATE),
      'pendente',
      NEW.description,
      (SELECT registration FROM aircraft WHERE id = NEW.aircraft_id LIMIT 1),
      NEW.id,
      NEW.criado_por,
      NEW.id::text,
      'bank_reconciliation',
      NEW.boleto_url,
      NEW.nf_url
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF NEW.type = 'colaborador' THEN
    v_fornecedor_nome := COALESCE(NEW.fornecedor_nome, NEW.colaborador, 'Colaborador');
    v_fornecedor_cnpj := COALESCE(
      (NEW.fornecedor_dados->>'documento')::text,
      ''
    );

    INSERT INTO contas_apagar (
      numero, fornecedor_nome, fornecedor_cnpj, categoria, valor,
      data_recebimento, data_vencimento, status, descricao,
      criado_por, client_id, aeronave_id,
      boleto_url, nf_url
    ) VALUES (
      v_numero,
      v_fornecedor_nome,
      v_fornecedor_cnpj,
      COALESCE(NEW.category, 'Despesa'),
      NEW.amount,
      COALESCE(NEW.date, CURRENT_DATE),
      COALESCE(NEW.prazo_pagamento, NEW.date, CURRENT_DATE),
      'pendente',
      NEW.description,
      NEW.criado_por,
      NEW.client_id,
      NEW.aircraft_id,
      NEW.boleto_url,
      NEW.nf_url
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;