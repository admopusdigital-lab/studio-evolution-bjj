-- Studio Evolution BJJ · faixas do Kids, reserva até 48h antes e aulas feitas antes do app.
-- Pode rodar mais de uma vez (idempotente). Rode depois de instalar-gestao.sql.

-- ===== faixas: as do Kids (CBJJ/IBJJF, 4 a 15 anos) além das do adulto =====
-- cinza, amarela, laranja e verde têm três versões: com listra branca, lisa e com listra preta
do $$
declare
  lista text := $l$('branca', 'cinza-branca', 'cinza', 'cinza-preta', 'amarela-branca', 'amarela', 'amarela-preta',
    'laranja-branca', 'laranja', 'laranja-preta', 'verde-branca', 'verde', 'verde-preta', 'azul', 'roxa', 'marrom', 'preta')$l$;
begin
  alter table public.alunos drop constraint if exists alunos_faixa_check;
  execute 'alter table public.alunos add constraint alunos_faixa_check check (faixa in ' || lista || ')';
  alter table public.graduacoes drop constraint if exists graduacoes_faixa_check;
  execute 'alter table public.graduacoes add constraint graduacoes_faixa_check check (faixa in ' || lista || ')';
  if to_regclass('public.perfis') is not null then
    alter table public.perfis drop constraint if exists perfis_faixa_check;
    execute 'alter table public.perfis add constraint perfis_faixa_check check (faixa in ' || lista || ')';
  end if;
end $$;

-- ===== aulas feitas antes do app: o professor lança o número, que entra nas contas do aluno =====
-- aulas_antes_ate: até quando essas aulas foram feitas (contam como "desde o último grau" se o grau é anterior)
alter table public.alunos add column if not exists aulas_antes integer not null default 0;
alter table public.alunos add column if not exists aulas_antes_ate date;
alter table public.alunos drop constraint if exists alunos_aulas_antes_check;
alter table public.alunos add constraint alunos_aulas_antes_check check (aulas_antes between 0 and 5000);
comment on column public.alunos.aulas_antes is 'Aulas feitas antes do app (lançadas pelo professor); somam no total do aluno.';

-- ===== reserva: qualquer aula que ainda não acabou e começa em até 48 horas; várias no mesmo dia =====
create or replace function public.reservar(p_data date, p_hora text)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.meu_aluno();
  inicio timestamptz;
  n integer;
begin
  if eu is null then
    raise exception 'Sua conta ainda não está ligada a um cadastro de aluno. Fale com o professor.' using errcode = 'P0001';
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
revoke all on function public.reservar(date, text) from public, anon;
grant execute on function public.reservar(date, text) to authenticated;

-- ===== ranking de frequência para o app: os 10 que mais treinaram no período (e a posição de quem pergunta).
-- Kids e Adulto têm rankings separados; o aluno vê o primeiro nome e a inicial do sobrenome, como em "quem vai" =====
create or replace function public.ranking_frequencia(p_dias integer default 30)
returns table (posicao integer, nome text, faixa text, graus smallint, aulas integer, eu boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select a.id, a.turma from public.alunos a where a.id = privado.meu_aluno()
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
revoke all on function public.ranking_frequencia(integer) from public, anon;
grant execute on function public.ranking_frequencia(integer) to authenticated;
