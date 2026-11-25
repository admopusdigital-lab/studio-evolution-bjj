/* Painel · Hoje e Modo tatame: as aulas do dia (Site.GRADE), o código da aula (chamadas), quem confirmou (reservas)
   e quem chegou (presenças). O professor também marca a presença de quem chegou sem o app (o Kids, por exemplo). */
(function () {
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var hoje = P.hoje(), aulas = [], sel = null, reservas = [], presHoje = [], chamadas = [], timer = null, leadsN = 0, tecSemana = [];

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
      P.q(function (sb) { return sb.from("leads").select("id", { count: "exact", head: false }).eq("etapa", "novo"); }),
      /* a técnica da semana vai no rodapé da TV; sem a tabela (banco antigo), fica sem */
      P.q(function (sb) { var d = P.dia(hoje); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return sb.from("tecnicas_semana").select("titulo, turma, ordem").eq("semana", P.iso(d)).order("ordem"); }).catch(function () { return []; })
    ]).then(function (r) {
      reservas = r[0] || []; presHoje = r[1] || []; chamadas = r[2] || []; leadsN = (r[3] || []).length; tecSemana = r[4] || [];
    });
  }

  /* ---------- cabeçalho e números ---------- */
  function paintTopo() {
    var dt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date()), h = new Date().getHours();
    var ses = window.Acesso && Acesso.sessao ? Acesso.sessao() : null, nome = ses && ses.nome ? P.first(ses.nome) : "";
    $("#hData").textContent = dt.charAt(0).toUpperCase() + dt.slice(1) + (aulas.length ? " · " + aulas.length + (aulas.length === 1 ? " aula" : " aulas") : " · sem aula");
    $("#t-hoje").textContent = (h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite") + (nome ? ", " + nome + "." : ".");
    var agora = aulas.filter(function (c) { return estado(c) === "now"; })[0], prox = aulas.filter(function (c) { return estado(c) === "next"; })[0];
    $("#hAgora").textContent = (agora ? "Agora: " + agora.n + " " + Site.hora(agora.t) : "") + (agora && prox ? " · " : "") + (prox ? "Próxima: " + prox.n + " " + Site.hora(prox.t) : "");
    var at = P.ativos(), sem7 = P.somaDias(hoje, -6);
    $("#kAtivos").textContent = at.length;
    $("#kAtivosT").textContent = at.length === 1 ? "aluno ativo" : "alunos ativos";
    $("#kPres").textContent = P.pres.filter(function (p) { return p.data >= sem7; }).length;
    var sum = at.filter(P.sumido).length;
    $("#kSumidos").textContent = sum;
    /* laranja só quando tem alguém sumido: zero é boa notícia */
    $("#kSumidosB").classList.toggle("warn", sum > 0);
    $("#kLeads").textContent = leadsN;
    P.selo("bLeads", leadsN);
    P.selo("bAlunos", sum);
    paintFila();
  }

  /* ---------- Precisa de você: uma fila só, uma ação por linha, na ordem do que é mais urgente ---------- */
  function selo(id) { var el = $("#" + id); return el && !el.hidden ? +el.textContent || 0 : 0; }
  function aba(nome) { var b = $('.dash-side button[data-go="' + nome + '"]'); return !!b && !b.hidden; }
  function plural(n, um, varios) { return n + " " + (n === 1 ? um : varios); }
  function paintFila() {
    var ul = $("#hFila"), l = [];
    var grau = aba("grad") && P.prontosGrau ? P.prontosGrau() : [];
    if (grau.length) l.push({ ic: "i-belt", tx: grau.length === 1 ? esc(P.first(grau[0].a.nome)) + " está pronto para o grau" : plural(grau.length, "aluno pronto", "alunos prontos") + " para o grau", bt: "Avaliar", go: "grad" });
    var atr = aba("fin") ? selo("bFin") : 0;
    if (atr) l.push({ ic: "i-coin", tx: plural(atr, "mensalidade atrasada", "mensalidades atrasadas"), bt: "Cobrar", go: "fin", warn: true });
    if (aba("leads") && leadsN) l.push({ ic: "i-inbox", tx: plural(leadsN, "interessado esperando resposta", "interessados esperando resposta"), bt: "Responder", go: "leads" });
    var ped = aba("estoque") ? selo("bEst") : 0;
    if (ped) l.push({ ic: "i-box", tx: plural(ped, "pedido da loja para separar", "pedidos da loja para separar"), bt: "Ver", go: "estoque" });
    var niver = P.ativos().map(function (a) { return { a: a, n: P.aniversario(a) }; }).filter(function (x) { return x.n && x.n.dias <= 7; })
      .sort(function (x, y) { return x.n.dias - y.n.dias || x.a.nome.localeCompare(y.a.nome); });
    niver.filter(function (x) { return x.n.dias === 0; }).forEach(function (x) {
      l.push({ ic: "i-star", tx: esc(P.first(x.a.nome)) + " faz " + x.n.idade + " anos hoje", bt: x.a.whatsapp ? "Parabéns" : "", parabens: x.a.id, ficha: x.a.id });
    });
    var sum = aba("alunos") ? P.ativos().filter(P.sumido).length : 0;
    if (sum) l.push({ ic: "i-users", tx: plural(sum, "aluno", "alunos") + " sem treinar há 14 dias ou mais", bt: "Ver", go: "alunos", chip: "sumidos" });
    var prox = niver.filter(function (x) { return x.n.dias > 0; });
    var dia = function (x) { return x.n.dias === 1 ? "amanhã" : new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "numeric", month: "numeric" }).format(x.n.data).replace(".", ""); };
    var semNasc = aba("alunos") ? P.ativos().filter(function (a) { return !a.nascimento; }).length : 0;
    ul.innerHTML = (l.length ? l.map(function (x) {
      return '<li' + (x.warn ? ' class="warn"' : "") + '><svg class="ic" aria-hidden="true" focusable="false"><use href="#' + x.ic + '"/></svg><span>' +
        (x.ficha ? '<button class="nm-btn" type="button" data-ficha="' + x.ficha + '">' + x.tx + "</button>" : x.tx) + "</span>" +
        (x.bt ? '<button class="mini-btn ghost" type="button"' + (x.go ? ' data-go-fila="' + x.go + '"' : "") + (x.chip ? ' data-chip="' + x.chip + '"' : "") + (x.parabens ? ' data-parabens="' + x.parabens + '"' : "") + ">" + x.bt + "</button>" : "") + "</li>";
    }).join("") : '<li class="fila-ok">Nada pendente agora.</li>') +
      (prox.length ? '<li class="fila-nota">Aniversários nos próximos 7 dias: ' + prox.map(function (x) { return '<button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(P.first(x.a.nome)) + "</button> (" + dia(x) + ")"; }).join(", ") + "</li>" : "") +
      (semNasc ? '<li class="fila-nota"><button class="nm-btn" type="button" data-semnasc>' + plural(semNasc, "aluno ativo", "alunos ativos") + " sem data de nascimento</button>: cadastre em Editar dados para entrar nos aniversários.</li>" : "") +
      (grau.length && window.Notification && Notification.permission === "default" ? '<li class="fila-nota"><button class="nm-btn" type="button" data-grau-notif>Receber os avisos de grau como notificação neste aparelho</button></li>' : "");
  }
  $("#hFila").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.ficha) return P.abrirAluno(b.dataset.ficha);
    if (b.hasAttribute("data-semnasc")) { if (P.filtroAlunos) P.filtroAlunos("semnasc"); return P.go("alunos", true); }
    if (b.dataset.goFila) { if (b.dataset.chip && P.filtroAlunos) P.filtroAlunos(b.dataset.chip); return P.go(b.dataset.goFila, true); }
    if (b.hasAttribute("data-grau-notif")) {
      return Notification.requestPermission().then(function (r) {
        P.toast(r === "granted" ? "Pronto: os avisos de grau também chegam como notificação neste aparelho." : "Sem permissão do navegador: os avisos continuam aqui no painel.");
        paintFila();
      });
    }
    if (b.dataset.parabens) {
      var a = P.porId[b.dataset.parabens], kid = P.kid(a.turma);
      var resp = P.first(a.responsavel || ""), fem = a.artigo === "a";
      P.wa(a.whatsapp, kid ? "Oi" + (resp ? ", " + resp : "") + "! Hoje é aniversário " + (fem ? "da " : a.artigo === "o" ? "do " : "de ") + P.first(a.nome) + " e todo o Studio Evolution BJJ deseja um dia muito especial! Parabéns, " + (fem ? "campeã" : "campeão") + "! 🥋🎂"
        : "Parabéns, " + P.first(a.nome) + "! 🎂 Todo o Studio Evolution BJJ deseja um ano de muita saúde, evolução e treinos. Oss! 🥋");
    }
  });
  /* os números do menu (financeiro, loja, grau) chegam de outros módulos: a fila acompanha */
  var filaT = null;
  new MutationObserver(function () { clearTimeout(filaT); filaT = setTimeout(function () { if (P.atual() === "hoje") paintFila(); }, 120); })
    .observe($(".dash-side"), { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden"] });

  /* ---------- as aulas do dia ---------- */
  function paintAulas() {
    var box = $("#classes");
    if (!aulas.length) { box.innerHTML = '<p class="muted">Domingo não tem aula.</p>'; return; }
    if (!sel || !aulas.some(function (c) { return c.t === sel.t && c.n === sel.n; })) {
      sel = aulas.filter(function (c) { return estado(c) === "now"; })[0] || aulas.filter(function (c) { return estado(c) === "next"; })[0] || aulas[aulas.length - 1];
    }
    box.innerHTML = aulas.map(function (c, i) {
      var st = estado(c), conf = daAula(reservas, c).length, veio = daAula(presHoje, c).length, on = c === sel || (c.t === sel.t && c.n === sel.n);
      var info = st === "now" ? "agora" : st === "past" ? (veio === 1 ? "1 veio" : veio + " vieram") : (conf === 1 ? "1 confirmou" : conf + " confirmados");
      return '<button type="button" data-i="' + i + '" class="' + (st === "past" ? "past" : st === "now" ? "now" : "") + '" aria-pressed="' + on + '"><b>' + Site.hora(c.t) + "</b> <span>" + c.n + "</span> <small>" + info + "</small></button>";
    }).join("");
  }
  $("#classes").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-i]");
    if (!b) return;
    sel = aulas[+b.dataset.i];
    paintAulas();
    paintSala();
  });

  /* ---------- a aula escolhida: código e chamada. A lista traz quem chegou, quem confirmou e quem costuma vir
     nesse horário; um toque marca ou desfaz a presença ---------- */
  function daTurma(a, c) {
    var t = P.turmaAula(c.n);
    if (t === "openmat") return false;
    return a.horario === c.t && (t === "adulto" ? a.turma === "adulto" || a.turma === "feminino" : a.turma === t);
  }
  function linhas() {
    var conf = daAula(reservas, sel), veio = daAula(presHoje, sel), m = {};
    function pega(id) { return m[id] || (m[id] = { id: id, conf: null, pres: null, reg: false }); }
    conf.forEach(function (r) { pega(r.aluno).conf = r.criado_em; });
    veio.forEach(function (p) { pega(p.aluno).pres = p; });
    P.alunosDeVerdade().forEach(function (a) { if (daTurma(a, sel)) pega(a.id).reg = true; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) {
      var a = P.porId[x.id], b = P.porId[y.id];
      return (a ? a.nome : "~").localeCompare(b ? b.nome : "~");
    });
  }
  function paintSala() {
    var room = $("#room");
    if (!sel) { room.innerHTML = '<div class="room-h"><div><h4>Sem aula hoje</h4><p>Aproveite o domingo.</p></div></div>'; return; }
    var l = linhas(), conf = daAula(reservas, sel).length, veio = daAula(presHoje, sel).length, ch = chamadaDe(sel), st = estado(sel);
    var vale = ch && new Date(ch.valido_ate) > new Date();
    room.className = "room" + (st === "now" ? " agora" : "");
    room.innerHTML =
      '<div class="room-h"><div><h4>' + esc(sel.n) + " · " + Site.hora(sel.t) + '</h4><p class="room-n">' +
        (st === "past" ? "Aula encerrada · " : st === "now" ? "Agora · " : "Próxima aula · ") + "<b>" + veio + " de 10</b> " + (veio === 1 ? "chegou" : "chegaram") +
        " · " + (conf === 1 ? "1 confirmou" : conf + " confirmaram") + "</p></div>" +
      '<div class="room-tools"><label for="valSel">Vale por</label><select class="sel" id="valSel"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="60">1 hora</option><option value="90">1h30</option></select>' +
      '<button class="ap-btn' + (vale ? " ghost" : "") + '" type="button" id="genBtn"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-code"/></svg><span>' + (ch ? "Gerar novo código" : "Gerar código da aula") + "</span></button>" +
      '<button class="ap-btn' + (vale ? "" : " ghost") + '" type="button" id="tvBtn"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-tv"/></svg><span>Abrir na TV</span></button></div></div>' +
      '<div class="codebox"><div><span class="cd' + (ch ? "" : " hold") + '">' + (ch ? ch.codigo.slice(0, 3) + " " + ch.codigo.slice(3) : "O código aparece aqui") + "</span><small>" +
        (ch ? (vale ? "Vale até " + P.hm(ch.valido_ate) + ". O aluno lê o QR da TV ou digita no app, em Presença." : "Venceu às " + P.hm(ch.valido_ate) + ". Gere um novo se ainda tiver gente chegando.") : "3 letras e 3 números. Vale só para esta aula.") +
      "</small></div></div>" +
      '<div class="cham-h"><h5>Chamada</h5><small>' + (l.length ? "Toque para marcar quem veio" : "") + "</small></div>" +
      '<ul class="roster cham" id="roster">' + (l.length ? l.map(function (x) {
        var a = P.porId[x.id] || { nome: "Aluno removido", faixa: "branca", graus: 0 };
        var sub = x.pres ? "chegou " + P.hm(x.pres.chegou_em) + (x.pres.como === "professor" ? ", marcado aqui" : "") : x.conf ? "confirmou" : "costuma vir neste horário";
        return '<li data-id="' + x.id + '"' + (x.pres ? ' class="on"' : "") + '><span class="av"' + Fotos.attr(a.foto) + '>' + P.ini(a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.id + '">' + esc(a.nome) + "</button><small>" +
          esc(P.beltTxt(a.faixa, a.graus)) + " · " + sub + (P.seloGrau ? P.seloGrau(a) : "") + "</small></div>" +
          '<button class="tog pres" type="button" role="switch" aria-checked="' + !!x.pres + '" aria-label="' + esc(P.first(a.nome)) + ' veio" ' + (x.pres ? 'data-desfaz="' + x.pres.id + '"' : 'data-marca="' + x.id + '"') + "></button></li>";
      }).join("") : '<li class="muted" style="display:block">Ninguém confirmou nem costuma vir neste horário. Use a busca abaixo.</li>') + "</ul>" +
      '<div class="walk"><label class="sr-only" for="walkQ">Marcar outro aluno</label><input class="crm-in" type="search" id="walkQ" placeholder="Outro aluno veio? Digite o nome" autocomplete="off"><ul id="walkList"></ul></div>';
    paintWalk();
  }
  function paintWalk() {
    var inp = $("#walkQ"), ul = $("#walkList");
    if (!inp) return;
    var q = P.norm(inp.value.trim()), ja = {};
    linhas().forEach(function (x) { ja[x.id] = 1; });
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
    if (b.id === "tvBtn") return abrirTV();
    if (b.dataset.ficha && P.abrirAluno) return P.abrirAluno(b.dataset.ficha);
    if (b.dataset.marca) return marcar(b.dataset.marca, b);
    if (b.dataset.desfaz) return desfazer(b.dataset.desfaz, b);
  });
  /* Abrir na TV: a aba do Modo tatame já em tela cheia (o clique vale como gesto para o navegador) */
  function abrirTV() {
    P.go("tatame");
    var tt = $("#tt");
    if (tt.requestFullscreen && !document.fullscreenElement) tt.requestFullscreen().catch(function () {});
  }

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
    if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", "true");
    P.q(function (sb) { return sb.from("presencas").insert({ aluno: id, data: hoje, hora: sel.t, turma: P.turmaAula(sel.n), como: "professor" }); })
      .then(atualizarTudo).then(function () {
        var a = P.porId[id];
        P.toast((a ? P.first(a.nome) : "Aluno") + " marcado na aula das " + Site.hora(sel.t) + ".");
        var w = $("#walkQ"); if (w && w.value) { w.value = ""; paintWalk(); }
      })
      .catch(function (e) { b.classList.remove("loading"); if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", "false"); P.erro(e, /duplicate|unique/i.test(e && e.message) ? "Essa presença já estava marcada" : "Não deu para marcar a presença"); });
  }
  function desfazer(pid, b) {
    b.classList.add("loading");
    if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", "false");
    P.q(function (sb) { return sb.from("presencas").delete().eq("id", pid); }).then(atualizarTudo).then(function () { P.toast("Presença desfeita."); })
      .catch(function (e) { b.classList.remove("loading"); if (b.getAttribute("role") === "switch") b.setAttribute("aria-checked", "true"); P.erro(e, "Não deu para desfazer"); });
  }

  /* ---------- Modo tatame: a aula com código válido (ou a escolhida em Hoje) ---------- */
  function aulaTV() {
    var vivas = chamadas.filter(function (c) { return new Date(c.valido_ate) > new Date(); }).sort(function (a, b) { return a.valido_ate < b.valido_ate ? 1 : -1; });
    if (vivas.length) { var ch = vivas[0]; return { ch: ch, c: aulas.filter(function (x) { return x.t === ch.hora && P.turmaAula(x.n) === ch.turma; })[0] || { t: ch.hora, n: ch.turma } }; }
    return sel ? { ch: chamadaDe(sel), c: sel } : null;
  }
  /* o QR leva ao app com o código: o celular abre a presença já preenchida */
  var qrFeito = "";
  function paintQR(cod) {
    var box = $("#ttQr");
    if (!cod) { box.innerHTML = ""; qrFeito = ""; box.hidden = true; return; }
    box.hidden = false;
    if (qrFeito === cod) return;
    if (!window.qrcode) { box.innerHTML = ""; setTimeout(function () { paintQR(cod); }, 800); return; }
    var url = new URL("app.html?presenca=" + cod, location.href).href, q = window.qrcode(0, "M");
    q.addData(url); q.make();
    box.innerHTML = q.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    qrFeito = cod;
  }
  function paintTV() {
    var x = aulaTV();
    if (!x) { $("#ttAula").textContent = "Nenhuma aula hoje"; $("#ttSt").textContent = ""; $("#ttCode").textContent = "—"; paintQR(null); return; }
    var ch = x.ch, vale = ch && new Date(ch.valido_ate) > new Date();
    $("#ttAula").textContent = x.c.n + " · " + Site.hora(x.c.t);
    $("#ttSt").textContent = vale ? "Presença aberta" : ch ? "O código venceu" : "Gere o código em Hoje";
    $("#ttSt").className = "tt-st" + (vale ? " on" : "");
    var cd = $("#ttCode");
    cd.className = "cd" + (vale ? "" : " hold");
    cd.textContent = vale ? ch.codigo.slice(0, 3) + " " + ch.codigo.slice(3) : "— — —";
    $("#ttHow").hidden = !vale;
    paintQR(vale ? ch.codigo : null);
    var resta = vale ? Math.max(0, Math.ceil((new Date(ch.valido_ate) - new Date()) / 60000)) : 0;
    var total = vale && ch.criado_em ? Math.max(1, (new Date(ch.valido_ate) - new Date(ch.criado_em)) / 60000) : 30;
    $("#ttBar").style.transform = "scaleX(" + (vale ? Math.min(1, resta / total) : 0) + ")";
    $("#ttVal").innerHTML = vale ? "Vale até <b>" + P.hm(ch.valido_ate) + "</b> · faltam " + resta + " min" : "";
    var veio = daAula(presHoje, x.c).slice().sort(function (a, b) { return a.chegou_em < b.chegou_em ? -1 : 1; });
    $("#ttN").innerHTML = veio.length + "<small> de 10</small>";
    var vagas = Math.max(0, 10 - veio.length);
    $("#ttList").innerHTML = veio.slice(0, 15).map(function (p) {
      var a = P.porId[p.aluno];
      var cor = Site.COR_FAIXA[Site.faixaBase(a ? a.faixa : "branca")] || Site.COR_FAIXA.branca;
      return '<li><span class="av" style="--anel:' + cor + '"' + (a ? Fotos.attr(a.foto) : "") + ">" + (a ? P.ini(a.nome) : "?") + "</span><b>" + esc(a ? P.first(a.nome) : "Aluno") + "</b></li>";
    }).join("") + new Array(vagas + 1).join('<li class="vaga" aria-hidden="true"><span class="av"></span><b>&nbsp;</b></li>');
    var prox = aulas.filter(function (c) { return P.mins(c.t) > P.mins(x.c.t); })[0];
    var tt = P.kid(P.turmaAula(x.c.n)) ? "kids" : "adulto", tec = (tecSemana.filter(function (t) { return t.turma === tt; })[0] || tecSemana.filter(function (t) { return t.turma === "todas"; })[0] || {}).titulo || "";
    $("#ttRod").innerHTML = (tec ? "Técnica da semana: <b>" + esc(tec) + "</b>" : "") + (tec && prox ? '<span aria-hidden="true"> · </span>' : "") + (prox ? "Próxima aula: " + Site.hora(prox.t) + " · " + esc(prox.n) : "");
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
      if (P.paintGrauAviso) P.paintGrauAviso();
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
