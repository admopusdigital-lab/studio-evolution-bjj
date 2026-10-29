-- Studio Evolution BJJ · limpeza inicial (rodar uma vez, depois da migration de gestão)
-- Apaga contas de teste: ficam só o professor Tiago e o aluno Gui. Zera movimentos e progresso de teste
-- e cria o cadastro de aluno do Gui, ligado à conta dele.

delete from auth.users
where lower(email) not in ('tiago@evolution.com', 'guigalegos@gmail.com');

delete from public.estudos;
delete from public.movimentos;

insert into public.alunos (conta, nome, artigo, turma, email, faixa, graus)
select u.id, 'Gui', 'o', 'adulto', lower(u.email), 'branca', 0
from auth.users u
where lower(u.email) = 'guigalegos@gmail.com'
on conflict (conta) do nothing;
