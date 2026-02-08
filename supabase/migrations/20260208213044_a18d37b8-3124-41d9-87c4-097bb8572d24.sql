
-- Atualizar a constraint para permitir aircraft_id NULL para type='cliente'
-- A aeronave não é obrigatória em notas fiscais de saída

ALTER TABLE public.bank_reconciliations 
DROP CONSTRAINT IF EXISTS cliente_fields_required;

ALTER TABLE public.bank_reconciliations
ADD CONSTRAINT cliente_fields_required 
CHECK (
  (type <> 'cliente') OR 
  (client_id IS NOT NULL AND category IS NOT NULL)
);

COMMENT ON CONSTRAINT cliente_fields_required ON public.bank_reconciliations IS 
'Para type=cliente, client_id e category são obrigatórios. aircraft_id é opcional.';
