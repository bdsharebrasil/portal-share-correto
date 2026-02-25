-- Create function to register banking entry when conta_receber status changes to recebido
CREATE OR REPLACE FUNCTION create_entrada_bancaria_from_conta_receber(
  p_conta_receber_id UUID,
  p_conta_banco TEXT
)
RETURNS void AS $$
DECLARE
  v_conta_receber RECORD;
BEGIN
  -- Get the contas_areceber record
  SELECT * INTO v_conta_receber 
  FROM contas_areceber 
  WHERE id = p_conta_receber_id;
  
  IF v_conta_receber IS NULL THEN
    RAISE EXCEPTION 'Conta a receber não encontrada';
  END IF;
  
  -- Insert into controle_bancario table
  INSERT INTO controle_bancario (
    data,
    tipo_movimento,
    categoria,
    descricao,
    valor,
    conta_banco,
    numero_documento,
    status,
    criado_por,
    aeronave
  ) VALUES (
    CURRENT_DATE,
    'entrada',
    v_conta_receber.categoria,
    'Recebimento - NF: ' || v_conta_receber.numero || ' - Cliente: ' || v_conta_receber.cliente_nome,
    v_conta_receber.valor,
    p_conta_banco,
    v_conta_receber.numero,
    'recebido',
    v_conta_receber.criado_por,
    v_conta_receber.aeronave
  );
END;
$$ LANGUAGE plpgsql;
