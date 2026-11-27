-- Studio Evolution BJJ · câmera do tatame, piloto no app: o professor libera a tela "Ao vivo" só para algumas pessoas.
-- A lista (testadores) guarda cadastros de alunos; vale para a conta do próprio aluno e para a do responsável dele.
-- O app não lê a tabela camera_links: chama a função camera_ao_vivo(), que só responde para quem está na lista e só
-- entrega o endereço de assistir enquanto a câmera está no ar. O endereço de envio nunca sai por aqui.
-- Rodar depois de 20261128120000_camera_links.sql (pode rodar mais de uma vez).

alter table public.camera_links add column if not exists testadores uuid[] not null default '{}';
alter table public.camera_links drop constraint if exists camera_links_testadores_check;
alter table public.camera_links add constraint camera_links_testadores_check check (cardinality(testadores) <= 50);
comment on column public.camera_links.testadores is 'Piloto: os alunos (cadastros) que veem a tela Ao vivo no app, com a própria conta ou a do responsável.';

create or replace function public.camera_ao_vivo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  c public.camera_links%rowtype;
  cfg jsonb;
  no_ar boolean;
begin
  select * into c from public.camera_links where id = 'tatame1';
  if not found then return null; end if;
  -- só quem o professor liberou: algum cadastro da família da conta logada precisa estar na lista
  if not exists (select 1 from privado.meus_alunos() m where m = any (c.testadores)) then return null; end if;

  select valor into cfg from public.configuracoes where chave = 'cameras';
  -- no ar: o aparelho disse que está transmitindo, mandou sinal há menos de 90 segundos e o professor não pausou
  no_ar := c.assistir_url is not null and not c.pausada
    and coalesce((c.estado ->> 'ao_vivo')::boolean, false)
    and c.visto_em is not null and c.visto_em > now() - interval '90 seconds';

  return jsonb_build_object(
    'nome', coalesce(cfg ->> 'nome', 'Tatame 1'),
    'ao_vivo', no_ar,
    'pausada', c.pausada,
    'turma', case when no_ar then c.estado ->> 'turma' end,
    'assistir_url', case when no_ar then c.assistir_url end,
    'marca', coalesce((cfg -> 'regras' ->> 'nome')::boolean, true),
    'abre5', coalesce((cfg -> 'regras' ->> 'abre5')::boolean, true),
    'turmas', coalesce(cfg -> 'turmas', '{"kids1": true, "kids2": true, "adulto": false}'::jsonb)
  );
end;
$$;

revoke all on function public.camera_ao_vivo() from public, anon;
grant execute on function public.camera_ao_vivo() to authenticated;
