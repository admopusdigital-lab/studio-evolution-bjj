-- Studio Evolution BJJ · atualização do banco de 25/11/2026 (as três migrações do dia, em uma colada só).
-- Colar tudo no Supabase → SQL Editor → New query → Run. Pode rodar mais de uma vez.
-- 1) pedido do site com WhatsApp · 2) grade de aulas editável · 3) autorização do responsável no Kids

-- ===================== 20261125120000_pedido_site_whatsapp =====================
-- Studio Evolution BJJ · o pedido de aula do site passa a trazer o WhatsApp de quem pediu.
-- Antes, o contato só chegava se a pessoa enviasse a mensagem no WhatsApp; quem abria o WhatsApp e desistia virava
-- um "Pedido pelo site" sem telefone em Interessados. Agora o número entra junto com o pedido.
-- Se o mesmo WhatsApp já está em aberto em Interessados, o pedido atualiza aquele contato em vez de criar outro.
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

drop function if exists public.pedido_site(text, text, date, text, text, text, boolean);

create or replace function public.pedido_site(p_nome text, p_programa text, p_data date, p_hora text, p_turma text, p_codigo text,
                                              p_familia boolean default false, p_whatsapp text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  novo uuid;
  nm text := case when char_length(trim(coalesce(p_nome, ''))) >= 2 then trim(p_nome) end;  -- nome de 1 letra vira "Pedido pelo site"
  prog text := case when p_programa in ('kids1', 'kids2', 'kids') then 'kids' when p_programa = 'feminino' then 'feminino' else 'adulto' end;
  fone text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  txt text;
begin
  -- limite contra abuso: no máximo 30 pedidos do site por hora
  if (select count(*) from public.leads where origem = 'site' and criado_em > now() - interval '1 hour') >= 30 then
    return false;
  end if;
  if p_hora !~ '^[0-9]{2}:[0-9]{2}$' or p_data is null or p_data < (now() at time zone 'America/Sao_Paulo')::date - 1 then
    return false;
  end if;
  -- guarda só DDD + número (10 ou 11 dígitos), como o painel
  if length(fone) in (12, 13) and left(fone, 2) = '55' then fone := substr(fone, 3); end if;
  if length(fone) not in (10, 11) then fone := null; end if;

  txt := left('Pedido pelo site: aula experimental no ' || coalesce(p_turma, prog) || ', ' || to_char(p_data, 'DD/MM') || ', às ' || p_hora
    || case when p_familia then ' (com o Adulto junto)' else '' end || coalesce(' · ingresso ' || p_codigo, ''), 1000);

  if fone is not null then
    select id into novo from public.leads
     where whatsapp = fone and etapa not in ('matriculado', 'perdido')
     order by criado_em desc limit 1;
  end if;

  if novo is not null then
    update public.leads
       set aula_data = p_data, aula_hora = p_hora, turma_aula = left(p_turma, 40), codigo = left(p_codigo, 40),
           nome = case when nm is not null and nome = 'Pedido pelo site' then left(nm, 120) else nome end,
           etapa = case when etapa = 'atendimento' then 'atendimento' else 'novo' end,
           atualizado_em = now()
     where id = novo;
    insert into public.lead_eventos (lead, texto) values (novo, left('Novo pedido. ' || txt, 1000));
    return true;
  end if;

  insert into public.leads (nome, whatsapp, programa, origem, etapa, aula_data, aula_hora, turma_aula, codigo)
  values (left(coalesce(nm, 'Pedido pelo site'), 120), fone, prog, 'site', 'novo', p_data, p_hora, left(p_turma, 40), left(p_codigo, 40))
  returning id into novo;
  insert into public.lead_eventos (lead, texto) values (novo, txt);
  return true;
end;
$$;

revoke all on function public.pedido_site(text, text, date, text, text, text, boolean, text) from public;
grant execute on function public.pedido_site(text, text, date, text, text, text, boolean, text) to anon, authenticated;

-- ===================== 20261125130000_grade_aulas =====================
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

-- ===================== 20261125140000_consentimento_kids =====================
-- Studio Evolution BJJ · autorização do responsável para o cadastro de criança (LGPD, art. 14).
-- O painel pede a autorização no cadastro do Kids e guarda quando e quem autorizou. O dado fica no próprio
-- cadastro do aluno, com as mesmas regras de acesso da tabela alunos.
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

alter table public.alunos add column if not exists consentimento_em timestamptz;
alter table public.alunos add column if not exists consentimento_por text;
alter table public.alunos drop constraint if exists alunos_consentimento_por_check;
alter table public.alunos add constraint alunos_consentimento_por_check check (consentimento_por is null or char_length(consentimento_por) between 2 and 120);
comment on column public.alunos.consentimento_em is 'Kids: quando o responsável autorizou o cadastro e o uso dos dados e da foto da criança (LGPD, art. 14).';
comment on column public.alunos.consentimento_por is 'Kids: o nome de quem autorizou (o responsável).';

