-- Studio Evolution BJJ · avisos por aluno.
-- O professor (ou a equipe) escreve um recado no painel, na aba Avisos, para um aluno, uma turma ou todos.
-- Cada recado vira uma linha aqui, já com o primeiro nome do aluno no texto. Quem ativou os avisos recebe a
-- notificação no celular; quem não ativou vê o recado ao abrir o app. Quem grava é a função de servidor "push".
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez). Precisa das tabelas de push (28/11).

create table if not exists public.avisos (
  id         uuid primary key default gen_random_uuid(),
  aluno      uuid not null references public.alunos (id) on delete cascade,
  titulo     text not null check (char_length(titulo) between 1 and 80),
  corpo      text not null default '' check (char_length(corpo) <= 400),
  tela       text check (tela is null or tela in ('inicio', 'presenca', 'movimentos', 'perfil')),
  criado_em  timestamptz not null default now(),
  criado_por uuid references auth.users (id) on delete set null,
  lido_em    timestamptz
);
-- de qual envio do painel o recado veio (para o histórico contar quantos leram)
alter table public.avisos add column if not exists envio uuid references public.push_envios (id) on delete set null;
create index if not exists avisos_aluno_idx on public.avisos (aluno, criado_em desc);
create index if not exists avisos_envio_idx on public.avisos (envio);
comment on table public.avisos is 'Recados do Studio para cada aluno: aparecem no app e, para quem ativou, como notificação.';

alter table public.avisos enable row level security;
-- o aluno (e o responsável) lê os próprios; a equipe lê todos
drop policy if exists "aluno le os proprios avisos" on public.avisos;
create policy "aluno le os proprios avisos" on public.avisos for select to authenticated
  using (aluno in (select privado.meus_alunos()) or (select privado.equipe()));
-- escrever é só da equipe (o caminho normal é a função push, com a chave de servidor)
drop policy if exists "equipe cria avisos" on public.avisos;
create policy "equipe cria avisos" on public.avisos for insert to authenticated
  with check ((select privado.equipe()));
drop policy if exists "equipe altera avisos" on public.avisos;
create policy "equipe altera avisos" on public.avisos for update to authenticated
  using ((select privado.equipe())) with check ((select privado.equipe()));
drop policy if exists "equipe apaga avisos" on public.avisos;
create policy "equipe apaga avisos" on public.avisos for delete to authenticated
  using ((select privado.equipe()));
revoke all on table public.avisos from anon, authenticated;
grant select, insert, update, delete on table public.avisos to authenticated;

-- o aluno abriu o recado: marca como lido (só os dele, e só uma vez)
create or replace function public.aviso_lido(p_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with t as (
    update public.avisos set lido_em = now()
    where id = p_id and lido_em is null and aluno in (select privado.meus_alunos())
    returning 1
  )
  select exists (select 1 from t);
$$;
revoke all on function public.aviso_lido(uuid) from public, anon;
grant execute on function public.aviso_lido(uuid) to authenticated;

-- para o painel: quantos aparelhos com aviso ativo cada aluno tem (a conta dele e a do responsável).
-- Só a equipe recebe resposta; aluno sem aparelho não aparece na lista.
create or replace function public.push_alcance()
returns table (aluno uuid, aparelhos integer)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, count(distinct i.id)::integer
  from public.alunos a
  join public.push_inscricoes i on i.conta = a.conta or i.conta = a.responsavel_conta
  where a.ativo and (select privado.equipe())
  group by a.id;
$$;
revoke all on function public.push_alcance() from public, anon;
grant execute on function public.push_alcance() to authenticated;
