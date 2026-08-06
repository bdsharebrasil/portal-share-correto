alter table public.solicitacoes_reserva_voo
  drop constraint if exists solicitacoes_reserva_voo_status_check;

alter table public.solicitacoes_reserva_voo
  add constraint solicitacoes_reserva_voo_status_check
  check (status in ('pendente', 'confirmado', 'em_rota', 'concluido', 'rejeitado', 'cancelado'));
