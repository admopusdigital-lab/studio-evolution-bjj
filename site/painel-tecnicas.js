/* Painel · Movimentos → Técnicas da semana: o professor marca o que foi ensinado em cada semana (por turma), vê quem
   marcou "aprendi" no app e os pedidos de "quero aprender" dos alunos. Tabelas tecnicas_semana e tecnicas_aluno
   (migração 20261118120000_kids_graus_tecnicas.sql). */
(function () {
  var $ = P.$, esc = P.esc;
  var box = $("#tecBox");
  if (!box) return;
  var TURMA = { todas: "Todas as turmas", adulto: "Adulto", kids: "Kids" };
  var semana = segunda(P.hoje()), TEC = [], MARC = [], PED = [], MOVS = [], pronto = false, busy = false;

  function segunda(iso) { var d = P.dia(iso); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return P.iso(d); }
  function titSemana(seg) {
    var sab = P.somaDias(seg, 5), atual = seg === segunda(P.hoje());
    return (atual ? "Esta semana · " : "") + P.dataBR(seg) + " a " + P.dataBR(sab);
  }
  function semBanco(e) { return /PGRST205|42P01|PGRST200/.test((e && e.code) || "") || /does not exist|schema cache/i.test((e && e.message) || ""); }

  function carregar() {
    return Promise.all([
      P.q(function (sb) { return sb.from("tecnicas_semana").select("*").eq("semana", semana).order("ordem").order("criado_em"); }),
      P.q(function (sb) { return sb.from("tecnicas_aluno").select("*").order("criado_em", { ascending: false }).limit(1000); }),
      MOVS.length ? Promise.resolve(MOVS) : P.q(function (sb) { return sb.from("movimentos").select("id, nome, faixa, categoria, publicado").order("nome"); })
    ]).then(function (r) {
      pronto = true;
      TEC = r[0] || []; MARC = r[1] || []; MOVS = r[2] || [];
      PED = MARC.filter(function (m) { return m.tipo === "quero" && !m.visto; });
      paint();
    }).catch(function (e) {
      if (semBanco(e)) {
        box.innerHTML = '<p class="muted">As técnicas da semana precisam da atualização do banco de 18/11. Abra o Supabase → SQL Editor e rode o arquivo ' +
          '<a href="' + P.SQL_ATUALIZA + '" target="_blank" rel="noopener">20261118120000_kids_graus_tecnicas.sql</a>.</p>';
        return;
      }
      P.erro(e, "Não deu para carregar as técnicas da semana");
    });
  }

  function nomeAluno(id) { var a = P.porId[id]; return a ? P.first(a.nome) : "Aluno"; }
  function paint() {
    $("#tecSem").textContent = titSemana(semana);
    $("#tecMov").innerHTML = '<option value="">Escolher do catálogo (opcional)</option>' + MOVS.map(function (m) {
      return '<option value="' + m.id + '">' + esc(m.nome) + " · faixa " + esc((Mov.FAIXAS[m.faixa] || m.faixa).toLowerCase()) + (m.publicado ? "" : " (rascunho)") + "</option>";
    }).join("");
    /* as técnicas da semana, com quem marcou "aprendi" */
    $("#tecL").innerHTML = TEC.length ? TEC.map(function (t) {
      var quem = MARC.filter(function (m) { return m.tipo === "aprendi" && m.tecnica === t.id; }).map(function (m) { return nomeAluno(m.aluno); });
      return '<li><div><b>' + esc(t.titulo) + '</b><small>' + TURMA[t.turma] + (t.movimento ? " · com vídeo" : "") + " · " +
        (quem.length ? quem.length + (quem.length === 1 ? " aprendeu: " : " aprenderam: ") + esc(quem.join(", ")) : "ninguém marcou que aprendeu ainda") + "</small></div>" +
        '<button class="mini-btn ghost" type="button" data-tec-x="' + t.id + '" aria-label="Tirar ' + esc(t.titulo) + '">Tirar</button></li>';
    }).join("") : '<li class="muted">Nenhuma técnica marcada nesta semana. Adicione acima: os alunos veem no app, em Movimentos.</li>';
    /* os pedidos "quero aprender", juntos pelo nome da técnica */
    var grupos = {};
    PED.forEach(function (m) {
      var k = m.titulo.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
      var g = grupos[k] = grupos[k] || { titulo: m.titulo, l: [] };
      g.l.push(m);
      /* o nome mostrado: a versão escrita com mais capricho (acentos e maiúsculas) */
      var nota = function (t) { return (t.match(/[A-ZÀ-ÖØ-Þà-öø-ÿ]/g) || []).length; };
      if (nota(m.titulo) > nota(g.titulo)) g.titulo = m.titulo;
    });
    Object.keys(grupos).forEach(function (k) { var t = grupos[k].titulo; grupos[k].titulo = t.charAt(0).toUpperCase() + t.slice(1); });
    var gl = Object.keys(grupos).map(function (k) { return grupos[k]; }).sort(function (a, b) { return b.l.length - a.l.length; });
    $("#tecPedN").textContent = PED.length ? PED.length + (PED.length === 1 ? " pedido" : " pedidos") : "";
    /* o número de pedidos também aparece na aba, para ser visto de dentro da Biblioteca */
    var nb = $("#mvtPed");
    if (nb) { nb.hidden = !gl.length; nb.textContent = gl.length; $("#mvtSem").setAttribute("aria-label", "Técnicas da semana" + (gl.length ? ", " + gl.length + (gl.length === 1 ? " pedido dos alunos" : " pedidos dos alunos") : "")); }
    $("#tecPed").innerHTML = gl.length ? gl.map(function (g, i) {
      return '<li><div><b>' + esc(g.titulo) + '</b><small>' + g.l.length + (g.l.length === 1 ? " pedido · " : " pedidos · ") +
        esc(g.l.map(function (m) { return nomeAluno(m.aluno); }).join(", ")) + " · desde " + P.dataBR(g.l[g.l.length - 1].criado_em) + "</small></div>" +
        '<span class="tec-acts"><button class="mini-btn" type="button" data-ped-sem="' + i + '">Pôr nesta semana</button>' +
        '<button class="mini-btn ghost" type="button" data-ped-ok="' + i + '">Visto</button></span></li>';
    }).join("") : '<li class="muted">Nenhum pedido novo. Os alunos pedem pelo app, em Movimentos → Quero aprender.</li>';
    paint.grupos = gl;
  }

  function adiciona(titulo, movimento, turma) {
    return P.q(function (sb) { return sb.from("tecnicas_semana").insert({ semana: semana, titulo: titulo, movimento: movimento || null, turma: turma || "todas", ordem: TEC.length }); });
  }
  function marcaVisto(lista) {
    var ids = lista.map(function (m) { return m.id; });
    return P.q(function (sb) { return sb.from("tecnicas_aluno").update({ visto: true }).in("id", ids); });
  }

  $("#tecMov").addEventListener("change", function () {
    var m = MOVS.filter(function (x) { return x.id === this.value; }, this)[0];
    if (m && !$("#tecTit").value.trim()) $("#tecTit").value = m.nome;
  });
  $("#tecForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = this, t = $("#tecTit").value.trim().replace(/\s+/g, " "), mv = $("#tecMov").value, btn = $('[type="submit"]', f);
    if (!t && mv) t = (MOVS.filter(function (x) { return x.id === mv; })[0] || {}).nome || "";
    if (t.length < 2) return P.erroForm(f, $("#tecTit"), "Escreva a técnica ou escolha uma do catálogo.");
    btn.classList.add("loading");
    adiciona(t.slice(0, 120), mv, $("#tecTurma").value).then(function () {
      $("#tecTit").value = ""; $("#tecMov").value = "";
      return carregar();
    }).then(function () { P.toast("“" + t + "” entrou nas técnicas da semana. Os alunos já veem no app."); })
      .catch(function (er) { P.erro(er, "Não deu para adicionar"); }).then(function () { btn.classList.remove("loading"); });
  });
  box.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || busy) return;
    if (b.id === "tecPrev" || b.id === "tecNext") { semana = P.somaDias(semana, b.id === "tecPrev" ? -7 : 7); return carregar(); }
    if (b.id === "tecHoje") { semana = segunda(P.hoje()); return carregar(); }
    var acao = null;
    if (b.dataset.tecX) {
      var t = TEC.filter(function (x) { return x.id === b.dataset.tecX; })[0];
      if (!confirm("Tirar “" + t.titulo + "” desta semana? As marcações de “aprendi” dela também saem.")) return;
      acao = P.q(function (sb) { return sb.from("tecnicas_semana").delete().eq("id", t.id); });
    } else if (b.dataset.pedSem !== undefined) {
      var g = paint.grupos[+b.dataset.pedSem];
      acao = adiciona(g.titulo, null, "todas").then(function () { return marcaVisto(g.l); }).then(function () { P.toast("“" + g.titulo + "” entrou nesta semana. Quem pediu vê que o pedido foi visto."); });
    } else if (b.dataset.pedOk !== undefined) {
      acao = marcaVisto(paint.grupos[+b.dataset.pedOk].l);
    }
    if (!acao) return;
    busy = true; b.classList.add("loading");
    acao.then(carregar).catch(function (er) { P.erro(er); }).then(function () { busy = false; b.classList.remove("loading"); });
  });
  P.aoAbrir("mov", function () { carregar(); });
  P.recarregarTecnicas = function () { if (pronto) carregar(); };
})();
