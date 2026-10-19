# Studio Evolution BJJ · redesign do site

Proposta de redesign do site do **Studio Evolution BJJ**, academia de jiu-jitsu da Equipe TRUE no Jardim São Paulo, em Sorocaba/SP. É um site estático (HTML, CSS e JavaScript), sem etapa de build.

Versão publicada (privada): https://claude.ai/artifact/7PbBFQCkuSw1SPbBvzXHuw

## Estrutura

- `site/index.html`: página inicial. Começa sem `<!doctype>` porque o publicador do Artifact acrescenta o esqueleto da página; as outras páginas são documentos completos.
- `site/aulas.html`, `site/agendamento.html`, `site/perguntas.html`, `site/contato.html`: páginas internas, cada uma com o próprio estilo no `<style>`.
- `site/entrar.html`: tela de entrada (login e senha) das áreas do aluno e do professor. "Área do aluno" e "Área do professor" no site levam para cá.
- `site/area-do-aluno.html`, `site/area-do-professor.html` e `site/app.css`: as áreas logadas. Cada uma confere a sessão no topo do `<head>` e, sem login, volta para `entrar.html`; a sessão de professor também abre a Área do Aluno. "Sair" (no lugar do selo, ao lado da logo) apaga a sessão.
  - Login de demonstração (sem servidor, a conferência é no navegador): aluno `aluno` / `evolution`; professor `professor` / `evolution`. "Manter conectado" guarda a sessão no `localStorage`; sem isso, ela dura até fechar a aba (`sessionStorage`).
  - Na produção, o formulário chama o backend (ex.: Supabase Auth) e a conferência do `<head>` vira a verificação do token.
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
- `tools/simbolo-true.py`: vetoriza o símbolo da Equipe TRUE a partir de `tools/fontes/logo-true.png` (logo oficial, baixada de bjjtrue.com) e gera `site/img/true-simbolo.svg`. O mesmo desenho vai embutido na seção "Equipe TRUE", onde a rolagem o desenha e enche de ouro.
- `area-do-aluno-evolution.html`: estudo inicial de direções para a Área do Aluno.

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

- Aulas de segunda a sexta: Adulto às 8h, 11h e 19h; Kids (4 a 12 anos) às 10h e 18h; Feminino junto com as turmas de adulto. Até 10 alunos por aula.
- WhatsApp (15) 99674-1812. Atendimento de segunda a sexta, das 8h às 21h.
- Av. Getúlio Vargas, 400, sala 3, sobreloja, Jardim São Paulo, Sorocaba/SP, CEP 18051-480 (-23.5230709, -47.4940211).
- O Studio faz parte da Equipe TRUE (https://bjjtrue.com).
