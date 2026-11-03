/* Painel · Ranking de frequência: quem mais treinou no período, com pódio dos três primeiros.
   Conta as presenças do último ano (P.pres); "Desde o início" soma as aulas feitas antes do app. */
(function () {
  "use strict";
  var P = window.P, $ = P.$, esc = P.esc;
  /* por mês do calendário: o mês atual e os três anteriores; depois, o ano e desde o início */
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
  function paint() {
    $("#rkPer").innerHTML = PER.map(function (x) { return '<button type="button" data-p="' + x[0] + '" aria-pressed="' + (per === x[0]) + '">' + x[1] + "</button>"; }).join("");
    $("#rkGr").innerHTML = GR.map(function (x) { return '<button type="button" data-g="' + x[0] + '" aria-pressed="' + (gr === x[0]) + '">' + x[1] + "</button>"; }).join("");
    var l = P.ativos().filter(function (a) { return gr === "todos" || (gr === "kids") === P.kid(a.turma); })
      .map(function (a) { return { a: a, n: conta(a) }; }).filter(function (x) { return x.n > 0; })
      .sort(function (x, y) { return y.n - x.n || x.a.nome.localeCompare(y.a.nome); });
    /* empate divide a posição: 1, 2, 2, 4 */
    l.forEach(function (x, i) { x.pos = i && x.n === l[i - 1].n ? l[i - 1].pos : i + 1; });
    var max = l.length ? l[0].n : 1, rot = PER.filter(function (x) { return x[0] === per; })[0][1].replace(" (este mês)", "").toLowerCase();
    $("#rkK").textContent = l.length ? l.length + (l.length === 1 ? " aluno treinou" : " alunos treinaram") + " · " + (per.length === 10 ? "em " : "") + rot : "Frequência";
    var med = ["ouro", "prata", "bronze"];
    $("#rkPodio").innerHTML = l.slice(0, 3).map(function (x, i) {
      return '<li class="rk-p ' + med[Math.min(x.pos - 1, 2)] + '"><span class="rk-m" aria-hidden="true">' + x.pos + '</span><span class="av">' + P.ini(x.a.nome) + "</span>" +
        '<button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) + "</button>" +
        "<small>" + esc(P.turmaTx(x.a)) + "</small>" + P.belt(x.a.faixa, x.a.graus) +
        '<b class="rk-n">' + x.n + "<span>" + (x.n === 1 ? " aula" : " aulas") + "</span></b></li>";
    }).join("");
    $("#rkPodio").hidden = !l.length;
    $("#rkTbl tbody").innerHTML = l.slice(3).map(function (x) {
      return '<tr><td class="num rk-pos">' + x.pos + "º</td>" +
        '<td><div class="nm"><span class="av">' + P.ini(x.a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) + "</button><small>" + esc(P.turmaTx(x.a)) + "</small></div></div></td>" +
        "<td>" + P.belt(x.a.faixa, x.a.graus) + '</td><td class="num">' + x.n + '</td><td class="hide-s"><span class="rk-bar" style="--w:' + Math.round(x.n / max * 100) + '%"></span></td></tr>';
    }).join("");
    $("#rkTbl").hidden = l.length <= 3;
    var e = $("#rkEmpty");
    e.hidden = !!l.length;
    e.innerHTML = "<b>Ninguém treinou " + "neste período" + " ainda.</b>As presenças entram aqui quando o aluno digita o código da aula no app ou quando você marca a presença em Hoje." +
      (per === "tudo" ? "" : " Em Desde o início também contam as aulas feitas antes do app.");
  }
  $("#rkPer").addEventListener("click", function (e) { var b = e.target.closest("button[data-p]"); if (b) { per = b.dataset.p; paint(); } });
  $("#rkGr").addEventListener("click", function (e) { var b = e.target.closest("button[data-g]"); if (b) { gr = b.dataset.g; paint(); } });
  $('.dv[data-v="rank"]').addEventListener("click", function (e) { var b = e.target.closest("[data-ficha]"); if (b) P.abrirAluno(b.dataset.ficha); });
  P.aoMudarAlunos(paint);
  P.aoAbrir("rank", function () { paint(); P.carregarPresencas().then(paint).catch(function () {}); });
})();
