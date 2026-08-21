-- Centro Treinamento: reuniões, participantes, permissões e Realtime.
-- Usa public.user_roles já existente no Share Brasil; não cria um sistema paralelo de roles.

create or replace function public.unk_treinamento_role()
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  configured_role text;
  claim_role text;
begin
  select lower(role::text) into configured_role
    from public.user_roles
   where user_id = auth.uid()
   order by case when lower(role::text) = 'admin' then 0 when lower(role::text) = 'gestor_master' then 1 else 2 end
   limit 1;
  if configured_role in ('admin', 'gestor_master') then return configured_role; end if;
  claim_role := lower(coalesce(auth.jwt() -> 'app_metadata' ->> 'role', auth.jwt() -> 'user_metadata' ->> 'role', auth.jwt() ->> 'role', 'user'));
  if claim_role in ('admin', 'administrator') then return 'admin'; end if;
  if claim_role in ('gestor_master', 'gestor-master', 'gestor master', 'master') then return 'gestor_master'; end if;
  return 'user';
end;
$$;
grant execute on function public.unk_treinamento_role() to authenticated;

-- Tabelas com prefixo próprio para não colidir com módulos existentes.
create table if not exists public.unk_treinamento_reunioes (
  id uuid primary key default gen_random_uuid(),
  titulo varchar(140) not null,
  descricao text not null default '',
  host_id uuid not null references auth.users(id) on delete restrict,
  status varchar(20) not null default 'agendada' check (status in ('agendada', 'em_andamento', 'encerrada')),
  agendada_para timestamptz,
  iniciada_em timestamptz,
  encerrada_em timestamptz,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.unk_treinamento_reunioes to authenticated;
alter table public.unk_treinamento_reunioes enable row level security;
drop policy if exists "Equipe autenticada consulta reuniões" on public.unk_treinamento_reunioes;
create policy "Equipe autenticada consulta reuniões" on public.unk_treinamento_reunioes for select to authenticated using (true);
drop policy if exists "Admin e gestor master criam reuniões" on public.unk_treinamento_reunioes;
create policy "Admin e gestor master criam reuniões" on public.unk_treinamento_reunioes for insert to authenticated with check (host_id = auth.uid() and public.unk_treinamento_role() in ('admin', 'gestor_master'));
drop policy if exists "Host atualiza a própria reunião" on public.unk_treinamento_reunioes;
create policy "Host atualiza a própria reunião" on public.unk_treinamento_reunioes for update to authenticated using (host_id = auth.uid() or public.unk_treinamento_role() in ('admin', 'gestor_master')) with check (host_id = auth.uid() or public.unk_treinamento_role() in ('admin', 'gestor_master'));

create table if not exists public.unk_treinamento_participantes (
  id uuid primary key default gen_random_uuid(),
  reuniao_id uuid not null references public.unk_treinamento_reunioes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  nome varchar(140) not null,
  entrou_em timestamptz not null default now(),
  saiu_em timestamptz,
  unique (reuniao_id, user_id)
);

grant select, insert, update on public.unk_treinamento_participantes to authenticated;
alter table public.unk_treinamento_participantes enable row level security;
drop policy if exists "Equipe autenticada consulta participantes" on public.unk_treinamento_participantes;
create policy "Equipe autenticada consulta participantes" on public.unk_treinamento_participantes for select to authenticated using (true);
drop policy if exists "Usuário entra na reunião" on public.unk_treinamento_participantes;
create policy "Usuário entra na reunião" on public.unk_treinamento_participantes for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "Usuário atualiza a própria presença" on public.unk_treinamento_participantes;
create policy "Usuário atualiza a própria presença" on public.unk_treinamento_participantes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists idx_unk_treinamento_reunioes_status on public.unk_treinamento_reunioes(status, agendada_para);
create index if not exists idx_unk_treinamento_participantes_reuniao on public.unk_treinamento_participantes(reuniao_id);

-- O Supabase gerencia a tabela realtime.messages; Broadcast e Presence são usados
-- pelo cliente autenticado sem alterar a propriedade dessa tabela.
