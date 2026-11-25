-- Studio Evolution BJJ · grade de aulas editável pelo professor (Configurações → Aulas e horários).
-- A grade fica em configuracoes, na chave 'grade': uma lista de aulas {t: "19:00", n: "Adulto", d: [1,2,3,4,5]}
-- (d = dias da semana, 0 = domingo). O site, o app e o painel leem pela função pública grade_aulas();
-- sem grade salva, todos usam a grade padrão que está no site.js. Só o professor (ou a equipe com a área
-- Configurações) grava, pelas regras que a tabela configuracoes já tem.
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

-- formato válido: de 1 a 60 aulas, horário HH:MM, turma conhecida e de 1 a 7 dias entre 0 e 6
create or replace function privado.grade_valida(v jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(v) = 'array'
     and jsonb_array_length(v) between 1 and 60
     and not exists (
       select 1 from jsonb_array_elements(v) e
       where not (
         jsonb_typeof(e) = 'object'
         and coalesce(e->>'t', '') ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         and coalesce(e->>'n', '') in ('Adulto', 'Kids 1', 'Kids 2', 'Open Mat')
         and jsonb_typeof(e->'d') = 'array'
         and jsonb_array_length(e->'d') between 1 and 7
         and not exists (select 1 from jsonb_array_elements(e->'d') x where jsonb_typeof(x) <> 'number' or x::text !~ '^[0-6]$')
       )
     );
$$;

alter table public.configuracoes drop constraint if exists configuracoes_grade_formato;
alter table public.configuracoes add constraint configuracoes_grade_formato check (chave <> 'grade' or privado.grade_valida(valor));

-- leitura pública da grade (o site não tem login)
create or replace function public.grade_aulas()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select valor from public.configuracoes where chave = 'grade';
$$;

revoke all on function public.grade_aulas() from public;
grant execute on function public.grade_aulas() to anon, authenticated;
