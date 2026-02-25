-- Criar função que insere no controle_bancario quando contas_apagar é marcada como paga
CREATE OR REPLACE FUNCTION insert_controle_bancario_on_pagamento()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se o status mudou para 'paga'
  IF NEW.status = 'paga' AND OLD.status != 'paga' THEN
    -- Inserir registro no controle_bancario
    INSERT INTO public.controle_bancario (
      data,
      tipo_movimento,
      categoria,
      descricao,
      valor,
      conta_banco,
      numero_documento,
      referencia,
      status,
      observacoes,
      criado_por,
      nf_url,
      data_criacao,
      criado_em
    ) VALUES (
      CURRENT_DATE,
      'saída',
      COALESCE(NEW.categoria, 'Despesa'),
      'Pagamento NF ' || NEW.numero || ' - ' || NEW.fornecedor_nome,
      NEW.valor,
      NULL, -- banco será atualizado na aplicação
      NEW.numero,
      NEW.id,
      'pago',
      NEW.observacoes,
      NEW.criado_por,
      NEW.arquivo_pdf_url,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
CREATE OR REPLACE TRIGGER trigger_contas_apagar_pagamento
AFTER UPDATE ON public.contas_apagar
FOR EACH ROW
EXECUTE FUNCTION insert_controle_bancario_on_pagamento();

-- Comentários explicativos
COMMENT ON FUNCTION insert_controle_bancario_on_pagamento() IS 'Função que insere automaticamente um registro no controle_bancario quando uma conta a pagar é marcada como paga';
COMMENT ON TRIGGER trigger_contas_apagar_pagamento ON public.contas_apagar IS 'Trigger para sincronizar contas_apagar com controle_bancario quando o status muda para paga';
