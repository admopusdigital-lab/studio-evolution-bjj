/* Painel · Câmeras (em preparo, só o dono vê): a aula ao vivo no app para os responsáveis, só no horário da aula
   e sem gravação. Aqui o professor escolhe as turmas, registra o aceite de cada família (LGPD: imagem de criança
   pede consentimento específico de um dos pais, art. 14), marca as condições e vê a prévia da tela do app.
   Nada aparece no app nem para a equipe até a transmissão ser ligada e liberada.
   Turmas, regras e aceites ficam em configuracoes (chave "cameras").
   Fase 1 (piloto): um celular preso à parede vira a câmera (transmitir.html). Os dois links da Cloudflare Stream e o
   estado desse celular ficam em camera_links, que só o professor lê. Nesta fase só o professor assiste. */
(function () {
  "use strict";
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var box = $("#camBox");
  if (!box) return;
  var TURMAS = [["Kids 1", "kids1"], ["Kids 2", "kids2"], ["Adulto", "adulto"]];
  var PADRAO = { instalada: false, nome: "Tatame 1", turmas: { kids1: true, kids2: true, adulto: false }, regras: { abre5: true, nome: true, gravar: false }, aviso: false, revisao: false, aceites: {} };
  var C = null, previa = "fechada", abertas = {}, salvaT = null;
  var ID = "tatame1", L = null, semTabela = false, ver = null, verT = null, verMsg = "", editando = false, pollT = null;
  var SQL_CAMERA = "https://raw.githubusercontent.com/admopusdigital-lab/studio-evolution-bjj/main/supabase/atualizar-2026-11-28.sql";
  var semPiloto = false;   /* o banco tem a tabela da câmera, mas ainda não a lista do piloto no app */

  function carregar() {
    return P.q(function (sb) { return sb.from("configuracoes").select("valor").eq("chave", "cameras").maybeSingle(); })
      .then(function (r) { C = Object.assign(JSON.parse(JSON.stringify(PADRAO)), r && r.valor ? r.valor : {}); C.aceites = C.aceites || {}; paint(); return carregarLinks(); })
      .catch(function (e) { C = JSON.parse(JSON.stringify(PADRAO)); paint(); P.erro(e, "Não deu para carregar as câmeras"); });
  }
  function salvar(msg) {
    clearTimeout(salvaT);
    salvaT = setTimeout(function () {
      P.q(function (sb) { return sb.from("configuracoes").upsert({ chave: "cameras", valor: C }); })
        .then(function () { if (msg) P.toast(msg); })
        .catch(function (e) { P.erro(e, "Não deu para salvar"); });
    }, 350);
  }
  /* quem aparece na câmera de cada turma: os alunos ativos dela (o Feminino treina com o Adulto) */
  function daTurma(k) {
    return P.alunosDeVerdade().filter(function (a) { return (a.turma === "feminino" ? "adulto" : a.turma) === k; })
      .sort(function (x, y) { return x.nome.localeCompare(y.nome); });
  }
  function aceitou(a) { return C.aceites[a.id]; }
  function horarios(n) {
    var h = {};
    Site.GRADE.forEach(function (c) { if (c.n === n) h[c.t] = (h[c.t] || []).concat(c.d); });
    return Object.keys(h).sort().map(function (t) { return Site.hora(t); }).join(" · ");
  }
  function ligadas() { return TURMAS.filter(function (t) { return C.turmas[t[1]]; }); }
  function faltam() {
    var n = 0, tot = 0;
    ligadas().forEach(function (t) { daTurma(t[1]).forEach(function (a) { tot++; if (!aceitou(a)) n++; }); });
    return { n: n, tot: tot };
  }
  function tog(nome, on, rot, extra) {
    return '<button type="button" class="tog" role="switch" aria-checked="' + !!on + '" data-' + nome + (extra || "") + ' aria-label="' + esc(rot) + '"></button>';
  }

  function paint() {
    if (!C) return;
    var f = faltam(), lig = ligadas();
    var cond = [
      ["Câmera conectada e transmitindo", instalada(), instalada() ? "O celular já mandou sinal" : "Falta conectar o celular (em Transmissão, acima)"],
      ["Aviso na entrada de que o tatame tem câmera", C.aviso, null, "aviso"],
      ["Termo de autorização revisado por um advogado", C.revisao, null, "revisao"],
      ["Aceite de todos nas turmas com câmera", lig.length && f.tot && !f.n, lig.length ? (f.tot ? (f.tot - f.n) + " de " + f.tot + " aceitaram" : "Nenhum aluno nessas turmas") : "Nenhuma turma escolhida"]
    ];
    var prontas = cond.filter(function (c) { return c[1]; }).length;
    montaCaixa();
    pintaTx();
    $("#camResto").innerHTML =
      /* as condições para liberar */
      '<section class="cam-card cam-cond" aria-labelledby="camCondT"><div class="cam-h"><h4 id="camCondT">Para liberar para as famílias</h4><span>' + prontas + " de " + cond.length + " prontas</span></div><ol>" +
        cond.map(function (c) {
          return '<li class="' + (c[1] ? "ok" : "") + '"><span class="cam-mk" aria-hidden="true">' + (c[1] ? '<svg class="ic"><use href="#i-check"/></svg>' : "") + "</span>" +
            "<b>" + esc(c[0]) + '<span class="sr-only">' + (c[1] ? ": pronto" : ": falta") + "</span></b>" +
            (c[3] ? tog("cond", c[1], c[0], '="' + c[3] + '"') : '<small>' + esc(c[2]) + "</small>") + "</li>";
        }).join("") + "</ol>" +
        '<button class="mini-btn" type="button" disabled>Liberar para as famílias</button><p class="cam-nota">Nesta fase só você assiste. A liberação para as famílias vem depois do piloto, com o link protegido por pessoa e por horário. Até lá, ninguém além de você vê esta área.</p>' + piloto() + "</section>" +

      /* as turmas e o aceite de cada um */
      '<section class="cam-card" aria-labelledby="camTurT"><div class="cam-h"><h4 id="camTurT">Turmas com câmera</h4></div><p class="cam-nota" style="margin-top:0">A câmera filma o tatame inteiro, então só liga na turma em que todos aceitaram: no Kids, um dos responsáveis; no Adulto, o próprio aluno.</p><ul class="cam-tur">' +
        TURMAS.map(function (t) {
          var l = daTurma(t[1]), ok = l.filter(aceitou).length, on = !!C.turmas[t[1]], ab = !!abertas[t[1]];
          return '<li class="' + (on ? "on" : "") + '"><div class="cam-tur-h">' + tog("turma", on, "Câmera na turma " + t[0], '="' + t[1] + '"') +
            "<div><b>" + t[0] + "</b><small>" + esc(horarios(t[0]) || "sem aula na grade") + "</small></div>" +
            (on ? '<span class="cam-st ' + (l.length && ok === l.length ? "ok" : "falta") + '">' + (l.length ? ok === l.length ? "todos aceitaram" : "faltam " + (l.length - ok) + " de " + l.length : "sem alunos") + "</span>" : '<span class="cam-st">desligada</span>') +
            (on && l.length ? '<button class="mini-btn ghost" type="button" data-abre="' + t[1] + '" aria-expanded="' + ab + '">' + (ab ? "Fechar" : "Ver quem falta") + "</button>" : "") + "</div>" +
            (on && ab ? '<ul class="cam-pes">' + l.map(function (a) {
              var ac = aceitou(a), kid = P.kid(a.turma);
              return '<li data-id="' + a.id + '"><span class="av"' + Fotos.attr(a.foto) + ">" + P.ini(a.nome) + "</span><div><b>" + esc(a.nome) + "</b><small>" +
                (kid ? "responsável: " + esc(a.responsavel || "sem responsável no cadastro") : "aluno") + (ac ? " · aceitou em " + P.dataBR(ac.em) + (ac.como === "termo" ? " (termo assinado)" : " (pelo WhatsApp)") : "") + "</small></div>" +
                (ac ? '<button class="mini-btn ghost" type="button" data-desfaz>Desfazer</button>'
                  : (a.whatsapp ? '<button class="mini-btn ghost" type="button" data-pede>Pedir pelo WhatsApp</button>' : "") +
                    '<button class="mini-btn" type="button" data-aceite="whatsapp">Aceitou pelo WhatsApp</button><button class="mini-btn ghost" type="button" data-aceite="termo">Assinou o termo</button>') + "</li>";
            }).join("") + "</ul>" : "") + "</li>";
        }).join("") + "</ul></section>" +

      /* as regras */
      '<section class="cam-card" aria-labelledby="camRegT"><div class="cam-h"><h4 id="camRegT">Regras</h4></div><ul class="cam-reg">' +
        '<li><div><b>Abrir 5 min antes e fechar no fim da aula</b><small>O link do vídeo só vale nesse intervalo, pela grade de aulas.</small></div>' + tog("regra", C.regras.abre5, "Abrir 5 min antes e fechar no fim da aula", '="abre5"') + "</li>" +
        '<li><div><b>Nome de quem assiste sobre o vídeo</b><small>Uma marca d\'água com o nome do responsável desestimula quem pensa em gravar a tela.</small></div>' + tog("regra", C.regras.nome, "Nome de quem assiste sobre o vídeo", '="nome"') + "</li>" +
        '<li><div><b>Gravar as aulas</b><small>Recomendado desligado: sem gravação, não há imagem de criança guardada para cuidar.</small></div>' + tog("regra", C.regras.gravar, "Gravar as aulas", '="gravar"') + "</li>" +
      "</ul></section>" +

      /* a prévia do app */
      '<section class="cam-card cam-prev-w" aria-labelledby="camPrevT"><div class="cam-h"><h4 id="camPrevT">Como a família vai ver no app</h4>' +
        '<div class="seg cam-seg" role="group" aria-label="Momento da prévia"><button type="button" data-previa="fechada" aria-pressed="' + (previa === "fechada") + '">Fora do horário</button><button type="button" data-previa="aovivo" aria-pressed="' + (previa === "aovivo") + '">Durante a aula</button></div></div>' +
        '<div class="cam-fone" aria-label="Prévia da tela Ao vivo do app">' + telaApp() + "</div>" +
        '<p class="cam-nota">Prévia com os dados de hoje. Os alunos não veem esta tela até a liberação.</p></section>' +

      /* equipamento e custo */
      '<section class="cam-card" aria-labelledby="camEqT"><div class="cam-h"><h4 id="camEqT">Equipamento e custo</h4><span>referência de preços de novembro de 2026</span></div><ul class="cam-eq">' +
        '<li class="fase"><b>Fase 1 · piloto com um celular</b></li>' +
        "<li><b>Celular reserva com boa câmera traseira</b><small>o que o Studio já tiver; Android com Chrome é o mais previsível</small><span>sem compra</span></li>" +
        "<li><b>Suporte firme e carregador</b><small>de parede ou tripé, com o celular deitado e sempre na tomada</small><span>orçamento local</span></li>" +
        '<li class="mes"><b>Transmissão (Cloudflare Stream)</b><small>assinatura do Stream a partir de US$ 5 por mês, mais US$ 1 a cada 1.000 minutos assistidos; sem gravação</small><span>a partir de US$ 5/mês</span></li>' +
        '<li class="fase"><b>Fase 2 · câmera fixa, depois do piloto</b></li>' +
        "<li><b>Câmera Wi-Fi com saída RTSP</b><small>ex.: TP-Link Tapo de tomada; instala pelo app do fabricante</small><span>a confirmar</span></li>" +
        "<li><b>Caixinha conversora</b><small>kit Raspberry Pi 5 ou um computador pequeno, preparada uma vez e ligada no roteador</small><span>R$ 800 a 1.250</span></li>" +
        "<li><b>Alternativa com cabo</b><small>câmera IP com PoE (R$ 300 a 470) e switch PoE (R$ 330 a 600)</small><span>R$ 630 a 1.070</span></li>" +
      "</ul></section>";
  }

  /* ---------- a tela "Ao vivo" do app, desenhada com os dados de hoje ---------- */
  function proximas(n) {
    /* as turmas com câmera que têm alunos (Kids primeiro, que é para quem a câmera foi pensada) */
    var comGente = ligadas().filter(function (t) { return daTurma(t[1]).length; });
    var nomes = comGente.filter(function (t) { return t[1] !== "adulto"; }).map(function (t) { return t[0]; });
    if (!nomes.length) nomes = (comGente.length ? comGente : ligadas()).map(function (t) { return t[0]; });
    var l = [], d0 = new Date();
    for (var k = 0; k < 8 && l.length < n; k++) {
      var d = new Date(d0); d.setDate(d0.getDate() + k);
      Site.aulasDo(d.getDay()).filter(function (c) { return nomes.indexOf(c.n) >= 0; }).forEach(function (c) {
        var p = c.t.split(":"), ini = new Date(d); ini.setHours(+p[0], +p[1], 0, 0);
        if (ini.getTime() + 3600e3 > d0.getTime()) l.push({ c: c, ini: ini, k: k });
      });
    }
    return l.sort(function (a, b) { return a.ini - b.ini; }).slice(0, n);
  }
  function quando(x) {
    return (x.k === 0 ? "Hoje" : x.k === 1 ? "Amanhã" : Site.DIAS[x.ini.getDay()].replace("-feira", "")) + ", " + Site.hora(x.c.t);
  }
  function telaApp() {
    var px = proximas(3), x = px[0];
    if (!x) return '<div class="cam-app"><p class="cam-app-t">Ao vivo</p><p class="cam-app-s">Escolha ao menos uma turma com aula na grade para ver a prévia.</p></div>';
    var turmaK = TURMAS.filter(function (t) { return t[0] === x.c.n; })[0][1], al = daTurma(turmaK)[0];
    var crianca = al ? P.first(al.nome) : "Pedro", resp = al ? (al.responsavel || al.nome) : "Responsável";
    var fim = new Date(x.ini.getTime() + 3600e3);
    if (previa === "aovivo") {
      return '<div class="cam-app"><div class="cam-app-h"><p class="cam-app-t">Ao vivo</p><span class="cam-vivo">ao vivo</span></div>' +
        '<p class="cam-app-s">' + esc(x.c.n) + " · aula de " + esc(crianca) + " · termina às " + Site.hora(P.two(fim.getHours()) + ":" + P.two(fim.getMinutes())) + "</p>" +
        '<div class="cam-video"><img src="img/jiu-jitsu-kids.webp" alt=""><span class="cam-tag-l">' + esc(C.nome) + '</span><span class="cam-tag-r">' + P.hm(new Date(x.ini.getTime() + 22 * 60000)) + "</span>" +
          (C.regras.nome ? '<span class="cam-marca">' + esc(resp) + "</span>" : "") + "</div>" +
        '<div class="cam-prog"><i style="width:37%"></i></div><p class="cam-prog-t"><span>22 min de aula</span><span>faltam 38 min</span></p>' +
        '<p class="cam-escudo"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg>Só os responsáveis desta turma veem esta câmera, e só no horário da aula. ' + (C.regras.gravar ? "As aulas ficam gravadas." : "Nada é gravado.") + "</p></div>";
    }
    var falta = Math.max(0, Math.round((x.ini - new Date()) / 60000));
    return '<div class="cam-app"><p class="cam-app-t">Ao vivo</p>' +
      '<div class="cam-video fechada"><svg class="ic" aria-hidden="true"><use href="#i-lock"/></svg><span>A câmera abre na aula de ' + esc(crianca) + "</span></div>" +
      '<p class="cam-app-big">' + esc(quando(x)) + '</p><p class="cam-app-s">' + (falta < 60 ? "em " + falta + " min" : falta < 1440 ? "em " + Math.floor(falta / 60) + " h" + (falta % 60 ? " " + falta % 60 + " min" : "") : "") + "</p>" +
      '<p class="cam-app-k">Próximas transmissões</p><ul class="cam-app-l">' + px.map(function (y) {
        var t = TURMAS.filter(function (q) { return q[0] === y.c.n; })[0][1], a = daTurma(t)[0];
        return "<li><b>" + esc(quando(y)) + "</b><small>" + esc(y.c.n + " · " + (a ? P.first(a.nome) : "")) + '</small><i aria-hidden="true"></i></li>';
      }).join("") + "</ul>" +
      '<p class="cam-app-n">A transmissão fica aberta só durante a aula.</p></div>';
  }

  /* ---------- piloto no app: a tela "Ao vivo" só para as pessoas escolhidas ----------
     A lista guarda cadastros de alunos; o app libera para a conta do próprio aluno e para a do responsável dele.
     Quem decide é o banco (função camera_ao_vivo); aqui o professor só monta a lista. */
  function testadores() { return ((L && L.testadores) || []).map(function (id) { return P.porId[id]; }).filter(Boolean); }
  function comApp(a) { return !!(a.conta || a.responsavel_conta); }
  function piloto() {
    if (!L || semTabela) return "";
    var h = '<div class="cam-pil"><h5 id="camPilT">Piloto no app: liberar só para algumas pessoas</h5>';
    if (semPiloto) return h + '<p class="cam-nota">Para liberar pessoas no app, falta atualizar o banco de dados: no Supabase, SQL Editor, New query, cole <a href="' + SQL_CAMERA + '" target="_blank" rel="noopener">este arquivo</a> inteiro e clique em Run. Depois recarregue esta página.</p></div>';
    var l = testadores(), ids = (L.testadores || []);
    var fora = P.alunosDeVerdade().filter(function (a) { return comApp(a) && ids.indexOf(a.id) < 0; }).sort(function (x, y) { return x.nome.localeCompare(y.nome); });
    return h + '<p class="cam-nota">Quem estiver nesta lista vê a câmera no app, com a conta dela (ou a do responsável), sempre que a transmissão estiver no ar. Use para testar antes de abrir para as famílias.</p>' +
      (l.length ? '<ul class="cam-pil-l" aria-labelledby="camPilT">' + l.map(function (a) {
        return '<li data-id="' + a.id + '"><span class="av"' + Fotos.attr(a.foto) + ">" + P.ini(a.nome) + "</span><div><b>" + esc(a.nome) + "</b><small>" +
          esc(P.TURMAS[a.turma] || a.turma || "") + (a.conta ? " · assiste com a própria conta" : " · assiste pela conta do responsável") + '</small></div><button class="mini-btn ghost" type="button" data-pil="tira">Tirar</button></li>';
      }).join("") + "</ul>" : '<p class="cam-pil-0">Ninguém liberado ainda.</p>') +
      '<div class="cam-pil-add"><label class="sr-only" for="camPilSel">Pessoa para liberar no app</label><select class="crm-in" id="camPilSel"><option value="">' + (fora.length ? "Escolha quem vai assistir" : "Ninguém mais com acesso ao app") + "</option>" +
        fora.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nome) + "</option>"; }).join("") + '</select><button class="mini-btn" type="button" data-pil="poe"' + (fora.length ? "" : " disabled") + ">Liberar no app</button></div>" +
      '<p class="cam-nota">Só aparece aqui quem já tem acesso ao app. Para criar o acesso, abra a ficha do aluno.</p></div>';
  }
  function gravaPiloto(lista, msg) {
    P.q(function (sb) { return sb.from("camera_links").upsert({ id: ID, testadores: lista }); })
      .then(function () { L.testadores = lista; P.toast(msg); paint(); })
      .catch(function (e) { P.erro(e, "Não deu para mudar a lista do piloto"); });
  }

  /* ---------- a transmissão (fase 1: um celular como câmera) ---------- */
  function instalada() { return !!(L && L.envio_url && L.visto_em); }
  function faltaTabela(e) { var m = (e && (e.message || "")) + " " + ((e && e.code) || ""); return /42P01|PGRST205|camera_links/.test(m); }
  function carregarLinks(soEstado) {
    var antes = instalada();
    var CAMPOS = "envio_url, assistir_url, pausada, estado, visto_em";
    return P.q(function (sb) { return sb.from("camera_links").select(CAMPOS + ", testadores").eq("id", ID).maybeSingle(); })
      .then(function (r) { semPiloto = false; return r; }, function (e) {
        if (!/42703|testadores/.test((e && (e.message || "")) + " " + ((e && e.code) || ""))) throw e;
        semPiloto = true;
        return P.q(function (sb) { return sb.from("camera_links").select(CAMPOS).eq("id", ID).maybeSingle(); });
      })
      .then(function (r) { L = r || {}; semTabela = false; }, function (e) { L = L || {}; semTabela = faltaTabela(e); if (!semTabela && window.console) console.warn(e); })
      .then(function () { if (!C) return; if (soEstado && antes === instalada()) pintaTx(); else paint(); });
  }
  function haQuanto(ms) {
    var m = Math.round(ms / 60000);
    return m < 1 ? "agora há pouco" : m < 60 ? "há " + m + " min" : m < 1440 ? "há " + Math.round(m / 60) + " h" : "há " + Math.round(m / 1440) + " dias";
  }
  /* o que o celular informou no último sinal (ele manda um a cada 30 segundos enquanto a câmera está ligada) */
  function estadoTx() {
    if (semTabela) return { cls: "falta", t: "Falta atualizar o banco", det: "" };
    if (!L || !L.envio_url) return { cls: "", t: "Ainda não conectada", det: "Siga os três passos abaixo. Leva uns dez minutos." };
    var e = L.estado || {}, visto = L.visto_em ? Date.now() - new Date(L.visto_em).getTime() : null, det = [];
    if (visto === null) return { cls: L.pausada ? "falta" : "", t: L.pausada ? "Pausada por você" : "Links salvos · falta ligar o celular", det: "Falta o passo 3: abrir a câmera no celular e tocar em Ligar." };
    var some = visto > 120000;
    if (e.aparelho) det.push(e.aparelho);
    if (some) det.push("último sinal " + haQuanto(visto));
    else {
      if (e.ao_vivo && e.conexao && e.conexao.kbps) det.push((e.conexao.kbps >= 1000 ? (e.conexao.kbps / 1000).toFixed(1).replace(".", ",") + " Mbps" : e.conexao.kbps + " kbps") + " · " + e.conexao.larg + "×" + e.conexao.alt);
      if (e.bateria) det.push("bateria " + e.bateria.nivel + "%" + (e.bateria.tomada ? " na tomada" : " · fora da tomada"));
      if (e.armada && e.tela_acesa === false) det.push("a tela do celular pode apagar: toque nela uma vez");
      if (e.erro) det.push(e.erro);
    }
    var d = det.join(" · ");
    if (L.pausada) return { cls: "falta", t: "Pausada por você", det: d };
    if (some) return { cls: "falta", t: "Celular sem sinal " + haQuanto(visto), det: d + (d ? ". " : "") + "Confira se a página da câmera continua aberta nele, com internet e na tomada." };
    if (!e.armada) return { cls: "falta", t: "Celular aberto, câmera desligada", det: d + (d ? ". " : "") + "No celular, toque em Ligar a câmera do tatame." };
    if (e.ao_vivo) return { cls: "ok", t: "No ar agora" + (e.turma ? " · " + e.turma : ""), det: d };
    return { cls: e.erro ? "falta" : "ok", t: e.erro ? "Celular ligado, com problema" : "Celular ligado, aguardando a próxima aula", det: d };
  }
  function montaCaixa() {
    if ($("#camTx")) return;
    var end = new URL("transmitir", location.href).href, curto = end.replace(/^https?:\/\//, "");
    box.innerHTML =
      '<section class="cam-card cam-tx" id="camTx" aria-labelledby="camTxT">' +
        '<div class="cam-h"><h4 id="camTxT">Transmissão · um celular como câmera</h4><span class="cam-st" id="camTxSt" role="status"></span></div>' +
        '<p class="cam-nota cam-tx-det" id="camTxDet"></p>' +
        '<p class="cam-tx-banco" id="camTxBanco" hidden><b>Falta atualizar o banco de dados.</b> Abra o Supabase, SQL Editor, New query, cole <a href="' + SQL_CAMERA + '" target="_blank" rel="noopener">este arquivo</a> inteiro e clique em Run. Depois recarregue esta página.</p>' +
        '<div class="cam-tx-g"><div>' +
          '<ol class="cam-tx-passos">' +
            '<li><b>Crie a entrada ao vivo na Cloudflare.</b> Em <a href="https://dash.cloudflare.com/?to=/:account/stream/inputs" target="_blank" rel="noopener">Stream, Live inputs</a>, clique em Create live input e dê o nome Tatame 1. Na entrada criada, copie os dois endereços de WebRTC. O Stream precisa estar ativado na conta (assinatura a partir de US$ 5 por mês).</li>' +
            "<li><b>Cole os dois endereços aqui.</b> O de envio termina em <code>/webRTC/publish</code> e o de assistir em <code>/webRTC/play</code>.</li>" +
            "<li><b>Ligue o celular que vai filmar.</b> Nele, aponte a câmera para o código ao lado ou abra <code>" + esc(curto) + "</code>, entre com a sua conta de professor e toque em Ligar. Deixe o celular deitado, no suporte e na tomada.</li>" +
          "</ol>" +
          '<p class="cam-tx-salvo" id="camTxSalvo" hidden><svg class="ic" aria-hidden="true"><use href="#i-check"/></svg><span>Os dois endereços estão salvos. O de envio não aparece de novo: ele é a chave da transmissão.</span><button class="mini-btn ghost" type="button" data-tx="trocar">Trocar os endereços</button></p>' +
          '<form class="cam-tx-form" id="camTxForm" novalidate hidden>' +
            '<label class="crm-f"><span>Endereço de envio <small>(termina em /webRTC/publish)</small></span><input class="crm-in" id="camTxEnvio" type="url" inputmode="url" autocomplete="off" spellcheck="false" aria-describedby="camTxErr"></label>' +
            '<label class="crm-f"><span>Endereço para assistir <small>(termina em /webRTC/play)</small></span><input class="crm-in" id="camTxAssistir" type="url" inputmode="url" autocomplete="off" spellcheck="false" aria-describedby="camTxErr"></label>' +
            '<p class="cam-tx-err" id="camTxErr" role="alert" hidden></p>' +
            '<div class="cam-tx-bt"><button class="mini-btn" type="submit">Salvar os endereços</button><button class="mini-btn ghost" type="button" data-tx="cancelar" hidden>Cancelar</button></div>' +
          "</form>" +
        '</div><div class="cam-tx-lado">' +
          '<div class="cam-tx-qr"><div id="camTxQr" role="img" aria-label="Código para abrir a câmera no celular"></div><p>Aponte a câmera do celular que vai filmar para este código. Ele abre a página da câmera.</p></div>' +
          '<div class="cam-tx-video"><video id="camTxVideo" muted playsinline aria-label="Imagem ao vivo do tatame"></video><p class="cam-tx-msg" id="camTxMsg"></p></div>' +
          '<div class="cam-tx-bt"><button class="mini-btn" type="button" data-tx="ver">Ver ao vivo</button><button class="mini-btn ghost cam-pausa" type="button" data-tx="pausa" aria-pressed="false">Pausar a transmissão agora</button></div>' +
          '<p class="cam-nota">Sem som e sem gravação. Cada minuto assistido conta na Cloudflare, por isso o vídeo aqui para sozinho depois de 5 minutos.</p>' +
        "</div></div></section>" +
      '<div class="cam-resto" id="camResto"></div>';
    if (window.qrcode) { try { var q = window.qrcode(0, "M"); q.addData(end); q.make(); $("#camTxQr").innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch (e) {} }
    $("#camTxForm").addEventListener("submit", function (e) { e.preventDefault(); salvarLinks(); });
    /* enquanto a área está aberta, atualiza o estado do celular a cada 20 segundos; ao sair dela, o vídeo para */
    if (!pollT) pollT = setInterval(function () {
      var aberta = $('.dv[data-v="cam"]').classList.contains("on");
      if (!aberta) { if (ver) pararVer(""); return; }
      if (!document.hidden && !semTabela) carregarLinks(true);
    }, 20000);
  }
  function pintaTx() {
    if (!$("#camTx")) return;
    var st = estadoTx(), tem = !!(L && L.envio_url), carregou = !!L;
    $("#camTxSt").className = "cam-st " + st.cls; $("#camTxSt").textContent = carregou ? st.t : "";
    $("#camTxDet").textContent = carregou ? st.det : ""; $("#camTxDet").hidden = !carregou || !st.det;
    $("#camTxBanco").hidden = !semTabela;
    $("#camTxSalvo").hidden = !tem || editando;
    $("#camTxForm").hidden = !carregou || semTabela || (tem && !editando);
    $('[data-tx="cancelar"]').hidden = !tem;
    var bVer = $('[data-tx="ver"]'), bPausa = $('[data-tx="pausa"]');
    bVer.disabled = !(L && L.assistir_url); bVer.textContent = ver ? "Parar de assistir" : "Ver ao vivo";
    bPausa.disabled = !tem; bPausa.textContent = L && L.pausada ? "Retomar a transmissão" : "Pausar a transmissão agora"; bPausa.setAttribute("aria-pressed", String(!!(L && L.pausada)));
    var msg = verMsg || (ver ? "" : !tem ? "O vídeo aparece aqui depois de conectar o celular." : "Toque em Ver ao vivo para abrir a imagem do tatame.");
    $("#camTxMsg").textContent = msg; $("#camTxMsg").hidden = !msg;
  }
  function confereLink(v, fim, outro) {
    v = String(v || "").trim();
    if (!v) return "Cole os dois endereços.";
    var u;
    try { u = new URL(v); } catch (e) { return "Isso não parece um endereço. Copie de novo na Cloudflare."; }
    if (u.protocol !== "https:" || !/(^|\.)cloudflarestream\.com$/.test(u.hostname)) return "O endereço precisa ser da Cloudflare Stream (termina em cloudflarestream.com).";
    if (new RegExp("/webRTC/" + outro + "/?$").test(u.pathname)) return "Os endereços estão trocados: o de " + (fim === "publish" ? "envio" : "assistir") + " termina em /webRTC/" + fim + ".";
    if (!new RegExp("/webRTC/" + fim + "/?$").test(u.pathname)) return "O endereço de " + (fim === "publish" ? "envio" : "assistir") + " precisa terminar em /webRTC/" + fim + ". Copie o de WebRTC, não o de RTMPS nem o de SRT.";
    return "";
  }
  function salvarLinks() {
    var env = $("#camTxEnvio").value.trim(), ass = $("#camTxAssistir").value.trim(), err = $("#camTxErr");
    var m = confereLink(env, "publish", "play") || confereLink(ass, "play", "publish");
    err.hidden = !m; err.textContent = m;
    if (m) { (confereLink(env, "publish", "play") ? $("#camTxEnvio") : $("#camTxAssistir")).focus(); return; }
    P.q(function (sb) { return sb.from("camera_links").upsert({ id: ID, envio_url: env, assistir_url: ass }).select("envio_url, assistir_url, pausada, estado, visto_em").maybeSingle(); })
      .then(function (r) {
        L = Object.assign(L || {}, r && r.envio_url ? r : { envio_url: env, assistir_url: ass });
        editando = false; $("#camTxEnvio").value = ""; $("#camTxAssistir").value = "";
        P.toast("Endereços salvos. Agora ligue o celular que vai filmar.");
        salvar();   /* as turmas e as regras ficam gravadas como estão na tela, para o celular ler */
        paint();
      })
      .catch(function (e) { if (faltaTabela(e)) { semTabela = true; pintaTx(); } else P.erro(e, "Não deu para salvar os endereços"); });
  }
  function pararVer(msg) {
    clearTimeout(verT);
    var v = ver; ver = null;
    if (v && v.s) v.s.parar();
    verMsg = msg || ""; pintaTx();
  }
  function verAoVivo() {
    if (ver) return pararVer("");
    if (!window.Vivo || !Vivo.suporta()) { verMsg = "Este navegador não toca a transmissão."; return pintaTx(); }
    var meu = ver = {}, video = $("#camTxVideo");
    verMsg = "Conectando…"; pintaTx();
    Vivo.assistir(L.assistir_url, video, { aoCair: function () { if (ver === meu) pararVer("A transmissão terminou."); } }).then(function (s) {
      if (ver !== meu) { s.parar(); return; }
      meu.s = s;
      /* ligou, mas a imagem só existe se o celular estiver no ar: espera até 10 segundos por ela */
      var n = 0, t = setInterval(function () {
        if (ver !== meu) return clearInterval(t);
        if (video.videoWidth > 0) return chegou();
        if (++n >= 20) { clearInterval(t); pararVer("A câmera não está transmitindo agora."); }
      }, 500);
      function chegou() { clearInterval(t); video.removeEventListener("playing", chegou); if (ver !== meu || !verMsg) return; verMsg = ""; pintaTx(); }
      video.addEventListener("playing", chegou);
      if (video.videoWidth > 0) chegou();
      verT = setTimeout(function () { if (ver === meu) pararVer("O vídeo parou sozinho depois de 5 minutos. Toque em Ver ao vivo para continuar."); }, 5 * 60000);
    }, function (e) {
      if (ver !== meu) return;
      ver = null;
      verMsg = e.tipo === "fora-do-ar" ? "A câmera não está transmitindo agora." : e.tipo === "sem-rede" ? "Sem internet. Confira a conexão e tente de novo." : "Não deu para abrir o vídeo agora. Se a câmera estiver no ar, tente de novo em alguns segundos.";
      pintaTx();
    });
  }
  function pausar() {
    var nova = !L.pausada;
    P.q(function (sb) { return sb.from("camera_links").update({ pausada: nova }).eq("id", ID); })
      .then(function () { L.pausada = nova; P.toast(nova ? "Transmissão pausada. O celular para em até 30 segundos." : "Transmissão retomada."); pintaTx(); })
      .catch(function (e) { P.erro(e, "Não deu para " + (nova ? "pausar" : "retomar")); });
  }

  /* ---------- ações ---------- */
  box.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
    if (b.hasAttribute("data-tx")) {
      var tx = b.dataset.tx;
      if (tx === "ver") return verAoVivo();
      if (tx === "pausa") return pausar();
      if (tx === "trocar") { editando = true; pintaTx(); $("#camTxAssistir").value = (L && L.assistir_url) || ""; return $("#camTxEnvio").focus(); }
      if (tx === "cancelar") { editando = false; $("#camTxErr").hidden = true; return pintaTx(); }
      return;
    }
    if (b.hasAttribute("data-pil")) {
      var atual = ((L && L.testadores) || []).slice();
      if (b.dataset.pil === "poe") {
        var sel = $("#camPilSel"), quem = sel && P.porId[sel.value];
        if (!quem) { if (sel) sel.focus(); return P.toast("Escolha a pessoa na lista."); }
        return gravaPiloto(atual.concat(quem.id), P.first(quem.nome) + " liberado no app. A câmera aparece no Início do app dele.");
      }
      var li0 = b.closest("[data-id]"), sai = li0 && P.porId[li0.dataset.id];
      if (sai) gravaPiloto(atual.filter(function (x) { return x !== sai.id; }), P.first(sai.nome) + " saiu do piloto.");
      return;
    }
    if (b.hasAttribute("data-previa")) { previa = b.dataset.previa; return paint(); }
    if (b.hasAttribute("data-abre")) { abertas[b.dataset.abre] = !abertas[b.dataset.abre]; return paint(); }
    if (b.hasAttribute("data-turma")) { C.turmas[b.dataset.turma] = !C.turmas[b.dataset.turma]; paint(); return salvar(); }
    if (b.hasAttribute("data-regra")) { C.regras[b.dataset.regra] = !C.regras[b.dataset.regra]; paint(); return salvar(); }
    if (b.hasAttribute("data-cond")) { C[b.dataset.cond] = !C[b.dataset.cond]; paint(); return salvar(); }
    var li = b.closest("[data-id]"), a = li && P.porId[li.dataset.id];
    if (!a) return;
    if (b.hasAttribute("data-aceite")) { C.aceites[a.id] = { em: P.hoje(), como: b.dataset.aceite }; paint(); return salvar("Aceite de " + P.first(a.nome) + " registrado."); }
    if (b.hasAttribute("data-desfaz")) { delete C.aceites[a.id]; paint(); return salvar("Aceite de " + P.first(a.nome) + " desfeito."); }
    if (b.hasAttribute("data-pede")) {
      var kid = P.kid(a.turma), t = P.TURMAS[a.turma === "feminino" ? "adulto" : a.turma];
      P.wa(a.whatsapp, "Oi, " + P.first(kid ? a.responsavel || a.nome : a.nome) + "! Aqui é do Studio Evolution BJJ. Estamos preparando uma câmera no tatame para os responsáveis assistirem às aulas ao vivo pelo app, " +
        "só no horário da aula e sem gravação. Para ligar na turma " + t + ", precisamos da autorização de todos da turma. " +
        (kid ? "Você autoriza a transmissão da imagem de " + P.first(a.nome) + " durante as aulas?" : "Você autoriza a transmissão da sua imagem durante as aulas?") + " Se autorizar, é só responder aqui com \"autorizo\".");
    }
  });

  P.aoAbrir("cam", function () { if (C) paint(); carregar(); });
  P.aoMudarAlunos(function () { if (C) paint(); });
})();
