ALTER TABLE public.aeronave
ADD COLUMN IF NOT EXISTS tipo_aeronave text
CHECK (tipo_aeronave IN ('PISTAO', 'TURBOELICE', 'JATO'));

COMMENT ON COLUMN public.aeronave.tipo_aeronave IS 'Classificação de motorização para o Simulador de Custos: PISTAO, TURBOELICE ou JATO. Define quais campos de custo de longo prazo (magneto, hélice, seção quente etc.) se aplicam ao cálculo.';