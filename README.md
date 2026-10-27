# Studio Evolution BJJ · redesign do site

Proposta de redesign do site do **Studio Evolution BJJ**, academia de jiu-jitsu da Equipe TRUE no Jardim São Paulo, em Sorocaba/SP. É um site estático (HTML, CSS e JavaScript), sem etapa de build.

Versão publicada (privada): https://claude.ai/artifact/7PbBFQCkuSw1SPbBvzXHuw

## Estrutura

- `site/index.html`: página inicial. Começa sem `<!doctype>` porque o publicador do Artifact acrescenta o esqueleto da página; as outras páginas são documentos completos.
- `site/aulas.html`, `site/agendamento.html`, `site/perguntas.html`, `site/contato.html`: páginas internas, cada uma com o próprio estilo no `<style>`.
- `site/entrar.html`, `site/nova-senha.html` e `site/acessos.html`: entrada (login e senha), senha nova pelo link do e-mail e, para o professor, a criação dos acessos de alunos com a senha provisória pelo WhatsApp. Estilo em `site/acesso.css`.
- `site/acesso.js` e `site/supabase-config.js`: o login. Com `supabase-config.js` vazio, vale o modo demonstração (aluno `aluno` / `evolution`, professor `professor` / `evolution`); preenchido com a URL e a chave publicável do projeto, o mesmo código usa o Supabase Auth. Passo a passo em `docs/supabase.md`.
- `supabase/`: as migrations com as regras de segurança (RLS), testadas num Postgres local: `perfis` (quem entra e com qual papel) e `movimentos` + `estudos` (a biblioteca e o progresso de cada aluno). E a função `criar-conta` (Edge Function), que cria contas e gera senhas provisórias, só para professor.
- `site/app.html`: o app do aluno em tela cheia, para onde o aluno vai depois de entrar. São as mesmas telas do celular da vitrine (Início, Presença, Movimentos, Perfil e os Avisos no sino), ampliadas até a largura do aparelho; no computador, o app fica numa coluna no meio. Perfil traz tema, WhatsApp do Studio e Sair.
  - **Movimentos:** a biblioteca da faixa do aluno ("Continue assistindo", filtro por tipo, estudados) e a tela da aula, com o vídeo de verdade (arquivo .mp4 ou YouTube, pelo player oficial), os pontos-chave e o quiz, que só abre com 90% do vídeo assistido de verdade (pular para o fim não conta). Sem vídeo, o movimento aparece "em gravação". Se o YouTube não abrir, a aula mostra o link e um "Já assisti".
- `site/movimentos.js`: a biblioteca e o progresso, usados pelo app e pelo painel. Na demonstração, a faixa azul de exemplo (7 movimentos com cenas do Studio como vídeo de exemplo e 5 em gravação); o que o professor cadastra fica no navegador e o progresso do aluno, na aba. Com o Supabase ligado, usa as tabelas `movimentos` e `estudos`.
- `site/area-do-professor.html?painel`: o painel do professor em tela cheia, para onde o professor vai depois de entrar. É a mesma página da vitrine sem a apresentação em volta, com um topo próprio (Modo tatame, Acessos, tema e Sair).
  - **Modo tatame:** no painel, é uma aba própria (a TV com o código da aula e quem chegou), com "Abrir na TV" em tela cheia. Na vitrine, continua como a seção abaixo do painel.
  - **Alunos:** "Adicionar aluno" (nome, tratamento nas mensagens, turma e horário, responsável e idade no Kids, WhatsApp, e-mail, faixa e graus, mensalidade, vencimento, início). O aluno entra na lista com ficha, ganha a primeira mensalidade no Financeiro e, se marcado, o acesso ao app com a senha provisória pronta para o WhatsApp. Um interessado vira aluno pelo "Matricular como aluno" da ficha dele (ou "Cadastrar" em Fechados), sem contar a matrícula duas vezes.
  - **Financeiro:** três partes. **Visão geral** (o BI): receita, despesas, resultado, alunos ativos, ticket médio e inadimplência do mês; a meta do mês, definida pelo professor, com o quanto falta; os gráficos de receita x despesas, alunos que entraram e saíram e alunos ativos, com 12 meses e a projeção dos 3 seguintes (cada um com a tabela); despesas por categoria e a projeção por escrito. **Mensalidades**: a cobrança pelo Asaas e os lembretes, como antes. **Despesas**: lançar, separar fixas e variáveis, marcar como paga e apagar. Os valores são de exemplo; meta e despesas ficam no navegador na demonstração.
  - **Interessados (CRM):** busca por nome ou WhatsApp, filtro por etapa, "Adicionar contato" (nome, WhatsApp, turma, origem, criança e idade no Kids, etapa e aula) e a ficha de cada contato, com anotações e o histórico que o painel registra sozinho (pedido do site, mensagens, etapas, reabertura).
  - **Movimentos:** a biblioteca por faixa. O professor cadastra o movimento (nome, faixa, tipo, link do YouTube ou de um .mp4, duração, pontos-chave), monta o quiz (até 5 perguntas com 3 alternativas, a certa e uma dica), publica ou deixa como rascunho, edita, apaga e vê quem já estudou.
  - **Configurações:** só o professor dono. Um cartão por integração (Mensalidades/Asaas, WhatsApp de avisos/Evolution API, Pedidos do site, Login e dados/Supabase) com status, testar, conectar e desconectar, e os dados do Studio. As chaves ficam no servidor: a tela só mostra os 4 últimos caracteres.
