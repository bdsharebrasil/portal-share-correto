-- Create function to handle notas_fiscais_saida status change
CREATE OR REPLACE FUNCTION handle_nf_saida_recebida()
RETURNS TRIGGER AS $$
DECLARE
  v_banco_id uuid;
BEGIN
  -- Only process when status changes to 'recebido'
  IF NEW.status = 'recebido' AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- Check if a controle_bancario entry already exists for this NF
    IF NOT EXISTS (
      SELECT 1 FROM controle_bancario 
      WHERE referencia = 'nf_saida_' || NEW.id
    ) THEN
      -- Insert entry into controle_bancario
      INSERT INTO controle_bancario (
        descricao,
        valor,
        data,
        tipo_movimento,
        categoria,
        status,
        numero_documento,
        referencia,
        criado_por,
        conta_banco,
        criado_em,
        atualizado_em
      ) VALUES (
        'NF Saída ' || NEW.numero || ' - ' || NEW.cliente_nome,
        NEW.valor,
        CURRENT_DATE,
        'entrada',
        NEW.categoria,
        'recebido',
        NEW.numero,
        'nf_saida_' || NEW.id,
        NEW.criado_por,
        NULL, -- conta_banco will be set by the user in the dialog
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_nf_saida_recebida ON notas_fiscais_saida;
CREATE TRIGGER trigger_nf_saida_recebida
AFTER UPDATE ON notas_fiscais_saida
FOR EACH ROW
EXECUTE FUNCTION handle_nf_saida_recebida();

-- Alternative: If you want to update the conta_banco field AFTER insertion from the application
-- Create a function to update the controle_bancario with the selected bank
CREATE OR REPLACE FUNCTION update_controle_bancario_with_bank(
  p_nf_saida_id uuid,
  p_banco text
)
RETURNS void AS $$
BEGIN
  UPDATE controle_bancario
  SET conta_banco = p_banco, atualizado_em = CURRENT_TIMESTAMP
  WHERE referencia = 'nf_saida_' || p_nf_saida_id;
END;
$$ LANGUAGE plpgsql;
