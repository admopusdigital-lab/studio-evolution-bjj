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
