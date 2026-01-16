-- Create sync_salary_to_banking function for pagamento_salario_funcionario triggers
CREATE OR REPLACE FUNCTION sync_salary_to_banking()
RETURNS TRIGGER AS $$
DECLARE
  employee_name TEXT;
  user_email TEXT;
  payment_date TEXT;
  user_profile_id UUID;
BEGIN
  -- Log para debug
  RAISE LOG 'sync_salary_to_banking triggered for payment_id: %, user_profile: %', NEW.id, NEW.user_profile;

  -- Obter informações do funcionário
  SELECT up.full_name, up.email, COALESCE(NEW.data_pagamento, TO_CHAR(NEW.created_at, 'YYYY-MM-DD'))
  INTO employee_name, user_email, payment_date
  FROM user_profiles up
  WHERE up.id = NEW.user_profile
  LIMIT 1;

  -- Se não encontrou nome, usar email ou ID
  IF employee_name IS NULL THEN
    employee_name := COALESCE(user_email, NEW.user_profile::TEXT);
  END IF;

  user_profile_id := NEW.user_profile;

  RAISE LOG 'Employee info: name=%, date=%', employee_name, payment_date;

  -- Salário Base
  IF NEW.base_salary_holerite IS NOT NULL AND NEW.base_salary_holerite > 0 THEN
    RAISE LOG 'Inserting base salary: % for %', NEW.base_salary_holerite, employee_name;
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      comprovante_url,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = 'Salário' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      'Salário - ' || employee_name,
      NEW.base_salary_holerite,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.holerite_url,
      NEW.obs,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Benefícios
  IF NEW.benefit IS NOT NULL AND NEW.benefit <> '' THEN
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = 'Benefícios' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      'Benefício - ' || employee_name,
      0,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.benefit,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Horas de Voo
  IF NEW.horas_voo IS NOT NULL AND NEW.horas_voo <> '' THEN
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = 'Horas de Voo' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      'Horas de Voo - ' || employee_name,
      0,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.horas_voo,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Extras
  IF NEW.extra IS NOT NULL AND NEW.extra <> '' THEN
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = 'Extras' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      'Extra - ' || employee_name,
      0,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.extra,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 13º Salário - Parcela 1
  IF NEW.decimo_terceiro_parcela1 IS NOT NULL AND NEW.decimo_terceiro_parcela1 > 0 THEN
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      comprovante_url,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = '13º Salário' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      '13º Salário (1ª Parcela) - ' || employee_name,
      NEW.decimo_terceiro_parcela1,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.comprovante_url,
      NEW.obs,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- 13º Salário - Parcela 2
  IF NEW.decimo_terceiro_parcela2 IS NOT NULL AND NEW.decimo_terceiro_parcela2 > 0 THEN
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      comprovante_url,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = '13º Salário' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      '13º Salário (2ª Parcela) - ' || employee_name,
      NEW.decimo_terceiro_parcela2,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.comprovante_url,
      NEW.obs,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  -- Férias
  IF NEW.ferias IS NOT NULL AND NEW.ferias > 0 THEN
    INSERT INTO controle_bancario (
      data,
      tipo_movimento,
      categoria_id,
      descricao,
      valor,
      status,
      grupo_categoria,
      colaborador_id,
      comprovante_url,
      observacoes,
      created_at
    ) VALUES (
      COALESCE(payment_date, TO_CHAR(NOW(), 'YYYY-MM-DD')),
      'saida',
      (SELECT id FROM categorias_movimentacao WHERE nome = 'Férias' LIMIT 1) OR (SELECT id FROM categorias_movimentacao WHERE tipo = 'despesa' LIMIT 1),
      'Férias - ' || employee_name,
      NEW.ferias,
      'pago',
      'Pessoal',
      user_profile_id,
      NEW.comprovante_url,
      NEW.obs,
      NOW()
    ) ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;