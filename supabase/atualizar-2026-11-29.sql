-- Studio Evolution BJJ · atualização do banco de 29/11/2026, em uma colada só.
-- Colar tudo no Supabase → SQL Editor → New query → Run. Pode rodar mais de uma vez.
-- Traz de novo as quatro partes de 28/11 (quem já rodou não perde nada) e acrescenta a de hoje:
-- 1) câmera do tatame · 2) piloto da câmera no app · 3) notificações push · 4) interessado ligado ao aluno · 5) avisos por aluno

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

-- ===================== 20261128150000_lead_aluno =====================
-- Studio Evolution BJJ · interessado matriculado ligado ao cadastro de aluno.
-- Quando o professor cadastra o aluno direto (sem passar pelo "Cadastrar aluno" do interessado), o contato ficava
-- em Matriculados pedindo um cadastro que já existe. Agora o interessado aponta para o aluno: pelo cadastro feito
-- a partir dele ou pelo botão "Já é aluno: vincular".
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

alter table public.leads add column if not exists aluno uuid references public.alunos (id) on delete set null;
create index if not exists leads_aluno_idx on public.leads (aluno) where aluno is not null;
comment on column public.leads.aluno is 'O cadastro de aluno em que este interessado virou (matriculado).';

-- ===================== 20261129120000_avisos =====================
-- Studio Evolution BJJ · avisos por aluno.
-- O professor (ou a equipe) escreve um recado no painel, na aba Avisos, para um aluno, uma turma ou todos.
-- Cada recado vira uma linha aqui, já com o primeiro nome do aluno no texto. Quem ativou os avisos recebe a
-- notificação no celular; quem não ativou vê o recado ao abrir o app. Quem grava é a função de servidor "push".
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez). Precisa das tabelas de push (28/11).

create table if not exists public.avisos (
  id         uuid primary key default gen_random_uuid(),
  aluno      uuid not null references public.alunos (id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 1 and 80),
  corpo      text not null default '' check (char_length(corpo) <= 400),
  tela       text check (tela is null or tela in ('inicio', 'presenca', 'movimentos', 'perfil')),
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  lido_em    timestamptz
);
-- de qual envio do painel o recado veio (para o histórico contar quantos leram)
alter table public.avisos add column if not exists envio uuid references public.push_envios (id) on delete set null;
create index if not exists avisos_aluno_idx on public.avisos (aluno, criado_em desc);
create index if not exists avisos_envio_idx on public.avisos (envio);
comment on table public.avisos is 'Recados do Studio para cada aluno: aparecem no app e, para quem ativou, como notificação.';

alter table public.avisos enable row level security;
-- o aluno (e o responsável) lê os próprios; a equipe lê todos
drop policy if exists "aluno le os proprios avisos" on public.avisos;
create policy "aluno le os proprios avisos" on public.avisos for select to authenticated
  using (aluno in (select privado.meus_alunos()) or (select privado.equipe()));
-- escrever é só da equipe (o caminho normal é a função push, com a chave de servidor)
drop policy if exists "equipe cria avisos" on public.avisos;
create policy "equipe cria avisos" on public.avisos for insert to authenticated
  with check ((select privado.equipe()));
drop policy if exists "equipe altera avisos" on public.avisos;
create policy "equipe altera avisos" on public.avisos for update to authenticated
  using ((select privado.equipe())) with check ((select privado.equipe()));
drop policy if exists "equipe apaga avisos" on public.avisos;
create policy "equipe apaga avisos" on public.avisos for delete to authenticated
  using ((select privado.equipe()));
revoke all on table public.avisos from anon, authenticated;
grant select, insert, update, delete on table public.avisos to authenticated;

-- o aluno abriu o recado: marca como lido (só os dele, e só uma vez)
create or replace function public.aviso_lido(p_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with t as (
    update public.avisos set lido_em = now()
    where id = p_id and lido_em is null and aluno in (select privado.meus_alunos())
    returning 1
  )
  select exists (select 1 from t);
$$;
revoke all on function public.aviso_lido(uuid) from public, anon;
grant execute on function public.aviso_lido(uuid) to authenticated;

-- para o painel: quantos aparelhos com aviso ativo cada aluno tem (a conta dele e a do responsável).
-- Só a equipe recebe resposta; aluno sem aparelho não aparece na lista.
create or replace function public.push_alcance()
returns table (aluno uuid, aparelhos integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, count(distinct i.id)::integer
  from public.alunos a
  join public.push_inscricoes i on i.conta = a.conta or i.conta = a.responsavel_conta
  where a.ativo and (select privado.equipe())
  group by a.id;
$$;
revoke all on function public.push_alcance() from public, anon;
grant execute on function public.push_alcance() to authenticated;
