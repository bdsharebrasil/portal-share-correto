
-- Remove restrição antiga que limita grupo_custo a FIXO/VARIAVEL/EXTRA
ALTER TABLE public.movimentacoes DROP CONSTRAINT IF EXISTS mov_grupo_custo_check;

-- Drop dependent view
DROP VIEW IF EXISTS public.vw_rateio_cotistas;

-- 1) Remove categoria_id
ALTER TABLE public.rateio_despesas DROP COLUMN IF EXISTS categoria_id;

-- 2) Converter categoria_custo (text) em FK para expense_configu(id)
ALTER TABLE public.rateio_despesas ADD COLUMN IF NOT EXISTS categoria_custo_id uuid;

UPDATE public.rateio_despesas rd
   SET categoria_custo_id = ec.id
  FROM public.expense_configu ec
 WHERE trim(rd.categoria_custo) ILIKE trim(ec.expense_type)
   AND rd.categoria_custo_id IS NULL;

ALTER TABLE public.rateio_despesas DROP COLUMN categoria_custo;
ALTER TABLE public.rateio_despesas RENAME COLUMN categoria_custo_id TO categoria_custo;

ALTER TABLE public.rateio_despesas
  ADD CONSTRAINT rateio_despesas_categoria_custo_fkey
  FOREIGN KEY (categoria_custo) REFERENCES public.expense_configu(id) ON DELETE SET NULL;

-- Recreate view
CREATE OR REPLACE VIEW public.vw_rateio_cotistas AS
SELECT rd.aeronave_id,
       rd.cliente_id,
       rd.socio_id,
       COALESCE(rd.clientes_nome, rd.socios_nome, 'Sem identificação'::text) AS cotista_nome,
       date_trunc('month', COALESCE(rd.data_vencimento, rd.data_pagamento, rd.criado_em::date)::timestamptz)::date AS mes_referencia,
       to_char(COALESCE(rd.data_vencimento, rd.data_pagamento, rd.criado_em::date)::timestamptz, 'MM/YYYY') AS mes_ano,
       rd.categoria_custo,
       ec.expense_type AS categoria_custo_nome,
       rd.tipo_rateio,
       sum(COALESCE(rd.valor_rateado, 0)) AS total_devido,
       sum(COALESCE(rd.valor_pago_real, 0)) AS total_pago,
       sum(COALESCE(rd.valor_pago_real, 0)) - sum(COALESCE(rd.valor_rateado, 0)) AS saldo
  FROM public.rateio_despesas rd
  LEFT JOIN public.expense_configu ec ON ec.id = rd.categoria_custo
 GROUP BY rd.aeronave_id, rd.cliente_id, rd.socio_id,
          COALESCE(rd.clientes_nome, rd.socios_nome, 'Sem identificação'::text),
          date_trunc('month', COALESCE(rd.data_vencimento, rd.data_pagamento, rd.criado_em::date)::timestamptz)::date,
          to_char(COALESCE(rd.data_vencimento, rd.data_pagamento, rd.criado_em::date)::timestamptz, 'MM/YYYY'),
          rd.categoria_custo, ec.expense_type, rd.tipo_rateio;

-- 3) Trigger populate refs
CREATE OR REPLACE FUNCTION public.rateio_despesas_populate_refs()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL THEN
    SELECT COALESCE(razao_social, proprietario) INTO NEW.clientes_nome
      FROM public.clientes WHERE id = NEW.cliente_id;
  ELSE
    NEW.clientes_nome := NULL;
  END IF;

  IF NEW.socio_id IS NOT NULL THEN
    SELECT nome INTO NEW.socios_nome FROM public.socios WHERE id = NEW.socio_id;
  ELSE
    NEW.socios_nome := NULL;
  END IF;

  IF NEW.aeronave_id IS NOT NULL THEN
    SELECT matricula INTO NEW.aeronave_registro FROM public.aeronave WHERE id = NEW.aeronave_id;
  ELSE
    NEW.aeronave_registro := NULL;
  END IF;

  IF NEW.socio_id IS NOT NULL AND NEW.aeronave_id IS NOT NULL THEN
    SELECT percentual_sociedade INTO NEW.percentual_sociedade
      FROM public.cotistas_aeronave
     WHERE socios_id = NEW.socio_id AND id_aeronave = NEW.aeronave_id
     LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rateio_despesas_populate_refs ON public.rateio_despesas;
CREATE TRIGGER trg_rateio_despesas_populate_refs
BEFORE INSERT OR UPDATE OF cliente_id, socio_id, aeronave_id
ON public.rateio_despesas
FOR EACH ROW EXECUTE FUNCTION public.rateio_despesas_populate_refs();

-- Backfill nomes/registro/percentual
UPDATE public.rateio_despesas rd
   SET clientes_nome = COALESCE(c.razao_social, c.proprietario)
  FROM public.clientes c
 WHERE rd.cliente_id = c.id;

UPDATE public.rateio_despesas rd
   SET socios_nome = s.nome
  FROM public.socios s
 WHERE rd.socio_id = s.id;

UPDATE public.rateio_despesas rd
   SET aeronave_registro = a.matricula
  FROM public.aeronave a
 WHERE rd.aeronave_id = a.id;

UPDATE public.rateio_despesas rd
   SET percentual_sociedade = ca.percentual_sociedade
  FROM public.cotistas_aeronave ca
 WHERE rd.socio_id = ca.socios_id AND rd.aeronave_id = ca.id_aeronave;

-- 4) Sync movimentacoes.grupo_custo <-> rateio_despesas.tipo_rateio
CREATE OR REPLACE FUNCTION public.movimentacoes_sync_grupo_custo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_rateio text;
BEGIN
  SELECT tipo_rateio INTO v_tipo_rateio
    FROM public.rateio_despesas
   WHERE despesa_id = NEW.id
   LIMIT 1;
  IF v_tipo_rateio IS NOT NULL THEN
    NEW.grupo_custo := v_tipo_rateio;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movimentacoes_sync_grupo_custo ON public.movimentacoes;
CREATE TRIGGER trg_movimentacoes_sync_grupo_custo
BEFORE INSERT OR UPDATE ON public.movimentacoes
FOR EACH ROW EXECUTE FUNCTION public.movimentacoes_sync_grupo_custo();

CREATE OR REPLACE FUNCTION public.rateio_despesas_sync_movimentacao_grupo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.despesa_id IS NOT NULL AND NEW.tipo_rateio IS NOT NULL THEN
    UPDATE public.movimentacoes
       SET grupo_custo = NEW.tipo_rateio
     WHERE id = NEW.despesa_id
       AND (grupo_custo IS DISTINCT FROM NEW.tipo_rateio);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rateio_despesas_sync_mov_grupo ON public.rateio_despesas;
CREATE TRIGGER trg_rateio_despesas_sync_mov_grupo
AFTER INSERT OR UPDATE OF tipo_rateio, despesa_id
ON public.rateio_despesas
FOR EACH ROW EXECUTE FUNCTION public.rateio_despesas_sync_movimentacao_grupo();

UPDATE public.movimentacoes m
   SET grupo_custo = rd.tipo_rateio
  FROM public.rateio_despesas rd
 WHERE rd.despesa_id = m.id
   AND rd.tipo_rateio IS NOT NULL
   AND (m.grupo_custo IS DISTINCT FROM rd.tipo_rateio);
