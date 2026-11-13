-- Studio Evolution BJJ · foto dos alunos: aparece redondinha em "quem vai", no ranking, no Perfil do app e no painel.
-- A foto fica no Storage, bucket privado "fotos", em <id do aluno>/<arquivo>.jpg. Só vê quem tem conta de aluno
-- ou de professor (link assinado). O professor troca a foto de qualquer aluno; a conta do app, a do próprio
-- cadastro e a dos dependentes. Pode rodar mais de uma vez (idempotente). Rode depois de 20261111120000_estoque_cobrancas.sql.

-- ===== o caminho da foto no cadastro =====
alter table public.alunos add column if not exists foto text;
alter table public.alunos drop constraint if exists alunos_foto_check;
alter table public.alunos add constraint alunos_foto_check check (foto is null or (char_length(foto) <= 120 and foto like id::text || '/%'));
comment on column public.alunos.foto is 'Foto do aluno: caminho no bucket privado "fotos" (<id do aluno>/<arquivo>.jpg).';

-- ===== o bucket: privado, só JPEG/WebP/PNG, até 1 MB (o app já manda a foto reduzida, ~30 KB) =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', false, 1048576, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ===== regras do bucket =====
-- ver: quem tem conta de aluno ligada a um cadastro, ou o professor
drop policy if exists "fotos: ver" on storage.objects;
create policy "fotos: ver" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and ((select privado.eh_professor()) or (select privado.meu_aluno()) is not null));
-- enviar, trocar e apagar: o professor, ou a conta dona do cadastro (a pasta é o id do aluno)
drop policy if exists "fotos: enviar" on storage.objects;
create policy "fotos: enviar" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and ((select privado.eh_professor())
    or (storage.foldername(name))[1] in (select m::text from privado.meus_alunos() m)));
drop policy if exists "fotos: trocar" on storage.objects;
create policy "fotos: trocar" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and ((select privado.eh_professor())
    or (storage.foldername(name))[1] in (select m::text from privado.meus_alunos() m)));
drop policy if exists "fotos: apagar" on storage.objects;
create policy "fotos: apagar" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and ((select privado.eh_professor())
    or (storage.foldername(name))[1] in (select m::text from privado.meus_alunos() m)));

-- ===== o aluno (ou o responsável) troca a própria foto pelo app; o cadastro em si continua só do professor =====
create or replace function public.definir_foto(p_foto text, p_aluno uuid default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.aluno_da_conta(p_aluno);
  antiga text;
begin
  if eu is null then
    raise exception 'Esse cadastro não está ligado à sua conta. Fale com o professor.' using errcode = 'P0001';
  end if;
  if p_foto is not null and (char_length(p_foto) > 120 or p_foto not like eu::text || '/%') then
    raise exception 'Foto inválida.' using errcode = 'P0003';
  end if;
  select foto into antiga from public.alunos where id = eu;
  update public.alunos set foto = p_foto where id = eu;
  return json_build_object('ok', true, 'foto', p_foto, 'antiga', antiga);
end;
$$;
revoke all on function public.definir_foto(text, uuid) from public, anon;
grant execute on function public.definir_foto(text, uuid) to authenticated;

-- ===== quem vai: agora com a foto =====
drop function if exists public.confirmados_aula(date, text, uuid);
create or replace function public.confirmados_aula(p_data date, p_hora text, p_aluno uuid default null)
returns table (nome text, faixa text, graus smallint, eu boolean, chegou_em timestamptz, confirmou_em timestamptz, foto text)
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
    r.criado_em,
    a.foto
  from public.reservas r
  join public.alunos a on a.id = r.aluno
  where r.data = p_data and r.hora = p_hora
    and (privado.meu_aluno() is not null or privado.eh_professor())
  order by r.criado_em;
$$;
revoke all on function public.confirmados_aula(date, text, uuid) from public, anon;
grant execute on function public.confirmados_aula(date, text, uuid) to authenticated;

-- ===== ranking: agora com a foto =====
drop function if exists public.ranking_frequencia(integer, uuid);
create or replace function public.ranking_frequencia(p_dias integer default 30, p_aluno uuid default null)
returns table (posicao integer, nome text, faixa text, graus smallint, aulas integer, eu boolean, foto text)
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
    select a.id, a.nome, a.faixa, a.graus, a.foto, count(p.id)::integer as aulas
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
    r.faixa, r.graus, r.aulas, r.id = (select id from me), r.foto
  from r
  where (exists (select 1 from me) or privado.eh_professor())
    and (r.pos <= 10 or r.id = (select id from me))
  order by r.pos, r.nome;
$$;
revoke all on function public.ranking_frequencia(integer, uuid) from public, anon;
grant execute on function public.ranking_frequencia(integer, uuid) to authenticated;
