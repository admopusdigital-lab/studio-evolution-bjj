-- Studio Evolution BJJ · notificações push do app.
-- Cada aparelho que ativa as notificações vira uma inscrição ligada à conta. Quem envia é a função de servidor "push"
-- (com a chave secreta); o professor e a equipe escrevem o aviso no painel. As chaves que assinam os envios são
-- geradas pela própria função na primeira vez e ficam em push_chaves, que ninguém lê pelo app nem pelo painel.
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

create table if not exists public.push_inscricoes (
  id         uuid primary key default gen_random_uuid(),
  conta      uuid not null references auth.users (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh     text not null check (char_length(p256dh) between 20 and 200),
  auth       text not null check (char_length(auth) between 8 and 100),
  aparelho   text check (aparelho is null or char_length(aparelho) <= 60),
  criado_em  timestamptz not null default now()
);
create index if not exists push_inscricoes_conta_idx on public.push_inscricoes (conta);
comment on table public.push_inscricoes is 'Aparelhos com as notificações do app ativadas, por conta.';

alter table public.push_inscricoes enable row level security;
drop policy if exists "cada conta ve os proprios aparelhos" on public.push_inscricoes;
create policy "cada conta ve os proprios aparelhos" on public.push_inscricoes for select to authenticated
  using (conta = (select auth.uid()));
revoke all on table public.push_inscricoes from anon, authenticated;
grant select on table public.push_inscricoes to authenticated;

-- ativar neste aparelho: grava (ou passa para a conta de agora, se o aparelho era de outra conta)
create or replace function public.push_inscrever(p_endpoint text, p_p256dh text, p_auth text, p_aparelho text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then return false; end if;
  insert into public.push_inscricoes (conta, endpoint, p256dh, auth, aparelho)
  values ((select auth.uid()), p_endpoint, p_p256dh, p_auth, left(p_aparelho, 60))
  on conflict (endpoint) do update set conta = excluded.conta, p256dh = excluded.p256dh, auth = excluded.auth, aparelho = excluded.aparelho;
  return true;
end;
$$;
-- desativar neste aparelho
create or replace function public.push_sair(p_endpoint text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with t as (delete from public.push_inscricoes where endpoint = p_endpoint and conta = (select auth.uid()) returning 1)
  select exists (select 1 from t);
$$;
revoke all on function public.push_inscrever(text, text, text, text), public.push_sair(text) from public, anon;
grant execute on function public.push_inscrever(text, text, text, text), public.push_sair(text) to authenticated;

-- as chaves que assinam os envios: só a função de servidor lê (sem regra nenhuma para o app e o painel)
create table if not exists public.push_chaves (
  id        integer primary key default 1 check (id = 1),
  publica   text not null,
  privada   text not null,
  criado_em timestamptz not null default now()
);
alter table public.push_chaves enable row level security;
revoke all on table public.push_chaves from anon, authenticated;

-- o que foi enviado (o painel mostra os últimos)
create table if not exists public.push_envios (
  id        uuid primary key default gen_random_uuid(),
  por       uuid references auth.users (id) on delete set null,
  titulo    text not null,
  corpo     text not null,
  para      text not null,
  aparelhos integer not null default 0,
  falhas    integer not null default 0,
  criado_em timestamptz not null default now()
);
alter table public.push_envios enable row level security;
drop policy if exists "equipe le os avisos enviados" on public.push_envios;
create policy "equipe le os avisos enviados" on public.push_envios for select to authenticated
  using ((select privado.equipe()));
revoke all on table public.push_envios from anon, authenticated;
grant select on table public.push_envios to authenticated;
