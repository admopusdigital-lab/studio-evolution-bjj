-- Studio Evolution BJJ · (1) graus das faixas Kids no padrão IBJJF e (2) técnicas da semana nos Movimentos.
-- Pode rodar mais de uma vez (idempotente). Rode depois de 20261113120000_fotos.sql.
--
-- (1) IBJJF, Sistema Geral de Graduação (jun/2026), Anexo I: nas faixas Kids (4 a 15 anos) a escola escolhe o sistema
--     de graus; no mensal são 11 graus por faixa (4 brancos, 4 vermelhos e 3 da cor da faixa seguinte).
--     O limite antigo era 6; passa a ser 11. Os limites de cada faixa (adulto 4, preta 6, Kids 11) ficam no app e no painel.
-- (2) O professor marca as técnicas de cada semana; o aluno marca "aprendi" e pede "quero aprender"; o professor vê tudo.

-- ===== (1) graus até 11 =====
do $$
declare
  r record;
begin
  for r in
    select c.conrelid::regclass as tabela, c.conname
    from pg_constraint c
    where c.contype = 'c'
      and c.conrelid in ('public.alunos'::regclass, 'public.graduacoes'::regclass)
      and pg_get_constraintdef(c.oid) ilike '%graus%'
  loop
    execute format('alter table %s drop constraint %I', r.tabela, r.conname);
  end loop;
  alter table public.alunos add constraint alunos_graus_check check (graus between 0 and 11);
  alter table public.graduacoes add constraint graduacoes_graus_check check (graus between 0 and 11);
  if to_regclass('public.perfis') is not null and exists (
    select 1 from information_schema.columns where table_schema = 'public' and table_name = 'perfis' and column_name = 'graus'
  ) then
    for r in
      select c.conname from pg_constraint c
      where c.contype = 'c' and c.conrelid = 'public.perfis'::regclass and pg_get_constraintdef(c.oid) ilike '%graus%'
    loop
      execute format('alter table public.perfis drop constraint %I', r.conname);
    end loop;
    alter table public.perfis add constraint perfis_graus_check check (graus between 0 and 11);
  end if;
end $$;

-- ===== (2) as técnicas de cada semana (o professor marca) =====
create table if not exists public.tecnicas_semana (
  id         uuid primary key default gen_random_uuid(),
  semana     date not null,                                   -- a segunda-feira da semana
  turma      text not null default 'todas' check (turma in ('todas', 'adulto', 'kids')),
  movimento  uuid references public.movimentos (id) on delete set null,   -- o vídeo da biblioteca, quando houver
  titulo     text not null check (char_length(titulo) between 2 and 120),
  ordem      integer not null default 0,
  criado_em  timestamptz not null default now(),
  check (extract(isodow from semana) = 1)
);
comment on table public.tecnicas_semana is 'Técnicas ensinadas em cada semana (segunda-feira da semana), por turma. O aluno vê no app, em Movimentos.';
create index if not exists tecnicas_semana_semana_idx on public.tecnicas_semana (semana, turma, ordem);

-- ===== o que o aluno marca: "aprendi" (uma técnica da semana) e "quero aprender" (texto livre) =====
create table if not exists public.tecnicas_aluno (
  id         uuid primary key default gen_random_uuid(),
  aluno      uuid not null references public.alunos (id) on delete cascade,
  tipo       text not null check (tipo in ('aprendi', 'quero')),
  tecnica    uuid references public.tecnicas_semana (id) on delete cascade,
  titulo     text check (char_length(titulo) between 2 and 120),
  visto      boolean not null default false,                  -- "quero aprender": o professor já tratou o pedido
  criado_em  timestamptz not null default now(),
  check ((tipo = 'aprendi' and tecnica is not null) or (tipo = 'quero' and titulo is not null))
);
comment on table public.tecnicas_aluno is 'Marcações do aluno: aprendi (técnica da semana) e quero aprender (pedido em texto livre).';
create unique index if not exists tecnicas_aluno_aprendi_uq on public.tecnicas_aluno (aluno, tecnica) where tipo = 'aprendi';
create index if not exists tecnicas_aluno_tipo_idx on public.tecnicas_aluno (tipo, visto, criado_em desc);

-- ===== regras =====
alter table public.tecnicas_semana enable row level security;
alter table public.tecnicas_aluno enable row level security;

drop policy if exists "professor gerencia tecnicas da semana" on public.tecnicas_semana;
create policy "professor gerencia tecnicas da semana" on public.tecnicas_semana for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
drop policy if exists "aluno ve as tecnicas da semana" on public.tecnicas_semana;
create policy "aluno ve as tecnicas da semana" on public.tecnicas_semana for select to authenticated
  using ((select privado.meu_aluno()) is not null);

drop policy if exists "professor ve e trata as marcacoes" on public.tecnicas_aluno;
create policy "professor ve e trata as marcacoes" on public.tecnicas_aluno for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
drop policy if exists "aluno le as proprias marcacoes" on public.tecnicas_aluno;
create policy "aluno le as proprias marcacoes" on public.tecnicas_aluno for select to authenticated
  using (aluno in (select privado.meus_alunos()));
drop policy if exists "aluno marca" on public.tecnicas_aluno;
create policy "aluno marca" on public.tecnicas_aluno for insert to authenticated
  with check (aluno in (select privado.meus_alunos()) and visto = false);
drop policy if exists "aluno desmarca" on public.tecnicas_aluno;
create policy "aluno desmarca" on public.tecnicas_aluno for delete to authenticated
  using (aluno in (select privado.meus_alunos()));

revoke all on table public.tecnicas_semana, public.tecnicas_aluno from anon, authenticated;
grant select, insert, update, delete on table public.tecnicas_semana, public.tecnicas_aluno to authenticated;
