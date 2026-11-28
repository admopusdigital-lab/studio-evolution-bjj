/* Testes de fumaça: abre o site montado (_site/), o painel e o app com o banco simulado e confere que nada quebra.
   Rodar:  bash scripts/montar-site.sh && node tests/fumaca.js
   Cada verificação imprime "ok" ou "FALHOU"; no fim, sai com erro se alguma falhou (o GitHub Actions marca vermelho).
   O banco de verdade nunca é tocado: tudo que vai para o Supabase é respondido pelo simulador. */
/* No sábado e no domingo a grade não tem as aulas que os testes conferem (a das 19h, a chamada). Para o teste não
   ficar vermelho todo fim de semana, a fumaça roda como se fosse a sexta-feira anterior: a data recua 1 ou 2 dias só
   enquanto os dados de exemplo são montados (depois o relógio do Node volta ao normal, porque o Playwright usa ele),
   e as páginas recebem a mesma data pelo relógio que o teste instala. */
const DateReal = Date;
const RECUO = (d => (d === 6 ? 1 : d === 0 ? 2 : 0) * 864e5)(new Date().getDay());
if (RECUO) global.Date = class extends DateReal {
  constructor(...a) { if (a.length) super(...a); else super(DateReal.now() - RECUO); }
  static now() { return DateReal.now() - RECUO; }
};
const { chromium } = require('playwright');
const simula = require('./simulador.js');
require('./dados-de-exemplo.js')(simula.T);
const HOJE = new Date().toISOString().slice(0, 10);
global.Date = DateReal;

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
  const hoje = HOJE;

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
    confere('Hoje: cartão Aviso pelo app (notificações)', !!(await p.$('#hPush #puAbre')));
    confere('Hoje: atalho Aviso para um aluno', !!(await p.$('#hPush #puUm')));
    await p.evaluate(() => P.go('avisos')); await p.clock.runFor(1500); await p.waitForTimeout(700);
    confere('Avisos: a aba abre com formulário, prévia, alcance e histórico', !!(await p.$('#recForm')) && !!(await p.$('#recPvT')) && /com aviso ativo no celular/.test(await p.textContent('#recAlc')) && (await p.$$('#recH li')).length > 0);
    confere('Avisos: sem aviso de atualização com banco e função em dia', await p.isHidden('#recBanco'));
    await p.click('[data-modelo="0"]'); await p.click('[data-modo="escolher"]'); await p.check('#recL input[data-id="a0"]'); await p.clock.runFor(300); await p.waitForTimeout(200);
    confere('Avisos: prévia com o primeiro nome do aluno escolhido', (await p.textContent('#recPvT')) === 'Sua aula é hoje, Douglas' && (await p.textContent('#recEnv')) === 'Enviar para Douglas');
    await p.click('#recEnv'); await p.clock.runFor(1500); await p.waitForTimeout(700);
    confere('Avisos: envia para o aluno e guarda o recado com o nome', simula.T.avisos.some(x => x.aluno === 'a0' && x.titulo === 'Sua aula é hoje, Douglas' && x.tela === 'presenca') && /para Douglas Lima/.test(await p.textContent('#recH li')));
    await p.evaluate(() => P.go('hoje')); await p.clock.runFor(500); await p.waitForTimeout(300);
    confere('Câmeras: piloto no app com a lista e a escolha de quem assiste', !!(await p.$('.cam-pil #camPilSel')) && !!(await p.$('.cam-pil [data-pil="poe"]')));
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
    confere('app: a câmera do tatame não aparece para quem não foi liberado', !(await p.$('#apCam')));
    confere('app: Perfil com Notificações neste aparelho', !!(await p.$('#apPush #apPushSt')));
    /* excluir a conta pelo app (exigência das lojas): pede a palavra e só então chama o servidor */
    await p.click('#apStoryX'); await p.clock.runFor(800); await p.waitForTimeout(300);
    /* a conta fica nos Ajustes: a engrenagem só aparece no Perfil e abre a tela própria */
    const engrenagemSoNoPerfil = await p.isVisible('#apGear');
    await p.click('#apGear'); await p.clock.runFor(1200); await p.waitForTimeout(300);
    confere('app: Ajustes abre pela engrenagem do Perfil, com os avisos, a senha e o sair', engrenagemSoNoPerfil && await p.evaluate(() => document.querySelector('.ap-view.on').dataset.view === 'conta') && await p.isVisible('#apPush') && await p.isVisible('#apSenha') && await p.isVisible('.app-sair'));
    await p.click('#apExc'); await p.waitForTimeout(200);
    await p.fill('#apExcP', 'sim'); await p.click('#apExcBtn'); await p.waitForTimeout(300);
    const pedidos = [], idas = [];
    p.on('request', r => { if (/functions\/v1\/excluir-conta/.test(r.url())) pedidos.push(r.postData()); });
    p.on('framenavigated', f => { if (f === p.mainFrame()) idas.push(f.url()); });
    const semPalavra = /Digite EXCLUIR/.test(await p.textContent('#apExcErr')) && !pedidos.length;
    const errosAntes = erros.slice();
    await p.fill('#apExcP', 'excluir'); await p.click('#apExcBtn');
    await p.waitForTimeout(2500);
    /* (o simulador devolve a sessão a cada página, então a entrada manda de volta ao app; o que vale é ter passado por ela) */
    confere('app: Excluir minha conta pede a palavra, chama o servidor e sai', semPalavra && pedidos.length === 1 && /"confirma":"excluir"/i.test(pedidos[0] || '') && idas.some(u => /entrar(\.html)?\?app&conta=excluida/.test(u)), JSON.stringify(idas));
    erros.length = 0; errosAntes.forEach(e => erros.push(e));
    confere('app sem erro de script', !erros.length, erros.join(' | '));
    await c.close();
  }

  /* 4a) app do aluno: os estados (carregando, falha, dados guardados), o Início enxuto e o recado do professor */
  {
    const REST = 'https://nkscqdhczfeykrtexyzs.supabase.co/rest/**';
    const { c, p, erros } = await pagina(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'aluno');
    await p.clock.install({ time: new Date(hoje + 'T09:00:00-03:00') });
    /* o relógio da página é controlado: anda aos poucos, com tempo real para a rede (a biblioteca do banco tenta de novo com espera) */
    const anda = async ms => { for (let i = 0; i < Math.ceil(ms / 1000); i++) { await p.clock.runFor(1000); await p.waitForTimeout(200); } };
    const fora = r => r.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"upstream connect error or disconnect/reset before headers","code":"503"}' });
    /* um recado novo do professor para este aluno (os de exemplo já foram lidos no bloco anterior) */
    simula.T.avisos.push({ id: 'fum-recado', aluno: 'a0', titulo: 'Douglas, sábado tem Open Mat', corpo: 'Treino livre às 10h30.', tela: 'presenca', criado_em: new Date().toISOString(), criado_por: null, lido_em: null });
    /* servidor fora e nada guardado no aparelho: a tela de "sem conexão", nunca os dados de exemplo */
    await p.route(REST, fora);
    await p.goto(BASE + '/app', { waitUntil: 'load' }); await anda(8000);
    confere('app: sem conexão e sem dados guardados mostra a tela própria, nunca o exemplo', await p.isVisible('#apFalha') && !(await p.isVisible('#apHero')) && !/Marina|Azul/.test(await p.evaluate(() => document.querySelector('#ap').innerText)));
    /* a conexão volta: "Tentar de novo" carrega os dados, e o recado não lido abre em destaque */
    await p.unroute(REST, fora);
    await p.click('#apFalhaB'); await anda(6000);
    confere('app: Tentar de novo carrega os dados e tira o esqueleto', await p.evaluate(() => document.querySelector('#ap').classList.contains('pronto') && getComputedStyle(document.querySelector('.ap-esq')).display === 'none') && await p.isHidden('#apFalha'));
    const novos = simula.T.avisos.filter(x => x.aluno === 'a0' && !x.lido_em).length;
    confere('app: recado do professor ainda não lido abre em destaque', novos > 0 && await p.isVisible('#apRecado') && (await p.textContent('#apRecadoT')).trim().length > 2);
    for (let i = 0; i < novos && await p.isVisible('#apRecado'); i++) { await p.click('#apRecadoOk'); await anda(1000); }
    confere('app: "Entendi" fecha o recado e marca como lido', await p.isHidden('#apRecado') && !simula.T.avisos.some(x => x.aluno === 'a0' && !x.lido_em));
    await p.click('#apBell'); await anda(1500);
    confere('app: o recado fica guardado na lista de avisos', (await p.$$('.app-notes .ap-note[data-note="recado"]')).length >= 1);
    await p.click('#apBell'); await anda(1500);
    confere('app: Início com a faixa e a meta lado a lado', !!(await p.$('.ap-duo #apFx')) && !!(await p.$('.ap-duo #apGoalC')) && await p.isHidden('#apGoalMais') && await p.isVisible('#apHero'));
    await p.click('#apGoalC'); await anda(1000);
    confere('app: um toque na meta abre a semana e o ajuste', await p.isVisible('#apGoalMais') && await p.isVisible('#apGoal') && (await p.$$('#apGoalMais .ap-wk > div')).length === 6);
    /* o servidor falha ao marcar a aula: mensagem simples com o ícone de erro, nunca o texto cru do servidor */
    await p.route(REST, fora);
    await p.click('#apConfirm'); await p.waitForTimeout(600); await p.clock.runFor(400); await p.waitForTimeout(400);
    const tx = await p.textContent('#apToast span');
    confere('app: erro do servidor vira mensagem simples, com ícone de erro', /Não deu para confirmar/.test(tx) && !/upstream/.test(tx) && await p.evaluate(() => document.querySelector('#apToast').classList.contains('erro') && document.querySelector('#apToast use').getAttribute('href') === '#i-alerta'), tx);
    await p.unroute(REST, fora);
    /* reabre sem rede: os dados guardados no aparelho aparecem, com a barra de "sem conexão" */
    const semRede = r => r.abort('internetdisconnected');
    await p.route(REST, semRede);
    await p.reload({ waitUntil: 'load' }); await anda(9000);
    confere('app: sem rede abre com os dados guardados e a barra de sem conexão', await p.isVisible('#apOff') && /Sem conexão · dados/.test(await p.textContent('#apOffT')) && await p.isVisible('#apHero') && /Faixa azul/.test(await p.evaluate(() => document.querySelector('[data-view="perfil"] .ap-fxrow span').textContent)));
    await p.unroute(REST, semRede);
    await p.click('#apOffB'); await anda(6000);
    confere('app: a conexão volta e a barra some', await p.isHidden('#apOff'));
    /* sair leva junto os dados guardados no aparelho */
    const guardou = await p.evaluate(() => !!localStorage.getItem('evo-guardado'));
    await p.evaluate(() => Acesso.sair()); await p.waitForTimeout(300);
    confere('app: os dados guardados saem junto com a conta', guardou && await p.evaluate(() => !localStorage.getItem('evo-guardado')));
    confere('app (estados) sem erro de script', !erros.length, erros.join(' | '));
    await c.close();
  }
  {
    const { c, p, erros } = await pagina(b, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'aluno');
    await p.route('https://nkscqdhczfeykrtexyzs.supabase.co/rest/v1/rpc/camera_ao_vivo', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ nome: 'Tatame 1', ao_vivo: true, pausada: false, turma: 'Kids 1', assistir_url: 'https://customer-teste.cloudflarestream.com/abc/webRTC/play', marca: true, abre5: true, turmas: { kids1: true, kids2: true, adulto: false } }) }));
    await p.goto(BASE + '/app', { waitUntil: 'load' });
    await p.waitForTimeout(3500);
    confere('app: quem o professor liberou vê a câmera no ar com o botão Assistir', await p.isVisible('#apCam') && /Kids 1 no ar agora/.test(await p.textContent('#apCamT')) && await p.isVisible('#apCamVer'));
    confere('app com a câmera sem erro de script', !erros.length, erros.join(' | '));
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
