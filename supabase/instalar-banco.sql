-- Studio Evolution BJJ · banco completo para colar no SQL Editor do Supabase (projeto novo, vazio).
-- É a soma das migrations de supabase/migrations, na ordem. Rodar uma vez só.

-- ===== 20261019120000_perfis_e_acesso.sql =====
-- Studio Evolution BJJ · perfis e acesso
-- Quem pode entrar no app e com qual papel. Cada conta do Supabase Auth (auth.users) tem uma linha em perfis.
-- Contas são criadas só pelo Studio (função criar-conta, chamada pela página acessos.html); ninguém se cadastra sozinho.
--
-- Regras (RLS):
--   - cada pessoa lê o próprio perfil;
--   - professor ativo lê e atualiza todos os perfis;
--   - criar e apagar perfis: só a função criar-conta, com a chave secreta (não passa pelas regras).

create table public.perfis (
  id            uuid primary key references auth.users (id) on delete cascade,
  papel         text not null check (papel in ('aluno', 'professor')),
  nome          text not null check (char_length(nome) between 2 and 120),
  whatsapp      text check (whatsapp ~ '^[0-9]{10,13}$'),
  turma         text check (turma in ('adulto', 'feminino', 'kids1', 'kids2')),
  faixa         text check (faixa in ('branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta')),
  graus         smallint not null default 0 check (graus between 0 and 6),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.perfis is 'Uma linha por conta do app: papel (aluno ou professor), dados de contato e faixa.';
comment on column public.perfis.whatsapp is 'Só dígitos, com DDI e DDD (ex.: 5515996741812). Na turma Kids, o do responsável.';
comment on column public.perfis.ativo is 'false bloqueia a entrada sem apagar o histórico.';

create index perfis_papel_idx on public.perfis (papel) where ativo;

-- "é professor?": fica num schema que a API não expõe, e roda como dono da tabela (security definer),
-- para a regra de leitura não consultar perfis dentro de perfis
create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

create or replace function privado.eh_professor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and papel = 'professor' and ativo
  );
$$;
revoke all on function privado.eh_professor() from public;
grant execute on function privado.eh_professor() to authenticated;

alter table public.perfis enable row level security;

create policy "cada um le o proprio perfil"
  on public.perfis for select to authenticated
  using (id = (select auth.uid()));

create policy "professor le todos os perfis"
  on public.perfis for select to authenticated
  using ((select privado.eh_professor()));

create policy "professor atualiza perfis"
  on public.perfis for update to authenticated
  using ((select privado.eh_professor()))
  with check ((select privado.eh_professor()));

-- atualizado_em sempre em dia
create or replace function privado.marca_atualizacao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger perfis_atualizado_em
  before update on public.perfis
  for each row execute function privado.marca_atualizacao();

-- o anônimo (site sem login) não vê nada; o logado só lê e atualiza o que as regras acima deixam
-- (o Supabase dá todos os privilégios por padrão: aqui eles são reduzidos ao necessário)
revoke all on table public.perfis from anon, authenticated;
grant select, update on table public.perfis to authenticated;

-- ===== 20261021120000_movimentos.sql =====
-- Studio Evolution BJJ · movimentos (vídeos e quizzes) e o progresso de cada aluno
-- A biblioteca que o professor monta no painel (aba Movimentos) e que o aluno estuda no app (aba Movimentos).
-- Depende de 20261019120000_perfis_e_acesso.sql (tabela perfis e privado.eh_professor()).
--
-- Regras (RLS):
--   - movimentos: quem está logado lê os publicados; professor ativo lê todos (rascunhos também) e cria, muda e apaga;
--   - estudos: cada aluno lê e grava só o próprio progresso; professor ativo lê o de todos (quem estudou).
-- O quiz fica junto do movimento, com a resposta certa: é um quiz de estudo, não uma prova.

