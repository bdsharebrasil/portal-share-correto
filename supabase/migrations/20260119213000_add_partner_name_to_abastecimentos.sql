-- Adicionar coluna partner_name para armazenar o nome do sócio
ALTER TABLE abastecimentos ADD COLUMN IF NOT EXISTS partner_name TEXT DEFAULT NULL;

-- Comentário para documentação
COMMENT ON COLUMN abastecimentos.partner_name IS 'Nome do sócio responsável pelo abastecimento (quando partner_index é preenchido)';
