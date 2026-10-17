# Studio Evolution BJJ · redesign do site

Proposta de redesign do site do **Studio Evolution BJJ**, academia de jiu-jitsu da Equipe TRUE no Jardim São Paulo, em Sorocaba/SP. É um site estático (HTML, CSS e JavaScript), sem etapa de build.

Versão publicada (privada): https://claude.ai/artifact/7PbBFQCkuSw1SPbBvzXHuw

## Estrutura

- `site/index.html`: página inicial. Começa sem `<!doctype>` porque o publicador do Artifact acrescenta o esqueleto da página; as outras páginas são documentos completos.
- `site/aulas.html`, `site/agendamento.html`, `site/perguntas.html`, `site/contato.html`: páginas internas, cada uma com o próprio estilo no `<style>`.
- `site/area-do-aluno.html`, `site/area-do-professor.html` e `site/app.css`: demonstrações das áreas logadas.
- `site/site.css`: tokens (tema Black, o padrão, e Claro), componentes e o sistema de profundidade 3D.
- `site/tema.css`: ajustes finais da linguagem visual "noite de luta". Carrega por último em todas as páginas.
- `site/site.js`: comportamento comum. `Site.boot({ intro, setup, loader })`, aberturas de cinema, fitas cruzadas (faixas pretas de jiu-jitsu), inclinação 3D (`data-tilt3d`, `data-z`, `data-glare`, `data-tilt-touch`, `data-stand`), kanjis em volume e vitrine nos trilhos do celular.
- `site/faixa3d.js`: a faixa em 3D realista da seção "A faixa" (Three.js r149, carregado só quando a seção se aproxima; sem WebGL, fica o SVG).
- `site/img/`: fotos e vídeo do Studio, e as texturas do tecido da faixa (`faixa-normal.webp`, `faixa-detalhe.webp`, `faixa-preta.webp`).
- `site/img/takes/`: cenas curtas do vídeo gravado no Studio (MP4 e WebM, 720x900, câmera um pouco lenta, sem som) e o primeiro quadro de cada uma. Usadas na "Sua primeira aula" e no cartão da turma Adulto; cada take só baixa quando aparece e só toca enquanto está à vista.
- `tools/faixa-texturas.py`: gera as texturas da faixa a partir de um mapa de altura do tecido (`python3 tools/faixa-texturas.py <pasta>`).
- `site/medalha3d.js`: a medalha da Equipe TRUE em 3D na seção "Equipe TRUE" (frente com a logo da TRUE, verso com a do Studio). Usa o mesmo Three.js da faixa; sem WebGL, fica a foto do medalhão.
- `tools/medalha-mapas.py`: gera os mapas de relevo e material das duas faces da medalha (`site/img/medalha-*.webp`) a partir de `tools/fontes/logo-true.png` (logo oficial, baixada de bjjtrue.com) e de `site/img/logo-evolution-refinada.png`.
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
