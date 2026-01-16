-- ========================================
-- INSERT OAS #75 - MANUTENÇÃO CORRETIVA
-- ========================================
-- Primeiro, insira a Ordem de Serviço principal (OAS #75)
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
  '75',
  (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
  'CORRETIVA',
  'Revisão Corretiva - Célula em 3338,1 horas - 50 horas de serviço',
  'NEW WAY',
  '50 HORAS',
  840.00,
  'concluído'
) RETURNING id as oas_75_id;

-- Obtenha o ID da OAS #75 (você vai precisar dele para os itens)
-- Substitua 'OAS_75_ID_AQUI' pelo ID retornado acima

-- ========================================
-- ITENS DE SERVIÇO OAS #75
-- ========================================
INSERT INTO service_items (service_order_id, aircraft_id, description, provider, period, value, nfse, status)
VALUES 
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'SUBSTITUIÇÃO ÂNCORA METALOPLÁSTICA DO CARTER LH/RH', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'PESQUISA DE PANE FAROL DA ASA RH (CORTESIA)', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'SUBSTITUIÇÃO DO CONECTOR DO MOTOR DE PARTIDA LH', 'NEW WAY', 'CORRETIVA', 420.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'REPARO CAVA STROBE LIGHT', 'NEW WAY', 'CORRETIVA', 420.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'INSPEÇÃO NO SISTEMA DE LUZES DA AERONAVE', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'INSPEÇÃO NO CONJUNTO DE HÉLICES LH/RH', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'INSPEÇÃO NAS RODAS E PNEUS TOP PRINCIPAL E DE NARIZ', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído'),
  
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'INSPEÇÃO NAS PÁS DA HÉLICE', 'NEW WAY', 'CORRETIVA', 0.00, 'NFE 784', 'concluído');

-- ========================================
-- PEÇAS APLICADAS OAS #75
-- ========================================
INSERT INTO service_items (service_order_id, aircraft_id, description, provider, period, value, nfse, status)
VALUES 
  ((SELECT id FROM service_orders WHERE order_number = '75' LIMIT 1), 
   (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
   'JUNTAS METALOPLÁSTICAS', 'CLÁUDIO', 'CORRETIVA', 11.52, 'NFE 52197', 'concluído');

-- ========================================
-- INSERT OAS #76 - MANUTENÇÃO PROGRAMADA
-- ========================================
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
  '76',
  (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1),
  'PROGRAMADA',
  'Revisão Programada - Célula em 3402,2 horas - 100 horas de serviço',
  'NEW WAY',
  '100 HORAS',
  0.00,
  'pendente'
);

-- ========================================
-- RESUMO DOS DADOS INSERIDOS
-- ========================================
-- OAS #75 TOTAIS:
-- - Mão de Obra: R$ 840,00
-- - Peças: R$ 11,52
-- - TOTAL: R$ 851,52
--
-- HORAS CARVALIMA: 38:29 (75,33%)
-- HORAS WATT: 09:53 (19,35%)
-- HORAS OFICINA/TESTES: 02:43 (5,32%)
-- TOTAL VOADO: 51:05

-- OAS #76 (Ainda em andamento)
-- - Tipo: PROGRAMADA
-- - Período: 100 HORAS
-- - Status: PENDENTE
-- - Horas até 10/12/2025:
--   - CARVALIMA: 34:56 (56,25%)
--   - WATT: 27:10 (43,75%)
--   - TOTAL: 62:06

-- Para verificar os dados inseridos:
-- SELECT * FROM service_orders WHERE aircraft_id = (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1);
-- SELECT * FROM service_items WHERE aircraft_id = (SELECT id FROM aircraft WHERE registration = 'PR-MDL' LIMIT 1);
