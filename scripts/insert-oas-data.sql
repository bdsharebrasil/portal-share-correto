-- Insert Service Orders OAS 75 e 76 (Aeronave PR-MDL)
-- Assumindo que existe um aircraft com registration 'PR-MDL'

-- Buscar ID da aeronave PR-MDL (você pode precisar ajustar o UUID)
-- Substitua o UUID abaixo pelo ID correto da aeronave PR-MDL

DO $$
DECLARE
  aircraft_id UUID := (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1);
BEGIN
  IF aircraft_id IS NOT NULL THEN
    -- OAS #75 - Manutenção Corretiva
    INSERT INTO service_orders (
      order_number, 
      aircraft_id, 
      service_type, 
      description, 
      supplier, 
      period, 
      value, 
      status
    ) VALUES (
      '77-2025',
      aircraft_id,
      'CORRETIVA',
      'Revisão Geral - Célula em 3338,1 horas',
      'NEW WAY',
      '50 HORAS',
      840.00,
      'concluído'
    );

    -- Itens de Serviço OAS #75
    INSERT INTO service_items (
      service_order_id, 
      aircraft_id, 
      description, 
      provider, 
      period, 
      value, 
      nfse, 
      status
    ) 
    SELECT 
      id as service_order_id,
      aircraft_id,
      description,
      provider,
      period,
      value,
      nfse,
      status
    FROM (
      VALUES 
        ('SUBSTITUIÇÃO ÂNCORA METALOPLÁSTICA DO CARTER LH/RH', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
        ('PESQUISA DE PANE FAROL DA ASA RH (CORTESIA)', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
        ('SUBSTITUIÇÃO DO CONECTOR DO MOTOR DE PARTIDA LH', 'NEW WAY', 'CORRETIVA', 420.00, 'NFE 784', 'concluído'),
        ('REPARO CAVA STROBE LIGHT', 'NEW WAY', 'CORRETIVA', 420.00, 'NFE 784', 'concluído'),
        ('INSPEÇÃO NO SISTEMA DE LUZES DA AERONAVE', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
        ('INSPEÇÃO NO CONJUNTO DE HÉLICES LH/RH', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
        ('INSPEÇÃO NAS RODAS E PNEUS TOP PRINCIPAL E DE NARIZ', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
        ('INSPEÇÃO NAS PÁS DA HÉLICE', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído')
    ) AS items(description, provider, period, value, nfse, status)
    WHERE EXISTS (
      SELECT 1 FROM service_orders 
      WHERE order_number = '77-2025' AND aircraft_id = $1
    );

    -- Peças OAS #75
    INSERT INTO service_items (
      service_order_id, 
      aircraft_id, 
      description, 
      provider, 
      period, 
      value, 
      nfse, 
      status
    ) 
    SELECT 
      id as service_order_id,
      aircraft_id,
      'JUNTAS METALOPLÁSTICAS' as description,
      'CLÁUDIO' as provider,
      'CORRETIVA' as period,
      11.52 as value,
      'NFE 52197' as nfse,
      'concluído' as status
    FROM service_orders 
    WHERE order_number = '77-2025' AND aircraft_id = $1;

    -- OAS #76 - Manutenção Programada
    INSERT INTO service_orders (
      order_number, 
      aircraft_id, 
      service_type, 
      description, 
      supplier, 
      period, 
      value, 
      status
    ) VALUES (
      '76-2025',
      aircraft_id,
      'PROGRAMADA',
      'Revisão Programada - Célula em 3402,2 horas',
      'NEW WAY',
      '100 HORAS',
      0.00,
      'pendente'
    );

    RAISE NOTICE 'Dados da OAS #75 e #76 inseridos com sucesso para a aeronave PR-MDL';
  ELSE
    RAISE EXCEPTION 'Aeronave PR-MDL não encontrada no banco de dados';
  END IF;
END $$;

-- Depois de inserir, você pode adicionar metadados em uma tabela separada para armazenar:
-- - Horas por mecânico/período
-- - Percentuais de rateio
-- - Datas de entrada/saída
-- Se tiver uma tabela de `service_order_hours`, pode inserir assim:

-- INSERT INTO service_order_hours (
--   service_order_id,
--   mechanic_name,
--   month,
--   hours
-- ) 
-- SELECT 
--   id as service_order_id,
--   mechanic,
--   month,
--   hours
-- FROM (
--   VALUES 
--     ('CARVALIMA', '06/2025', 7.933),
--     ('CARVALIMA', '07/2025', 13.767),
--     ('CARVALIMA', '08/2025', 16.783),
--     ('CARVALIMA', '09/2025', 0.0),
--     ('WATT', '06/2025', 5.783),
--     ('WATT', '07/2025', 0.0),
--     ('WATT', '08/2025', 4.1),
--     ('WATT', '09/2025', 0.0),
--     ('OFICINA/TESTES', '06/2025', 2.717),
--     ('OFICINA/TESTES', '07/2025', 0.0),
--     ('OFICINA/TESTES', '08/2025', 0.0),
--     ('OFICINA/TESTES', '09/2025', 0.0)
-- ) AS hours(mechanic, month, hours)
-- WHERE EXISTS (
--   SELECT 1 FROM service_orders 
--   WHERE order_number = '77-2025'
-- );