create table public.movimentos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 2 and 120),
  faixa         text not null check (faixa in ('branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta')),
  categoria     text not null check (categoria in ('raspagem', 'passagem', 'finalizacao', 'fuga', 'defesa', 'queda', 'outro')),
  video_tipo    text check (video_tipo in ('youtube', 'arquivo')),
  video_ref     text check (char_length(video_ref) <= 500),
  duracao       text check (duracao ~ '^[0-9]{1,3}:[0-5][0-9]$'),
  pontos        text[] not null default '{}',
  quiz          jsonb not null default '[]' check (jsonb_typeof(quiz) = 'array' and jsonb_array_length(quiz) <= 5),
  publicado     boolean not null default false,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- vídeo: os dois campos juntos, ou nenhum (sem vídeo, o app mostra "em gravação")
  check ((video_tipo is null) = (video_ref is null))
);

comment on table public.movimentos is 'Biblioteca da academia: um vídeo (YouTube ou arquivo), pontos-chave e quiz por movimento, por faixa.';
comment on column public.movimentos.video_ref is 'YouTube: o id de 11 caracteres. Arquivo: o endereço https do .mp4.';
comment on column public.movimentos.quiz is 'Lista de { q, a: [3 alternativas], r: índice da certa, dica }. Até 5 perguntas.';

create index movimentos_faixa_idx on public.movimentos (faixa, ordem) where publicado;

create table public.estudos (
  aluno         uuid not null references public.perfis (id) on delete cascade,
  movimento     uuid not null references public.movimentos (id) on delete cascade,
  visto         real not null default 0 check (visto between 0 and 1),
  quiz_ok       boolean not null default false,
  atualizado_em timestamptz not null default now(),
  primary key (aluno, movimento)
);

comment on table public.estudos is 'Progresso de cada aluno em cada movimento: quanto do vídeo assistiu (0 a 1) e se fez o quiz.';

create index estudos_movimento_idx on public.estudos (movimento) where quiz_ok;

alter table public.movimentos enable row level security;
alter table public.estudos enable row level security;

create policy "logado le os movimentos publicados"
  on public.movimentos for select to authenticated
  using (publicado);

create policy "professor le todos os movimentos"
  on public.movimentos for select to authenticated
  using ((select privado.eh_professor()));

create policy "professor cria movimentos"
  on public.movimentos for insert to authenticated
  with check ((select privado.eh_professor()));

create policy "professor muda movimentos"
  on public.movimentos for update to authenticated
  using ((select privado.eh_professor()))
  with check ((select privado.eh_professor()));

create policy "professor apaga movimentos"
  on public.movimentos for delete to authenticated
  using ((select privado.eh_professor()));

create policy "aluno le o proprio progresso"
  on public.estudos for select to authenticated
  using (aluno = (select auth.uid()));

create policy "professor le o progresso de todos"
  on public.estudos for select to authenticated
  using ((select privado.eh_professor()));

-- o aluno só grava progresso de movimento publicado
create policy "aluno grava o proprio progresso"
  on public.estudos for insert to authenticated
  with check (aluno = (select auth.uid()) and exists (select 1 from public.movimentos m where m.id = movimento and m.publicado));

create policy "aluno atualiza o proprio progresso"
  on public.estudos for update to authenticated
  using (aluno = (select auth.uid()))
  with check (aluno = (select auth.uid()));

-- atualizado_em sempre em dia (a função vem da migration de perfis)
create trigger movimentos_atualizado_em
  before update on public.movimentos
  for each row execute function privado.marca_atualizacao();

create trigger estudos_atualizado_em
  before update on public.estudos
  for each row execute function privado.marca_atualizacao();

-- o anônimo não vê nada; o logado só faz o que as regras acima deixam
revoke all on table public.movimentos, public.estudos from anon, authenticated;
grant select, insert, update, delete on table public.movimentos to authenticated;
grant select, insert, update on table public.estudos to authenticated;

