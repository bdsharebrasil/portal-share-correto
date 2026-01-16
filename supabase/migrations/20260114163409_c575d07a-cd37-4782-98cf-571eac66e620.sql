-- Adicionar campo partner_name para armazenar o nome do sócio no voo
ALTER TABLE public.logbook_entries 
ADD COLUMN IF NOT EXISTS partner_name TEXT;