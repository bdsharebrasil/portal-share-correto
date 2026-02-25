-- Fix trigger: set criado_por instead of created_by, and add saldo_pendente
CREATE OR REPLACE FUNCTION handle_reembolso_receipt()
RETURNS TRIGGER AS $$
DECLARE
  v_aircraft_id UUID;
BEGIN
  -- Se é um recibo de reembolso e tem um cliente associado
  IF NEW.receipt_type = 'reembolso' AND NEW.client_id IS NOT NULL THEN
    -- Buscar a primeira aeronave associada ao cliente
    SELECT aircraft_id INTO v_aircraft_id
    FROM public.client_aircraft
    WHERE client_id = NEW.client_id
    LIMIT 1;
    
    -- Só inserir se encontrou uma aeronave (constraint exige aircraft_id)
    IF v_aircraft_id IS NOT NULL THEN
      INSERT INTO public.bank_reconciliations (
        id,
        client_id,
        aircraft_id,
        amount,
        type,
        status,
        description,
        date,
        reference_id,
        reference_type,
        criado_por,
        category,
        saldo_pendente,
        created_at
      ) VALUES (
        gen_random_uuid(),
        NEW.client_id,
        v_aircraft_id,
        -ABS(NEW.amount),
        'cliente',
        'pendente',
        'Reembolso: ' || NEW.service_description,
        NEW.issue_date,
        NEW.id,
        'receipt',
        NEW.user_id,
        'reembolso',
        -ABS(NEW.amount),
        NOW()
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;