alter table public.planos_voo
  add column if not exists solicitacao_id uuid references public.solicitacoes_reserva_voo(id) on delete set null,
  add column if not exists regra_voo text;

alter table public.planos_voo
  drop constraint if exists planos_voo_regra_voo_check;

alter table public.planos_voo
  add constraint planos_voo_regra_voo_check
  check (regra_voo is null or regra_voo in ('V', 'I', 'Y', 'Z'));

create index if not exists planos_voo_solicitacao_id_idx
  on public.planos_voo (solicitacao_id);

create index if not exists planos_voo_aeronave_id_idx
  on public.planos_voo (aeronave_id);

comment on column public.planos_voo.solicitacao_id is 'Agendamento de voo ao qual o plano está vinculado';
comment on column public.planos_voo.regra_voo is 'Regra de voo: VFR, IFR ou transição Y/Z';
