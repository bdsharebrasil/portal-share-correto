-- ============================================
-- TABLE: service_items (Itens de Serviço)
-- ============================================
create table public.service_items (
  id uuid not null default gen_random_uuid (),
  service_order_id uuid not null,
  aircraft_id uuid not null,
  description text not null,
  provider text not null,
  period text null,
  value numeric(15, 2) not null,
  nfse text null,
  status text null default 'pendente'::text,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint service_items_pkey primary key (id),
  constraint service_items_service_order_id_fkey foreign key (service_order_id) references service_orders (id) on delete cascade,
  constraint service_items_aircraft_id_fkey foreign key (aircraft_id) references aircraft (id) on delete cascade,
  constraint service_items_status_check check (
    status = any (
      array['pendente'::text, 'concluído'::text, 'cancelado'::text]
    )
  )
) tablespace pg_default;

create index if not exists idx_service_items_service_order on public.service_items using btree (service_order_id) tablespace pg_default;

create index if not exists idx_service_items_aircraft on public.service_items using btree (aircraft_id) tablespace pg_default;

create trigger service_items_updated_at before update on service_items for each row execute function update_service_items_updated_at ();

-- ============================================
-- TABLE: pilot_hours (Horas de Voo dos Pilotos)
-- ============================================
create table public.pilot_hours (
  id uuid not null default gen_random_uuid (),
  service_order_id uuid not null,
  aircraft_id uuid not null,
  period text not null,
  josmeyr text null,
  duilio text null,
  ricardo text null,
  gramulha text null,
  oficina text null,
  created_at timestamp with time zone null default now(),
  updated_at timestamp with time zone null default now(),
  constraint pilot_hours_pkey primary key (id),
  constraint pilot_hours_service_order_id_fkey foreign key (service_order_id) references service_orders (id) on delete cascade,
  constraint pilot_hours_aircraft_id_fkey foreign key (aircraft_id) references aircraft (id) on delete cascade
) tablespace pg_default;

create index if not exists idx_pilot_hours_service_order on public.pilot_hours using btree (service_order_id) tablespace pg_default;

create index if not exists idx_pilot_hours_aircraft on public.pilot_hours using btree (aircraft_id) tablespace pg_default;

create trigger pilot_hours_updated_at before update on pilot_hours for each row execute function update_pilot_hours_updated_at ();

-- ============================================
-- TRIGGER FUNCTIONS (caso não existam)
-- ============================================

-- Função para atualizar timestamp de service_items
create or replace function update_service_items_updated_at ()
  returns trigger
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$
language plpgsql;

-- Função para atualizar timestamp de pilot_hours
create or replace function update_pilot_hours_updated_at ()
  returns trigger
  as $$
begin
  new.updated_at = now();
  return new;
end;
$$
language plpgsql;

-- ============================================
-- DADOS DE EXEMPLO
-- ============================================

-- Insert exemplo para service_items (vinculado a um service_order existente)
insert into public.service_items (service_order_id, aircraft_id, description, provider, period, value, nfse, status)
select 
  so.id,
  ac.id,
  'INSPEÇÃO 100 HORAS (VALOR DE ENTRADA)',
  'ASTA',
  'PROGRAMADO',
  4080.00,
  '359',
  'pendente'
from service_orders so
join aircraft ac on ac.id = so.aircraft_id
limit 1
on conflict do nothing;

-- Insert exemplo para pilot_hours (vinculado a um service_order existente)
insert into public.pilot_hours (service_order_id, aircraft_id, period, josmeyr, duilio, ricardo, gramulha, oficina)
select 
  so.id,
  ac.id,
  '18/03 A 31/03/25',
  '9:36',
  '0:00',
  '6:32',
  '-',
  '0:09'
from service_orders so
join aircraft ac on ac.id = so.aircraft_id
limit 1
on conflict do nothing;
