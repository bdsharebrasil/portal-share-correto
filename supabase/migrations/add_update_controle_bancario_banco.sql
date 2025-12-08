-- Função para atualizar o banco no controle_bancario quando o pagamento é marcado como pago
CREATE OR REPLACE FUNCTION update_controle_bancario_banco(
  p_conta_apagar_id uuid,
  p_conta_banco text
)
RETURNS TABLE (success boolean, message text) AS $$
DECLARE
  v_found boolean;
BEGIN
  -- Verificar se existe registro no controle_bancario com essa referência
  SELECT EXISTS (
    SELECT 1 FROM public.controle_bancario
    WHERE referencia = p_conta_apagar_id::text
  ) INTO v_found;
  
  IF v_found THEN
    -- Atualizar o banco no controle_bancario
    UPDATE public.controle_bancario
    SET 
      conta_banco = p_conta_banco,
      atualizado_em = CURRENT_TIMESTAMP
    WHERE referencia = p_conta_apagar_id::text;
    
    RETURN QUERY SELECT true, 'Banco atualizado com sucesso no controle bancário'::text;
  ELSE
    RETURN QUERY SELECT false, 'Nenhum registro encontrado no controle bancário para esta conta'::text;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentário
COMMENT ON FUNCTION update_controle_bancario_banco(uuid, text) IS 'Função para atualizar o banco no controle_bancario quando um pagamento é marcado como pago com seleção de banco';

-- View para visualizar contas a pagar com seu status no controle bancário
CREATE OR REPLACE VIEW vw_contas_apagar_com_fluxo AS
SELECT 
  ca.id,
  ca.numero,
  ca.fornecedor_nome,
  ca.fornecedor_cnpj,
  ca.data_recebimento,
  ca.data_vencimento,
  ca.valor,
  ca.categoria,
  ca.descricao,
  ca.status as status_conta_apagar,
  ca.metodo_pagamento,
  ca.arquivo_pdf_url,
  ca.observacoes,
  ca.criado_em,
  cb.id as fluxo_id,
  cb.conta_banco,
  cb.status as status_fluxo,
  cb.criado_em as fluxo_criado_em
FROM public.contas_apagar ca
LEFT JOIN public.controle_bancario cb ON cb.referencia = ca.id::text
ORDER BY ca.data_vencimento DESC;

-- Comentário
COMMENT ON VIEW vw_contas_apagar_com_fluxo IS 'View que mostra contas a pagar com seus registros correspondentes no controle bancário';
