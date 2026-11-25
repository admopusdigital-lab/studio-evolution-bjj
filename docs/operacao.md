# Operação: testes, monitoramento e cópia de segurança

Três rotinas automáticas no GitHub Actions (aba **Actions** do repositório).

## Testes (a cada push)

`.github/workflows/testes.yml` monta o site e roda `tests/fumaca.js`: abre as seis páginas públicas no celular e no
computador, faz um agendamento completo, passa por todas as abas do painel (com a chamada, a TV e o editor da grade)
e abre o app com o link do QR da TV. O banco é simulado (`tests/simulador.js`, com os alunos fictícios de
`tests/dados-de-exemplo.js`): nenhum teste toca os dados do Studio.

Para rodar na máquina: `bash scripts/montar-site.sh && node tests/fumaca.js` (precisa do Playwright com o Chromium).

Se o teste ficar vermelho, o site continua publicado (o deploy é outro fluxo), mas é sinal de que algo quebrou:
abra a execução e veja qual verificação falhou.

## Monitoramento (de hora em hora)

`.github/workflows/monitor.yml` confere se as páginas do site, o app, o painel, o login e o banco respondem. Se algo
cair, a execução fica vermelha e o GitHub manda e-mail para quem cuida do repositório (Settings → Notifications →
Actions, no perfil de quem recebe). As chamadas de hora em hora também mantêm o projeto do Supabase ativo.

## Cópia de segurança do banco (toda segunda de madrugada)

`.github/workflows/copia.yml` faz o `pg_dump` dos dados do Studio (schemas `public` e `privado`), restaura num
Postgres vazio dentro da própria execução e confere que todas as tabelas voltaram com o mesmo número de linhas.
Só depois criptografa a cópia (AES-256, com a senha do segredo `BACKUP_SENHA`) e guarda como artefato por 30 dias.

Para ligar, crie dois segredos em **Settings → Secrets and variables → Actions → New repository secret**:

1. `SUPABASE_DB_URL`: no Supabase, **Connect** (botão no topo do projeto) → **Session pooler** → copie a URI e troque
   `[YOUR-PASSWORD]` pela senha do banco. Use o *Session pooler*: a conexão direta não funciona nos servidores do GitHub.
2. `BACKUP_SENHA`: uma senha longa, guardada também fora do GitHub (sem ela a cópia não abre).

Os dois ficam só no GitHub; não mande nenhum dos dois por chat ou e-mail. Depois, em **Actions → Cópia de segurança →
Run workflow**, rode uma vez para conferir.

### Para restaurar

1. Baixe o artefato `copia-do-banco` da execução (Actions → Cópia de segurança → a execução → Artifacts).
2. Abra: `gpg --decrypt copia-AAAA-MM-DD.dump.gpg > copia.dump` (pede a `BACKUP_SENHA`).
3. Restaure num projeto do Supabase: `pg_restore --no-owner --no-privileges -d "<URI do Session pooler>" copia.dump`.

A cópia traz os dados do Studio (alunos, presenças, graduações, mensalidades, interessados e o resto). As contas de
login ficam no Supabase Auth: num projeto novo, os acessos são recriados pelo painel (Acessos).
