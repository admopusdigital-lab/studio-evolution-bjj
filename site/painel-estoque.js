/* Painel · Estoque e loja: o que o Studio tem para vender (kimono, rashguard, faixa…), uma linha por produto e
   tamanho. Vender baixa o estoque e lança o valor no aluno (cobrancas), tudo junto (vender_produto). Os pedidos
   que os alunos fazem pelo app aparecem em cima. A loja só aparece no app quando há item com quantidade. */
(function () {
  "use strict";
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var CAT = { kimono: "Kimono", rashguard: "Rashguard", faixa: "Faixa", camiseta: "Camiseta", acessorio: "Acessório", outro: "Outro" };
  var FORMA = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", boleto: "Boleto" };
  P.CAT_PRODUTO = CAT;
  var PROD = [], PED = [], VEND = [], catF = "todos", ok = false;

  function carregar() {
    return Promise.all([
      P.todos(function (sb) { return sb.from("produtos").select("*").order("nome").order("tamanho"); }),
      P.q(function (sb) { return sb.from("pedidos_loja").select("*").eq("status", "novo").order("criado_em"); }),
      P.q(function (sb) { return sb.from("cobrancas").select("valor, quantidade, vencimento").eq("tipo", "produto").gte("vencimento", P.mesIni(P.hoje())); })
    ]).then(function (r) {
      PROD = r[0] || []; PED = r[1] || []; VEND = r[2] || []; ok = true;
      P.selo("bEst", PED.length);
      paint();
    }).catch(function (e) {
      if (P.faltaAtualizar(e) || /produtos|pedidos_loja|cobrancas|42P01|PGRST205/.test((e && (e.message || "")) + (e && e.code || ""))) {
        P.avisoBanco("estoque");
        $("#esEmpty").hidden = false;
        $("#esEmpty").innerHTML = "<b>Falta atualizar o banco para usar o estoque.</b>Veja o aviso no topo do painel.";
        return;
      }
      P.erro(e, "Não deu para carregar o estoque");
    });
  }
  function nomeP(p) { return p.nome + (p.cor ? " " + p.cor.toLowerCase() : ""); }
  function porId(id) { return PROD.filter(function (p) { return p.id === id; })[0]; }

  function paint() {
    if (!ok) return;
    var vis = PROD.filter(function (p) { return catF === "todos" || p.categoria === catF; });
    var q = P.norm($("#esQ").value.trim());
    if (q) vis = vis.filter(function (p) { return P.norm(nomeP(p) + " " + p.tamanho).indexOf(q) >= 0; });
    var pecas = PROD.filter(function (p) { return p.ativo; }).reduce(function (a, p) { return a + p.quantidade; }, 0);
    var valor = PROD.filter(function (p) { return p.ativo; }).reduce(function (a, p) { return a + p.quantidade * p.preco; }, 0);
    var vendM = VEND.reduce(function (a, x) { return a + Number(x.valor); }, 0), vendQ = VEND.reduce(function (a, x) { return a + (x.quantidade || 1); }, 0);
    var acabando = PROD.filter(function (p) { return p.ativo && p.quantidade > 0 && p.quantidade <= 1; }).length;
    $("#esK").textContent = pecas ? pecas + (pecas === 1 ? " peça" : " peças") + " em estoque · loja visível no app" : "Loja escondida no app (sem itens com quantidade)";
    $("#esKpis").innerHTML =
      '<div class="kpi"><b>' + pecas + "</b><span>peças em estoque</span></div>" +
      '<div class="kpi"><b>' + P.brl(valor) + "</b><span>valor do estoque, a preço de venda</span></div>" +
      '<div class="kpi"><b>' + P.brl(vendM) + "</b><span>" + vendQ + (vendQ === 1 ? " peça vendida" : " peças vendidas") + " em " + P.MESES[new Date().getMonth()] + "</span></div>" +
      '<div class="kpi' + (acabando ? " warn" : "") + '"><b>' + acabando + "</b><span>" + (acabando === 1 ? "item com a última peça" : "itens com a última peça") + "</span></div>";
    /* pedidos do app */
    $("#esPed").innerHTML = PED.length ? '<div class="bi-meta"><div class="head"><p><b>' + PED.length + (PED.length === 1 ? " pedido pelo app" : " pedidos pelo app") + "</b> esperando você. Venda (baixa o estoque e lança o valor no aluno) ou cancele.</p></div>" +
      '<ul class="ficha-list es-ped">' + PED.map(function (x) {
        var a = P.porId[x.aluno], p = porId(x.produto);
        return '<li data-ped="' + x.id + '"><span><b>' + esc(a ? a.nome : "Aluno removido") + "</b> quer " + esc(p ? nomeP(p) + " · " + p.tamanho : "um item que saiu do estoque") + (p ? " · " + P.brl(p.preco) : "") +
          ' <small class="muted">' + P.dataBR(x.criado_em) + "</small></span>" +
          '<span class="row-acts">' + (p && a ? '<button class="mini-btn" type="button" data-vende-ped>Vender</button>' : "") + (a && a.whatsapp ? '<button class="mini-btn wa" type="button" data-wa-ped>WhatsApp</button>' : "") + '<button class="mini-btn ghost" type="button" data-cancela-ped>Cancelar</button></span></li>';
      }).join("") + "</ul></div>" : "";
    var cats = Object.keys(CAT).filter(function (k) { return PROD.some(function (p) { return p.categoria === k; }); });
    $("#esChips").innerHTML = ["todos"].concat(cats).map(function (k) { return '<button type="button" data-c="' + k + '" aria-pressed="' + (catF === k) + '">' + (k === "todos" ? "Tudo" : CAT[k]) + "</button>"; }).join("");
    $("#esTbl tbody").innerHTML = vis.map(function (p) {
      return '<tr data-id="' + p.id + '"' + (p.ativo ? "" : ' class="off"') + '><td><div class="nm"><span class="es-ic ' + p.categoria + '" aria-hidden="true"></span><div><b>' + esc(nomeP(p)) + "</b><small>" + CAT[p.categoria] + (p.ativo ? "" : " · fora da loja") + "</small></div></div></td>" +
        '<td><span class="pill-s">' + esc(p.tamanho) + '</span></td><td class="num">' + P.brl(p.preco) + "</td>" +
        '<td><div class="es-qtd"><button type="button" data-menos aria-label="Tirar uma peça"' + (p.quantidade ? "" : " disabled") + '>−</button><b' + (p.quantidade === 0 ? ' class="zero"' : "") + ">" + p.quantidade + '</b><button type="button" data-mais aria-label="Pôr uma peça">+</button></div></td>' +
        '<td class="act"><div class="row-acts">' + (p.quantidade ? '<button class="mini-btn" type="button" data-vende>Vender</button>' : "") + '<button class="mini-btn ghost" type="button" data-edita>Editar</button></div></td></tr>';
    }).join("");
    $("#esTbl").hidden = !vis.length;
    var e = $("#esEmpty");
    e.hidden = !!vis.length;
    if (!vis.length) e.innerHTML = PROD.length ? "Nada neste filtro." : "<b>O estoque está vazio.</b>Toque em Adicionar item para cadastrar os kimonos, rashguards e o que mais o Studio vende. A loja aparece no app dos alunos assim que houver pelo menos uma peça.";
  }

  /* ---------- adicionar itens: um produto em vários tamanhos de uma vez ---------- */
  var form = $("#esForm"), add = $("#esAdd");
  function formHTML(p) {
    p = p || {};
    return '<p class="fin-k">' + (p.id ? "Editar " + esc(nomeP(p)) + " · " + esc(p.tamanho) : "Novo item no estoque") + "</p><div class=\"crm-grid\">" +
      '<label class="crm-f"><span>Produto</span><input class="crm-in" data-f="nome" placeholder="Kimono Evolution" autocomplete="off" value="' + esc(p.nome || "") + '"></label>' +
      '<label class="crm-f"><span>Tipo</span><select class="sel" data-f="categoria">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '"' + (p.categoria === k ? " selected" : "") + ">" + CAT[k] + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Cor <small>(opcional)</small></span><input class="crm-in" data-f="cor" placeholder="Branco" autocomplete="off" value="' + esc(p.cor || "") + '"></label>' +
      '<label class="crm-f"><span>Preço de venda (R$)</span><input class="crm-in" data-f="preco" inputmode="decimal" placeholder="380" autocomplete="off" value="' + (p.preco != null ? String(p.preco).replace(".", ",") : "") + '"></label>' +
      (p.id ? '<label class="crm-f"><span>Tamanho</span><input class="crm-in" data-f="tamanho" autocomplete="off" value="' + esc(p.tamanho) + '"></label>' +
          '<label class="crm-f"><span>Quantidade</span><input class="crm-in" data-f="quantidade" inputmode="numeric" autocomplete="off" value="' + p.quantidade + '"></label>'
        : '<label class="crm-f"><span>Tamanhos <small>(separados por vírgula)</small></span><input class="crm-in" data-f="tamanhos" placeholder="A1, A2, A3" autocomplete="off"></label>' +
          '<label class="crm-f"><span>Peças de cada tamanho</span><input class="crm-in" data-f="quantidade" inputmode="numeric" placeholder="2" autocomplete="off"></label>') +
      '<label class="crm-f wide"><span>Descrição <small>(opcional, aparece na loja do app)</small></span><input class="crm-in" data-f="descricao" maxlength="300" autocomplete="off" value="' + esc(p.descricao || "") + '"></label></div>' +
      (p.id ? '<label class="mf-pub"><input type="checkbox" data-f="ativo"' + (p.ativo ? " checked" : "") + "><span>Mostrar na loja do app</span></label>" : "") +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">' + (p.id ? "Salvar" : "Adicionar ao estoque") + '</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button>' +
      (p.id ? '<button class="mini-btn ghost" type="button" data-apaga>Apagar do estoque</button>' : "") + "</div>";
  }
  function ler(f) {
    var g = function (k) { var el = $('[data-f="' + k + '"]', f); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : null; };
    return { nome: g("nome").replace(/\s+/g, " "), categoria: g("categoria"), cor: g("cor") || null, preco: P.num(g("preco")), descricao: g("descricao") || null,
      tamanho: g("tamanho"), tamanhos: g("tamanhos"), quantidade: g("quantidade"), ativo: g("ativo") };
  }
  add.addEventListener("click", function () {
    if (!form.hidden) { form.hidden = true; add.setAttribute("aria-expanded", "false"); return; }
    form.innerHTML = formHTML(); form.hidden = false; add.setAttribute("aria-expanded", "true"); P.aparece(form); P.focusSoft($('[data-f="nome"]', form));
  });
  form.addEventListener("click", function (e) { if (e.target.closest("[data-cancel]")) { form.hidden = true; add.setAttribute("aria-expanded", "false"); P.focusSoft(add); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var d = ler(form), el = function (k) { return $('[data-f="' + k + '"]', form); };
    if (d.nome.length < 2) return P.erroForm(form, el("nome"), "Digite o nome do produto, como Kimono Evolution.");
    if (!(d.preco >= 0)) return P.erroForm(form, el("preco"), "Digite o preço, como 380 ou 149,90.");
    var tams = (d.tamanhos || "").split(/[,;\/]+/).map(function (t) { return t.trim().toUpperCase(); }).filter(Boolean);
    if (!tams.length) tams = ["Único"];
    if (tams.some(function (t) { return t.length > 12; })) return P.erroForm(form, el("tamanhos"), "Cada tamanho com até 12 letras, como A2 ou M.");
    var qt = d.quantidade === "" ? 0 : parseInt(d.quantidade, 10);
    if (!(qt >= 0 && qt <= 999)) return P.erroForm(form, el("quantidade"), "Quantidade de 0 a 999.");
    var rows = tams.map(function (t) { return { nome: d.nome, categoria: d.categoria, cor: d.cor, preco: d.preco, descricao: d.descricao, tamanho: t, quantidade: qt }; });
    $('[type="submit"]', form).classList.add("loading");
    P.q(function (sb) { return sb.from("produtos").insert(rows); }).then(carregar).then(function () {
      form.hidden = true; add.setAttribute("aria-expanded", "false");
      P.toast(d.nome + (rows.length > 1 ? " em " + rows.length + " tamanhos" : "") + " no estoque." + (qt ? " A loja já aparece no app." : ""));
    }).catch(function (er) { $('[type="submit"]', form).classList.remove("loading"); P.erro(er); });
  });

  /* ---------- editar (na ficha lateral) ---------- */
  function editar(p) {
    var dr = P.abrirFicha('<form class="crm-form" id="esEd" novalidate>' + formHTML(p) + "</form>", nomeP(p));
    $("#drSub").textContent = CAT[p.categoria] + " · tamanho " + p.tamanho;
    var f = $("#esEd", dr);
    f.onsubmit = function (e) {
      e.preventDefault();
      var d = ler(f), el = function (k) { return $('[data-f="' + k + '"]', f); }, qt = parseInt(d.quantidade, 10);
      if (d.nome.length < 2) return P.erroForm(f, el("nome"), "Digite o nome do produto.");
      if (!(d.preco >= 0)) return P.erroForm(f, el("preco"), "Digite o preço, como 380 ou 149,90.");
      if (!d.tamanho) return P.erroForm(f, el("tamanho"), "Digite o tamanho, como A2 ou M.");
      if (!(qt >= 0 && qt <= 999)) return P.erroForm(f, el("quantidade"), "Quantidade de 0 a 999.");
      $('[type="submit"]', f).classList.add("loading");
      P.q(function (sb) { return sb.from("produtos").update({ nome: d.nome, categoria: d.categoria, cor: d.cor, preco: d.preco, descricao: d.descricao, tamanho: d.tamanho.toUpperCase().slice(0, 12), quantidade: qt, ativo: !!d.ativo }).eq("id", p.id); })
        .then(carregar).then(function () { P.fecharFicha(); P.toast("Item salvo."); })
        .catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er); });
    };
    dr.onclick = function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-cancel")) P.fecharFicha();
      else if (b.hasAttribute("data-apaga")) {
        if (b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Apagar mesmo?"; return; }
        P.q(function (sb) { return sb.from("produtos").delete().eq("id", p.id); }).then(carregar).then(function () { P.fecharFicha(); P.toast("Item apagado do estoque. As vendas já lançadas continuam nos alunos."); }).catch(function (er) { P.erro(er); });
      }
    };
  }

  /* ---------- vender: escolhe o aluno, a quantidade e se já recebeu ---------- */
  function vender(p, ped) {
    var alunos = P.ativos().slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
    var dr = P.abrirFicha('<form class="crm-form" id="esVd" novalidate><p class="fin-k">' + esc(nomeP(p)) + " · " + esc(p.tamanho) + " · " + P.brl(p.preco) + "</p>" +
      '<div class="crm-grid"><label class="crm-f wide"><span>Para quem</span><select class="sel" id="vdAluno"><option value="">Escolha o aluno…</option>' +
        alunos.map(function (a) { return '<option value="' + a.id + '"' + (ped && ped.aluno === a.id ? " selected" : "") + ">" + esc(a.nome) + " · " + esc(P.turmaTx(a)) + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Quantidade</span><input class="crm-in" id="vdQ" inputmode="numeric" value="1"></label>' +
      '<label class="crm-f"><span>Forma</span><select class="sel" id="vdForma">' + Object.keys(FORMA).map(function (k) { return '<option value="' + k + '">' + FORMA[k] + "</option>"; }).join("") + "</select></label></div>" +
      '<label class="mf-pub"><input type="checkbox" id="vdPago" checked><span>Já recebi (se não, fica a receber na ficha do aluno e no Financeiro)</span></label>' +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Registrar venda</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div></form>', "Vender");
    $("#drSub").textContent = p.quantidade + (p.quantidade === 1 ? " peça" : " peças") + " no estoque";
    var f = $("#esVd", dr);
    dr.onclick = function (e) { if (e.target.closest("[data-cancel]")) P.fecharFicha(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      var aid = $("#vdAluno", f).value, q = parseInt($("#vdQ", f).value, 10), pago = $("#vdPago", f).checked;
      if (!aid) return P.erroForm(f, $("#vdAluno", f), "Escolha para quem foi a venda.");
      if (!(q >= 1 && q <= p.quantidade)) return P.erroForm(f, $("#vdQ", f), "Quantidade de 1 a " + p.quantidade + ".");
      $('[type="submit"]', f).classList.add("loading");
      P.q(function (sb) { return sb.rpc("vender_produto", { p_produto: p.id, p_aluno: aid, p_quantidade: q, p_pago: pago, p_forma: pago ? $("#vdForma", f).value : null, p_pedido: ped ? ped.id : null }); })
        .then(carregar).then(function () {
          P.fecharFicha();
          P.toast("Venda registrada: " + P.first(P.porId[aid].nome) + ", " + P.brl(p.preco * q) + (pago ? " recebido." : " a receber."));
        }).catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er, "Não deu para registrar a venda"); });
    };
  }

  /* ---------- ações da lista ---------- */
  $("#esChips").addEventListener("click", function (e) { var b = e.target.closest("button[data-c]"); if (b) { catF = b.dataset.c; paint(); } });
  $("#esQ").addEventListener("input", paint);
  $("#esTbl").addEventListener("click", function (e) {
    var b = e.target.closest("button"), tr = e.target.closest("tr[data-id]");
    if (!b || !tr) return;
    var p = porId(tr.dataset.id);
    if (b.hasAttribute("data-vende")) return vender(p);
    if (b.hasAttribute("data-edita")) return editar(p);
    if (b.hasAttribute("data-mais") || b.hasAttribute("data-menos")) {
      /* um toque de cada vez por produto: os pedidos ao banco saem em ordem e o número final é o da tela */
      var n = Math.max(0, p.quantidade + (b.hasAttribute("data-mais") ? 1 : -1));
      p.quantidade = n; paint();
      p._fila = (p._fila || Promise.resolve()).then(function () {
        return P.q(function (sb) { return sb.from("produtos").update({ quantidade: n }).eq("id", p.id); });
      }).catch(function (er) { P.erro(er); p._fila = null; carregar(); });
    }
  });
  $("#esPed").addEventListener("click", function (e) {
    var b = e.target.closest("button"), li = e.target.closest("[data-ped]");
    if (!b || !li) return;
    var ped = PED.filter(function (x) { return x.id === li.dataset.ped; })[0], p = porId(ped.produto), a = P.porId[ped.aluno];
    if (b.hasAttribute("data-vende-ped")) return vender(p, ped);
    if (b.hasAttribute("data-wa-ped")) return P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. Recebi seu pedido de " + (p ? nomeP(p) + " (" + p.tamanho + ")" : "um item da loja") + ". ");
    if (b.hasAttribute("data-cancela-ped")) {
      P.q(function (sb) { return sb.from("pedidos_loja").update({ status: "cancelado" }).eq("id", ped.id); }).then(carregar).then(function () { P.toast("Pedido cancelado."); }).catch(function (er) { P.erro(er); });
    }
  });

  P.aoMudarAlunos(paint);
  P.aoAbrir("estoque", function () { paint(); carregar(); });
  /* o selo de pedidos novos aparece mesmo sem abrir a aba */
  window.addEventListener("load", function () { setTimeout(carregar, 1500); });
})();
