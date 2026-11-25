/* Painel · Frequência: três respostas na mesma tela.
   Em queda: quem treinou bem nas 4 semanas anteriores e caiu pela metade ou mais nas últimas 4 (com o WhatsApp pronto).
   Aulas e dias: a média de alunos por aula nas últimas 8 semanas, turma × dia da semana, num mapa de calor.
   Ranking: quem mais treinou no período, com pódio (os 10 primeiros do mês também aparecem no app).
   Tudo sai das presenças do último ano (P.pres); "Desde o início" soma as aulas feitas antes do app. */
(function () {
  "use strict";
  var P = window.P, $ = P.$, esc = P.esc;
  var DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"], DIAS_L = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var aba = "queda";
  function dec(n) { return (Math.round(n * 10) / 10).toLocaleString("pt-BR", { maximumFractionDigits: 1 }); }
  function plural(n, s, p) { return n + " " + (n === 1 ? s : p); }

  /* ---------- abas ---------- */
  var ABAS = [["queda", "#fqtQueda", "#fqpQueda"], ["mapa", "#fqtMapa", "#fqpMapa"], ["rank", "#fqtRank", "#fqpRank"]];
  function abrirAba(k, foco) {
    aba = k;
    ABAS.forEach(function (t) { var on = t[0] === k; $(t[1]).setAttribute("aria-selected", on); $(t[1]).tabIndex = on ? 0 : -1; $(t[2]).hidden = !on; if (on && foco) P.focusSoft($(t[1])); });
    paint();
  }
  ABAS.forEach(function (t, i) {
    $(t[1]).addEventListener("click", function () { abrirAba(t[0]); });
    $(t[1]).addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      abrirAba(ABAS[(i + (e.key === "ArrowRight" ? 1 : ABAS.length - 1)) % ABAS.length][0], true);
    });
  });

  /* ---------- as contas: 4 semanas de agora contra as 4 de antes, e 8 semanas para o mapa ---------- */
  function contas() {
    var H = P.hoje(), d28 = P.somaDias(H, -27), d56 = P.somaDias(H, -55);
    var por = {}, rec = 0, ant = 0, sess = {}, quem = {};
    P.pres.forEach(function (p) {
      if (p.data > H || p.data < d56) return;
      (por[p.aluno] = por[p.aluno] || []).push(p.data);
      if (p.data >= d28) { rec++; sess[p.data + " " + p.hora] = 1; quem[p.aluno] = 1; } else ant++;
    });
    return { H: H, d28: d28, d56: d56, por: por, rec: rec, ant: ant, sessoes: Object.keys(sess).length, treinando: Object.keys(quem).length };
  }
  /* aulas por semana nas últimas 8 (da mais antiga para a de agora), em janelas de 7 dias terminando hoje */
  function semanas(datas, H) {
    var w = [0, 0, 0, 0, 0, 0, 0, 0];
    datas.forEach(function (d) { var k = Math.floor(P.difDias(d, H) / 7); if (k >= 0 && k < 8) w[7 - k]++; });
    return w;
  }
  function emQueda(c) {
    return P.alunosDeVerdade().filter(function (a) { return a.ativo; }).map(function (a) {
      var ds = c.por[a.id] || [], r = ds.filter(function (d) { return d >= c.d28; }).length, n = ds.length - r;
      return { a: a, rec: r, ant: n, w: semanas(ds, c.H), ult: P.ultima(a.id) };
    }).filter(function (x) { return x.ant >= 3 && x.rec <= x.ant / 2; })
      .sort(function (x, y) { return (y.ant - y.rec) / y.ant - (x.ant - x.rec) / x.ant || y.ant - x.ant || x.a.nome.localeCompare(y.a.nome); });
  }

  function paint() {
    var c = contas(), q = emQueda(c);
    var ativos = P.alunosDeVerdade().filter(function (a) { return a.ativo; }).length;
    var dif = c.ant ? Math.round((c.rec - c.ant) / c.ant * 100) : null;
    $("#fqKpis").innerHTML =
      '<div class="kpi"><b>' + c.rec + "</b><span>presenças nas últimas 4 semanas" + (dif === null ? "" : ' · <em class="' + (dif < 0 ? "dn" : "up") + '">' + (dif > 0 ? "+" : dif < 0 ? "−" : "") + Math.abs(dif) + "%</em> sobre as 4 de antes") + "</span></div>" +
      '<div class="kpi"><b>' + (c.sessoes ? dec(c.rec / c.sessoes) : "—") + "</b><span>alunos por aula, em média" + (c.sessoes ? " (" + plural(c.sessoes, "aula", "aulas") + ")" : "") + "</span></div>" +
      '<div class="kpi"><b>' + c.treinando + "</b><span>de " + plural(ativos, "aluno ativo", "alunos ativos") + " treinaram nesse tempo</span></div>" +
      '<div class="kpi' + (q.length ? " warn" : "") + '"><b>' + q.length + "</b><span>" + (q.length === 1 ? "aluno em queda" : "alunos em queda") + "</span></div>";
    var n = $("#fqN");
    n.hidden = !q.length; n.textContent = q.length;
    $("#fqtQueda").setAttribute("aria-label", "Em queda" + (q.length ? ", " + plural(q.length, "aluno", "alunos") : ""));
    if (aba === "queda") paintQueda(q);
    else if (aba === "mapa") paintMapa(c);
    else paintRank();
  }

  /* ---------- Em queda ---------- */
  function msg(a) {
    var kid = P.kid(a.turma) && a.responsavel;
    return "Oi, " + P.first(kid ? a.responsavel : a.nome) + "! Aqui é do Studio Evolution BJJ. " +
      (kid ? "Sentimos falta de " + P.first(a.nome) + " no tatame nas últimas semanas. Está tudo bem por aí?" : "Sentimos sua falta no tatame nas últimas semanas. Está tudo bem?") +
      " Se algum horário ficou difícil, me conta que a gente acha um jeito. Te esperamos no treino!";
  }
  function paintQueda(q) {
    $("#fqQSub").textContent = q.length ? "Treinavam 3 aulas ou mais nas 4 semanas anteriores e caíram pela metade ou mais nas últimas 4. Os primeiros caíram mais. Uma mensagem agora costuma trazer de volta." : "";
    $("#fqQ").innerHTML = q.map(function (x) {
      var a = x.a, max = Math.max.apply(null, x.w.concat([1])), dias = x.ult ? P.difDias(x.ult, P.hoje()) : null;
      return '<li><span class="av"' + Fotos.attr(a.foto) + ">" + P.ini(a.nome) + "</span>" +
        '<div class="fq-qn"><button class="nm-btn" type="button" data-ficha="' + a.id + '">' + esc(a.nome) + "</button><small>" + esc(P.turmaTx(a)) +
        (dias === null ? "" : " · última aula " + (dias === 0 ? "hoje" : dias === 1 ? "ontem" : "há " + dias + " dias")) + "</small></div>" +
        '<span class="fq-sp" role="img" aria-label="Aulas por semana, da mais antiga para a de agora: ' + x.w.join(", ") + '" title="Aulas por semana (8 semanas): ' + x.w.join(" · ") + '">' +
          x.w.map(function (v, i) { return '<i class="' + (i < 4 ? "a" : "r") + (v ? "" : " z") + '" style="--h:' + Math.max(8, Math.round(v / max * 100)) + '%"></i>'; }).join("") + "</span>" +
        '<div class="fq-qv"><b>' + x.ant + ' <span aria-hidden="true">→</span><span class="sr-only">para</span> ' + x.rec + "</b><small>aulas, antes e agora</small></div>" +
        '<div class="row-acts">' + (a.whatsapp ? '<button class="mini-btn ghost" type="button" data-wa="' + a.id + '"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-wa"/></svg>WhatsApp</button>' : '<button class="mini-btn ghost" type="button" data-ficha="' + a.id + '">Ficha</button>') + "</div></li>";
    }).join("");
    var e = $("#fqQEmpty");
    e.hidden = !!q.length;
    e.innerHTML = "<b>Ninguém em queda.</b>Quem treinava nas 4 semanas anteriores continua no ritmo. Os alunos sem treinar há 14 dias ou mais estão em Alunos, no filtro Sem treinar.";
  }

  /* ---------- Aulas e dias: média de alunos por aula, turma × dia ---------- */
  function paintMapa(c) {
    var dias = [];
    Site.GRADE.forEach(function (g) { g.d.forEach(function (d) { if (dias.indexOf(d) < 0) dias.push(d); }); });
    dias.sort(function (a, b) { return (a || 7) - (b || 7); });  /* segunda primeiro, domingo no fim */
    /* presenças das 8 semanas por aula (turma + hora + dia da semana): total e em quantos dias houve aula */
    var m = {};
    P.pres.forEach(function (p) {
      if (p.data > c.H || p.data < c.d56) return;
      var k = p.turma + "|" + p.hora + "|" + P.dia(p.data).getDay();
      var x = m[k] = m[k] || { n: 0, d: {} };
      x.n++; x.d[p.data] = 1;
    });
    var max = 0, cel = [], vazias = 0;
    var linhas = Site.GRADE.map(function (g) {
      return dias.map(function (d) {
        if (g.d.indexOf(d) < 0) return null;
        var x = m[P.turmaAula(g.n) + "|" + g.t + "|" + d], s = x ? Object.keys(x.d).length : 0, v = s ? x.n / s : null;
        var o = { g: g, d: d, v: v, s: s };
        if (v !== null) { max = Math.max(max, v); cel.push(o); } else vazias++;
        return o;
      });
    });
    function passo(v) { var r = v / max; return r >= 0.8 ? 5 : r >= 0.6 ? 4 : r >= 0.4 ? 3 : r >= 0.2 ? 2 : 1; }
    $("#fqMapa").innerHTML = '<caption class="sr-only">Média de alunos por aula nas últimas 8 semanas, por turma e dia da semana</caption>' +
      '<thead><tr><th scope="col">Aula</th>' + dias.map(function (d) { return '<th scope="col"><abbr title="' + DIAS_L[d] + '">' + DIAS[d] + "</abbr></th>"; }).join("") + "</tr></thead><tbody>" +
      linhas.map(function (l, i) {
        var g = Site.GRADE[i];
        return '<tr><th scope="row"><b>' + esc(g.t) + "</b> " + esc(g.n) + "</th>" + l.map(function (o) {
          if (!o) return '<td class="fora"><span class="sr-only">sem aula</span></td>';
          if (o.v === null) return '<td class="nada" title="' + DIAS[o.d] + " " + esc(g.t) + " " + esc(g.n) + ': sem presença registrada nas últimas 8 semanas">—</td>';
          return '<td class="s' + passo(o.v) + '" title="' + DIAS[o.d] + " " + esc(g.t) + " " + esc(g.n) + ": média de " + dec(o.v) + " alunos em " + plural(o.s, "aula", "aulas") + '">' + dec(o.v) + "</td>";
        }).join("") + "</tr>";
      }).join("") + "</tbody>";
    cel.sort(function (a, b) { return b.v - a.v; });
    var nome = function (o) { return DIAS_L[o.d] + " " + o.g.t + " (" + o.g.n + ")"; };
    $("#fqMSub").innerHTML = cel.length ? "Média de alunos por aula nas últimas 8 semanas. " + (cel.length > 1 ? "Mais cheia: <b>" + esc(nome(cel[0])) + "</b>, " + dec(cel[0].v) + ". Mais vazia: <b>" + esc(nome(cel[cel.length - 1])) + "</b>, " + dec(cel[cel.length - 1].v) + "." : "") +
      (vazias ? " " + (vazias === 1 ? "Uma aula da grade está" : vazias + " aulas da grade estão") + " sem nenhuma presença registrada (—): confira se a chamada está sendo feita nelas ou se o horário ainda existe." : "") : "";
    $("#fqLeg").innerHTML = cel.length ? "<span>menos</span>" + [1, 2, 3, 4, 5].map(function (s) { return '<i class="s' + s + '"></i>'; }).join("") + "<span>mais alunos por aula</span>" : "";
    $("#fqMapa").hidden = !cel.length;
    var e = $("#fqMEmpty");
    e.hidden = !!cel.length;
    e.innerHTML = "<b>Ainda sem presenças nas últimas 8 semanas.</b>O mapa se monta sozinho com a chamada de Hoje e os códigos que os alunos digitam no app.";
  }

  /* ---------- Ranking: por mês do calendário (o atual e os três anteriores), o ano e desde o início ---------- */
  var NOMES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  var PER = [0, 1, 2, 3].map(function (k) {
    var m = P.mesIni(P.hoje()), d;
    for (var i = 0; i < k; i++) { d = P.dia(m); d.setDate(0); m = P.mesIni(P.iso(d)); }
    var nm = NOMES[+m.slice(5, 7) - 1];
    return [m, nm.charAt(0).toUpperCase() + nm.slice(1) + (k === 0 ? " (este mês)" : "")];
  }).concat([["ano", "Este ano"], ["tudo", "Desde o início"]]);
  var GR = [["todos", "Todos"], ["adulto", "Adulto"], ["kids", "Kids"]];
  var per = PER[0][0], gr = "todos";
  function conta(a) {
    var hoje = P.hoje(), ini, fim = "9999";
    if (per === "tudo") ini = "0000";
    else if (per === "ano") ini = hoje.slice(0, 4) + "-01-01";
    else { ini = per; var d = P.dia(per); d.setMonth(d.getMonth() + 1); fim = P.iso(d); }
    var n = P.pres.filter(function (p) { return p.aluno === a.id && p.data >= ini && p.data < fim; }).length;
    return per === "tudo" ? n + (a.aulas_antes || 0) : n;
  }
  function paintRank() {
    $("#rkPer").innerHTML = PER.map(function (x) { return '<button type="button" data-p="' + x[0] + '" aria-pressed="' + (per === x[0]) + '">' + x[1] + "</button>"; }).join("");
    $("#rkGr").innerHTML = GR.map(function (x) { return '<button type="button" data-g="' + x[0] + '" aria-pressed="' + (gr === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var l = P.alunosDeVerdade().filter(function (a) { return gr === "todos" || (gr === "kids") === P.kid(a.turma); })
      .map(function (a) { return { a: a, n: conta(a) }; }).filter(function (x) { return x.n > 0; })
      .sort(function (x, y) { return y.n - x.n || x.a.nome.localeCompare(y.a.nome); });
    /* empate divide a posição: 1, 2, 2, 4 */
    l.forEach(function (x, i) { x.pos = i && x.n === l[i - 1].n ? l[i - 1].pos : i + 1; });
    var max = l.length ? l[0].n : 1;
    var med = ["ouro", "prata", "bronze"];
    $("#rkPodio").innerHTML = l.slice(0, 3).map(function (x) {
      return '<li class="rk-p ' + med[Math.min(x.pos - 1, 2)] + '"><span class="rk-m" aria-hidden="true">' + x.pos + '</span><span class="av"' + Fotos.attr(x.a.foto) + '>' + P.ini(x.a.nome) + "</span>" +
        '<button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) + "</button>" +
        "<small>" + esc(P.turmaTx(x.a)) + "</small>" + P.belt(x.a.faixa, x.a.graus, x.a.turma) +
        '<b class="rk-n">' + x.n + "<span>" + (x.n === 1 ? " aula" : " aulas") + "</span></b></li>";
    }).join("");
    $("#rkPodio").hidden = !l.length;
    $("#rkTbl tbody").innerHTML = l.slice(3).map(function (x) {
      return '<tr><td class="num rk-pos">' + x.pos + "º</td>" +
        '<td><div class="nm"><span class="av"' + Fotos.attr(x.a.foto) + '>' + P.ini(x.a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) + "</button><small>" + esc(P.turmaTx(x.a)) + "</small></div></div></td>" +
        "<td>" + P.belt(x.a.faixa, x.a.graus, x.a.turma) + '</td><td class="num">' + x.n + '</td><td class="hide-s"><span class="rk-bar" style="--w:' + Math.round(x.n / max * 100) + '%"></span></td></tr>';
    }).join("");
    $("#rkTbl").hidden = l.length <= 3;
    var e = $("#rkEmpty");
    e.hidden = !!l.length;
    e.innerHTML = "<b>Ninguém treinou neste período ainda.</b>As presenças entram aqui quando o aluno digita o código da aula no app ou quando você marca a presença em Hoje." +
      (per === "tudo" ? "" : " Em Desde o início também contam as aulas feitas antes do app.");
  }

  $("#rkPer").addEventListener("click", function (e) { var b = e.target.closest("button[data-p]"); if (b) { per = b.dataset.p; paint(); } });
  $("#rkGr").addEventListener("click", function (e) { var b = e.target.closest("button[data-g]"); if (b) { gr = b.dataset.g; paint(); } });
  $('.dv[data-v="rank"]').addEventListener("click", function (e) {
    var w = e.target.closest("[data-wa]");
    if (w) { var a = P.porId[w.dataset.wa]; if (a) P.wa(a.whatsapp, msg(a)); return; }
    var b = e.target.closest("[data-ficha]");
    if (b) P.abrirAluno(b.dataset.ficha);
  });
  P.aoMudarAlunos(paint);
  document.addEventListener("evo-grade", function () { if (aba === "mapa") paint(); });
  P.aoAbrir("rank", function () { paint(); P.carregarPresencas().then(paint).catch(function () {}); });
})();
