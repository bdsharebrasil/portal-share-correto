ALTER TABLE public.ctm_oas_item_rateios
  ADD COLUMN IF NOT EXISTS socio_id uuid;

ALTER TABLE public.ctm_horas_voadas_rateio
  ADD COLUMN IF NOT EXISTS socio_id uuid;

COMMENT ON COLUMN public.ctm_oas_item_rateios.socio_id IS 'Sócio/cotista individual responsável pelo rateio do item.';
COMMENT ON COLUMN public.ctm_horas_voadas_rateio.socio_id IS 'Sócio/cotista individual responsável pelas horas do período.';

CREATE INDEX IF NOT EXISTS idx_ctm_oas_item_rateios_socio_id ON public.ctm_oas_item_rateios (socio_id);
CREATE INDEX IF NOT EXISTS idx_ctm_horas_voadas_rateio_socio_id ON public.ctm_horas_voadas_rateio (socio_id);
