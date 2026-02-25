-- Função para converter DMS (Graus Minutos Segundos) para Decimal
CREATE OR REPLACE FUNCTION dms_to_decimal(dms_str TEXT) RETURNS TEXT AS $$
DECLARE
  parts TEXT[];
  degrees NUMERIC;
  minutes NUMERIC;
  seconds NUMERIC;
  lat_deg NUMERIC;
  lat_min NUMERIC;
  lat_sec NUMERIC;
  lon_deg NUMERIC;
  lon_min NUMERIC;
  lon_sec NUMERIC;
  lat_sign NUMERIC := 1;
  lon_sign NUMERIC := 1;
  latitude NUMERIC;
  longitude NUMERIC;
  lat_parts TEXT[];
  lon_parts TEXT[];
BEGIN
  -- Remover espaços extras
  dms_str := TRIM(dms_str);
  
  -- Dividir longitude e latitude (formato: "LON LAT" onde LON tem W/E e LAT tem N/S)
  -- Exemplo: "47 52 48 W 23 19 55 S"
  parts := STRING_TO_ARRAY(dms_str, ' ');
  
  IF array_length(parts, 1) < 8 THEN
    RETURN NULL;
  END IF;
  
  -- Extrair longitude (primeiros 4 valores + W/E)
  lon_deg := CAST(parts[1] AS NUMERIC);
  lon_min := CAST(parts[2] AS NUMERIC);
  lon_sec := CAST(parts[3] AS NUMERIC);
  
  IF parts[4] = 'W' THEN
    lon_sign := -1;
  ELSE
    lon_sign := 1;
  END IF;
  
  -- Extrair latitude (últimos 4 valores + N/S)
  lat_deg := CAST(parts[5] AS NUMERIC);
  lat_min := CAST(parts[6] AS NUMERIC);
  lat_sec := CAST(parts[7] AS NUMERIC);
  
  IF parts[8] = 'S' THEN
    lat_sign := -1;
  ELSE
    lat_sign := 1;
  END IF;
  
  -- Converter para decimal
  longitude := lon_sign * (lon_deg + (lon_min / 60.0) + (lon_sec / 3600.0));
  latitude := lat_sign * (lat_deg + (lat_min / 60.0) + (lat_sec / 3600.0));
  
  -- Retornar no formato "latitude,longitude"
  RETURN ROUND(latitude::NUMERIC, 4) || ',' || ROUND(longitude::NUMERIC, 4);
END;
$$ LANGUAGE plpgsql;

-- Atualizar todos os registros da tabela aerodromes
UPDATE public.aerodromes
SET coordenadas = dms_to_decimal(coordenadas),
    updated_at = NOW()
WHERE coordenadas ~ '^\d+\s+\d+\s+\d+\s+[WE]\s+\d+\s+\d+\s+\d+\s+[NS]$';

-- Verificar os resultados
SELECT designativo, name, coordenadas 
FROM public.aerodromes 
LIMIT 10;
