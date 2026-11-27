/* Testes de fumaça: abre o site montado (_site/), o painel e o app com o banco simulado e confere que nada quebra.
   Rodar:  bash scripts/montar-site.sh && node tests/fumaca.js
   Cada verificação imprime "ok" ou "FALHOU"; no fim, sai com erro se alguma falhou (o GitHub Actions marca vermelho).
   O banco de verdade nunca é tocado: tudo que vai para o Supabase é respondido pelo simulador. */
const { chromium } = require('playwright');
const simula = require('./simulador.js');
require('./dados-de-exemplo.js')(simula.T);

const BASE = 'https://evolutionbjj.com.br';
const falhas = [];
function confere(nome, ok, detalhe) {
  console.log((ok ? 'ok      ' : 'FALHOU  ') + nome + (ok || !detalhe ? '' : ' · ' + detalhe));
  if (!ok) falhas.push(nome);
}

async function pagina(b, opcoes, papel) {
  const c = await b.newContext(Object.assign({ serviceWorkers: 'block', timezoneId: 'America/Sao_Paulo' }, opcoes || {}));
  const p = await c.newPage();
  const erros = [];
  p.on('pageerror', e => erros.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) erros.push(m.text().slice(0, 200)); });
  p.on('dialog', d => d.accept());
  await simula(p, papel || 'professor');
  /* a grade e o pedido do site respondem como o banco atualizado */
  await p.route('https://nkscqdhczfeykrtexyzs.supabase.co/rest/v1/rpc/grade_aulas', r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }));
  /* bibliotecas de fora (fontes, gsap, QR) seguem pela rede; se a rede cair, a página tem que continuar sem erro */
  return { c, p, erros };
}

