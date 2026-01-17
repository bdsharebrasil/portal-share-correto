-- Inserir categorias padrão de despesas de aeronaves (sem criado_por)
INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Combustível Aeronave', 'despesa', 'Abastecimento de combustível para aeronave', 'Despesas Aeronave', true, 
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Combustível Aeronave')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Taxa Infraero', 'despesa', 'Taxas de Infraero (pouso, permanência)', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Taxa Infraero')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Hangaragem', 'despesa', 'Custos de hangaragem e estadia', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Hangaragem')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Manutenção Aeronave', 'despesa', 'Custos de manutenção da aeronave', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Manutenção Aeronave')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Seguro Aeronave', 'despesa', 'Seguro da aeronave', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Seguro Aeronave')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Serviços de Rampa', 'despesa', 'Serviços de rampa em aeroportos', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Serviços de Rampa')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Taxa de Pouso', 'despesa', 'Taxa de pouso em aeroportos', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Taxa de Pouso')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Diária Hangar', 'despesa', 'Diária de hangar', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Diária Hangar')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Limpeza Aeronave', 'despesa', 'Custos de limpeza da aeronave', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Limpeza Aeronave')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);

INSERT INTO categorias_movimentacao (nome, tipo, descricao, grupo_categoria, reembolsavel, criado_por)
SELECT 'Despesa Aeronave Geral', 'despesa', 'Outras despesas gerais de aeronave', 'Despesas Aeronave', true,
  (SELECT id FROM auth.users LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM categorias_movimentacao WHERE nome = 'Despesa Aeronave Geral')
  AND EXISTS (SELECT 1 FROM auth.users LIMIT 1);