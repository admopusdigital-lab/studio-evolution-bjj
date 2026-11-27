-- Studio Evolution BJJ · câmera do tatame, fase 1 (um celular vira a câmera).
-- Guarda os dois links da transmissão (Cloudflare Stream) e o estado do aparelho que filma.
-- Só o professor (dono) lê e grava: o link de envio é uma chave (quem tem, transmite) e o link de assistir mostra
-- o tatame. A equipe de gestão e os alunos não enxergam esta tabela. As famílias só vão assistir pelo app depois,
-- por uma função que confere a turma, o aceite e o horário; isso entra na liberação, não aqui.
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

create table if not exists public.camera_links (
  id            text primary key check (id ~ '^[a-z0-9-]{1,30}$'),
  envio_url     text check (envio_url is null or (envio_url ~ '^https://' and char_length(envio_url) <= 400)),
  assistir_url  text check (assistir_url is null or (assistir_url ~ '^https://' and char_length(assistir_url) <= 400)),
  pausada       boolean not null default false,
  estado        jsonb,
  visto_em      timestamptz,
  atualizado_em timestamptz not null default now()
);

comment on table public.camera_links is 'Câmera do tatame: links da transmissão e estado do aparelho. Só o professor.';
comment on column public.camera_links.envio_url is 'Link de envio (WebRTC/WHIP). É uma chave: quem tem, transmite.';
comment on column public.camera_links.assistir_url is 'Link para assistir (WebRTC/WHEP).';
comment on column public.camera_links.pausada is 'O professor pausou a transmissão pelo painel; o aparelho para em até 30 segundos.';
comment on column public.camera_links.estado is 'O que o aparelho informa: no ar ou não, turma, conexão, bateria, último erro.';
comment on column public.camera_links.visto_em is 'Último sinal do aparelho que filma.';

alter table public.camera_links enable row level security;

drop policy if exists "professor gerencia a camera" on public.camera_links;
create policy "professor gerencia a camera" on public.camera_links for all to authenticated
  using ((select privado.eh_professor())) with check ((select privado.eh_professor()));

revoke all on table public.camera_links from anon, authenticated;
grant select, insert, update, delete on table public.camera_links to authenticated;
