
-- Tornar aeronave nullable
ALTER TABLE contas_apagar ALTER COLUMN aeronave DROP NOT NULL;
ALTER TABLE contas_apagar ALTER COLUMN aeronave SET DEFAULT '';

-- Novos campos de referência
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id);
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS client_partner_id uuid REFERENCES client_partners(id);
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS fornecedor_favorito_id uuid REFERENCES fornecedores_favoritos(id);
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS conta_pagamento_fornecedor text;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS aeronave_id uuid REFERENCES aircraft(id);
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS aeronave_registro text;

-- Boleto
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS possui_boleto boolean DEFAULT false;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS boleto_url text;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS data_recebimento_boleto date;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS data_prazo_pagamento date;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS codigo_barras text;

-- Nota Fiscal
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS possui_nf boolean DEFAULT false;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS nf_numero text;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS nf_url text;

-- DECEA/Infraero (reembolsáveis)
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS numero_documento_decea text;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS competencia_decea text;

-- Impostos
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS periodo_apuracao text;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS documento_url text;

-- Pagamento
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS data_pagamento date;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS comprovante_pagamento_url text;
ALTER TABLE contas_apagar ADD COLUMN IF NOT EXISTS banco_pagamento text;
