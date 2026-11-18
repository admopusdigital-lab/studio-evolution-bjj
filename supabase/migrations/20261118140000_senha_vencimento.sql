-- Studio Evolution BJJ · (1) vencimento da mensalidade de 1 a 31 e (2) controle da troca de senha pelo app.
-- Já inclui o 20261118130000_vencimento_31.sql (não precisa rodar os dois). Pode rodar mais de uma vez.
--
-- (2) A função trocar-senha (supabase/functions/trocar-senha) deixa o aluno criar uma senha nova confirmando dados do
--     cadastro. Cada tentativa fica registrada aqui para limitar abusos (5 erros por e-mail e 20 por rede por hora).
--     Só a função (com a chave secreta) lê e grava: ninguém do app tem acesso.

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

create table if not exists public.senha_tentativas (
  id        bigint generated always as identity primary key,
  email     text not null,
  ip        text,
  ok        boolean not null default false,
  criado_em timestamptz not null default now()
);
comment on table public.senha_tentativas is 'Tentativas de troca de senha pelo app (função trocar-senha), para limitar abusos.';
create index if not exists senha_tentativas_email_idx on public.senha_tentativas (email, criado_em desc);
create index if not exists senha_tentativas_ip_idx on public.senha_tentativas (ip, criado_em desc);
alter table public.senha_tentativas enable row level security;
revoke all on table public.senha_tentativas from anon, authenticated;
