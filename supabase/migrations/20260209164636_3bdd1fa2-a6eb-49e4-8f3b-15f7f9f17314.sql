
-- Inserir os 3 sócios do cliente DGA ADMINISTRADORA (se não existirem)
INSERT INTO partner_accounts (client_id, partner_cpf, partner_name, current_balance, total_deposited, total_spent)
VALUES 
  ('738850b2-d19c-496b-b2d3-35ecc64bd862', '018.858.390-00', 'GUAVIRA', 0.00, 0.00, 0.00),
  ('738850b2-d19c-496b-b2d3-35ecc64bd862', '039.149.411-20', 'ARMANDO', 0.00, 0.00, 0.00),
  ('738850b2-d19c-496b-b2d3-35ecc64bd862', '308.284.739-00', 'DJALMA', 0.00, 0.00, 0.00)
ON CONFLICT DO NOTHING;
