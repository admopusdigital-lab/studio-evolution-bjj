-- Studio Evolution BJJ · estoque e loja (kimono, rashguard…) e outros valores no cadastro do aluno
-- (taxa de matrícula, produto vendido, qualquer valor avulso). Pode rodar mais de uma vez (idempotente).
-- Rode depois de 20261104120000_familia.sql.

-- ===== estoque: uma linha por produto e tamanho (ex.: Kimono branco A2, 3 unidades) =====
create table if not exists public.produtos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null check (char_length(nome) between 2 and 80),
  categoria     text not null default 'kimono' check (categoria in ('kimono', 'rashguard', 'faixa', 'camiseta', 'acessorio', 'outro')),
  cor           text check (char_length(cor) <= 40),
  tamanho       text not null default 'Único' check (char_length(tamanho) between 1 and 12),
  preco         numeric(10, 2) not null check (preco >= 0),
  quantidade    integer not null default 0 check (quantidade >= 0),
  descricao     text check (char_length(descricao) <= 300),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.produtos is 'Estoque da loja do Studio: uma linha por produto e tamanho. O app mostra a loja só quando há item com quantidade.';
create index if not exists produtos_ativo_idx on public.produtos (ativo, categoria, nome);

-- ===== outros valores do aluno: taxa de matrícula, produto vendido, qualquer valor avulso =====
create table if not exists public.cobrancas (
  id          uuid primary key default gen_random_uuid(),
  aluno       uuid not null references public.alunos (id) on delete cascade,
  descricao   text not null check (char_length(descricao) between 2 and 80),
  tipo        text not null default 'outro' check (tipo in ('matricula', 'produto', 'outro')),
  valor       numeric(10, 2) not null check (valor >= 0),
  vencimento  date not null default ((now() at time zone 'America/Sao_Paulo')::date),
  pago_em     date,
  forma       text check (forma in ('pix', 'boleto', 'cartao', 'dinheiro')),
  produto     uuid references public.produtos (id) on delete set null,
  quantidade  integer not null default 1 check (quantidade > 0),
  criado_em   timestamptz not null default now()
);
comment on table public.cobrancas is 'Valores avulsos do aluno (fora da mensalidade): entram no Financeiro pelo mês do vencimento.';
create index if not exists cobrancas_aluno_idx on public.cobrancas (aluno, vencimento desc);
create index if not exists cobrancas_venc_idx on public.cobrancas (vencimento);

-- ===== pedidos feitos pelo app (o aluno pede, o professor vende ou cancela) =====
create table if not exists public.pedidos_loja (
  id        uuid primary key default gen_random_uuid(),
  aluno     uuid not null references public.alunos (id) on delete cascade,
  produto   uuid not null references public.produtos (id) on delete cascade,
  status    text not null default 'novo' check (status in ('novo', 'vendido', 'cancelado')),
  criado_em timestamptz not null default now()
);
create index if not exists pedidos_loja_status_idx on public.pedidos_loja (status, criado_em desc);

drop trigger if exists produtos_atualizado_em on public.produtos;
create trigger produtos_atualizado_em before update on public.produtos
  for each row execute function privado.marca_atualizacao();

-- ===== regras =====
alter table public.produtos enable row level security;
alter table public.cobrancas enable row level security;
alter table public.pedidos_loja enable row level security;

drop policy if exists "professor gerencia produtos" on public.produtos;
create policy "professor gerencia produtos" on public.produtos for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
drop policy if exists "aluno ve a loja" on public.produtos;
create policy "aluno ve a loja" on public.produtos for select to authenticated
  using (ativo and (select privado.meu_aluno()) is not null);

drop policy if exists "professor gerencia cobrancas" on public.cobrancas;
create policy "professor gerencia cobrancas" on public.cobrancas for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
drop policy if exists "aluno le as proprias cobrancas" on public.cobrancas;
create policy "aluno le as proprias cobrancas" on public.cobrancas for select to authenticated
  using (aluno in (select privado.meus_alunos()));

