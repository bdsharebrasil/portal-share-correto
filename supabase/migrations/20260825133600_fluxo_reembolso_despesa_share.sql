-- Fluxo financeiro correto para despesas reembolsáveis:
-- 1) Solicitação cria o rateio e uma única movimentação Share/contas a pagar.
-- 2) Antes do pagamento, a despesa não é reembolsável.
-- 3) Depois da baixa Share, o usuário gera contas a receber/movimentações de entrada.
-- 4) A baixa do recebimento atualiza contas a receber, movimentações e rateio.

-- O banco já possui um trigger que normaliza movimentacoes.status para maiúsculas.
-- O CHECK precisa aceitar as duas representações usadas pelo frontend legado.
alter table public.movimentacoes
drop constraint if exists movimentacoes_status_check;

alter table public.movimentacoes
add constraint movimentacoes_status_check
check (
  upper(coalesce(status, '')) = any (
    array[
      'PENDENTE',
      'PAGO',
      'REEMBOLSADO',
      'RECEBIDO',
      'AGUARDANDO_REEMBOLSO',
      'PARCIAL',
      'CANCELADO'
    ]
  )
);

-- Enquanto uma despesa Share reembolsável ainda não foi paga, ela não pode
-- abrir cobrança para o cliente.
create or replace function public.fin_set_reembolso_pending_after_insert()
returns trigger
language plpgsql
as $$
begin
  if new.tipo_caixa = 'share'
     and new.contas_apagar_id is not null
     and new.fluxo in ('despesa', 'saida')
     and (
       upper(coalesce(new.grupo_categoria, '')) = 'DESPESAS REEMBOLSÁVEIS'
       or coalesce(new.reembolsavel, false) = true
     )
     and new.data_pagamento is null
  then
    new.reembolsavel := false;
    new.reembolso_quitado := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_fin_set_reembolso_pending_after_insert on public.movimentacoes;
create trigger trg_fin_set_reembolso_pending_after_insert
before insert on public.movimentacoes
for each row
execute function public.fin_set_reembolso_pending_after_insert();

-- Proteção para versões antigas do frontend que ainda possam gravar uma
-- movimentação "cliente" antes do rateio. O rateio é normalizado para a
-- única movimentação Share vinculada ao mesmo contas_apagar e a perna
-- redundante é removida.
create or replace function public.fin_normalize_reembolso_rateio()
returns trigger
language plpgsql
as $$
begin
  with candidatos as (
    select n.id as rateio_id, cm.id as mov_cliente_id, sm.id as mov_share_id
    from new_rows n
    join public.movimentacoes cm
      on cm.id = n.despesa_id
     and cm.tipo_caixa = 'cliente'
     and cm.contas_apagar_id is not null
    join public.movimentacoes sm
      on sm.contas_apagar_id = cm.contas_apagar_id
     and sm.id <> cm.id
     and sm.tipo_caixa = 'share'
     and (
       coalesce(sm.reembolsavel, false) = true
       or upper(coalesce(sm.grupo_categoria, '')) = 'DESPESAS REEMBOLSÁVEIS'
     )
  )
  update public.rateio_despesas r
     set despesa_id = c.mov_share_id,
         atualizado_em = now()
    from candidatos c
   where r.id = c.rateio_id;

  with candidatos as (
    select distinct cm.id as mov_cliente_id
    from new_rows n
    join public.movimentacoes cm
      on cm.id = n.despesa_id
     and cm.tipo_caixa = 'cliente'
     and cm.contas_apagar_id is not null
    join public.movimentacoes sm
      on sm.contas_apagar_id = cm.contas_apagar_id
     and sm.id <> cm.id
     and sm.tipo_caixa = 'share'
     and (
       coalesce(sm.reembolsavel, false) = true
       or upper(coalesce(sm.grupo_categoria, '')) = 'DESPESAS REEMBOLSÁVEIS'
     )
  )
  delete from public.movimentacoes cm
   using candidatos c
  where cm.id = c.mov_cliente_id;

  return null;
end;
$$;

drop trigger if exists trg_fin_normalize_reembolso_rateio on public.rateio_despesas;
create trigger trg_fin_normalize_reembolso_rateio
after insert on public.rateio_despesas
referencing new table as new_rows
for each statement
execute function public.fin_normalize_reembolso_rateio();

-- Nota: a limpeza de registros históricos já foi executada no projeto de produção.
-- Não há IDs hard-coded nesta migration para que ambientes novos permaneçam seguros.