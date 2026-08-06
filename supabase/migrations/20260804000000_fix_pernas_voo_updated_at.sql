create or replace function public.update_flight_booking_requests_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;
