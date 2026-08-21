CREATE OR REPLACE FUNCTION public.sync_salary_to_banking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  employee_name TEXT;
  user_email TEXT;
  payment_date TEXT;
BEGIN
  -- historico_pagamentos_funcionarios usa id_usuario/criado_em; user_profile/created_at não existem.
  SELECT up.full_name, up.email
    INTO employee_name, user_email
  FROM public.user_profiles AS up
  WHERE up.id = NEW.id_usuario
  LIMIT 1;

  payment_date := COALESCE(NULLIF(NEW.data_pagamento, ''), TO_CHAR(NEW.criado_em, 'YYYY-MM-DD'));

  RAISE LOG 'sync_salary_to_banking triggered for payment_id: %, id_usuario: %, employee: %, date: %',
    NEW.id, NEW.id_usuario, COALESCE(employee_name, user_email, NEW.id_usuario::TEXT), payment_date;

  RETURN NEW;
END;
$function$;
