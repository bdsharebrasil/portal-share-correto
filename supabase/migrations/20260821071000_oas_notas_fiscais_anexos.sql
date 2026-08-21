ALTER TABLE public.ctm_oas_servicos
  ADD COLUMN IF NOT EXISTS nota_fiscal_path text,
  ADD COLUMN IF NOT EXISTS nota_fiscal_nome text;

ALTER TABLE public.ctm_pecas_trocadas
  ADD COLUMN IF NOT EXISTS nota_fiscal_path text,
  ADD COLUMN IF NOT EXISTS nota_fiscal_nome text;

COMMENT ON COLUMN public.ctm_oas_servicos.nota_fiscal_path IS 'Caminho do arquivo da nota fiscal do serviço no bucket oas_documentos.';
COMMENT ON COLUMN public.ctm_pecas_trocadas.nota_fiscal_path IS 'Caminho do arquivo da nota fiscal da peça no bucket oas_documentos.'; 
