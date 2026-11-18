-- Studio Evolution BJJ · dia de vencimento da mensalidade de 1 a 31.
-- No mês que não tem o dia (ex.: 30 em fevereiro, 31 em abril), o painel lança no último dia do mês.
-- Pode rodar mais de uma vez (idempotente). Rode depois de 20261118120000_kids_graus_tecnicas.sql.
do $$
declare
  r record;
begin
  for r in
    select c.conname from pg_constraint c
    where c.contype = 'c' and c.conrelid = 'public.alunos'::regclass and pg_get_constraintdef(c.oid) ilike '%vencimento%'
  loop
    execute format('alter table public.alunos drop constraint %I', r.conname);
  end loop;
  alter table public.alunos add constraint alunos_vencimento_check check (vencimento between 1 and 31);
end $$;
