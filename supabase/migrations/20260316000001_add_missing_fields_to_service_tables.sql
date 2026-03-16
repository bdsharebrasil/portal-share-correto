-- Add missing fields to ctm_service_items table
ALTER TABLE ctm_service_items
ADD COLUMN IF NOT EXISTS modelo VARCHAR(255),
ADD COLUMN IF NOT EXISTS numero_serie VARCHAR(255);

-- Add missing fields to ctm_services table
ALTER TABLE ctm_services
ADD COLUMN IF NOT EXISTS p_n VARCHAR(255),
ADD COLUMN IF NOT EXISTS n_s VARCHAR(255),
ADD COLUMN IF NOT EXISTS observacoes TEXT;

-- Create index on ctm_services for fornecedor_id if not exists
CREATE INDEX IF NOT EXISTS idx_ctm_services_fornecedor_id ON ctm_services(fornecedor_id);
