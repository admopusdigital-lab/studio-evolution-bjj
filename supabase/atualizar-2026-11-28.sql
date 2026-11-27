-- Studio Evolution BJJ · atualização do banco de 28/11/2026 (as três migrações do dia, em uma colada só).
-- Colar tudo no Supabase → SQL Editor → New query → Run. Pode rodar mais de uma vez.
-- 1) câmera do tatame: links e estado, só para o professor · 2) piloto no app: quem assiste · 3) notificações push

-- ===================== 20261128120000_camera_links =====================
-- Studio Evolution BJJ · câmera do tatame, fase 1 (um celular vira a câmera).
-- Guarda os dois links da transmissão (Cloudflare Stream) e o estado do aparelho que filma.
-- Só o professor (dono) lê e grava: o link de envio é uma chave (quem tem, transmite) e o link de assistir mostra
-- o tatame. A equipe de gestão e os alunos não enxergam esta tabela. As famílias só vão assistir pelo app depois,
-- por uma função que confere a turma, o aceite e o horário; isso entra na liberação, não aqui.
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

create table if not exists public.camera_links (
  id            text primary key check (id ~ '^[a-z0-9-]{1,30}$'),
  envio_url     text check (envio_url is null or (envio_url ~ '^https://' and char_length(envio_url) <= 400)),
  assistir_url  text check (assistir_url is null or (assistir_url ~ '^https://' and char_length(assistir_url) <= 400)),
  pausada       boolean not null default false,
  estado        jsonb,
  visto_em      timestamptz,
  atualizado_em timestamptz not null default now()
);

comment on table public.camera_links is 'Câmera do tatame: links da transmissão e estado do aparelho. Só o professor.';
comment on column public.camera_links.envio_url is 'Link de envio (WebRTC/WHIP). É uma chave: quem tem, transmite.';
comment on column public.camera_links.assistir_url is 'Link para assistir (WebRTC/WHEP).';
comment on column public.camera_links.pausada is 'O professor pausou a transmissão pelo painel; o aparelho para em até 30 segundos.';
comment on column public.camera_links.estado is 'O que o aparelho informa: no ar ou não, turma, conexão, bateria, último erro.';
comment on column public.camera_links.visto_em is 'Último sinal do aparelho que filma.';

alter table public.camera_links enable row level security;

drop policy if exists "professor gerencia a camera" on public.camera_links;
create policy "professor gerencia a camera" on public.camera_links for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));

revoke all on table public.camera_links from anon, authenticated;
grant select, insert, update, delete on table public.camera_links to authenticated;

-- ===================== 20261128130000_camera_piloto_app =====================
-- Studio Evolution BJJ · câmera do tatame, piloto no app: o professor libera a tela "Ao vivo" só para algumas pessoas.
-- A lista (testadores) guarda cadastros de alunos; vale para a conta do próprio aluno e para a do responsável dele.
-- O app não lê a tabela camera_links: chama a função camera_ao_vivo(), que só responde para quem está na lista e só
-- entrega o endereço de assistir enquanto a câmera está no ar. O endereço de envio nunca sai por aqui.
-- Rodar depois de 20261128120000_camera_links.sql (pode rodar mais de uma vez).

alter table public.camera_links add column if not exists testadores uuid[] not null default '{}';
alter table public.camera_links drop constraint if exists camera_links_testadores_check;
alter table public.camera_links add constraint camera_links_testadores_check check (cardinality(testadores) <= 50);
comment on column public.camera_links.testadores is 'Piloto: os alunos (cadastros) que veem a tela Ao vivo no app, com a própria conta ou a do responsável.';

create or replace function public.camera_ao_vivo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.camera_links%rowtype;
  cfg jsonb;
  no_ar boolean;
begin
  select * into c from public.camera_links where id = 'tatame1';
  if not found then return null; end if;
  -- só quem o professor liberou: algum cadastro da família da conta logada precisa estar na lista
  if not exists (select 1 from privado.meus_alunos() m where m = any (c.testadores)) then return null; end if;

  select valor into cfg from public.configuracoes where chave = 'cameras';
  -- no ar: o aparelho disse que está transmitindo, mandou sinal há menos de 90 segundos e o professor não pausou
  no_ar := c.assistir_url is not null and not c.pausada
    and coalesce((c.estado ->> 'ao_vivo')::boolean, false)
    and c.visto_em is not null and c.visto_em > now() - interval '90 seconds';

  return jsonb_build_object(
    'nome', coalesce(cfg ->> 'nome', 'Tatame 1'),
    'ao_vivo', no_ar,
    'pausada', c.pausada,
    'turma', case when no_ar then c.estado ->> 'turma' end,
    'assistir_url', case when no_ar then c.assistir_url end,
    'marca', coalesce((cfg -> 'regras' ->> 'nome')::boolean, true),
    'abre5', coalesce((cfg -> 'regras' ->> 'abre5')::boolean, true),
    'turmas', coalesce(cfg -> 'turmas', '{"kids1": true, "kids2": true, "adulto": false}'::jsonb)
  );
end;
$$;

revoke all on function public.camera_ao_vivo() from public, anon;
grant execute on function public.camera_ao_vivo() to authenticated;

-- ===================== 20261128140000_push =====================
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
