-- Create ctm_service_items table for multiple items within a service
CREATE TABLE IF NOT EXISTS ctm_service_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES ctm_services(id) ON DELETE CASCADE,
  ordenacao INTEGER NOT NULL,
  descricao TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 1,
  valor_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC GENERATED ALWAYS AS (quantidade * valor_unitario) STORED,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create ctm_service_attachments table for PDF and documents
CREATE TABLE IF NOT EXISTS ctm_service_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES ctm_services(id) ON DELETE CASCADE,
  arquivo_nome TEXT NOT NULL,
  arquivo_path TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT 'pdf',
  tamanho_bytes BIGINT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by UUID
);

-- Update ctm_services table to add new fields for financial data
ALTER TABLE ctm_services
ADD COLUMN IF NOT EXISTS fornecedor_id UUID,
ADD COLUMN IF NOT EXISTS modo_pagamento VARCHAR(100),
ADD COLUMN IF NOT EXISTS dados_pagamento TEXT,
ADD COLUMN IF NOT EXISTS condicoes_pagamento VARCHAR(100),
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pendente',
ADD COLUMN IF NOT EXISTS quantidade INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS modelo VARCHAR(255),
ADD COLUMN IF NOT EXISTS quantidade_items INTEGER,
ADD COLUMN IF NOT EXISTS valor_unitario NUMERIC;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ctm_service_items_service_id ON ctm_service_items(service_id);
CREATE INDEX IF NOT EXISTS idx_ctm_service_attachments_service_id ON ctm_service_attachments(service_id);
CREATE INDEX IF NOT EXISTS idx_ctm_services_status ON ctm_services(status);

-- Create or replace the function to update timestamp
CREATE OR REPLACE FUNCTION update_ctm_service_items_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ctm_service_items
DROP TRIGGER IF EXISTS update_ctm_service_items_timestamp_trigger ON ctm_service_items;
CREATE TRIGGER update_ctm_service_items_timestamp_trigger
BEFORE UPDATE ON ctm_service_items
FOR EACH ROW
EXECUTE FUNCTION update_ctm_service_items_timestamp();
