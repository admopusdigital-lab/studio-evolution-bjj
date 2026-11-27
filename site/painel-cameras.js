/* Painel · Câmeras (em preparo, só o dono vê): a aula ao vivo no app para os responsáveis, só no horário da aula
   e sem gravação. Aqui o professor escolhe as turmas, registra o aceite de cada família (LGPD: imagem de criança
   pede consentimento específico de um dos pais, art. 14), marca as condições e vê a prévia da tela do app.
   Nada aparece no app nem para a equipe até a transmissão ser ligada e liberada.
   Tudo fica em configuracoes (chave "cameras"), sem tabela nova. */
(function () {
  "use strict";
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var box = $("#camBox");
  if (!box) return;
  var TURMAS = [["Kids 1", "kids1"], ["Kids 2", "kids2"], ["Adulto", "adulto"]];
  var PADRAO = { instalada: false, nome: "Tatame 1", turmas: { kids1: true, kids2: true, adulto: false }, regras: { abre5: true, nome: true, gravar: false }, aviso: false, revisao: false, aceites: {} };
  var C = null, previa = "fechada", abertas = {}, salvaT = null;

  function carregar() {
    return P.q(function (sb) { return sb.from("configuracoes").select("valor").eq("chave", "cameras").maybeSingle(); })
      .then(function (r) { C = Object.assign(JSON.parse(JSON.stringify(PADRAO)), r && r.valor ? r.valor : {}); C.aceites = C.aceites || {}; paint(); })
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
      ["Câmera instalada e transmissão ligada", C.instalada, C.instalada ? "Ligada" : "Aguardando a compra e a instalação"],
      ["Aviso na entrada de que o tatame tem câmera", C.aviso, null, "aviso"],
      ["Termo de autorização revisado por um advogado", C.revisao, null, "revisao"],
      ["Aceite de todos nas turmas com câmera", lig.length && f.tot && !f.n, lig.length ? (f.tot ? (f.tot - f.n) + " de " + f.tot + " aceitaram" : "Nenhum aluno nessas turmas") : "Nenhuma turma escolhida"]
    ];
    var prontas = cond.filter(function (c) { return c[1]; }).length;
    box.innerHTML =
      /* as condições para liberar */
      '<section class="cam-card cam-cond" aria-labelledby="camCondT"><div class="cam-h"><h4 id="camCondT">Para liberar para as famílias</h4><span>' + prontas + " de " + cond.length + " prontas</span></div><ol>" +
        cond.map(function (c) {
          return '<li class="' + (c[1] ? "ok" : "") + '"><span class="cam-mk" aria-hidden="true">' + (c[1] ? '<svg class="ic"><use href="#i-check"/></svg>' : "") + "</span>" +
            "<b>" + esc(c[0]) + '<span class="sr-only">' + (c[1] ? ": pronto" : ": falta") + "</span></b>" +
            (c[3] ? tog("cond", c[1], c[0], '="' + c[3] + '"') : '<small>' + esc(c[2]) + "</small>") + "</li>";
        }).join("") + "</ol>" +
        '<button class="mini-btn" type="button" disabled>Liberar para as famílias</button><p class="cam-nota">A liberação acontece junto com a ligação do vídeo, quando a câmera estiver instalada. Até lá, ninguém além de você vê esta área.</p></section>' +

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
      '</ul><button class="mini-btn ghost cam-pausa" type="button" disabled>Pausar a transmissão agora</button></section>' +

      /* a prévia do app */
      '<section class="cam-card cam-prev-w" aria-labelledby="camPrevT"><div class="cam-h"><h4 id="camPrevT">Como a família vai ver no app</h4>' +
        '<div class="seg cam-seg" role="group" aria-label="Momento da prévia"><button type="button" data-previa="fechada" aria-pressed="' + (previa === "fechada") + '">Fora do horário</button><button type="button" data-previa="aovivo" aria-pressed="' + (previa === "aovivo") + '">Durante a aula</button></div></div>' +
        '<div class="cam-fone" aria-label="Prévia da tela Ao vivo do app">' + telaApp() + "</div>" +
        '<p class="cam-nota">Prévia com os dados de hoje. Os alunos não veem esta tela até a liberação.</p></section>' +

      /* equipamento e custo */
      '<section class="cam-card" aria-labelledby="camEqT"><div class="cam-h"><h4 id="camEqT">Equipamento e custo</h4><span>referência de preços de novembro de 2026</span></div><ul class="cam-eq">' +
        "<li><b>Câmera IP Full HD com PoE</b><small>ex.: Intelbras VIP 1230; energia e internet pelo mesmo cabo</small><span>R$ 300 a 470</span></li>" +
        "<li><b>Switch PoE de 4 portas</b><small>ex.: Intelbras SF 500; alimenta até 4 câmeras</small><span>R$ 330 a 600</span></li>" +
        "<li><b>Conversor na academia</b><small>kit Raspberry Pi 5, ou um computador que fique ligado</small><span>R$ 800 a 1.250</span></li>" +
        "<li><b>Cabo de rede e instalação</b><small>até o teto do tatame</small><span>orçamento local</span></li>" +
        '<li class="mes"><b>Transmissão (Cloudflare Stream)</b><small>US$ 1 a cada 1.000 minutos assistidos, sem gravação; a internet precisa de 2 a 4 Mbps de envio por câmera</small><span>~US$ 5 a 26/mês</span></li>' +
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

  /* ---------- ações ---------- */
  box.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
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
