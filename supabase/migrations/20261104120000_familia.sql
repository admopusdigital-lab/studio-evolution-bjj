-- Studio Evolution BJJ · plano família: uma conta do app cuida do próprio cadastro e dos dependentes.
-- O pai (ou a mãe) entra no app com a conta dele, escolhe quem vai treinar, marca a aula e faz o check-in
-- dos filhos. Pode rodar mais de uma vez (idempotente). Rode depois de 20261103120000_kids_reservas.sql.

-- ===== o dependente aponta para a conta do responsável =====
alter table public.alunos add column if not exists responsavel_conta uuid references auth.users (id) on delete set null;
create index if not exists alunos_responsavel_conta_idx on public.alunos (responsavel_conta);
comment on column public.alunos.responsavel_conta is 'Plano família: a conta do app (do pai ou da mãe) que cuida deste aluno dependente.';

-- ===== os cadastros da família da conta logada: o próprio e os dos dependentes =====
create or replace function privado.meus_alunos()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.alunos
  where ativo and (conta = (select auth.uid()) or responsavel_conta = (select auth.uid()));
$$;
revoke all on function privado.meus_alunos() from public;
grant execute on function privado.meus_alunos() to authenticated;

-- o aluno escolhido no app, conferindo que é da família; sem escolha, o próprio cadastro (ou o 1º dependente)
create or replace function privado.aluno_da_conta(p_aluno uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select a.id from public.alunos a
  where a.ativo and (a.conta = (select auth.uid()) or a.responsavel_conta = (select auth.uid()))
    and (p_aluno is null or a.id = p_aluno)
  order by (a.conta is not distinct from (select auth.uid())) desc, a.nome
  limit 1;
$$;
revoke all on function privado.aluno_da_conta(uuid) from public;
grant execute on function privado.aluno_da_conta(uuid) to authenticated;

-- meu_aluno passa a valer também para quem só tem dependentes (o pai que não treina)
create or replace function privado.meu_aluno()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select privado.aluno_da_conta(null);
$$;

-- ===== regras: a conta vê o que é da família =====
drop policy if exists "aluno le o proprio cadastro" on public.alunos;
create policy "aluno le o proprio cadastro" on public.alunos for select to authenticated
  using (conta = (select auth.uid()) or responsavel_conta = (select auth.uid()));
drop policy if exists "aluno le as proprias presencas" on public.presencas;
create policy "aluno le as proprias presencas" on public.presencas for select to authenticated
  using (aluno in (select privado.meus_alunos()));
drop policy if exists "aluno le as proprias reservas" on public.reservas;
create policy "aluno le as proprias reservas" on public.reservas for select to authenticated
  using (aluno in (select privado.meus_alunos()));
drop policy if exists "aluno cancela a propria reserva" on public.reservas;
create policy "aluno cancela a propria reserva" on public.reservas for delete to authenticated
  using (aluno in (select privado.meus_alunos()));
drop policy if exists "aluno le as proprias graduacoes" on public.graduacoes;
create policy "aluno le as proprias graduacoes" on public.graduacoes for select to authenticated
  using (aluno in (select privado.meus_alunos()));
drop policy if exists "aluno le as proprias mensalidades" on public.mensalidades;
create policy "aluno le as proprias mensalidades" on public.mensalidades for select to authenticated
  using (aluno in (select privado.meus_alunos()));

-- ===== conta nova: liga o cadastro com o mesmo e-mail (de preferência o do adulto) e os outros viram dependentes =====
create or replace function privado.liga_conta()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  em text;
  dono uuid;
begin
  if new.papel <> 'aluno' then return new; end if;
  select lower(email) into em from auth.users where id = new.id;
  if em is null then return new; end if;
  select id into dono from public.alunos
  where conta is null and lower(email) = em
  order by (turma in ('adulto', 'feminino')) desc, criado_em limit 1;
  if dono is not null then update public.alunos set conta = new.id where id = dono; end if;
  update public.alunos set responsavel_conta = new.id
  where conta is null and responsavel_conta is null and lower(email) = em and id is distinct from dono;
  return new;
end;
$$;

-- ===== marcar aula: para si ou para um dependente (p_aluno) =====
drop function if exists public.reservar(date, text);
create or replace function public.reservar(p_data date, p_hora text, p_aluno uuid default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.aluno_da_conta(p_aluno);
  inicio timestamptz;
  n integer;
begin
  if eu is null then
    raise exception 'Esse cadastro não está ligado à sua conta. Fale com o professor.' using errcode = 'P0001';
  end if;
  if p_data is null or coalesce(p_hora, '') !~ '^[0-2][0-9]:[0-5][0-9]$' then
    raise exception 'Aula inválida.' using errcode = 'P0003';
  end if;
  inicio := (p_data + p_hora::time) at time zone 'America/Sao_Paulo';
  if inicio + interval '1 hour' <= now() then
    raise exception 'Essa aula já passou.' using errcode = 'P0003';
  end if;
  if inicio > now() + interval '48 hours' then
    raise exception 'Dá para marcar com até 48 horas de antecedência.' using errcode = 'P0005';
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
revoke all on function public.reservar(date, text, uuid) from public, anon;
grant execute on function public.reservar(date, text, uuid) to authenticated;

-- ===== check-in com o código da aula: para si ou para um dependente =====
drop function if exists public.registrar_presenca(text);
create or replace function public.registrar_presenca(p_codigo text, p_aluno uuid default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.aluno_da_conta(p_aluno);
  ch public.chamadas;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  p public.presencas;
begin
  if eu is null then
    raise exception 'Esse cadastro não está ligado à sua conta. Fale com o professor.' using errcode = 'P0001';
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
  return json_build_object('data', p.data, 'hora', p.hora, 'turma', p.turma, 'chegou_em', p.chegou_em, 'como', p.como, 'aluno', eu);
end;
$$;
revoke all on function public.registrar_presenca(text, uuid) from public, anon;
grant execute on function public.registrar_presenca(text, uuid) to authenticated;

-- ===== quem vai: "você" é o membro da família escolhido no app =====
drop function if exists public.confirmados_aula(date, text);
create or replace function public.confirmados_aula(p_data date, p_hora text, p_aluno uuid default null)
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
    a.id = privado.aluno_da_conta(p_aluno),
    (select p.chegou_em from public.presencas p where p.aluno = a.id and p.data = r.data and p.hora = r.hora),
    r.criado_em
  from public.reservas r
  join public.alunos a on a.id = r.aluno
  where r.data = p_data and r.hora = p_hora
    and (privado.meu_aluno() is not null or privado.eh_professor())
  order by r.criado_em;
$$;
revoke all on function public.confirmados_aula(date, text, uuid) from public, anon;
grant execute on function public.confirmados_aula(date, text, uuid) to authenticated;

-- ===== ranking: a turma (Adulto ou Kids) e a posição do membro escolhido =====
drop function if exists public.ranking_frequencia(integer);
create or replace function public.ranking_frequencia(p_dias integer default 30, p_aluno uuid default null)
returns table (posicao integer, nome text, faixa text, graus smallint, aulas integer, eu boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select a.id, a.turma from public.alunos a where a.id = privado.aluno_da_conta(p_aluno)
  ), grupo as (
    select case when (select turma from me) in ('kids1', 'kids2') then array['kids1', 'kids2']::text[] else array['adulto', 'feminino']::text[] end as g
  ), base as (
    select a.id, a.nome, a.faixa, a.graus, count(p.id)::integer as aulas
    from public.alunos a
    left join public.presencas p on p.aluno = a.id
      and p.data > (now() at time zone 'America/Sao_Paulo')::date - greatest(1, least(coalesce(p_dias, 30), 400))
    where a.ativo and a.turma = any ((select g from grupo)::text[])
    group by a.id
  ), r as (
    select b.*, rank() over (order by b.aulas desc)::integer as pos from base b where b.aulas > 0
  )
  select r.pos,
    split_part(trim(r.nome), ' ', 1) || coalesce(' ' || upper(left(nullif(split_part(trim(r.nome), ' ', 2), ''), 1)) || '.', ''),
    r.faixa, r.graus, r.aulas, r.id = (select id from me)
  from r
  where (exists (select 1 from me) or privado.eh_professor())
    and (r.pos <= 10 or r.id = (select id from me))
  order by r.pos, r.nome;
$$;
revoke all on function public.ranking_frequencia(integer, uuid) from public, anon;
grant execute on function public.ranking_frequencia(integer, uuid) to authenticated;
