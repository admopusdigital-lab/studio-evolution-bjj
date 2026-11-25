/* Painel · Estoque e loja: o que o Studio tem para vender (kimono, rashguard, faixa…).
   No banco é uma linha por produto e tamanho; na tela, um produto só, com os tamanhos lado a lado.
   Duas abas: Vender (os pedidos do app em cima e um cartão por produto, com um botão por tamanho) e
   Estoque (uma grade por tipo: produto × tamanho, com − e + em cada casa e o Editar do produto inteiro).
   Vender baixa o estoque e lança o valor no aluno (cobrancas), tudo junto (vender_produto).
   A loja só aparece no app quando há item com quantidade. */
(function () {
  "use strict";
  var $ = P.$, $$ = P.$$, esc = P.esc;
  var CAT = { kimono: "Kimono", rashguard: "Rashguard", faixa: "Faixa", camiseta: "Camiseta", acessorio: "Acessório", outro: "Outro" };
  var FORMA = { pix: "Pix", dinheiro: "Dinheiro", cartao: "Cartão", boleto: "Boleto" };
  P.CAT_PRODUTO = CAT;
  var PROD = [], PED = [], VEND = [], catF = "todos", ok = false, aba = null;

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
  function pecas(n) { return n + (n === 1 ? " peça" : " peças"); }

  /* ---------- tamanhos na ordem de loja: kids, adulto, letras, números ---------- */
  var ORDEM = ["M000", "M00", "M0", "M1", "M2", "M3", "M4", "A00", "A0", "A1", "A2", "A3", "A4", "A5", "A6", "F1", "F2", "F3", "F4", "PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "G1", "G2", "G3", "ÚNICO"];
  function peso(t) {
    var u = String(t || "").toUpperCase(), i = ORDEM.indexOf(u);
    if (i >= 0) return i;
    var n = parseFloat(u.replace(",", "."));
    return isNaN(n) ? 1000 : 100 + n;
  }
  function ordTam(a, b) { return peso(a) - peso(b) || String(a).localeCompare(String(b)); }
  /* tamanho escrito sempre igual: A2, M, GG; "único" fica Único */
  function normTam(t) { t = String(t || "").trim(); return P.norm(t) === "unico" ? "Único" : t.toUpperCase(); }

  /* ---------- um produto = mesmo tipo, nome e cor; os tamanhos são as linhas do banco ---------- */
  function grupos(lista) {
    var m = {}, out = [];
    lista.forEach(function (p) {
      var k = p.categoria + "|" + P.norm(p.nome) + "|" + P.norm(p.cor || "");
      var g = m[k];
      if (!g) { g = m[k] = { k: k, nome: p.nome, cor: p.cor, categoria: p.categoria, descricao: null, foto: null, itens: [] }; out.push(g); }
      g.itens.push(p);
      if (p.foto && !g.foto) g.foto = p.foto;
      if (p.descricao && !g.descricao) g.descricao = p.descricao;
    });
    out.forEach(function (g) {
      g.itens.sort(function (a, b) { return ordTam(a.tamanho, b.tamanho); });
      g.total = g.itens.reduce(function (a, p) { return a + p.quantidade; }, 0);
      g.ativo = g.itens.some(function (p) { return p.ativo; });
      var pr = g.itens.map(function (p) { return Number(p.preco); });
      g.min = Math.min.apply(null, pr); g.max = Math.max.apply(null, pr);
    });
    return out;
  }
  function precoTx(g) { return g.min === g.max ? P.brl(g.min) : P.brl(g.min) + " a " + P.brl(g.max); }
  function porChave(k) { return grupos(PROD).filter(function (g) { return g.k === k; })[0]; }
  function icone(cat, foto, cls) {
    return foto ? '<span class="es-ic es-foto-mini' + (cls ? " " + cls : "") + '" aria-hidden="true" style="background-image:url(&quot;' + esc(foto) + '&quot;)"></span>'
      : '<span class="es-ic ' + cat + (cls ? " " + cls : "") + '" aria-hidden="true"></span>';
  }

  /* ---------- abas ---------- */
  var ABAS = [["vender", "#etVender", "#epVender"], ["estoque", "#etEstoque", "#epEstoque"]];
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
      abrirAba(ABAS[(i + 1) % 2][0], true);
    });
  });

  function paint() {
    if (!ok) return;
    /* sem nada para vender e sem pedido, abre direto no Estoque (é onde se cadastra) */
    if (!aba) { aba = PROD.length || PED.length ? "vender" : "estoque"; ABAS.forEach(function (t) { var on = t[0] === aba; $(t[1]).setAttribute("aria-selected", on); $(t[1]).tabIndex = on ? 0 : -1; $(t[2]).hidden = !on; }); }
    var cats = Object.keys(CAT).filter(function (k) { return PROD.some(function (p) { return p.categoria === k; }); });
    if (catF !== "todos" && (cats.indexOf(catF) < 0 || cats.length < 2)) catF = "todos";
    var vis = PROD.filter(function (p) { return catF === "todos" || p.categoria === catF; });
    var q = P.norm($("#esQ").value.trim());
    if (q) vis = vis.filter(function (p) { return P.norm(nomeP(p) + " " + p.tamanho + " " + CAT[p.categoria]).indexOf(q) >= 0; });
    var at = PROD.filter(function (p) { return p.ativo; });
    var nPecas = at.reduce(function (a, p) { return a + p.quantidade; }, 0);
    var valor = at.reduce(function (a, p) { return a + p.quantidade * p.preco; }, 0);
    var vendM = VEND.reduce(function (a, x) { return a + Number(x.valor); }, 0), vendQ = VEND.reduce(function (a, x) { return a + (x.quantidade || 1); }, 0);
    var ultima = at.filter(function (p) { return p.quantidade === 1; }).length, zerados = at.filter(function (p) { return p.quantidade === 0; }).length;
    $("#esK").textContent = nPecas ? pecas(nPecas) + " em estoque · loja visível no app" : "Loja escondida no app (sem itens com quantidade)";
    $("#esKpis").innerHTML =
      '<div class="kpi"><b>' + nPecas + "</b><span>peças em estoque</span></div>" +
      '<div class="kpi"><b>' + P.brl(valor) + "</b><span>valor do estoque, a preço de venda</span></div>" +
      '<div class="kpi"><b>' + P.brl(vendM) + "</b><span>" + vendQ + (vendQ === 1 ? " peça vendida" : " peças vendidas") + " em " + P.MESES[new Date().getMonth()] + "</span></div>" +
      '<div class="kpi' + (ultima || zerados ? " warn" : "") + '"><b>' + ultima + "</b><span>" + (ultima === 1 ? "tamanho com a última peça" : "tamanhos com a última peça") + (zerados ? " · " + zerados + (zerados === 1 ? " esgotado" : " esgotados") : "") + "</span></div>";
    var n = $("#etPed");
    n.hidden = !PED.length; n.textContent = PED.length;
    $("#etVender").setAttribute("aria-label", "Vender" + (PED.length ? ", " + PED.length + (PED.length === 1 ? " pedido do app esperando" : " pedidos do app esperando") : ""));
    $("#esChips").innerHTML = cats.length > 1 ? ["todos"].concat(cats).map(function (k) { return '<button type="button" data-c="' + k + '" aria-pressed="' + (catF === k) + '">' + (k === "todos" ? "Tudo" : CAT[k]) + "</button>"; }).join("") : "";
    var gs = grupos(vis);
    paintPedidos();
    if (aba === "vender") paintVender(gs); else paintEstoque(gs);
    var e = $("#esEmpty"), vazio = !gs.length && !(aba === "vender" && PED.length);
    e.hidden = !vazio;
    if (vazio) e.innerHTML = PROD.length ? "Nada neste filtro." : "<b>O estoque está vazio.</b>Toque em Adicionar produto para cadastrar os kimonos, rashguards e o que mais o Studio vende, com todos os tamanhos de uma vez. A loja aparece no app dos alunos assim que houver pelo menos uma peça.";
  }

  /* ---------- Vender: pedidos do app ---------- */
  function paintPedidos() {
    $("#esPed").innerHTML = PED.length ? '<div class="es-pedbox"><p class="fin-k">' + (PED.length === 1 ? "1 pedido pelo app" : PED.length + " pedidos pelo app") + " esperando você</p>" +
      '<ul class="es-ped">' + PED.map(function (x) {
        var a = P.porId[x.aluno], p = porId(x.produto), tem = p && p.quantidade > 0;
        return '<li data-ped="' + x.id + '">' + (p ? icone(p.categoria, p.foto) : '<span class="es-ic outro" aria-hidden="true"></span>') +
          '<div class="es-ped-t"><b>' + esc(a ? a.nome : "Aluno removido") + "</b> quer " + (p ? "<b>" + esc(nomeP(p)) + "</b> · " + esc(p.tamanho) : "um item que saiu do estoque") +
          "<small>" + (p ? P.brl(p.preco) + " · " : "") + "pedido em " + P.dataBR(x.criado_em) + (p && !tem ? ' · <span class="es-falta">sem peça desse tamanho</span>' : "") + "</small></div>" +
          '<div class="row-acts">' + (tem && a ? '<button class="mini-btn" type="button" data-vende-ped>Entregar e cobrar</button>' : "") +
          (a && a.whatsapp ? '<button class="mini-btn ghost" type="button" data-wa-ped>WhatsApp</button>' : "") +
          '<button class="mini-btn ghost" type="button" data-cancela-ped>Cancelar</button></div></li>';
      }).join("") + "</ul></div>" : "";
  }

  /* ---------- Vender: um cartão por produto, um botão por tamanho ---------- */
  function paintVender(gs) {
    /* primeiro o que tem peça e está na loja; depois o esgotado e o que está fora da loja */
    gs.sort(function (a, b) { return (b.total > 0) - (a.total > 0) || b.ativo - a.ativo || a.nome.localeCompare(b.nome); });
    $("#esCards").innerHTML = gs.map(function (g) {
      return '<article class="es-card' + (g.total ? "" : " esg") + '"><div class="es-card-f' + (g.foto ? "" : " sem") + '">' + (g.foto ? '<img src="' + esc(g.foto) + '" alt="" loading="lazy">' : '<span class="es-ic ' + g.categoria + '" aria-hidden="true"></span>') + "</div>" +
        '<div class="es-card-b"><h4>' + esc(g.nome) + (g.cor ? " <span>" + esc(g.cor.toLowerCase()) + "</span>" : "") + "</h4>" +
        "<p>" + precoTx(g) + " · " + (g.total ? pecas(g.total) : "esgotado") + (g.ativo ? "" : " · fora da loja do app") + "</p>" +
        '<div class="es-tams" role="group" aria-label="Vender ' + esc(nomeP(g)) + ', escolha o tamanho">' + g.itens.map(function (p) {
          var cls = p.quantidade === 0 ? "z" : p.quantidade === 1 ? "u" : "";
          return '<button type="button" data-vende="' + p.id + '"' + (cls ? ' class="' + cls + '"' : "") + (p.quantidade ? "" : " disabled") +
            ' aria-label="' + esc(p.tamanho) + ", " + (p.quantidade === 0 ? "esgotado" : p.quantidade === 1 ? "a última peça" : pecas(p.quantidade)) + (g.min !== g.max ? ", " + P.brl(p.preco) : "") + '">' +
            "<b>" + esc(p.tamanho) + "</b><span>" + (p.quantidade === 0 ? "0" : p.quantidade === 1 ? "última" : p.quantidade) + "</span></button>";
        }).join("") + "</div></div></article>";
    }).join("");
  }

  /* ---------- Estoque: uma grade por tipo, produto × tamanho ---------- */
  function paintEstoque(gs) {
    var porCat = {};
    gs.forEach(function (g) { (porCat[g.categoria] = porCat[g.categoria] || []).push(g); });
    $("#esMx").innerHTML = Object.keys(CAT).filter(function (c) { return porCat[c]; }).map(function (c) {
      var lista = porCat[c];
      var tams = [];
      lista.forEach(function (g) { g.itens.forEach(function (p) { var t = normTam(p.tamanho); if (tams.indexOf(t) < 0) tams.push(t); }); });
      tams.sort(ordTam);
      var soma = lista.reduce(function (a, g) { return a + g.total; }, 0);
      return '<section class="es-cat" aria-label="' + CAT[c] + '"><h4>' + CAT[c] + " <small>" + pecas(soma) + "</small></h4>" +
        '<div class="es-mx-wrap"><table class="es-mx"><thead><tr><th scope="col">Produto</th>' + tams.map(function (t) { return '<th scope="col" class="t">' + esc(t) + "</th>"; }).join("") +
        '<th scope="col" class="num">Total</th><th scope="col" class="act"><span class="sr-only">Ações</span></th></tr></thead><tbody>' +
        lista.map(function (g) {
          return '<tr data-g="' + esc(g.k) + '"' + (g.ativo ? "" : ' class="off"') + '><th scope="row"><div class="nm">' + icone(g.categoria, g.foto) +
            "<div><b>" + esc(nomeP(g)) + "</b><small>" + precoTx(g) + (g.ativo ? "" : " · fora da loja") + "</small></div></div></th>" +
            tams.map(function (t) {
              var p = g.itens.filter(function (x) { return normTam(x.tamanho) === t; })[0];
              if (!p) return '<td class="vazio"><span aria-label="não tem">·</span></td>';
              var cls = p.quantidade === 0 ? "z" : p.quantidade === 1 ? "u" : "";
              return '<td data-t="' + esc(p.tamanho) + '"><div class="es-st" data-id="' + p.id + '"><button type="button" data-menos aria-label="Tirar uma peça do ' + esc(p.tamanho) + '"' + (p.quantidade ? "" : " disabled") + '>−</button>' +
                "<b" + (cls ? ' class="' + cls + '"' : "") + ">" + p.quantidade + '</b><button type="button" data-mais aria-label="Pôr uma peça no ' + esc(p.tamanho) + '">+</button></div></td>';
            }).join("") +
            '<td class="num tot">' + g.total + '</td><td class="act"><button class="mini-btn ghost" type="button" data-edita>Editar</button></td></tr>';
        }).join("") + "</tbody></table></div></section>";
    }).join("");
  }

  /* ---------- foto: reduzida no aparelho e enviada só ao salvar ---------- */
  function fotoHTML(foto, cat) {
    return '<div class="crm-f wide es-foto"><span>Foto <small>(opcional: aparece na loja do app e vale para todos os tamanhos)</small></span><div class="es-foto-row">' +
      '<span class="es-foto-prev">' + (foto ? '<img src="' + esc(foto) + '" alt="">' : '<span class="es-ic ' + (cat || "kimono") + '" aria-hidden="true"></span>') + "</span>" +
      '<div class="msg-acts"><button class="mini-btn ghost" type="button" data-foto-escolhe>' + (foto ? "Trocar foto" : "Escolher foto") + "</button>" +
      '<button class="mini-btn ghost" type="button" data-foto-tira' + (foto ? "" : " hidden") + ">Tirar foto</button></div></div>" +
      '<input type="file" accept="image/*" hidden data-foto-in></div>';
  }
  function ligaFoto(f, atual) {
    f._foto = { blob: null, tirar: false, atual: atual || null };
    var inp = $("[data-foto-in]", f), prev = $(".es-foto-prev", f), tira = $("[data-foto-tira]", f), esc1 = $("[data-foto-escolhe]", f);
    esc1.onclick = function () { inp.click(); };
    inp.onchange = function () {
      var file = inp.files && inp.files[0];
      inp.value = "";
      if (!file) return;
      esc1.classList.add("loading");
      Fotos.reduzLivre(file).then(function (b) {
        f._foto.blob = b; f._foto.tirar = false;
        prev.innerHTML = '<img src="' + URL.createObjectURL(b) + '" alt="">';
        esc1.textContent = "Trocar foto"; tira.hidden = false;
      }, function (er) { P.toast(er.message); }).then(function () { esc1.classList.remove("loading"); });
    };
    tira.onclick = function () {
      f._foto.blob = null; f._foto.tirar = true;
      prev.innerHTML = '<span class="es-ic ' + ($('[data-f="categoria"]', f).value || "kimono") + '" aria-hidden="true"></span>';
      esc1.textContent = "Escolher foto"; tira.hidden = true;
    };
  }
  /* envia a foto ao bucket público "loja" e devolve o endereço */
  function enviaFoto(blob) {
    var nome = Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ".jpg";
    return P.db.then(function (sb) {
      return sb.storage.from("loja").upload(nome, blob, { contentType: "image/jpeg", cacheControl: "31536000", upsert: false }).then(function (r) {
        if (r.error) throw r.error;
        return sb.storage.from("loja").getPublicUrl(nome).data.publicUrl;
      });
    });
  }
  function apagaFoto(url) {
    var k = url && String(url).split("/object/public/loja/")[1];
    if (!k) return;
    P.db.then(function (sb) { return sb.storage.from("loja").remove([decodeURIComponent(k)]); }).catch(function () {});
  }
  /* a foto que vai para o banco: a nova (enviada agora), nenhuma (tirou) ou a de antes */
  function fotoFinal(f) {
    var st = f._foto || {};
    if (st.blob) return enviaFoto(st.blob);
    return Promise.resolve(st.tirar ? null : st.atual);
  }
  function campos(g) {
    g = g || {};
    return '<label class="crm-f"><span>Produto</span><input class="crm-in" data-f="nome" placeholder="Kimono Evolution" autocomplete="off" value="' + esc(g.nome || "") + '"></label>' +
      '<label class="crm-f"><span>Tipo</span><select class="sel" data-f="categoria">' + Object.keys(CAT).map(function (k) { return '<option value="' + k + '"' + (g.categoria === k ? " selected" : "") + ">" + CAT[k] + "</option>"; }).join("") + "</select></label>" +
      '<label class="crm-f"><span>Cor <small>(opcional)</small></span><input class="crm-in" data-f="cor" placeholder="Branco" autocomplete="off" value="' + esc(g.cor || "") + '"></label>';
  }
  function g1(f, k) { var el = $('[data-f="' + k + '"]', f); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : null; }
  function tamOk(t) { return t.length <= 12; }

  /* ---------- adicionar: um produto em vários tamanhos de uma vez ---------- */
  var form = $("#esForm"), add = $("#esAdd");
  function addHTML() {
    return '<p class="fin-k">Novo produto no estoque</p><div class="crm-grid">' + fotoHTML(null, "kimono") + campos() +
      '<label class="crm-f"><span>Preço de venda (R$)</span><input class="crm-in" data-f="preco" inputmode="decimal" placeholder="380" autocomplete="off"></label>' +
      '<label class="crm-f"><span>Tamanhos <small>(separados por vírgula)</small></span><input class="crm-in" data-f="tamanhos" placeholder="A1, A2, A3" autocomplete="off"></label>' +
      '<label class="crm-f"><span>Peças de cada tamanho</span><input class="crm-in" data-f="quantidade" inputmode="numeric" placeholder="2" autocomplete="off"></label>' +
      '<label class="crm-f wide"><span>Descrição <small>(opcional, aparece na loja do app)</small></span><input class="crm-in" data-f="descricao" maxlength="300" autocomplete="off"></label></div>' +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Adicionar ao estoque</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div>';
  }
  function fechaAdd() { form.hidden = true; add.setAttribute("aria-expanded", "false"); }
  add.addEventListener("click", function () {
    if (!form.hidden) { fechaAdd(); return; }
    if (aba !== "estoque") abrirAba("estoque");
    form.innerHTML = addHTML(); ligaFoto(form, null); form.hidden = false; add.setAttribute("aria-expanded", "true"); P.aparece(form); P.focusSoft($('[data-f="nome"]', form));
  });
  form.addEventListener("click", function (e) { if (e.target.closest("[data-cancel]")) { fechaAdd(); P.focusSoft(add); } });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var el = function (k) { return $('[data-f="' + k + '"]', form); };
    var nome = g1(form, "nome").replace(/\s+/g, " "), preco = P.num(g1(form, "preco")), qtTx = g1(form, "quantidade");
    if (nome.length < 2) return P.erroForm(form, el("nome"), "Digite o nome do produto, como Kimono Evolution.");
    if (!(preco >= 0)) return P.erroForm(form, el("preco"), "Digite o preço, como 380 ou 149,90.");
    var tams = (g1(form, "tamanhos") || "").split(/[,;\/]+/).map(normTam).filter(Boolean);
    tams = tams.filter(function (t, i) { return tams.indexOf(t) === i; });
    if (!tams.length) tams = ["Único"];
    if (!tams.every(tamOk)) return P.erroForm(form, el("tamanhos"), "Cada tamanho com até 12 letras, como A2 ou M.");
    var qt = qtTx === "" ? 0 : parseInt(qtTx, 10);
    if (!(qt >= 0 && qt <= 999)) return P.erroForm(form, el("quantidade"), "Quantidade de 0 a 999.");
    var base = { nome: nome, categoria: g1(form, "categoria"), cor: g1(form, "cor") || null, preco: preco, descricao: g1(form, "descricao") || null };
    /* o mesmo produto (tipo, nome e cor) que já existe ganha só os tamanhos que faltam */
    var ja = grupos(PROD).filter(function (g) { return g.categoria === base.categoria && P.norm(g.nome) === P.norm(nome) && P.norm(g.cor || "") === P.norm(base.cor || ""); })[0];
    var tem = ja ? ja.itens.map(function (p) { return normTam(p.tamanho); }) : [];
    var novos = tams.filter(function (t) { return tem.indexOf(t) < 0; });
    if (!novos.length) return P.erroForm(form, el("tamanhos"), "Esse produto já tem esses tamanhos. Use o − e + da grade ou o Editar.");
    var rows = novos.map(function (t) { return Object.assign({}, base, { nome: ja ? ja.nome : nome, cor: ja ? ja.cor : base.cor, tamanho: t, quantidade: qt }); });
    $('[type="submit"]', form).classList.add("loading");
    fotoFinal(form).then(function (url) {
      url = url || (ja && ja.foto);
      if (url) rows.forEach(function (r) { r.foto = url; });
      return P.q(function (sb) { return sb.from("produtos").insert(rows); });
    }).then(carregar).then(function () {
      fechaAdd();
      P.toast(nome + (rows.length > 1 ? " em " + rows.length + " tamanhos" : "") + " no estoque." + (qt ? " A loja já aparece no app." : ""));
    }).catch(function (er) { $('[type="submit"]', form).classList.remove("loading"); P.erro(er); });
  });

  /* ---------- editar o produto inteiro: dados, foto e a lista de tamanhos ---------- */
  function linhaTam(p, preco) {
    p = p || {};
    return '<li class="es-ed-l"' + (p.id ? ' data-id="' + p.id + '"' : "") + '><input class="crm-in" data-l="tamanho" aria-label="Tamanho" placeholder="A2" maxlength="12" autocomplete="off" value="' + esc(p.tamanho || "") + '">' +
      '<input class="crm-in" data-l="preco" aria-label="Preço (R$)" inputmode="decimal" autocomplete="off" value="' + String(p.preco != null ? p.preco : preco != null ? preco : "").replace(".", ",") + '">' +
      '<input class="crm-in" data-l="quantidade" aria-label="Peças" inputmode="numeric" autocomplete="off" value="' + (p.quantidade != null ? p.quantidade : 0) + '">' +
      '<button class="ic-btn" type="button" data-tira-l aria-label="Tirar o tamanho ' + esc(p.tamanho || "novo") + '"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></button></li>';
  }
  function editar(g) {
    var dr = P.abrirFicha('<form class="crm-form" id="esEd" novalidate><div class="crm-grid">' + fotoHTML(g.foto, g.categoria) + campos(g) +
      '<label class="crm-f"><span>Preço de todos os tamanhos (R$)</span><input class="crm-in" data-f="preco" inputmode="decimal" autocomplete="off" placeholder="' + (g.min === g.max ? "" : "cada tamanho tem o seu") + '" value="' + (g.min === g.max ? String(g.min).replace(".", ",") : "") + '"></label>' +
      '<label class="crm-f wide"><span>Descrição <small>(opcional, aparece na loja do app)</small></span><input class="crm-in" data-f="descricao" maxlength="300" autocomplete="off" value="' + esc(g.descricao || "") + '"></label></div>' +
      '<div class="es-ed"><p class="fin-k">Tamanhos</p><div class="es-ed-h" aria-hidden="true"><span>Tamanho</span><span>Preço (R$)</span><span>Peças</span><span></span></div>' +
      '<ul class="es-ed-ls">' + g.itens.map(function (p) { return linhaTam(p); }).join("") + "</ul>" +
      '<button class="mini-btn ghost" type="button" data-novo-l><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-plus"/></svg>Outro tamanho</button></div>' +
      '<label class="mf-pub"><input type="checkbox" data-f="ativo"' + (g.ativo ? " checked" : "") + "><span>Mostrar na loja do app</span></label>" +
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">Salvar</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button>' +
      '<button class="mini-btn ghost" type="button" data-apaga>Apagar o produto</button></div></form>', nomeP(g));
    $("#drSub").textContent = CAT[g.categoria] + " · " + (g.itens.length === 1 ? "1 tamanho" : g.itens.length + " tamanhos") + " · " + pecas(g.total);
    var f = $("#esEd", dr), ls = $(".es-ed-ls", f), tirados = [];
    ligaFoto(f, g.foto);
    /* o preço de cima preenche todos os tamanhos de uma vez */
    $('[data-f="preco"]', f).addEventListener("input", function () { var v = this.value; if (v.trim()) $$('[data-l="preco"]', f).forEach(function (i) { i.value = v; }); });
    dr.onclick = function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-cancel")) return P.fecharFicha();
      if (b.hasAttribute("data-novo-l")) {
        ls.insertAdjacentHTML("beforeend", linhaTam(null, P.num($('[data-f="preco"]', f).value) >= 0 ? P.num($('[data-f="preco"]', f).value) : g.max));
        return P.focusSoft($('li:last-child [data-l="tamanho"]', ls));
      }
      if (b.hasAttribute("data-tira-l")) {
        var li = b.closest("li");
        if (li.dataset.id) tirados.push(li.dataset.id);
        li.remove();
        return;
      }
      if (b.hasAttribute("data-apaga")) {
        if (b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Apagar mesmo? (" + (g.itens.length === 1 ? "o tamanho" : "os " + g.itens.length + " tamanhos") + ")"; return; }
        var ids = g.itens.map(function (p) { return p.id; });
        P.q(function (sb) { return sb.from("produtos").delete().in("id", ids); }).then(carregar)
          .then(function () { P.fecharFicha(); P.toast(nomeP(g) + " saiu do estoque. As vendas já lançadas continuam nos alunos."); }).catch(function (er) { P.erro(er); });
      }
    };
    f.onsubmit = function (e) {
      e.preventDefault();
      var el = function (k) { return $('[data-f="' + k + '"]', f); };
      var nome = g1(f, "nome").replace(/\s+/g, " ");
      if (nome.length < 2) return P.erroForm(f, el("nome"), "Digite o nome do produto.");
      var lin = $$(".es-ed-l", ls), vistos = [], erro = null;
      var tams = lin.map(function (li) {
        var v = function (k) { return $('[data-l="' + k + '"]', li); };
        var t = normTam(v("tamanho").value), pr = P.num(v("preco").value), qt = parseInt(v("quantidade").value, 10);
        if (erro) return null;
        if (!t || !tamOk(t)) erro = [v("tamanho"), "Digite o tamanho, como A2 ou M (até 12 letras)."];
        else if (vistos.indexOf(t) >= 0) erro = [v("tamanho"), "O tamanho " + t + " aparece duas vezes."];
        else if (!(pr >= 0)) erro = [v("preco"), "Digite o preço do " + t + ", como 380 ou 149,90."];
        else if (!(qt >= 0 && qt <= 999)) erro = [v("quantidade"), "Peças do " + t + ": de 0 a 999."];
        vistos.push(t);
        return { id: li.dataset.id || null, tamanho: t, preco: pr, quantidade: qt };
      });
      if (erro) return P.erroForm(f, erro[0], erro[1]);
      if (!tams.length) return P.erroForm(f, $("[data-novo-l]", f), "Deixe pelo menos um tamanho, ou use Apagar o produto.");
      var comum = { nome: nome, categoria: g1(f, "categoria"), cor: g1(f, "cor") || null, descricao: g1(f, "descricao") || null, ativo: !!g1(f, "ativo") };
      var trocou = !!(f._foto.blob || f._foto.tirar);
      $('[type="submit"]', f).classList.add("loading");
      fotoFinal(f).then(function (url) {
        var foto = trocou ? { foto: url } : {};  /* sem trocar a foto, nem manda o campo (funciona mesmo antes da atualização do banco) */
        var antes = {};
        g.itens.forEach(function (p) { antes[p.id] = p; });
        var jobs = [];
        tams.forEach(function (t) {
          if (t.id) {
            var p = antes[t.id];
            var mudou = trocou || p.nome !== comum.nome || p.categoria !== comum.categoria || (p.cor || null) !== comum.cor || (p.descricao || null) !== comum.descricao ||
              !!p.ativo !== comum.ativo || p.tamanho !== t.tamanho || Number(p.preco) !== t.preco || p.quantidade !== t.quantidade;
            if (mudou) jobs.push(function () { return P.q(function (sb) { return sb.from("produtos").update(Object.assign({}, comum, foto, { tamanho: t.tamanho, preco: t.preco, quantidade: t.quantidade })).eq("id", t.id); }); });
          } else {
            var ft = trocou ? foto : (g.foto ? { foto: g.foto } : {});
            jobs.push(function () { return P.q(function (sb) { return sb.from("produtos").insert(Object.assign({}, comum, ft, { tamanho: t.tamanho, preco: t.preco, quantidade: t.quantidade })); }); });
          }
        });
        if (tirados.length) jobs.push(function () { return P.q(function (sb) { return sb.from("produtos").delete().in("id", tirados); }); });
        /* um pedido de cada vez: se um falhar, os anteriores ficam e a tela recarrega o que ficou */
        return jobs.reduce(function (pr, j) { return pr.then(j); }, Promise.resolve()).then(function () {
          if (trocou && g.foto && g.foto !== url) apagaFoto(g.foto);
        });
      })
        .then(carregar).then(function () { P.fecharFicha(); P.toast(nome + " salvo."); })
        .catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er); carregar(); });
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
      '<p class="crm-err" role="alert"></p><div class="msg-acts"><button class="mini-btn" type="submit">' + (ped ? "Entregar e cobrar" : "Registrar venda") + '</button><button class="mini-btn ghost" type="button" data-cancel>Cancelar</button></div></form>', ped ? "Entregar pedido" : "Vender");
    $("#drSub").textContent = pecas(p.quantidade) + " no estoque";
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
          P.toast((ped ? "Pedido entregue: " : "Venda registrada: ") + P.first(P.porId[aid].nome) + ", " + P.brl(p.preco * q) + (pago ? " recebido." : " a receber."));
        }).catch(function (er) { $('[type="submit"]', f).classList.remove("loading"); P.erro(er, "Não deu para registrar a venda"); });
    };
  }

  /* ---------- ações ---------- */
  $("#esChips").addEventListener("click", function (e) { var b = e.target.closest("button[data-c]"); if (b) { catF = b.dataset.c; paint(); } });
  $("#esQ").addEventListener("input", paint);
  $("#esCards").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-vende]");
    if (b && !b.disabled) vender(porId(b.dataset.vende));
  });
  $("#esMx").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    if (b.hasAttribute("data-edita")) { var g = porChave(b.closest("tr").dataset.g); if (g) editar(g); return; }
    var st = b.closest(".es-st");
    if (!st || !(b.hasAttribute("data-mais") || b.hasAttribute("data-menos"))) return;
    var p = porId(st.dataset.id);
    if (!p) return;
    /* um toque de cada vez por tamanho: os pedidos ao banco saem em ordem e o número final é o da tela */
    var n = Math.max(0, p.quantidade + (b.hasAttribute("data-mais") ? 1 : -1));
    if (n === p.quantidade) return;
    p.quantidade = n; paint();
    var mesmo = $('.es-st[data-id="' + p.id + '"] [data-' + (b.hasAttribute("data-mais") ? "mais" : "menos") + "]");
    if (mesmo && !mesmo.disabled) mesmo.focus(); else if (mesmo) $('.es-st[data-id="' + p.id + '"] [data-mais]').focus();
    p._fila = (p._fila || Promise.resolve()).then(function () {
      return P.q(function (sb) { return sb.from("produtos").update({ quantidade: n }).eq("id", p.id); });
    }).catch(function (er) { P.erro(er); p._fila = null; carregar(); });
  });
  $("#esPed").addEventListener("click", function (e) {
    var b = e.target.closest("button"), li = e.target.closest("[data-ped]");
    if (!b || !li) return;
    var ped = PED.filter(function (x) { return x.id === li.dataset.ped; })[0], p = porId(ped.produto), a = P.porId[ped.aluno];
    if (b.hasAttribute("data-vende-ped")) return vender(p, ped);
    if (b.hasAttribute("data-wa-ped")) return P.wa(a.whatsapp, "Oi, " + P.first(a.responsavel || a.nome) + "! Aqui é do Studio Evolution BJJ. Recebi seu pedido de " + (p ? nomeP(p) + " (" + p.tamanho + ")" : "um item da loja") + ". ");
    if (b.hasAttribute("data-cancela-ped")) {
      if (b.dataset.certo !== "1") { b.dataset.certo = "1"; b.textContent = "Cancelar mesmo?"; return; }
      P.q(function (sb) { return sb.from("pedidos_loja").update({ status: "cancelado" }).eq("id", ped.id); }).then(carregar).then(function () { P.toast("Pedido cancelado."); }).catch(function (er) { P.erro(er); });
    }
  });

  P.aoMudarAlunos(paint);
  P.aoAbrir("estoque", function () { paint(); carregar(); });
  /* o selo de pedidos novos aparece mesmo sem abrir a aba */
  window.addEventListener("load", function () { setTimeout(carregar, 1500); });
})();
