-- Corrigir o trigger create_bank_reconciliation_from_nf_saida
-- para incluir client_id e aircraft_id obrigatórios

CREATE OR REPLACE FUNCTION public.create_bank_reconciliation_from_nf_saida()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_categoria_id uuid := '2874b45b-a3bb-4bec-8f7e-74b328f8693c'::uuid;
  v_status_br text;
  v_client_id uuid;
  v_aircraft_id uuid;
BEGIN
  -- Validar dados obrigatórios
  IF NEW.numero IS NULL OR NEW.cliente_nome IS NULL OR NEW.valor IS NULL OR NEW.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Determinar o status em bank_reconciliations baseado no status da NF
  IF NEW.status = 'recebido' THEN
    v_status_br := 'recebido';
  ELSIF NEW.status = 'pendente' THEN
    v_status_br := 'pendente';
  ELSE
    -- Se status for "cancelado", não cria registro
    RETURN NEW;
  END IF;

  -- Buscar client_id pelo nome ou CNPJ do cliente
  SELECT id INTO v_client_id
  FROM public.clients
  WHERE company_name = NEW.cliente_nome 
     OR cnpj = NEW.cliente_cnpj
     OR proprietario = NEW.cliente_nome
  LIMIT 1;

  -- Buscar aircraft_id pelo registro da aeronave (campo 'aeronave' contém o registration)
  IF NEW.aeronave IS NOT NULL AND NEW.aeronave <> '' THEN
    SELECT id INTO v_aircraft_id
    FROM public.aircraft
    WHERE registration = NEW.aeronave
    LIMIT 1;
  END IF;

  -- Se não encontrou client_id ou aircraft_id, não insere em bank_reconciliations
  -- Isso evita violação do constraint cliente_fields_required
  IF v_client_id IS NULL OR v_aircraft_id IS NULL THEN
    -- Apenas retorna sem criar o registro em bank_reconciliations
    -- A NF será criada normalmente, mas sem espelho em bank_reconciliations
    RETURN NEW;
  END IF;

  -- Verificar se já existe registro em bank_reconciliations para esta NF
  IF NOT EXISTS (
    SELECT 1 FROM public.bank_reconciliations
    WHERE reference_type = 'nf_saida'
    AND reference_id::text = NEW.id::text
  ) THEN
    -- Inserir entrada em bank_reconciliations com todos os campos obrigatórios
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
      'NF Saída ' || COALESCE(NEW.numero, '') || ' - ' || COALESCE(NEW.cliente_nome, ''),
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
      NEW.id::text,
      NEW.arquivo_pdf_url,
      v_client_id,
      v_aircraft_id
    );
  END IF;

  RETURN NEW;
END;
$function$;

-- Recriar o trigger se não existir
DROP TRIGGER IF EXISTS trigger_create_bank_reconciliation_from_nf_saida ON public.notas_fiscais_saida;

CREATE TRIGGER trigger_create_bank_reconciliation_from_nf_saida
AFTER INSERT ON public.notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION public.create_bank_reconciliation_from_nf_saida();