- `site/manifest.webmanifest`, `site/sw.js` e `site/img/app/`: o app instalável no celular (Android: Instalar; iPhone: Compartilhar → Adicionar à Tela de Início). O ícone abre `entrar.html?app`, que leva quem já está conectado direto ao seu app. O service worker guarda as telas para abrir mesmo sem internet; login, dados e vídeos nunca passam pelo cache. Ao mudar a lista de telas do `sw.js`, suba `VERSAO`. Ícones gerados por `tools/icones-app.py`.
- `site/area-do-aluno.html`, `site/area-do-professor.html` e `site/app.css`: as vitrines das áreas, que mostram o app e o painel com os capítulos da apresentação. Também pedem login: cada página logada chama `Acesso.portao(...)` no topo do `<head>` e, sem sessão, volta para `entrar.html`; a sessão de professor também abre o lado do aluno. "Sair" encerra a sessão. `app.css` guarda as telas do celular usadas na vitrine e no app.
- `site/site.css`: tokens (tema Black, o padrão, e Claro), componentes e o sistema de profundidade 3D.
- `site/tema.css`: ajustes finais da linguagem visual "noite de luta". Carrega por último em todas as páginas.
- `site/site.js`: comportamento comum. `Site.boot({ intro, setup, loader })`, aberturas de cinema, fitas cruzadas (faixas pretas de jiu-jitsu), inclinação 3D (`data-tilt3d`, `data-z`, `data-glare`, `data-tilt-touch`, `data-stand`), kanjis em volume e vitrine nos trilhos do celular.
- `site/faixa3d.js`: a faixa em 3D realista da seção "A faixa" (Three.js r149, carregado só quando a seção se aproxima; sem WebGL, fica o SVG).
- `site/img/`: fotos e vídeo do Studio, e as texturas do tecido da faixa (`faixa-normal.webp`, `faixa-detalhe.webp`, `faixa-preta.webp`).
- `site/img/takes/`: cenas curtas dos dois vídeos gravados no Studio (ZV-E10 II, 1080x1920), em MP4 (H.264) e WebM (VP9), sem som, com o quadro de abertura em JPG. Nenhuma cena se repete:
  - "Sua primeira aula" (1080x1350): `chega` (o professor recebe o aluno), `aquecimento` (o professor demonstra um rolamento), `tecnica` (passagem de guarda), `guarda` e `resenha` (dupla rindo depois do treino). Cada take só baixa quando aparece e só toca enquanto está à vista.
  - Cartão da turma Adulto: `adulto` (dupla de rosto à mostra, em loop sem emenda).
  - Abertura no computador, três colunas de 636x1080 em câmera lenta e loop sem emenda: `abertura-1` (a parede com o medalhão, sem o teto), `abertura-2` (a sala clara, com a turma assistindo) e `abertura-3` (treino no escuro). No celular, `abertura-celular` (720px, a sala clara enquadrada no alto, acima do título).
  - Os quadros dos takes também servem de foto vertical nítida nas aberturas das páginas internas no celular e nos convites finais de Perguntas e Contato.
  - A cena de pressão (o faixa-roxa por cima do colega careca) ficou de fora de propósito: assusta quem nunca treinou.
