-- Criar tabela de horas mensais consolidadas
CREATE TABLE IF NOT EXISTS public.horas_mensais_consolidadas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  aeronave_id uuid NOT NULL,
  aeronave_registro character varying(20) NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL,
  data_referencia date NOT NULL,
  horas_voadas numeric(10, 2) NOT NULL DEFAULT 0,
  horas_totais_aeronave numeric(10, 2) NOT NULL,
  percentual_uso numeric(5, 2) NOT NULL,
  fonte_diario_bordo boolean NULL DEFAULT true,
  fonte_portal_cliente boolean NULL DEFAULT false,
  validado boolean NULL DEFAULT false,
  validado_por uuid NULL,
  validado_em timestamp with time zone NULL,
  criado_em timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp with time zone NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT horas_mensais_consolidadas_pkey PRIMARY KEY (id),
  CONSTRAINT horas_mensais_unique UNIQUE (cliente_id, aeronave_id, ano, mes),
  CONSTRAINT horas_positivas_check CHECK ((horas_voadas >= (0)::numeric)),
  CONSTRAINT mes_valido CHECK (
    (
      (mes >= 1)
      AND (mes <= 12)
    )
  ),
  CONSTRAINT percentual_valido CHECK (
    (
      (percentual_uso >= (0)::numeric)
      AND (percentual_uso <= (100)::numeric)
    )
  )
) TABLESPACE pg_default;

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_horas_mensais_cliente ON public.horas_mensais_consolidadas USING btree (cliente_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_horas_mensais_aeronave ON public.horas_mensais_consolidadas USING btree (aeronave_id) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_horas_mensais_periodo ON public.horas_mensais_consolidadas USING btree (ano, mes) TABLESPACE pg_default;
CREATE INDEX IF NOT EXISTS idx_horas_mensais_validado ON public.horas_mensais_consolidadas USING btree (validado) TABLESPACE pg_default;

-- Função para consolidar horas mensais a partir de logbook_entries
CREATE OR REPLACE FUNCTION public.consolidar_horas_mensais()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registro RECORD;
  v_horas_totais_aeronave NUMERIC;
  v_percentual NUMERIC;
BEGIN
  -- Limpar dados existentes para recalcular
  DELETE FROM horas_mensais_consolidadas;
  
  -- Inserir dados consolidados
  FOR registro IN
    SELECT 
      le.client_id,
      le.aircraft_id,
      COALESCE(a.registration, 'N/A') as registration,
      EXTRACT(YEAR FROM le.entry_date)::INTEGER as ano,
      EXTRACT(MONTH FROM le.entry_date)::INTEGER as mes,
      DATE_TRUNC('month', le.entry_date)::DATE as data_mes,
      SUM(COALESCE(le.total_time, 0)) as horas_voadas
    FROM logbook_entries le
    LEFT JOIN aircraft a ON le.aircraft_id = a.id
    WHERE le.client_id IS NOT NULL
      AND le.aircraft_id IS NOT NULL
    GROUP BY le.client_id, le.aircraft_id, a.registration,
             EXTRACT(YEAR FROM le.entry_date), 
             EXTRACT(MONTH FROM le.entry_date),
             DATE_TRUNC('month', le.entry_date)
  LOOP
    -- Calcular total de horas da aeronave no mês
    SELECT COALESCE(SUM(total_time), 0) INTO v_horas_totais_aeronave
    FROM logbook_entries
    WHERE aircraft_id = registro.aircraft_id
      AND EXTRACT(YEAR FROM entry_date) = registro.ano
      AND EXTRACT(MONTH FROM entry_date) = registro.mes;
    
    -- Calcular percentual de uso
    IF v_horas_totais_aeronave > 0 THEN
      v_percentual := (registro.horas_voadas / v_horas_totais_aeronave) * 100;
    ELSE
      v_percentual := 0;
    END IF;
    
    -- Inserir na tabela de consolidação
    INSERT INTO horas_mensais_consolidadas (
      cliente_id,
      aeronave_id,
      aeronave_registro,
      ano,
      mes,
      data_referencia,
      horas_voadas,
      horas_totais_aeronave,
      percentual_uso,
      criado_em,
      atualizado_em
    ) VALUES (
      registro.client_id,
      registro.aircraft_id,
      registro.registration,
      registro.ano,
      registro.mes,
      registro.data_mes,
      registro.horas_voadas,
      v_horas_totais_aeronave,
      v_percentual,
      NOW(),
      NOW()
    )
    ON CONFLICT (cliente_id, aeronave_id, ano, mes) DO UPDATE SET
      horas_voadas = EXCLUDED.horas_voadas,
      horas_totais_aeronave = EXCLUDED.horas_totais_aeronave,
      percentual_uso = EXCLUDED.percentual_uso,
      atualizado_em = NOW();
  END LOOP;
END;
$$;

-- Função para consolidar um mês específico (para trigger)
CREATE OR REPLACE FUNCTION public.consolidar_horas_mes_especifico(
  p_aircraft_id UUID,
  p_ano INTEGER,
  p_mes INTEGER
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  registro RECORD;
  v_horas_totais_aeronave NUMERIC;
  v_percentual NUMERIC;
  v_aeronave_registro VARCHAR;
BEGIN
  -- Buscar registro da aeronave
  SELECT COALESCE(registration, 'N/A') INTO v_aeronave_registro
  FROM aircraft
  WHERE id = p_aircraft_id;

  -- Calcular total de horas da aeronave no mês
  SELECT COALESCE(SUM(total_time), 0) INTO v_horas_totais_aeronave
  FROM logbook_entries
  WHERE aircraft_id = p_aircraft_id
    AND EXTRACT(YEAR FROM entry_date) = p_ano
    AND EXTRACT(MONTH FROM entry_date) = p_mes;

  -- Deletar registros existentes para esse mês/aeronave
  DELETE FROM horas_mensais_consolidadas
  WHERE aircraft_id = p_aircraft_id
    AND ano = p_ano
    AND mes = p_mes;

  -- Inserir novos registros consolidados
  FOR registro IN
    SELECT 
      le.client_id,
      le.aircraft_id,
      SUM(COALESCE(le.total_time, 0)) as horas_voadas
    FROM logbook_entries le
    WHERE le.aircraft_id = p_aircraft_id
      AND EXTRACT(YEAR FROM le.entry_date) = p_ano
      AND EXTRACT(MONTH FROM le.entry_date) = p_mes
      AND le.client_id IS NOT NULL
    GROUP BY le.client_id, le.aircraft_id
  LOOP
    -- Calcular percentual de uso
    IF v_horas_totais_aeronave > 0 THEN
      v_percentual := (registro.horas_voadas / v_horas_totais_aeronave) * 100;
    ELSE
      v_percentual := 0;
    END IF;
    
    INSERT INTO horas_mensais_consolidadas (
      cliente_id,
      aeronave_id,
      aeronave_registro,
      ano,
      mes,
      data_referencia,
      horas_voadas,
      horas_totais_aeronave,
      percentual_uso,
      criado_em,
      atualizado_em
    ) VALUES (
      registro.client_id,
      registro.aircraft_id,
      v_aeronave_registro,
      p_ano,
      p_mes,
      DATE_TRUNC('month', MAKE_DATE(p_ano, p_mes, 1))::DATE,
      registro.horas_voadas,
      v_horas_totais_aeronave,
      v_percentual,
      NOW(),
      NOW()
    )
    ON CONFLICT (cliente_id, aeronave_id, ano, mes) DO UPDATE SET
      horas_voadas = EXCLUDED.horas_voadas,
      horas_totais_aeronave = EXCLUDED.horas_totais_aeronave,
      percentual_uso = EXCLUDED.percentual_uso,
      atualizado_em = NOW();
  END LOOP;
END;
$$;

-- Trigger function para atualizar consolidação automaticamente
CREATE OR REPLACE FUNCTION public.trigger_consolidar_horas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ano INTEGER;
  v_mes INTEGER;
  v_aircraft_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ano := EXTRACT(YEAR FROM OLD.entry_date)::INTEGER;
    v_mes := EXTRACT(MONTH FROM OLD.entry_date)::INTEGER;
    v_aircraft_id := OLD.aircraft_id;
  ELSE
    v_ano := EXTRACT(YEAR FROM NEW.entry_date)::INTEGER;
    v_mes := EXTRACT(MONTH FROM NEW.entry_date)::INTEGER;
    v_aircraft_id := NEW.aircraft_id;
  END IF;
  
  IF v_aircraft_id IS NOT NULL THEN
    PERFORM consolidar_horas_mes_especifico(v_aircraft_id, v_ano, v_mes);
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_consolidar_horas_logbook ON logbook_entries;
CREATE TRIGGER trigger_consolidar_horas_logbook
AFTER INSERT OR UPDATE OR DELETE ON logbook_entries
FOR EACH ROW
EXECUTE FUNCTION trigger_consolidar_horas();

-- Executar consolidação inicial para popular dados históricos
SELECT consolidar_horas_mensais();
