-- Adicionar coluna client_partner_id à tabela controle_bancario
ALTER TABLE controle_bancario ADD COLUMN IF NOT EXISTS client_partner_id uuid REFERENCES client_partners(id);