(async () => {
  const b = await chromium.launch();
  const hoje = new Date().toISOString().slice(0, 10);

  /* 1) páginas públicas, no celular e no computador */
  for (const [nome, vp, mob] of [['celular', { width: 390, height: 844 }, true], ['computador', { width: 1440, height: 900 }, false]]) {
    for (const pg of ['', 'aulas', 'agendamento', 'perguntas', 'contato', 'privacidade']) {
      const { c, p, erros } = await pagina(b, { viewport: vp, isMobile: mob, hasTouch: mob });
      const r = await p.goto(BASE + '/' + pg, { waitUntil: 'load' });
      await p.waitForTimeout(1500);
      const larg = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
      confere(`site ${pg || 'início'} (${nome}) abre`, r && r.ok());
      confere(`site ${pg || 'início'} (${nome}) sem erro de script`, !erros.length, erros.join(' | '));
      confere(`site ${pg || 'início'} (${nome}) sem rolagem para o lado`, larg);
      if (pg !== 'privacidade') confere(`site ${pg || 'início'} (${nome}) tem descrição e imagem de compartilhamento`,
        await p.evaluate(() => !!document.querySelector('meta[name="description"]') && !!document.querySelector('meta[property="og:image"]')));
      await c.close();
    }
  }

  /* 2) agendamento: os quatro passos e o pedido com WhatsApp */
  {
    const { c, p, erros } = await pagina(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const pedidos = [];
    await p.route('https://nkscqdhczfeykrtexyzs.supabase.co/rest/v1/rpc/pedido_site', r => { pedidos.push(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: 'true' }); });
    await p.route('https://wa.me/**', r => r.fulfill({ status: 200, body: 'ok' }));
    await p.goto(BASE + '/agendamento#adulto-19', { waitUntil: 'load' });
    await p.waitForTimeout(1200);
    await p.click('.dt >> nth=1');
    await p.fill('#nome', 'Pessoa Teste');
    await p.click('#fone'); await p.keyboard.type('15999990000');
    confere('agendamento pronto com nome e WhatsApp', await p.getAttribute('#waBtn', 'aria-disabled') === 'false');
    const [aba] = await Promise.all([c.waitForEvent('page'), p.click('#waBtn')]);
    await p.waitForTimeout(800);
    confere('agendamento manda o WhatsApp para o Studio', pedidos.some(x => /"p_whatsapp":"15999990000"/.test(x)), pedidos.join(' | '));
    confere('agendamento confirma no próprio site', /Pedido registrado/.test(await p.textContent('#waNote')));
    confere('agendamento sem erro de script', !erros.length, erros.join(' | '));
    await aba.close(); await c.close();
  }

  /* 3) painel do professor: cada aba abre sem erro */
  {
    const { c, p, erros } = await pagina(b, { viewport: { width: 1440, height: 1000 } });
    await p.clock.install({ time: new Date(hoje + 'T19:10:00-03:00') });
    await p.goto(BASE + '/painel', { waitUntil: 'load' });
    await p.clock.runFor(4000); await p.waitForTimeout(1200);
    confere('painel Hoje mostra a aula do momento', /Adulto · 19h/.test(await p.textContent('#room')));
    confere('painel Hoje tem a chamada em lista de toque', (await p.$$('#roster .tog.pres')).length >= 5);
    confere('painel Hoje tem a fila "Precisa de você"', (await p.$$('#hFila li')).length >= 1);
    global.__w = [];
    await p.click('#roster li .tog.pres[aria-checked="false"] >> nth=0');
    await p.clock.runFor(800); await p.waitForTimeout(600);
    confere('painel chamada marca a presença', global.__w.some(x => /^POST presencas/.test(x)), global.__w.join(' | '));
    for (const aba of ['tatame', 'alunos', 'grad', 'rank', 'mov', 'leads', 'fin', 'estoque', 'config', 'equipe']) {
      await p.evaluate(a => P.go(a), aba);
      await p.clock.runFor(1500); await p.waitForTimeout(500);
      confere(`painel aba ${aba} abre`, await p.evaluate(a => P.atual() === a, aba));
    }
    await p.evaluate(() => P.go('tatame')); await p.clock.runFor(1500); await p.waitForTimeout(1500);
    confere('TV mostra o código e o QR', /TRU 482/.test(await p.textContent('#ttCode')) && !!(await p.$('#ttQr svg')));
    await p.evaluate(() => P.go('config')); await p.clock.runFor(1500); await p.waitForTimeout(600);
    confere('Configurações tem o editor da grade', (await p.$$('#grdL .grd-r')).length >= 1);
    /* Estoque: um produto em dois tamanhos vira uma linha só na grade, e o + grava a quantidade */
    simula.T.produtos.push(
      { id: 'pr1', nome: 'Kimono Teste', cor: 'Branco', categoria: 'kimono', preco: 380, tamanho: 'A1', quantidade: 2, ativo: true },
      { id: 'pr2', nome: 'Kimono Teste', cor: 'Branco', categoria: 'kimono', preco: 380, tamanho: 'A2', quantidade: 1, ativo: true });
    await p.evaluate(() => P.go('estoque')); await p.clock.runFor(2500); await p.waitForTimeout(800);
    await p.click('#etVender'); await p.waitForTimeout(300);
    confere('Estoque mostra um cartão por produto com os tamanhos', (await p.$$('.es-card')).length === 1 && (await p.$$('.es-card [data-vende]')).length === 2);
    await p.click('#etEstoque'); await p.waitForTimeout(300);
    global.__w = [];
    await p.click('.es-st[data-id="pr2"] [data-mais]'); await p.clock.runFor(800); await p.waitForTimeout(400);
    confere('Estoque: grade produto × tamanho e o + grava', (await p.$$('.es-mx tbody tr')).length === 1 && global.__w.some(x => /^PATCH produtos\?id=eq\.pr2 \{"quantidade":2\}/.test(x)), global.__w.join(' | '));
    /* Frequência: os números do topo, a lista de quem caiu e o mapa com uma linha por aula da grade */
    await p.evaluate(() => P.go('rank')); await p.clock.runFor(2000); await p.waitForTimeout(600);
    confere('Frequência mostra os 4 números e a lista Em queda', (await p.$$('#fqKpis .kpi')).length === 4 && !(await p.isHidden('#fqpQueda')));
    await p.click('#fqtMapa'); await p.waitForTimeout(300);
    confere('Frequência: mapa com uma linha por aula da grade', (await p.$$('#fqMapa tbody tr')).length === await p.evaluate(() => Site.GRADE.length) || !(await p.isHidden('#fqMEmpty')));
    await p.click('#fqtRank'); await p.waitForTimeout(300);
    confere('Frequência: ranking continua numa aba', !(await p.isHidden('#fqpRank')) && (await p.$$('#rkPer button')).length === 6);
    /* Movimentos: abre em Técnicas da semana; a Biblioteca fica na outra aba */
    await p.evaluate(() => P.go('mov')); await p.clock.runFor(1500); await p.waitForTimeout(500);
    const semAntes = await p.isVisible('#tecBox') && await p.isHidden('#mvpBib');
    await p.click('#mvtBib'); await p.waitForTimeout(300);
    confere('Movimentos em abas Semana e Biblioteca', semAntes && await p.isVisible('#mvAdd') && await p.isHidden('#tecBox'));
    /* Câmeras: só o dono vê; mostra as condições, as turmas e a prévia do app */
    await p.evaluate(() => P.go('cam')); await p.clock.runFor(1500); await p.waitForTimeout(500);
    confere('Câmeras (em preparo) abre para o dono com a prévia do app', (await p.$$('.cam-cond li')).length === 4 && !!(await p.$('.cam-fone .cam-app')) && await p.evaluate(() => { var a = P.papel; P.papel = 'gestao'; var r = P.podeAba('cam'); P.papel = a; return r === false; }));
    confere('Câmeras: cartão Transmissão com os 3 passos, o código do celular e o formulário dos endereços', (await p.$$('#camTx .cam-tx-passos li')).length === 3 && !!(await p.$('#camTxQr svg')) && await p.isVisible('#camTxForm') && await p.isDisabled('[data-tx="ver"]'));
    confere('painel sem erro de script', !erros.length, erros.join(' | '));
    await c.close();
  }

  /* 4) app do aluno: Início, presença na hora da aula e o link do QR */
  {
    const { c, p, erros } = await pagina(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'aluno');
    await p.clock.install({ time: new Date(hoje + 'T18:45:00-03:00') });
    let reg = 0;
    await p.route('https://nkscqdhczfeykrtexyzs.supabase.co/rest/v1/rpc/registrar_presenca', r => { reg++; return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: hoje, hora: '19:00', turma: 'adulto', chegou_em: hoje + 'T18:46:00-03:00' }) }); });
    await p.goto(BASE + '/app?presenca=TRU482', { waitUntil: 'load' });
    await p.clock.runFor(5000); await p.waitForTimeout(1500);
    confere('app registra a presença pelo link do QR', reg === 1);
    confere('app abre na tela de presença', await p.evaluate(() => document.querySelector('.ap-view.on').dataset.view === 'presenca'));
    confere('app mostra "x de 50 aulas" na faixa', /de 50 aulas|ser avaliado/.test(await p.textContent('.ap-fx-c')));
    confere('app mostra a presença confirmada em tela cheia', await p.isVisible('#apOk') && /Bom treino/.test(await p.textContent('#apOkT')));
    await p.click('#apOkX'); await p.waitForTimeout(300);
    await p.click('#apBell'); await p.clock.runFor(1500); await p.waitForTimeout(400);
    confere('app: avisos com botão de ação', (await p.$$('.app-notes .ap-note [data-act]')).length >= 1 || !!(await p.$('.app-notes-none')));
    await p.click('.ap-dock [data-go="perfil"]'); await p.clock.runFor(1200); await p.waitForTimeout(300);
    confere('app: Perfil com a carteirinha', await p.isVisible('.ap-pass'));
    await p.evaluate(() => document.querySelector('.ap-story-btn').click());
    await p.clock.runFor(1500); await p.waitForTimeout(1500);
    confere('app: cartão para Stories gerado', await p.isVisible('#apStory') && /^blob:/.test(await p.getAttribute('#apStoryImg', 'src') || ''));
    confere('app sem erro de script', !erros.length, erros.join(' | '));
    await c.close();
  }

  /* 5) câmera do tatame (fase 1): a página do celular abre para o professor e, sem os endereços, explica o que falta */
  {
    const { c, p, erros } = await pagina(b, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
    await p.goto(BASE + '/transmitir', { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    confere('câmera: sem os endereços, avisa e não deixa ligar', await p.isVisible('#txAviso') && /Falta colar o link/.test(await p.textContent('#txAviso')) && await p.isDisabled('#txLigar'));
    confere('câmera sem erro de script', !erros.length, erros.join(' | '));
    await c.close();
    const fs = require('fs'), path = require('path'), raiz = path.join(__dirname, '..');
    const grade = (arq, nome) => { const m = new RegExp(nome + ' = (\\[[\\s\\S]*?\\n  \\]);').exec(fs.readFileSync(path.join(raiz, arq), 'utf8')); return m ? JSON.stringify(eval(m[1])) : arq; };
    confere('câmera: a grade padrão é a mesma do site', grade('site/transmitir.js', 'GRADE_PADRAO') === grade('site/site.js', 'Site\\.GRADE'));
    const cab = fs.readFileSync(path.join(raiz, '_site/_headers'), 'utf8');
    confere('câmera: só a página do celular pode ligar a câmera (e nunca o microfone)', /\n\/transmitir\n  ! Permissions-Policy\n  Permissions-Policy: camera=\(self\), microphone=\(\)/.test(cab) && /\/\*\n[^\n]*\n[^\n]*\n  Permissions-Policy: camera=\(\), microphone=\(\)/.test(cab));
  }

  await b.close();
  console.log(falhas.length ? `\n${falhas.length} verificação(ões) falharam.` : '\nTudo certo.');
  process.exit(falhas.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
