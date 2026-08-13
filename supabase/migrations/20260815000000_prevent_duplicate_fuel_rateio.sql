CREATE OR REPLACE FUNCTION public.sync_rateio_from_abastecimento()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.rateio_despesas
    WHERE abastecimento_id = NEW.id
  ) THEN
    INSERT INTO public.rateio_despesas (
      despesa_id,
      fonte_despesa,
      tipo_rateio,
      fluxo,
      data_emissao,
      data_vencimento,
      data_pagamento,
      fornecedor_nome,
      cliente_id,
      aeronave_id,
      percentual_uso,
      descricao_despesa,
      periodicidade,
      valor_total,
      valor_rateado,
      status,
      forma_pagamento,
      numero_nf,
      boleto_url,
      nf_url,
      comprovante_url,
      abastecimento_id
    ) VALUES (
      NEW.id,
      'abastecimento',
      'VARIAVEL_POR_VOO',
      'SAIDA',
      NEW.data,
      COALESCE(NEW.data_vencimento_boleto, NEW.data),
      NEW.data_pagamento,
      NEW.abastecedor,
      NEW.id_clientes,
      NEW.aeronave_id,
      100,
      COALESCE(NULLIF(NEW.descricao, ''), CONCAT('Abastecimento ', NEW.trecho)),
      'EVENTUAL',
      NEW.valor_total,
      NEW.valor_total,
      CASE WHEN LOWER(COALESCE(NEW.status, '')) = 'pago' THEN 'PAGO' ELSE 'PENDENTE' END,
      NEW.forma_pagamento,
      NEW.nf,
      NEW.boleto_url,
      NEW.nota_url,
      COALESCE(NEW.comprovante_url, NEW.comprovante_pagamento),
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;
