-- Studio Evolution BJJ · interessado matriculado ligado ao cadastro de aluno.
-- Quando o professor cadastra o aluno direto (sem passar pelo "Cadastrar aluno" do interessado), o contato ficava
-- em Matriculados pedindo um cadastro que já existe. Agora o interessado aponta para o aluno: pelo cadastro feito
-- a partir dele ou pelo botão "Já é aluno: vincular".
-- Rodar no SQL Editor do Supabase (pode rodar mais de uma vez).

alter table public.leads add column if not exists aluno uuid references public.alunos (id) on delete set null;
create index if not exists leads_aluno_idx on public.leads (aluno) where aluno is not null;
comment on column public.leads.aluno is 'O cadastro de aluno em que este interessado virou (matriculado).';
