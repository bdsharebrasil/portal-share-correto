-- Adicionar campos de percentual de rateio por sócio na tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partner_percentage1 NUMERIC DEFAULT 33.33;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partner_percentage2 NUMERIC DEFAULT 33.33;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS partner_percentage3 NUMERIC DEFAULT 33.33;

-- Adicionar identificador de sócio na tabela abastecimentos
-- 1 = Sócio 1, 2 = Sócio 2, 3 = Sócio 3, NULL = Empresa (CNPJ geral)
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS partner_index INTEGER DEFAULT NULL;

-- Adicionar constraint para validar partner_index
ALTER TABLE abastecimentos ADD CONSTRAINT check_partner_index 
  CHECK (partner_index IS NULL OR partner_index BETWEEN 1 AND 3);

-- Comentários para documentação
COMMENT ON COLUMN clients.partner_percentage1 IS 'Percentual de rateio do sócio 1';
COMMENT ON COLUMN clients.partner_percentage2 IS 'Percentual de rateio do sócio 2';
COMMENT ON COLUMN clients.partner_percentage3 IS 'Percentual de rateio do sócio 3';
COMMENT ON COLUMN abastecimentos.partner_index IS 'Índice do sócio responsável: 1, 2, 3 ou NULL para empresa';