drop policy if exists "professor gerencia pedidos" on public.pedidos_loja;
create policy "professor gerencia pedidos" on public.pedidos_loja for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));
drop policy if exists "aluno le os proprios pedidos" on public.pedidos_loja;
create policy "aluno le os proprios pedidos" on public.pedidos_loja for select to authenticated
  using (aluno in (select privado.meus_alunos()));

revoke all on table public.produtos, public.cobrancas, public.pedidos_loja from anon, authenticated;
grant select, insert, update, delete on table public.produtos, public.cobrancas, public.pedidos_loja to authenticated;

-- ===== o aluno pede um item pelo app (para si ou para um dependente) =====
create or replace function public.pedir_produto(p_produto uuid, p_aluno uuid default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  eu uuid := privado.aluno_da_conta(p_aluno);
  pr public.produtos;
  pid uuid;
begin
  if eu is null then
    raise exception 'Sua conta ainda não está ligada a um cadastro de aluno. Fale com o professor.' using errcode = 'P0001';
  end if;
  select * into pr from public.produtos where id = p_produto and ativo;
  if pr.id is null or pr.quantidade < 1 then
    raise exception 'Esse item acabou. Fale com o professor.' using errcode = 'P0006';
  end if;
  if (select count(*) from public.pedidos_loja where aluno = eu and status = 'novo') >= 5 then
    raise exception 'Você já tem 5 pedidos esperando. Fale com o professor no tatame.' using errcode = 'P0007';
  end if;
  select id into pid from public.pedidos_loja where aluno = eu and produto = p_produto and status = 'novo';
  if pid is null then
    insert into public.pedidos_loja (aluno, produto) values (eu, p_produto) returning id into pid;
  end if;
  return json_build_object('ok', true, 'pedido', pid);
end;
$$;
revoke all on function public.pedir_produto(uuid, uuid) from public, anon;
grant execute on function public.pedir_produto(uuid, uuid) to authenticated;

-- ===== o professor vende: baixa o estoque, lança o valor no aluno e fecha o pedido, tudo junto =====
create or replace function public.vender_produto(p_produto uuid, p_aluno uuid, p_quantidade integer default 1,
  p_pago boolean default false, p_forma text default null, p_pedido uuid default null)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  pr public.produtos;
  q integer := greatest(1, coalesce(p_quantidade, 1));
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  cid uuid;
begin
  if not privado.eh_professor() then
    raise exception 'Só o professor registra vendas.' using errcode = '42501';
  end if;
  select * into pr from public.produtos where id = p_produto for update;
  if pr.id is null then raise exception 'Produto não encontrado.' using errcode = 'P0006'; end if;
  if pr.quantidade < q then
    raise exception 'Só tem % no estoque.', pr.quantidade using errcode = 'P0006';
  end if;
  update public.produtos set quantidade = quantidade - q where id = pr.id;
  insert into public.cobrancas (aluno, descricao, tipo, valor, vencimento, pago_em, forma, produto, quantidade)
  values (p_aluno, left(pr.nome || coalesce(' ' || nullif(pr.cor, ''), '') || ' · ' || pr.tamanho || case when q > 1 then ' (' || q || ')' else '' end, 80),
    'produto', pr.preco * q, hoje, case when p_pago then hoje end, case when p_pago then p_forma end, pr.id, q)
  returning id into cid;
  if p_pedido is not null then update public.pedidos_loja set status = 'vendido' where id = p_pedido; end if;
  return json_build_object('ok', true, 'cobranca', cid, 'restam', pr.quantidade - q);
end;
$$;
revoke all on function public.vender_produto(uuid, uuid, integer, boolean, text, uuid) from public, anon;
grant execute on function public.vender_produto(uuid, uuid, integer, boolean, text, uuid) to authenticated;
