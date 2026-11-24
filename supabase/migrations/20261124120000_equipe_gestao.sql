-- Studio Evolution BJJ · usuários de gestão (equipe) com permissões por área do painel.
-- O professor (dono) cria a conta na aba Equipe e marca o que a pessoa pode ver e mexer. A regra vale no banco
-- (RLS), não só na tela: sem a permissão, os dados daquela área não saem do servidor.
-- Pode rodar mais de uma vez (idempotente). Rode depois de 20261119120000_loja_fotos.sql.
--
-- Áreas: hoje (Hoje e Modo tatame), alunos, graduacoes, ranking, movimentos, interessados, financeiro, estoque,
-- configuracoes. A Equipe (criar acessos e mudar permissões) é só do professor.
-- Toda a equipe ativa lê o cadastro dos alunos, as presenças e as graduações (os nomes e a frequência aparecem em
-- quase todas as telas); mudar qualquer coisa pede a permissão da área.

-- ===== perfis: o papel "gestao", as permissões e o e-mail (para gerar senha nova pela aba Equipe) =====
alter table public.perfis drop constraint if exists perfis_papel_check;
alter table public.perfis add constraint perfis_papel_check check (papel in ('aluno', 'professor', 'gestao'));
alter table public.perfis add column if not exists permissoes text[] not null default '{}';
alter table public.perfis drop constraint if exists perfis_permissoes_check;
alter table public.perfis add constraint perfis_permissoes_check check (permissoes <@ array['hoje', 'alunos', 'graduacoes', 'ranking', 'movimentos', 'interessados', 'financeiro', 'estoque', 'configuracoes']::text[]);
alter table public.perfis add column if not exists email text check (email is null or char_length(email) <= 200);
comment on column public.perfis.permissoes is 'Usuário de gestão: as áreas do painel que pode ver e mexer.';

-- ===== quem pode o quê =====
-- equipe ativa: o professor ou um usuário de gestão ativo
create or replace function privado.equipe()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and ativo and papel in ('professor', 'gestao')
  );
$$;
revoke all on function privado.equipe() from public;
grant execute on function privado.equipe() to authenticated;

-- pode mexer na área: o professor sempre; o usuário de gestão, se a área estiver nas permissões dele
create or replace function privado.pode(p_area text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and ativo
      and (papel = 'professor' or (papel = 'gestao' and p_area = any (permissoes)))
  );
$$;
revoke all on function privado.pode(text) from public;
grant execute on function privado.pode(text) to authenticated;

-- ===== as regras de cada tabela passam de "só o professor" para "professor ou quem tem a área" =====
-- (refaz cada regra trocando privado.eh_professor() pela checagem da área; numa segunda rodada não há mais o que trocar)
do $$
declare
  r record;
  area text;
  novo_using text;
  novo_check text;
  mapa jsonb := jsonb_build_object(
    'alunos', 'alunos',
    'presencas', 'hoje', 'chamadas', 'hoje', 'reservas', 'hoje',
    'graduacoes', 'graduacoes',
    'mensalidades', 'financeiro', 'cobrancas', 'financeiro', 'despesas', 'financeiro', 'metas', 'financeiro',
    'leads', 'interessados', 'lead_eventos', 'interessados',
    'movimentos', 'movimentos', 'estudos', 'movimentos', 'tecnicas_semana', 'movimentos', 'tecnicas_aluno', 'movimentos',
    'produtos', 'estoque', 'pedidos_loja', 'estoque',
    'configuracoes', 'configuracoes'
  );
begin
  for r in
    select schemaname, tablename, policyname, cmd, permissive, roles, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (coalesce(qual, '') ilike '%eh_professor()%' or coalesce(with_check, '') ilike '%eh_professor()%')
  loop
    if r.schemaname = 'public' and r.tablename = 'perfis' then continue; end if;  -- a equipe só o professor muda
    if r.schemaname = 'storage' then
      if r.policyname = 'fotos: ver' then area := '*';           -- as fotos dos alunos: toda a equipe vê
      elsif r.policyname like 'fotos:%' then area := 'alunos';
      elsif r.policyname like 'loja:%' then area := 'estoque';
      else continue; end if;
    else
      area := mapa ->> r.tablename;
      if area is null then continue; end if;
    end if;
    novo_using := replace(r.qual, 'privado.eh_professor()', case when area = '*' then 'privado.equipe()' else format('privado.pode(%L)', area) end);
    novo_check := replace(r.with_check, 'privado.eh_professor()', case when area = '*' then 'privado.equipe()' else format('privado.pode(%L)', area) end);
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    execute format('create policy %I on %I.%I as %s for %s to %s%s%s',
      r.policyname, r.schemaname, r.tablename,
      case when r.permissive = 'PERMISSIVE' then 'permissive' else 'restrictive' end,
      r.cmd,
      (select string_agg(quote_ident(x), ', ') from unnest(r.roles) x),
      case when novo_using is not null then ' using (' || novo_using || ')' else '' end,
      case when novo_check is not null then ' with check (' || novo_check || ')' else '' end);
  end loop;
end $$;

-- toda a equipe ativa lê o cadastro dos alunos, as presenças e as graduações
drop policy if exists "equipe le os alunos" on public.alunos;
create policy "equipe le os alunos" on public.alunos for select to authenticated using ((select privado.equipe()));
drop policy if exists "equipe le as presencas" on public.presencas;
create policy "equipe le as presencas" on public.presencas for select to authenticated using ((select privado.equipe()));
drop policy if exists "equipe le as graduacoes" on public.graduacoes;
create policy "equipe le as graduacoes" on public.graduacoes for select to authenticated using ((select privado.equipe()));
drop policy if exists "equipe le as reservas" on public.reservas;
create policy "equipe le as reservas" on public.reservas for select to authenticated using ((select privado.equipe()));

-- ===== as funções que conferiam "é professor" =====
-- quem vai e ranking: toda a equipe vê; vender um item: quem tem o Estoque
do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('confirmados_aula', 'ranking_frequencia', 'vender_produto')
  loop
    def := pg_get_functiondef(f.oid);
    if def not ilike '%eh_professor()%' then continue; end if;
    def := replace(def, 'privado.eh_professor()', case when f.proname = 'vender_produto' then 'privado.pode(''estoque'')' else 'privado.equipe()' end);
    execute def;
  end loop;
end $$;
