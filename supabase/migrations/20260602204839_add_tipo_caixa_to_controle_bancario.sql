-- ============================================================
-- Adicionar campo tipo_caixa na tabela controle_bancario
-- Distinguir entre caixa Share Brasil (padrão) e caixa do Cliente/Holding
-- ============================================================

-- 1) Adicionar coluna tipo_caixa com default 'share'
ALTER TABLE public.controle_bancario
  ADD COLUMN IF NOT EXISTS tipo_caixa text DEFAULT 'share';

-- 2) Adicionar constraint para valores válidos
ALTER TABLE public.controle_bancario
  ADD CONSTRAINT check_tipo_caixa_values 
  CHECK (tipo_caixa IN ('share', 'cliente'))
  NOT VALID;

-- 3) Validar a constraint (sem bloquear inserts existentes)
ALTER TABLE public.controle_bancario VALIDATE CONSTRAINT check_tipo_caixa_values;

-- 4) Comentário descritivo
COMMENT ON COLUMN public.controle_bancario.tipo_caixa IS
  'Tipo de caixa do lançamento. Valores: "share" (Caixa Share Brasil) ou "cliente" (Caixa do Cliente/Holding). Default: "share".';

-- 5) Índice para busca rápida por tipo de caixa
CREATE INDEX IF NOT EXISTS idx_controle_bancario_tipo_caixa
  ON public.controle_bancario (tipo_caixa);
