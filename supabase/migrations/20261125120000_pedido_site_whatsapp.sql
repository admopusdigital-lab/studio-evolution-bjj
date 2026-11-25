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
  nm text := nullif(trim(coalesce(p_nome, '')), '');
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
