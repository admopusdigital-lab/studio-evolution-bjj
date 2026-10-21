# Como ligar o login de verdade (Supabase)

O site já está pronto para o login de verdade. Enquanto `site/supabase-config.js` estiver vazio, ele funciona no
**modo demonstração**: contas fixas `aluno` / `evolution` e `professor` / `evolution`, sem servidor. Quando o arquivo
recebe a URL e a chave do projeto, o mesmo código passa a usar o Supabase, sem mais nenhuma troca nas páginas.

O que já está pronto:

| Peça | Onde | O que faz |
|---|---|---|
| Tela de entrada | `site/entrar.html` | E-mail e senha, aluno ou professor, manter conectado, esqueci a senha |
| App do aluno | `site/app.html` | Para onde o aluno vai depois de entrar; cumprimenta pelo nome do perfil |
| Painel do professor | `site/area-do-professor.html?painel` | Para onde o professor vai depois de entrar |
| Senha nova | `site/nova-senha.html` | Recebe o link do e-mail de "Esqueci a senha" e salva a senha nova |
| Acessos ao app | `site/acessos.html` | O professor cria o login de um aluno (ou de outro professor) e manda pelo WhatsApp |
| Módulo de acesso | `site/acesso.js` | Login, saída, conferência da sessão nas áreas, os dois modos |
| Configuração | `site/supabase-config.js` | URL e chave publicável do projeto (vazias = demonstração) |
| Banco | `supabase/migrations/20261019120000_perfis_e_acesso.sql` | Tabela `perfis` com as regras de segurança (RLS) |
| Movimentos | `supabase/migrations/20261021120000_movimentos.sql` | Tabelas `movimentos` (vídeo, pontos-chave, quiz) e `estudos` (o progresso de cada aluno) |
| Biblioteca no site | `site/movimentos.js` | Lê e grava os movimentos e o progresso; o app e o painel usam o mesmo módulo |
| Função do servidor | `supabase/functions/criar-conta/index.ts` | Cria contas e gera senhas provisórias; só professor usa |

As regras de segurança foram testadas num Postgres local imitando o Supabase:
- O visitante sem login não vê nada.
- O aluno vê só o próprio perfil. Ele não consegue virar professor, criar perfis nem apagar perfis.
- O professor ativo vê e atualiza todos os perfis. O professor desativado perde esse poder.
- Movimentos: quem está logado vê só os publicados; o professor ativo vê os rascunhos e cria, muda e apaga.
- Progresso: cada aluno lê e grava só o próprio, e só de movimento publicado; o professor vê o de todos (quem estudou).
  Apagar um movimento apaga o progresso dele.

## 1. Criar o projeto (dono da academia)

1. Em **supabase.com**, criar a conta com o e-mail da academia.
2. Criar a organização **Studio Evolution BJJ** no plano **Free**.
3. Criar o projeto **studio-evolution-bjj** na região **South America (São Paulo)** e guardar a senha do banco.
4. Em **Organization settings → Team**, convidar `operacao@opusmktdigital.com` como **Developer**.
   - Não use Administrator. Administradores contam no limite de projetos grátis, e a conta da OPUS já está no limite.
   - Com essa conta como Administrator, o Supabase poderia impedir a reativação do projeto.
5. Em **Authentication → Sign In / Providers → Email**, desligar **Allow new users to sign up**. Só o Studio cria contas.
6. Em **Authentication → URL Configuration**:
   - **Site URL**: o domínio do site, por exemplo `https://studioevolutionbjj.com.br`.
   - **Redirect URLs**: incluir `https://<domínio>/nova-senha.html`.
7. Para o "Esqueci a senha" por e-mail, configurar o SMTP em **Authentication → Emails → SMTP Settings** (por exemplo
   Resend ou Brevo, os dois têm plano grátis).
   - O e-mail padrão do Supabase só entrega para membros da equipe e tem limite baixo.
   - Sem SMTP, o caminho é o professor gerar uma senha nova em `acessos.html` e mandar pelo WhatsApp. Esse caminho já funciona.

Os passos 5 a 7 precisam do dono, porque o papel Developer não altera as configurações de login.

## 2. Banco e função

Com o convite aceito, a OPUS aplica a migration e publica a função:

```bash
supabase link --project-ref <ref-do-projeto>
supabase db push                                    # cria perfis, movimentos, estudos + regras
supabase functions deploy criar-conta --no-verify-jwt  # a função confere o login ela mesma
```

Também dá para colar o SQL da migration no **SQL Editor** do painel, se preferir.