- `tools/faixa-texturas.py`: gera as texturas da faixa a partir de um mapa de altura do tecido (`python3 tools/faixa-texturas.py <pasta>`).
- `tools/icones-app.py`: gera os ícones do app ("EVO" em ouro sobre o fundo escuro) a partir da logo (`python3 tools/icones-app.py site/img/logo-evolution-mask.webp site/img/app`).
- `tools/simbolo-true.py`: vetoriza o símbolo da Equipe TRUE a partir de `tools/fontes/logo-true.png` (logo oficial, baixada de bjjtrue.com) e gera `site/img/true-simbolo.svg`. O mesmo desenho vai embutido na seção "Equipe TRUE", onde a rolagem o desenha e enche de ouro.
- `area-do-aluno-evolution.html`: estudo inicial de direções para a Área do Aluno.

## Publicar

`scripts/montar-site.sh` monta a pasta `_site/`: copia `site/`, acrescenta o esqueleto ao `index.html` e escreve um
`robots.txt` que deixa o endereço de teste fora do Google. Com `PUBLICO=1`, o `robots.txt` libera a indexação (use no
domínio definitivo do Studio). `site/_headers` traz os cabeçalhos do Cloudflare (o service worker sem cache).

### Cloudflare Pages (principal)

Ligado direto no GitHub, sem chave de API: cada push na branch publica sozinho.

1. No painel do Cloudflare: **Workers & Pages → Create → Pages → Connect to Git**.
2. Autorizar o GitHub e escolher o repositório `admopusdigital-lab/studio-evolution-bjj`.
3. Configurar o build:
   - **Production branch:** `main-kr1apn`
   - **Framework preset:** None
   - **Build command:** `bash scripts/montar-site.sh`
   - **Build output directory:** `_site`
4. **Save and Deploy.** O endereço fica `https://<nome-do-projeto>.pages.dev`.
5. No domínio definitivo: **Custom domains → Set up a domain**, e em **Settings → Variables** criar `PUBLICO` = `1`
   para liberar o Google.

### GitHub Pages (reserva)

`.github/workflows/pages.yml` roda o mesmo script a cada push na branch `main-kr1apn`. Para funcionar, o ambiente
`github-pages` precisa aceitar a branch: **Settings → Environments → github-pages → Deployment branches** → adicionar
`main-kr1apn`.

## Ver localmente

Qualquer servidor estático apontado para a pasta `site`, por exemplo:

```bash
npx serve site
```

```bash
python -m http.server 8765 --directory site
```

No Windows, `.claude/serve.ps1` faz o mesmo e ainda acrescenta o doctype ao `index.html`, como o publicador do Artifact. É o servidor que a pré-visualização do Claude usa (`.claude/launch.json`).

## Bibliotecas

GSAP 3.12.5 com ScrollTrigger (cdnjs) e Lenis 1.1.13 (jsDelivr). Fontes do Google Fonts: Archivo Black, Archivo, JetBrains Mono e Shippori Mincho.

## Dados reais do Studio (não inventar)

- Grade de aulas (a fonte única no código é `Site.GRADE`, em `site/site.js`):
  - Adulto: segunda a sexta, às 8h, 11h, 19h e 20h30. O Feminino treina junto com as turmas de adulto.
  - Kids 1: terça e quinta, às 9h e 18h. Kids 2: segunda e quarta, às 9h e 18h. Kids é para crianças de 4 a 12 anos.
  - Open Mat: sábado, às 10h30.
  - Até 10 alunos por aula.
- WhatsApp (15) 99674-1812. Atendimento de segunda a sexta, das 8h às 21h.
- Av. Getúlio Vargas, 400, sala 3, sobreloja, Jardim São Paulo, Sorocaba/SP, CEP 18051-480 (-23.5230709, -47.4940211).
- O Studio faz parte da Equipe TRUE (https://bjjtrue.com).
