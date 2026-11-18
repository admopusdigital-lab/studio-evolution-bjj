/* Painel · prontos para o grau: a cada 50 aulas desde o último grau (ou desde o início, para quem ainda não tem grau),
   o professor é avisado. Com 49 aulas, o aviso diz que a próxima é a 50ª e que o aluno já pode ser avaliado.
   Aparece no Hoje (cartão), no menu (número em Graduações), na chamada (selo no nome) e, com a permissão do
   navegador, como notificação do celular ou do computador enquanto o painel estiver aberto. */
(function () {
  var $ = P.$, esc = P.esc;
  var ULT = null, BLOCO = 50, ADIA_K = "evo-grau-adiado", AVISADO_K = "evo-grau-avisado";

  function ler(k) { try { return JSON.parse(localStorage.getItem(k) || "{}") || {}; } catch (e) { return {}; } }
  function grava(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* a última graduação de cada aluno */
  function carregar() {
    return P.todos(function (sb) { return sb.from("graduacoes").select("aluno, faixa, graus, data, nota").order("data", { ascending: false }); }).then(function (l) {
      ULT = {};
      (l || []).forEach(function (g) { if (!ULT[g.aluno]) ULT[g.aluno] = g; });
      paint();
    }).catch(function () {});
  }
  /* aulas desde o último grau: as do app depois da data do grau e as de antes do app (P.antes decide se entram) */
  P.desdeGrau = function (a) {
    if (!ULT) return null;
    var g = ULT[a.id], ref = g ? g.data : null;
    return P.pres.filter(function (p) { return p.aluno === a.id && (!ref || p.data > ref); }).length + P.antes(a, g || null);
  };
  /* o bloco de 50 em que o aluno está: 49 a 98 aulas é o 1º (a 50ª), 99 a 148 o 2º (a 100ª)... */
  function bloco(n) { return Math.floor((n + 1) / BLOCO); }
  /* prontos: chegaram a 49 aulas no bloco atual e o professor ainda não adiou este bloco */
  P.prontosGrau = function () {
    if (!ULT) return [];
    var adiado = ler(ADIA_K);
    return P.ativos().map(function (a) { return { a: a, n: P.desdeGrau(a) }; })
      .filter(function (x) { return x.n >= BLOCO - 1 && !(adiado[x.a.id] >= bloco(x.n)); })
      .sort(function (x, y) { return y.n - x.n || x.a.nome.localeCompare(y.a.nome); });
  };
  /* o texto de cada aluno */
  function frase(x) {
    var meta = bloco(x.n) * BLOCO;
    if (x.n === meta - 1) return "A próxima aula é a " + meta + "ª desde o " + (ULT[x.a.id] ? "último grau" : "início") + ". Já pode ser avaliado para o grau.";
    return x.n + " aulas desde o " + (ULT[x.a.id] ? "último grau" : "início") + ". Pronto para ser avaliado.";
  }
  /* o selo na chamada do Hoje */
  P.seloGrau = function (a) {
    var n = P.desdeGrau(a);
    if (n === null || n < BLOCO - 1) return "";
    var meta = bloco(n) * BLOCO;
    return ' <span class="pill-s grau" title="' + esc(frase({ a: a, n: n })) + '">' + (n === meta - 1 ? meta + "ª aula" : "Avaliar grau") + "</span>";
  };

  function paint() {
    var l = P.prontosGrau(), box = $("#hGrau"), badge = $("#bGrad");
    if (badge) { badge.hidden = !l.length; badge.textContent = l.length; }
    avisa(l);
    if (!box) return;
    box.hidden = !l.length;
    if (!l.length) return;
    box.innerHTML = '<div class="niver-h"><span class="niver-ic" aria-hidden="true">🥋</span><div><p class="dv-k">Prontos para o grau</p><h4>' +
      (l.length === 1 ? esc(P.first(l[0].a.nome)) + " já pode ser avaliado" : l.length + " alunos já podem ser avaliados") + "</h4></div></div>" +
      '<ul class="niver-l">' + l.map(function (x) {
        return '<li><span class="av"' + Fotos.attr(x.a.foto) + ">" + P.ini(x.a.nome) + '</span><div><button class="nm-btn" type="button" data-ficha="' + x.a.id + '">' + esc(x.a.nome) +
          "</button><small>" + esc(P.beltTxt(x.a.faixa, x.a.graus)) + " · " + esc(frase(x)) + "</small></div>" +
          '<span class="tec-acts"><button class="mini-btn" type="button" data-grau-reg="' + x.a.id + '">Registrar grau</button>' +
          '<button class="mini-btn ghost" type="button" data-grau-adia="' + x.a.id + '" data-bloco="' + bloco(x.n) + '">Avaliar depois</button></span></li>';
      }).join("") + "</ul>" +
      (window.Notification && Notification.permission === "default" ? '<p class="niver-prox"><button class="nm-btn" type="button" data-grau-notif>Receber estes avisos como notificação neste aparelho</button></p>' : "");
  }

  /* notificação do sistema (celular ou computador), uma vez por aluno e bloco de 50, com o painel aberto */
  function avisa(l) {
    if (!window.Notification || Notification.permission !== "granted") return;
    var ja = ler(AVISADO_K), novos = l.filter(function (x) { return !(ja[x.a.id] >= bloco(x.n)); });
    if (!novos.length) return;
    novos.forEach(function (x) { ja[x.a.id] = bloco(x.n); });
    grava(AVISADO_K, ja);
    var t = novos.length === 1 ? P.first(novos[0].a.nome) + " já pode ser avaliado para o grau" : novos.length + " alunos já podem ser avaliados para o grau";
    var corpo = novos.slice(0, 4).map(function (x) { return P.first(x.a.nome) + ": " + frase(x); }).join("\n");
    var op = { body: corpo, icon: "img/app/icone-192.png", badge: "img/app/favicon-32.png", tag: "evo-grau" };
    var sw = navigator.serviceWorker;
    (sw && sw.getRegistration ? sw.getRegistration() : Promise.resolve(null)).then(function (r) {
      if (r && r.showNotification) return r.showNotification(t, op);
      new Notification(t, op);
    }).catch(function () { try { new Notification(t, op); } catch (e) {} });
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("#hGrau button");
    if (!b) return;
    if (b.dataset.ficha) return P.abrirAluno(b.dataset.ficha);
    if (b.dataset.grauReg) return P.registrarGrau(b.dataset.grauReg);
    if (b.dataset.grauAdia) {
      var ad = ler(ADIA_K);
      ad[b.dataset.grauAdia] = +b.dataset.bloco;
      grava(ADIA_K, ad);
      var a = P.porId[b.dataset.grauAdia];
      P.toast((a ? P.first(a.nome) : "O aluno") + " sai da lista até completar mais " + BLOCO + " aulas.");
      return paint();
    }
    if (b.hasAttribute("data-grau-notif")) {
      Notification.requestPermission().then(function (p) {
        P.toast(p === "granted" ? "Pronto: os avisos de grau também chegam como notificação neste aparelho." : "Sem permissão do navegador: os avisos continuam aqui no painel.");
        paint();
      });
    }
  });

  P.paintGrauAviso = paint;
  P.recarregarGrauAviso = carregar;
  /* um grau novo (ou dado apagado) muda a conta: recarrega junto com os alunos */
  P.aoMudarAlunos(function () { carregar(); });
  window.addEventListener("load", function () { setTimeout(carregar, 800); });
})();
