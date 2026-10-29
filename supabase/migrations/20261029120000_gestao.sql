-- Studio Evolution BJJ · gestão do Studio
-- Alunos, chamada (código da aula), presenças, reservas de vaga, graduações, mensalidades, despesas, meta do mês,
-- interessados (CRM) e configurações. Tudo começa vazio: os dados de exemplo ficam só na demonstração.
--
-- Regras (RLS):
--   - professor ativo lê e muda tudo;
--   - aluno lê só o que é dele (o cadastro ligado à conta, presenças, reservas, graduações, mensalidades);
--   - aluno marca presença só com o código da aula (registrar_presenca) e reserva vaga só com vaga livre (reservar);
--   - o site sem login só manda o pedido de aula experimental (pedido_site), com limite por hora.

-- ===== alunos =====
create table public.alunos (
  id            uuid primary key default gen_random_uuid(),
  conta         uuid unique references auth.users (id) on delete set null,
  nome          text not null check (char_length(nome) between 2 and 120),
  artigo        text check (artigo in ('a', 'o')),
  turma         text not null check (turma in ('adulto', 'feminino', 'kids1', 'kids2')),
  horario       text check (horario ~ '^[0-9]{2}:[0-9]{2}$'),
  responsavel   text check (char_length(responsavel) <= 120),
  nascimento    date,
  whatsapp      text check (whatsapp ~ '^[0-9]{10,13}$'),
  email         text check (char_length(email) <= 200),
  faixa         text not null default 'branca'
                check (faixa in ('branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta')),
  graus         smallint not null default 0 check (graus between 0 and 6),
  mensalidade   numeric(10, 2) check (mensalidade >= 0),
  vencimento    smallint check (vencimento between 1 and 28),
  inicio        date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  saida         date,
  ativo         boolean not null default true,
  nota          text check (char_length(nota) <= 2000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.alunos is 'O cadastro de cada aluno. conta liga ao login do app (no Kids, a conta é do responsável).';
create index alunos_ativo_idx on public.alunos (ativo, turma);
create index alunos_email_idx on public.alunos (lower(email));

-- ===== chamada: o código da aula, que o aluno digita no app =====
create table public.chamadas (
  id         uuid primary key default gen_random_uuid(),
  data       date not null,
  hora       text not null check (hora ~ '^[0-9]{2}:[0-9]{2}$'),
  turma      text not null check (turma in ('adulto', 'kids1', 'kids2', 'openmat')),
  codigo     text not null check (codigo ~ '^[A-Z]{3}[0-9]{3}$'),
  valido_ate timestamptz not null,
  criado_em  timestamptz not null default now(),
  unique (data, hora, turma)
);
create index chamadas_codigo_idx on public.chamadas (codigo, valido_ate);

-- ===== presenças =====
create table public.presencas (
  id        uuid primary key default gen_random_uuid(),
  aluno     uuid not null references public.alunos (id) on delete cascade,
  data      date not null,
  hora      text not null check (hora ~ '^[0-9]{2}:[0-9]{2}$'),
  turma     text not null check (turma in ('adulto', 'kids1', 'kids2', 'openmat')),
  como      text not null default 'professor' check (como in ('app', 'professor')),
  chegou_em timestamptz not null default now(),
  unique (aluno, data, hora)
);
create index presencas_data_idx on public.presencas (data, hora);

-- ===== reservas de vaga (até 10 por aula) =====
create table public.reservas (
  id        uuid primary key default gen_random_uuid(),
  aluno     uuid not null references public.alunos (id) on delete cascade,
  data      date not null,
  hora      text not null check (hora ~ '^[0-9]{2}:[0-9]{2}$'),
  criado_em timestamptz not null default now(),
  unique (aluno, data, hora)
);
create index reservas_data_idx on public.reservas (data, hora);

-- ===== graduações (a última define a faixa e os graus do aluno) =====
create table public.graduacoes (
  id        uuid primary key default gen_random_uuid(),
  aluno     uuid not null references public.alunos (id) on delete cascade,
  faixa     text not null check (faixa in ('branca', 'cinza', 'amarela', 'laranja', 'verde', 'azul', 'roxa', 'marrom', 'preta')),
  graus     smallint not null default 0 check (graus between 0 and 6),
  data      date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  nota      text check (char_length(nota) <= 500),
  criado_em timestamptz not null default now()
);
create index graduacoes_aluno_idx on public.graduacoes (aluno, data desc);

-- ===== mensalidades (uma por aluno por mês) =====
create table public.mensalidades (
  id          uuid primary key default gen_random_uuid(),
  aluno       uuid not null references public.alunos (id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  valor       numeric(10, 2) not null check (valor >= 0),
  vencimento  date not null,
  pago_em     date,
  forma       text check (forma in ('pix', 'boleto', 'cartao', 'dinheiro')),
  nota        text check (char_length(nota) <= 500),
  criado_em   timestamptz not null default now(),
  unique (aluno, competencia)
);
create index mensalidades_comp_idx on public.mensalidades (competencia);

-- ===== despesas =====
create table public.despesas (
  id         uuid primary key default gen_random_uuid(),
  descricao  text not null check (char_length(descricao) between 2 and 120),
  categoria  text not null check (categoria in ('aluguel', 'contas', 'pessoal', 'servicos', 'taxas', 'marketing', 'material', 'manutencao', 'outros')),
  valor      numeric(10, 2) not null check (valor > 0),
  data       date not null,
  recorrente boolean not null default false,
  paga       boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index despesas_data_idx on public.despesas (data);

-- ===== meta do mês =====
create table public.metas (
  mes     date primary key check (extract(day from mes) = 1),
  receita numeric(10, 2) check (receita >= 0),
  alunos  integer check (alunos >= 0)
);

-- ===== interessados (CRM) =====
create table public.leads (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 2 and 120),
  whatsapp      text check (whatsapp ~ '^[0-9]{10,13}$'),
  programa      text not null check (programa in ('adulto', 'feminino', 'kids')),
  crianca       text check (char_length(crianca) <= 120),
  idade         smallint check (idade between 2 and 17),
  origem        text not null default 'outro' check (origem in ('site', 'instagram', 'indicacao', 'visita', 'whatsapp', 'google', 'outro')),
  etapa         text not null default 'novo' check (etapa in ('novo', 'atendimento', 'agendado', 'matriculado', 'perdido')),
  aula_data     date,
  aula_hora     text check (aula_hora ~ '^[0-9]{2}:[0-9]{2}$'),
  turma_aula    text check (char_length(turma_aula) <= 40),
  codigo        text check (char_length(codigo) <= 40),
  nota          text check (char_length(nota) <= 2000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index leads_etapa_idx on public.leads (etapa, criado_em desc);

create table public.lead_eventos (
  id        uuid primary key default gen_random_uuid(),
  lead      uuid not null references public.leads (id) on delete cascade,
  texto     text not null check (char_length(texto) between 1 and 1000),
  criado_em timestamptz not null default now()
);
create index lead_eventos_lead_idx on public.lead_eventos (lead, criado_em desc);

-- ===== configurações (dados do Studio) =====
create table public.configuracoes (
  chave         text primary key check (char_length(chave) between 1 and 60),
  valor         jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- ===== atualizado_em =====
create trigger alunos_atualizado_em before update on public.alunos
  for each row execute function privado.marca_atualizacao();
create trigger leads_atualizado_em before update on public.leads
  for each row execute function privado.marca_atualizacao();
create trigger configuracoes_atualizado_em before update on public.configuracoes
  for each row execute function privado.marca_atualizacao();

-- ===== o aluno logado: o cadastro ligado à conta =====
create or replace function privado.meu_aluno()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.alunos where conta = (select auth.uid()) and ativo limit 1;
$$;
revoke all on function privado.meu_aluno() from public;
grant execute on function privado.meu_aluno() to authenticated;

-- ===== graduação nova muda a faixa e os graus do aluno =====
create or replace function privado.aplica_graduacao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.alunos a set faixa = new.faixa, graus = new.graus
  where a.id = new.aluno
    and not exists (select 1 from public.graduacoes g where g.aluno = new.aluno and g.id <> new.id and g.data > new.data);
  return new;
end;
$$;
create trigger graduacoes_aplica after insert on public.graduacoes
  for each row execute function privado.aplica_graduacao();

-- ===== conta nova de aluno (criada em Acessos) liga sozinha ao cadastro com o mesmo e-mail =====
create or replace function privado.liga_conta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  em text;
begin
  if new.papel <> 'aluno' then return new; end if;
  select lower(email) into em from auth.users where id = new.id;
  if em is null then return new; end if;
  update public.alunos set conta = new.id
  where id = (select id from public.alunos where conta is null and lower(email) = em order by criado_em limit 1);
  return new;
end;
$$;
create trigger perfis_liga_conta after insert on public.perfis
  for each row execute function privado.liga_conta();

-- ===== RLS =====
alter table public.alunos enable row level security;
alter table public.chamadas enable row level security;
alter table public.presencas enable row level security;
alter table public.reservas enable row level security;
alter table public.graduacoes enable row level security;
alter table public.mensalidades enable row level security;
alter table public.despesas enable row level security;
alter table public.metas enable row level security;
alter table public.leads enable row level security;
alter table public.lead_eventos enable row level security;
alter table public.configuracoes enable row level security;

-- professor: tudo
create policy "professor gerencia alunos" on public.alunos for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia chamadas" on public.chamadas for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia presencas" on public.presencas for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia reservas" on public.reservas for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia graduacoes" on public.graduacoes for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia mensalidades" on public.mensalidades for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia despesas" on public.despesas for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia metas" on public.metas for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia leads" on public.leads for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia historico dos leads" on public.lead_eventos for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
create policy "professor gerencia configuracoes" on public.configuracoes for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));

-- aluno: só o que é dele
create policy "aluno le o proprio cadastro" on public.alunos for select to authenticated
  using (conta = (select auth.uid()));
create policy "aluno le as proprias presencas" on public.presencas for select to authenticated
  using (aluno = (select privado.meu_aluno()));
create policy "aluno le as proprias reservas" on public.reservas for select to authenticated
  using (aluno = (select privado.meu_aluno()));
create policy "aluno cancela a propria reserva" on public.reservas for delete to authenticated
  using (aluno = (select privado.meu_aluno()));
create policy "aluno le as proprias graduacoes" on public.graduacoes for select to authenticated
  using (aluno = (select privado.meu_aluno()));
create policy "aluno le as proprias mensalidades" on public.mensalidades for select to authenticated
  using (aluno = (select privado.meu_aluno()));

-- privilégios: o anônimo não vê nenhuma tabela; o logado só o que as regras acima deixam
revoke all on table public.alunos, public.chamadas, public.presencas, public.reservas, public.graduacoes,
  public.mensalidades, public.despesas, public.metas, public.leads, public.lead_eventos, public.configuracoes
  from anon, authenticated;
grant select, insert, update, delete on table public.alunos, public.chamadas, public.presencas, public.reservas,
  public.graduacoes, public.mensalidades, public.despesas, public.metas, public.leads, public.lead_eventos,
  public.configuracoes to authenticated;

-- ===== funções chamadas pelo app e pelo site =====

-- o aluno digita o código da aula: vale só na aula aberta e dentro do prazo
create or replace function public.registrar_presenca(p_codigo text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.meu_aluno();
  ch public.chamadas;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p public.presencas;
begin
  if eu is null then
    raise exception 'Sua conta ainda não está ligada a um cadastro de aluno. Fale com o professor.' using errcode = 'P0001';
  end if;
  select * into ch from public.chamadas
  where codigo = upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g')) and data = hoje and valido_ate >= now()
  order by valido_ate desc limit 1;
  if ch.id is null then
    raise exception 'Código não confere ou já venceu. Confira na TV do tatame.' using errcode = 'P0002';
  end if;
  insert into public.presencas (aluno, data, hora, turma, como)
  values (eu, ch.data, ch.hora, ch.turma, 'app')
  on conflict (aluno, data, hora) do nothing;
  select * into p from public.presencas where aluno = eu and data = ch.data and hora = ch.hora;
  return json_build_object('data', p.data, 'hora', p.hora, 'turma', p.turma, 'chegou_em', p.chegou_em, 'como', p.como);
end;
$$;

-- quantas vagas já foram reservadas numa aula (o aluno não vê quem reservou, só o número)
create or replace function public.vagas_aula(p_data date, p_hora text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.reservas where data = p_data and hora = p_hora;
$$;

-- o aluno reserva a vaga: aula de hoje em diante e até 10 por aula
create or replace function public.reservar(p_data date, p_hora text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.meu_aluno();
  n integer;
begin
  if eu is null then
    raise exception 'Sua conta ainda não está ligada a um cadastro de aluno. Fale com o professor.' using errcode = 'P0001';
  end if;
  if p_data < (now() at time zone 'America/Sao_Paulo')::date or p_hora !~ '^[0-9]{2}:[0-9]{2}$' then
    raise exception 'Essa aula já passou.' using errcode = 'P0003';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_data::text || p_hora));
  if exists (select 1 from public.reservas where aluno = eu and data = p_data and hora = p_hora) then
    return json_build_object('ok', true, 'vagas', (select count(*) from public.reservas where data = p_data and hora = p_hora));
  end if;
  select count(*) into n from public.reservas where data = p_data and hora = p_hora;
  if n >= 10 then
    raise exception 'A turma já está cheia (10 de 10).' using errcode = 'P0004';
  end if;
  insert into public.reservas (aluno, data, hora) values (eu, p_data, p_hora);
  return json_build_object('ok', true, 'vagas', n + 1);
end;
$$;

-- quem confirmou a aula: o aluno vê o primeiro nome, a inicial do sobrenome e a faixa de cada um,
-- e quem já chegou. Só para quem tem cadastro de aluno ativo ou é professor
create or replace function public.confirmados_aula(p_data date, p_hora text)
returns table (nome text, faixa text, graus smallint, eu boolean, chegou_em timestamptz, confirmou_em timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select
    split_part(trim(a.nome), ' ', 1)
      || coalesce(' ' || upper(left(nullif(split_part(trim(a.nome), ' ', 2), ''), 1)) || '.', ''),
    a.faixa,
    a.graus,
    a.id = privado.meu_aluno(),
    (select p.chegou_em from public.presencas p where p.aluno = a.id and p.data = r.data and p.hora = r.hora),
    r.criado_em
  from public.reservas r
  join public.alunos a on a.id = r.aluno
  where r.data = p_data and r.hora = p_hora
    and (privado.meu_aluno() is not null or privado.eh_professor())
  order by r.criado_em;
$$;

-- o pedido de aula experimental do site (sem login): entra em Interessados
create or replace function public.pedido_site(p_nome text, p_programa text, p_data date, p_hora text, p_turma text, p_codigo text, p_familia boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo uuid;
  nm text := nullif(trim(coalesce(p_nome, '')), '');
  prog text := case when p_programa in ('kids1', 'kids2', 'kids') then 'kids' when p_programa = 'feminino' then 'feminino' else 'adulto' end;
begin
  -- limite contra abuso: no máximo 30 pedidos do site por hora
  if (select count(*) from public.leads where origem = 'site' and criado_em > now() - interval '1 hour') >= 30 then
    return false;
  end if;
  if p_hora !~ '^[0-9]{2}:[0-9]{2}$' or p_data is null or p_data < (now() at time zone 'America/Sao_Paulo')::date - 1 then
    return false;
  end if;
  insert into public.leads (nome, programa, origem, etapa, aula_data, aula_hora, turma_aula, codigo)
  values (left(coalesce(nm, 'Pedido pelo site'), 120), prog, 'site', 'novo', p_data, p_hora, left(p_turma, 40), left(p_codigo, 40))
  returning id into novo;
  insert into public.lead_eventos (lead, texto)
  values (novo, left('Pedido pelo site: aula experimental no ' || coalesce(p_turma, prog) || ', ' || to_char(p_data, 'DD/MM') || ', às ' || p_hora
    || case when p_familia then ' (com o Adulto junto)' else '' end || coalesce(' · ingresso ' || p_codigo, ''), 1000));
  return true;
end;
$$;

revoke all on function public.registrar_presenca(text), public.vagas_aula(date, text), public.reservar(date, text),
  public.confirmados_aula(date, text), public.pedido_site(text, text, date, text, text, text, boolean) from public;
-- o Supabase também dá execução direto ao anon: aqui ela sai das funções que pedem login
revoke execute on function public.registrar_presenca(text), public.vagas_aula(date, text), public.reservar(date, text),
  public.confirmados_aula(date, text) from anon;
grant execute on function public.registrar_presenca(text), public.vagas_aula(date, text), public.reservar(date, text),
  public.confirmados_aula(date, text) to authenticated;
grant execute on function public.pedido_site(text, text, date, text, text, text, boolean) to anon, authenticated;
