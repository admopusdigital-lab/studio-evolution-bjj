/* Painel · Hoje e Modo tatame: as aulas do dia (Site.GRADE), o código da aula (chamadas), quem confirmou (reservas)
   e quem chegou (presenças). O professor também marca a presença de quem chegou sem o app (o Kids, por exemplo). */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var hoje = P.hoje(), aulas = [], sel = null, reservas = [], presHoje = [], chamadas = [], timer = null, leadsN = 0;

  function fimAula(c) { return P.mins(c.t) + 60; }
  function estado(c) {
    var m = P.agoraMin(), ini = P.mins(c.t);
    return m >= fimAula(c) ? "past" : m >= ini - 15 ? "now" : "next";
  }
  function daAula(lista, c) { return lista.filter(function (x) { return x.hora === c.t && (!x.turma || x.turma === P.turmaAula(c.n)); }); }
  function chamadaDe(c) { return chamadas.filter(function (x) { return x.hora === c.t && x.turma === P.turmaAula(c.n); })[0] || null; }

  /* ---------- dados do dia ---------- */
  function carregarDia() {
    hoje = P.hoje();
    aulas = Site.aulasDo(P.dia(hoje).getDay());
    return Promise.all([
      P.q(function (sb) { return sb.from("reservas").select("id, aluno, hora, criado_em").eq("data", hoje).order("criado_em"); }),
      P.q(function (sb) { return sb.from("presencas").select("id, aluno, hora, turma, como, chegou_em").eq("data", hoje).order("chegou_em"); }),
      P.q(function (sb) { return sb.from("chamadas").select("*").eq("data", hoje); }),
      P.q(function (sb) { return sb.from("leads").select("id", { count: "exact", head: false }).eq("etapa", "novo"); })
    ]).then(function (r) {
      reservas = r[0] || []; presHoje = r[1] || []; chamadas = r[2] || []; leadsN = (r[3] || []).length;
    });
  }

  /* ---------- cabeçalho e números ---------- */
  function paintTopo() {
    var dt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), h = new Date().getHours();
    $("#hData").textContent = dt.charAt(0).toUpperCase() + dt.slice(1);
    $("#t-hoje").innerHTML = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + ". <em>" + (aulas.length ? aulas.length + (aulas.length === 1 ? " aula hoje." : " aulas hoje.") : "Sem aula hoje.") + "</em>";
    var agora = aulas.filter(function (c) { return estado(c) === "now"; })[0], prox = aulas.filter(function (c) { return estado(c) === "next"; })[0];
    $("#hAgora").textContent = (agora ? "Agora: " + agora.n + " " + Site.hora(agora.t) : "") + (agora && prox ? " · " : "") + (prox ? "Próxima: " + prox.n + " " + Site.hora(prox.t) : "");
    var at = P.ativos(), sem7 = P.somaDias(hoje, -6);
    $("#kAtivos").textContent = at.length;
    $("#kAtivosT").textContent = at.length === 1 ? "aluno ativo" : "alunos ativos";
    $("#kPres").textContent = P.pres.filter(function (p) { return p.data >= sem7; }).length;
    var sum = at.filter(P.sumido).length;
    $("#kSumidos").textContent = sum;
    $("#kLeads").textContent = leadsN;
    P.selo("bLeads", leadsN);
    P.selo("bAlunos", sum);
  }

  /* ---------- as aulas do dia ---------- */
  function paintAulas() {
    var box = $("#classes");
    if (!aulas.length) { box.innerHTML = '<p class="muted">Domingo não tem aula.</p>'; return; }
    if (!sel || !aulas.some(function (c) { return c.t === sel.t && c.n === sel.n; })) {
      sel = aulas.filter(function (c) { return estado(c) === "now"; })[0] || aulas.filter(function (c) { return estado(c) === "next"; })[0] || aulas[aulas.length - 1];
    }
    box.innerHTML = aulas.map(function (c, i) {
      var st = estado(c), conf = daAula(reservas, c).length, veio = daAula(presHoje, c).length, on = c === sel || (c.t === sel.t && c.n === sel.n);
      var info = st === "past" ? veio + (veio === 1 ? " veio" : " vieram") : conf + " de 10" + (veio ? " · " + veio + " no tatame" : "");
      return '<button type="button" data-i="' + i + '" class="' + (st === "past" ? "past" : st === "now" ? "now" : "") + '" aria-pressed="' + on + '"><b>' + Site.hora(c.t) + "</b> <span>" + c.n + (st === "now" ? " · agora" : "") + "</span> <small>" + info + "</small></button>";
    }).join("");
  }
  $("#classes").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-i]");
    if (!b) return;
    sel = aulas[+b.dataset.i];
    paintAulas();
    paintSala();
  });

  /* ---------- a aula escolhida: código, quem confirmou, quem chegou ---------- */
  function linhas() {
    var conf = daAula(reservas, sel), veio = daAula(presHoje, sel), ids = {};
    var l = [];
    conf.forEach(function (r) { ids[r.aluno] = 1; l.push({ id: r.aluno, conf: r.criado_em, pres: veio.filter(function (p) { return p.aluno === r.aluno; })[0] || null }); });
    veio.forEach(function (p) { if (!ids[p.aluno]) l.push({ id: p.aluno, conf: null, pres: p }); });
    return l;
  }
  function paintSala() {
    var room = $("#room");
    if (!sel) { room.innerHTML = '<div class="room-h"><div><h4>Sem aula hoje</h4><p>Aproveite o domingo.</p></div></div>'; return; }
    var l = linhas(), conf = daAula(reservas, sel).length, veio = daAula(presHoje, sel).length, ch = chamadaDe(sel), st = estado(sel);
    var vale = ch && new Date(ch.valido_ate) > new Date();
    room.innerHTML =
      '<div class="room-h"><div><h4>' + esc(sel.n) + " · " + Site.hora(sel.t) + "</h4><p>" + (st === "past" ? "Aula encerrada · " : st === "now" ? "Agora · " : "Próxima aula · ") +
        conf + " de 10 vagas confirmadas · " + (veio ? veio + " no tatame" : "ninguém chegou ainda") + "</p></div>" +
      '<div class="room-tools"><label for="valSel">Vale por</label><select class="sel" id="valSel"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">1 hora</option><option value="90">1h30</option></select>' +
      '<button class="ap-btn" type="button" id="genBtn"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-code"/></svg><span>' + (ch ? "Gerar novo código" : "Gerar código da aula") + "</span></button></div></div>" +
      '<div class="codebox"><div><span class="cd' + (ch ? "" : " hold") + '">' + (ch ? ch.codigo.slice(0, 3) + " " + ch.codigo.slice(3) : "O código aparece aqui") + "</span><small>" +
        (ch ? (vale ? "Vale até " + P.hm(ch.valido_ate) + ". O aluno digita no app, em Presença." : "Venceu às " + P.hm(ch.valido_ate) + ". Gere um novo se ainda tiver gente chegando.") : "3 letras e 3 números. Vale só para esta aula.") +
      "</small></div>" + (ch ? '<div class="acts"><button class="mini-btn" type="button" id="tvBtn">Mostrar na TV</button></div>' : "") + "</div>" +
      '<ul class="roster" id="roster">' + (l.length ? l.map(function (x) {
        var a = P.porId[x.id] || { nome: "Aluno removido", faixa: "branca", graus: 0 };
        var pill = x.pres ? '<span class="pill-s in">Chegou ' + P.hm(x.pres.chegou_em) + (x.pres.como === "professor" ? " · marcado" : "") + "</span>" : '<span class="pill-s">Confirmou</span>';
        var act = x.pres ? '<button class="mini-btn ghost" type="button" data-desfaz="' + x.pres.id + '">Desfazer</button>' : '<button class="mini-btn" type="button" data-marca="' + x.id + '">Chegou</button>';
        return '<li data-id="' + x.id + '"><span class="av">' + P.ini(a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.id + '">' + esc(a.nome) + "</button><small>" + P.beltTxt(a.faixa, a.graus) + "</small></div>" +
          '<div class="row-acts">' + pill + act + "</div></li>";
      }).join("") : '<li class="muted" style="display:block">Ninguém confirmou esta aula ainda.</li>') + "</ul>" +
      '<div class="walk"><label class="sr-only" for="walkQ">Marcar a presença de quem veio sem confirmar</label><input class="crm-in" type="search" id="walkQ" placeholder="Marcar quem veio sem confirmar: digite o nome" autocomplete="off"><ul id="walkList"></ul></div>';
    paintWalk();
  }
  function paintWalk() {
    var inp = $("#walkQ"), ul = $("#walkList");
    if (!inp) return;
    var q = P.norm(inp.value.trim()), ja = {};
    linhas().forEach(function (x) { if (x.pres) ja[x.id] = 1; });
    var kidAula = /^Kids/.test(sel.n);
    var l = q ? P.ativos().filter(function (a) { return !ja[a.id] && P.norm(a.nome).indexOf(q) >= 0; }).slice(0, 6) : [];
    ul.innerHTML = l.map(function (a) { return '<li><button type="button" data-marca="' + a.id + '">' + esc(a.nome) + ' <small class="muted">· ' + esc(P.turmaTx(a)) + (kidAula !== P.kid(a.turma) ? " (outra turma)" : "") + "</small></button></li>"; }).join("") +
      (q && !l.length ? '<li class="muted" style="padding:9px 10px">Nenhum aluno ativo com esse nome.</li>' : "");
  }
  $("#room").addEventListener("input", function (e) { if (e.target.id === "walkQ") paintWalk(); });
  $("#room").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.id === "genBtn") return gerarCodigo(+$("#valSel").value);
    if (b.id === "tvBtn") return P.go("tatame");
    if (b.dataset.ficha && P.abrirAluno) return P.abrirAluno(b.dataset.ficha);
    if (b.dataset.marca) return marcar(b.dataset.marca, b);
    if (b.dataset.desfaz) return desfazer(b.dataset.desfaz, b);
  });

  /* o código: 3 letras e 3 números, sem as letras que se confundem (I, O) */
  function novoCodigo() {
    var L = "ABCDEFGHJKLMNPQRSTUVWXYZ", c = "", r = crypto.getRandomValues(new Uint8Array(6));
    for (var i = 0; i < 3; i++) c += L[r[i] % L.length];
    for (var j = 3; j < 6; j++) c += String(r[j] % 10);
    return c;
  }
  function gerarCodigo(minutos) {
    var c = sel, cod = novoCodigo(), ate = new Date(Date.now() + minutos * 60000).toISOString(), b = $("#genBtn");
    b.classList.add("loading");
    P.q(function (sb) {
      return sb.from("chamadas").upsert({ data: hoje, hora: c.t, turma: P.turmaAula(c.n), codigo: cod, valido_ate: ate }, { onConflict: "data,hora,turma" }).select();
    }).then(function () { return carregarDia(); }).then(function () {
      paintSala(); paintTV();
      P.toast("Código " + cod.slice(0, 3) + " " + cod.slice(3) + " gerado para " + c.n + " " + Site.hora(c.t) + ". Vale até " + P.hm(ate) + ".");
    }).catch(function (e) { b.classList.remove("loading"); P.erro(e, "Não deu para gerar o código"); });
  }
  function marcar(id, b) {
    b.classList.add("loading");
    P.q(function (sb) { return sb.from("presencas").insert({ aluno: id, data: hoje, hora: sel.t, turma: P.turmaAula(sel.n), como: "professor" }); })
      .then(atualizarTudo).then(function () {
        var a = P.porId[id];
        P.toast((a ? P.first(a.nome) : "Aluno") + " marcado na aula das " + Site.hora(sel.t) + ".");
        var w = $("#walkQ"); if (w && w.value) { w.value = ""; paintWalk(); }
      })
      .catch(function (e) { b.classList.remove("loading"); P.erro(e, /duplicate|unique/i.test(e && e.message) ? "Essa presença já estava marcada" : "Não deu para marcar a presença"); });
  }
  function desfazer(pid, b) {
    b.classList.add("loading");
    P.q(function (sb) { return sb.from("presencas").delete().eq("id", pid); }).then(atualizarTudo).then(function () { P.toast("Presença desfeita."); })
      .catch(function (e) { b.classList.remove("loading"); P.erro(e, "Não deu para desfazer"); });
  }

  /* ---------- Modo tatame: a aula com código válido (ou a escolhida em Hoje) ---------- */
  function aulaTV() {
    var vivas = chamadas.filter(function (c) { return new Date(c.valido_ate) > new Date(); }).sort(function (a, b) { return a.valido_ate < b.valido_ate ? 1 : -1; });
    if (vivas.length) { var ch = vivas[0]; return { ch: ch, c: aulas.filter(function (x) { return x.t === ch.hora && P.turmaAula(x.n) === ch.turma; })[0] || { t: ch.hora, n: ch.turma } }; }
    return sel ? { ch: chamadaDe(sel), c: sel } : null;
  }
  function paintTV() {
    var x = aulaTV();
    if (!x) { $("#ttAula").textContent = "Nenhuma aula hoje"; $("#ttCode").textContent = "—"; return; }
    var ch = x.ch, vale = ch && new Date(ch.valido_ate) > new Date();
    $("#ttAula").textContent = x.c.n + " · " + Site.hora(x.c.t);
    var cd = $("#ttCode");
    cd.className = "cd" + (vale ? "" : " hold");
    cd.textContent = vale ? ch.codigo.slice(0, 3) + " " + ch.codigo.slice(3) : ch ? "Código vencido" : "Gere o código em Hoje";
    var resta = vale ? Math.max(0, Math.ceil((new Date(ch.valido_ate) - new Date()) / 60000)) : 0;
    $("#ttVal").innerHTML = vale ? "Vale até <b>" + P.hm(ch.valido_ate) + "</b> · faltam " + resta + " min" : "";
    var veio = daAula(presHoje, x.c).slice().sort(function (a, b) { return a.chegou_em < b.chegou_em ? 1 : -1; });
    $("#ttN").innerHTML = veio.length + "<small> de 10</small>";
    $("#ttList").innerHTML = veio.slice(0, 12).map(function (p) {
      var a = P.porId[p.aluno];
      return "<li>" + esc(a ? P.curto(a.nome) : "Aluno") + "<span>" + P.hm(p.chegou_em) + "</span></li>";
    }).join("");
  }
  $("#ttFull").addEventListener("click", function () {
    var tt = $("#tt");
    if (document.fullscreenElement) document.exitFullscreen();
    else if (tt.requestFullscreen) tt.requestFullscreen().catch(function () { P.toast("O navegador não deixou abrir em tela cheia."); });
  });

  /* ---------- atualização: ao abrir a aba e a cada 15 s com Hoje ou o Modo tatame na tela ---------- */
  function atualizarTudo() {
    return Promise.all([carregarDia(), P.carregarPresencas()]).then(function () {
      paintTopo(); paintAulas(); paintSala(); paintTV();
    });
  }
  function ligar() {
    clearInterval(timer);
    timer = setInterval(function () {
      if (document.hidden || (P.atual() !== "hoje" && P.atual() !== "tatame")) return;
      var foco = document.activeElement && document.activeElement.id;
      Promise.all([carregarDia(), P.carregarPresencas()]).then(function () {
        paintTopo(); paintAulas();
        if (foco !== "walkQ" && foco !== "valSel") paintSala();
        paintTV();
      }).catch(function () {});
    }, 15000);
  }
  P.aoAbrir("hoje", function () { atualizarTudo().catch(function (e) { P.erro(e, "Não deu para carregar as aulas"); }); ligar(); });
  P.aoAbrir("tatame", function () { atualizarTudo().catch(function () {}); ligar(); });
  P.aoMudarAlunos(function () { if (P.atual() === "hoje") { paintTopo(); paintSala(); } });
  P.atualizarHoje = atualizarTudo;
})();