A função usa os segredos padrão do Supabase (`SUPABASE_URL` e `SUPABASE_SECRET_KEYS`, ou `SUPABASE_SERVICE_ROLE_KEY`
nos projetos antigos). Não é preciso cadastrar nenhum segredo à mão.

## 3. O primeiro professor

A página de acessos só funciona para quem já é professor. O primeiro entra pelo painel:

1. **Authentication → Users → Add user → Create new user**, com o e-mail e uma senha, marcando **Auto Confirm User**.
2. No **SQL Editor**:

```sql
insert into public.perfis (id, papel, nome, whatsapp)
select id, 'professor', 'Nome do Professor', '5515996741812'
from auth.users where email = 'email-do-professor@exemplo.com';
```

A partir daí, todo o resto (alunos e outros professores) é criado em `acessos.html`, pelo próprio site.

## 4. Ligar o site

Em `site/supabase-config.js`, preencher com os dados de **Project Settings → API Keys**:

```js
window.EVO_SUPABASE = {
  url: "https://<ref-do-projeto>.supabase.co",
  chave: "sb_publishable_..."
};
```

A URL e a chave publicável são públicas por natureza. Quem protege os dados são as regras do banco. **Nunca** coloque
no site a chave secreta (`sb_secret_...` / `service_role`).

## Como funciona, em resumo

- **Entrar:**
  - `supabase.auth.signInWithPassword` confere o e-mail e a senha.
  - O papel (aluno ou professor) vem da tabela `perfis`. Um aluno que escolher "Sou professor" recebe o aviso para trocar.
  - A sessão fica no navegador. Sem "Manter conectado", ela some ao fechar a aba (`sessionStorage`); com ele, fica guardada (`localStorage`).
- **Áreas:**
  - Depois de entrar, o aluno vai para `app.html` e o professor para o painel (`area-do-professor.html?painel`).
  - No `<head>`, `Acesso.portao("aluno" | "professor")` decide antes de a página aparecer, usando o papel guardado.
  - Logo depois, confere a sessão com o servidor (`auth.getUser`). Sessão vencida ou conta desativada (`ativo = false`) voltam para a entrada.
  - A sessão de professor também abre a Área do Aluno.
- **Sair:** `auth.signOut`, e o token local é apagado mesmo sem internet.
- **Acessos:**
  - A função `criar-conta` confere se quem pede é professor ativo.
  - Ela cria a conta já confirmada, com uma senha provisória de 10 caracteres, e o perfil.
  - Se o perfil falhar, a conta é desfeita.
  - "Senha nova" gera outra senha provisória para um e-mail que já existe.
- **Kids:** a conta é do responsável (e-mail e WhatsApp dele), com o nome da criança no perfil.

## Os vídeos das aulas

Os vídeos não ficam no Supabase: o professor sobe no YouTube como **Não listado** (só assiste quem tem o link) e cola o
link na aba Movimentos do painel. O app toca pelo player oficial do YouTube e acompanha quanto foi assistido para
liberar o quiz aos 90%. Também vale o link direto de um arquivo .mp4 (por exemplo, de um serviço de vídeo privado, se um
dia o Studio quiser vídeos só para quem tem login).

Os movimentos de exemplo da demonstração não vão para o banco: com o Supabase ligado, a biblioteca começa vazia e o
professor cadastra a dele.

## O que fica para depois (precisa do banco ligado)

As áreas do aluno e do professor ainda mostram dados de exemplo (Marina, a turma das 19h, o financeiro). Ligar cada
tela ao banco é a próxima etapa. Cada uma vira uma tabela com as mesmas regras de segurança:
- presenças e vagas;
- faixas e graus;
- interessados (o CRM): contatos vindos do Agendar e os adicionados no painel, com anotações e histórico;
- configurações: o status de cada integração e as chaves do Asaas e da Evolution API, guardadas só no servidor
  (segredos da função ou Vault do Supabase), nunca numa tabela que o site leia;
- alunos cadastrados pelo professor (o cadastro já cria o login pela função `criar-conta`; os dados da ficha, como turma,
  faixa, mensalidade e vencimento, ainda precisam de tabela);
- mensalidades, com o Asaas e os lembretes da Evolution API;
- despesas e a meta do mês (o BI do Financeiro passa a ler o histórico de verdade, mês a mês).

O service worker do app (`site/sw.js`) não guarda nada do Supabase: login e dados vão sempre direto ao servidor.

Dentro do artifact (claude.ai), o login de verdade não funciona: a página bloqueia conexões com outros sites. Lá vale
o modo demonstração. O login real vale no domínio da academia.
