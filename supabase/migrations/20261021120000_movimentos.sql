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
