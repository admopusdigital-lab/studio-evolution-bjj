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
