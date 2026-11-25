/* Studio Evolution BJJ · painel do professor (modo Supabase): o núcleo que as abas usam.
   Cada aba mora num arquivo (painel-hoje.js, painel-alunos.js, painel-crm.js, painel-fin.js, painel-mov.js) e fala com
   o banco pelo P.db (supabase-js do acesso.js). As regras de quem lê e muda o quê estão no banco (RLS). */
(function () {
  var $ = Site.$, $$ = Site.$$, focusSoft = Site.focusSoft;
  var anim = !!window.gsap && !Site.reduce;
  var P = window.P = { $: $, $$: $$, anim: anim, focusSoft: focusSoft };

  /* ---------- textos e datas ---------- */
  P.esc = function (t) { return String(t == null ? "" : t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  P.norm = function (s) { return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""); };
  P.first = function (n) { return String(n || "").trim().split(/\s+/)[0]; };
  P.ini = function (n) { var p = String(n || "?").trim().split(/\s+/); return ((p[0] || "?").charAt(0) + (p.length > 1 ? p[p.length - 1].charAt(0) : "")).toUpperCase(); };
  P.curto = function (n) { var p = String(n || "").trim().split(/\s+/); return p.length > 1 ? p[0] + " " + p[p.length - 1].charAt(0) + "." : p[0]; };
  P.two = function (n) { return (n < 10 ? "0" : "") + n; };
  P.iso = function (d) { return d.getFullYear() + "-" + P.two(d.getMonth() + 1) + "-" + P.two(d.getDate()); };
  P.hoje = function () { return P.iso(new Date()); };
  /* data do dia (AAAA-MM-DD) no horário do Brasil: um carimbo de hora (criado_em) vira o dia local, não o do UTC */
  P.d10 = function (x) { var s = String(x || ""); return s.length > 10 && /[T ]\d\d:/.test(s) ? P.iso(new Date(s)) : s.slice(0, 10); };
  P.dia = function (iso) { var p = P.d10(iso).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  P.somaDias = function (iso, n) { var d = P.dia(iso); d.setDate(d.getDate() + n); return P.iso(d); };
  P.difDias = function (a, b) { return Math.round((P.dia(b) - P.dia(a)) / 864e5); };
  /* o vencimento no mês: o dia escolhido (1 a 31) ou o último dia do mês, se o mês for mais curto */
  P.vencDe = function (mes, dia) {
    var d = P.dia(mes), ult = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    return P.mesIni(mes).slice(0, 8) + P.two(Math.min(dia || 10, ult));
  };
  P.mesIni = function (iso) { return P.d10(iso).slice(0, 7) + "-01"; };
  P.somaMes = function (mes, n) { var d = P.dia(mes); d.setMonth(d.getMonth() + n, 1); return P.iso(d); };
  P.hm = function (ts) { var d = new Date(ts); return P.two(d.getHours()) + ":" + P.two(d.getMinutes()); };
  P.agoraMin = function () { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  P.mins = function (t) { var p = String(t).split(":"); return +p[0] * 60 + +p[1]; };
  P.dataBR = function (iso) { var p = P.d10(iso).split("-"); return p[2] + "/" + p[1]; };
  P.dataBRano = function (iso) { var p = P.d10(iso).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  var MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  P.MESES = MESES;
  P.mesNome = function (mes) { var d = P.dia(mes); return MESES[d.getMonth()] + " de " + d.getFullYear(); };
  P.mesCurto = function (mes) { var d = P.dia(mes); return MESES[d.getMonth()].slice(0, 3) + "/" + String(d.getFullYear()).slice(2); };
  P.quando = function (iso) {
    if (!iso) return "nunca";
    var d = P.difDias(iso, P.hoje());
    return d <= 0 ? "hoje" : d === 1 ? "ontem" : d < 7 ? Site.DIAS[P.dia(iso).getDay()].toLowerCase() : "há " + d + " dias";
  };
  P.brl = function (v) { v = Number(v) || 0; return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
  /* "1.234,56", "150,00", "12.000" e "1.250" viram número; "12.5" continua 12,5 */
  P.num = function (t) {
    var s = String(t || "").replace(/[^\d,.-]/g, "");
    if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    var v = parseFloat(s);
    return isFinite(v) ? v : NaN;
  };
  /* um formulário que já está salvando não envia de novo (Enter duas vezes, toque duplo) */
  document.addEventListener("submit", function (e) {
    var b = e.target.querySelector('[type="submit"]');
    if (b && (b.disabled || b.classList.contains("loading"))) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  /* ---------- faixas e turmas ---------- */
  /* as faixas vêm de Site (site.js): as do adulto e as do Kids, com listra branca, lisa e com listra preta */
  P.FX_AD = Site.FX_AD;
  P.FX_KD = Site.FX_KD;
  P.FAIXAS = {};
  P.FX_KD.concat(P.FX_AD).forEach(function (f) { P.FAIXAS[f] = Site.faixaNome(f); });
  P.beltTxt = function (f, g) { return (P.FAIXAS[f] || Site.faixaNome(f)) + " · " + (g ? g + (g === 1 ? " grau" : " graus") : "sem grau"); };
  /* faixa pequena com os graus nas cores certas (Kids: brancos, vermelhos e da próxima faixa) */
  P.belt = function (f, g, turma) { return '<span class="bl">' + Site.miniFaixa(f, g, turma ? P.kid(turma) : undefined) + "<span>" + P.beltTxt(f, g) + "</span></span>"; };
  /* aulas feitas antes do app: somam no total e também em "desde o último grau", a não ser que o último grau
     seja NOVO (dado depois de lançadas essas aulas). Grau marcado "já tinha antes do app" nunca zera a conta.
     g: a última graduação (objeto) ou só a data dela */
  /* As aulas de antes do app são o total feito no Studio; cada grau "custa" 50 aulas (regra do Studio).
     Quem tem 1 grau e 61 aulas no Studio tem 61 - 50 = 11 desde o último grau. */
  P.AULAS_GRAU = 50;
  P.antes = function (a, g) {
    var n = (a && a.aulas_antes) || 0;
    if (!n) return 0;
    var graus = g && typeof g === "object" ? (g.graus || 0) : (a.graus || 0);
    if (g && typeof g === "object") {
      if (!P.doCadastro(g) && a.aulas_antes_ate && g.data > a.aulas_antes_ate) return 0;
      return Math.max(0, n - P.AULAS_GRAU * graus);
    }
    return !g || !a.aulas_antes_ate || g <= a.aulas_antes_ate ? Math.max(0, n - P.AULAS_GRAU * graus) : 0;
  };
  /* as aulas de antes do app ficaram fora de "desde o último grau" por causa de um grau registrado depois */
  /* o aviso "aulas de antes fora" foi desligado a pedido do professor (os graus registrados depois foram promoções
     de verdade). Para um caso de cadastro, a correção é em Editar dados (faixa e graus) */
  P.AVISO_ANTES_FORA = false;
  P.antesFora = function (a, g) {
    if (!P.AVISO_ANTES_FORA) return false;
    /* só no começo (até 30 dias depois de lançadas as aulas de antes), quando um grau antigo pode ter sido registrado
       como novo; depois disso, um grau novo é promoção de verdade e zerar a conta é o certo */
    return !!(a && a.aulas_antes > 0 && g && !P.doCadastro(g) && a.aulas_antes_ate && g.data > a.aulas_antes_ate && g.data <= P.somaDias(a.aulas_antes_ate, 30));
  };
  P.TURMAS = { adulto: "Adulto", feminino: "Feminino", kids1: "Kids 1", kids2: "Kids 2" };
  /* a turma na grade (Site.GRADE): o Feminino treina junto com o Adulto */
  P.GRADE_TURMA = { adulto: "Adulto", feminino: "Adulto", kids1: "Kids 1", kids2: "Kids 2" };
  /* os horários de cada turma vêm da grade (Configurações → Aulas e horários); o Feminino treina com o Adulto */
  P.horasDa = function (t) {
    var n = { adulto: "Adulto", feminino: "Adulto", kids1: "Kids 1", kids2: "Kids 2" }[t], h = {};
    Site.GRADE.forEach(function (c) { if (c.n === n) h[c.t] = 1; });
    return Object.keys(h).sort();
  };
  P.kid = function (t) { return /^kids/.test(t); };
  /* idade mínima da IBJJF para a faixa kids (cinza 4, amarela 7, laranja 10, verde 13): a mensagem, ou "" se está ok ou sem nascimento */
  P.avisoIdade = function (faixa, nascimento) {
    var min = Site.IDADE_MIN[Site.faixaBase(faixa)];
    if (!min || !nascimento) return "";
    var idade = Math.floor(P.difDias(nascimento, P.hoje()) / 365.25);
    return idade < min ? "Pela IBJJF, a faixa " + P.FAIXAS[faixa].toLowerCase() + " é a partir de " + min + " anos, e o aluno tem " + idade + ". Registrar assim mesmo?" : "";
  };
  P.turmaTx = function (a) { return (P.TURMAS[a.turma] || a.turma) + (a.horario ? " " + Site.hora(a.horario) : ""); };
  /* a turma da aula no banco (chamadas e presenças) a partir do nome na grade */
  P.turmaAula = function (n) { return n === "Kids 1" ? "kids1" : n === "Kids 2" ? "kids2" : n === "Open Mat" ? "openmat" : "adulto"; };

  /* ---------- WhatsApp ---------- */
  P.digitos = function (t) { return String(t || "").replace(/\D/g, ""); };
  P.fone = function (d) {
    d = P.digitos(d).replace(/^55(?=\d{10,11}$)/, "");
    return d.length === 11 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7) : d.length === 10 ? "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6) : d;
  };
  /* guarda só dígitos, com DDD (10 ou 11); o banco aceita de 10 a 13 */
  P.foneBanco = function (t) { var d = P.digitos(t); if (d.length === 12 || d.length === 13) d = d.replace(/^55/, ""); return d.length === 10 || d.length === 11 ? d : null; };
  P.wa = function (fone, texto) {
    var d = P.digitos(fone);
    if (d.length === 10 || d.length === 11) d = "55" + d;
    window.open("https://wa.me/" + d + "?text=" + encodeURIComponent(texto), "_blank", "noopener");
  };

  /* ---------- aviso ---------- */
  var toastEl = $("#dashToast"), toastT = null;
  P.toast = function (msg) {
    $("span", toastEl).textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { toastEl.classList.remove("on"); }, Math.max(3400, 55 * msg.length));
  };
  ["mouseenter", "focusin"].forEach(function (ev) { toastEl.addEventListener(ev, function () { clearTimeout(toastT); }); });
  ["mouseleave", "focusout"].forEach(function (ev) { toastEl.addEventListener(ev, function () { if (toastEl.classList.contains("on")) toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 2400); }); });

  /* ---------- banco ---------- */
  P.db = Acesso.cliente();
  /* fotos dos alunos: troca as iniciais pela foto em qualquer lista do painel */
  if (window.Fotos && Acesso.real) Fotos.liga(P.db);
  /* uma consulta: devolve os dados ou falha com a mensagem do banco */
  /* o banco ainda não tem a coluna (migração pendente): PostgREST responde PGRST204 */
  P.semColuna = function (e) { return !!e && (/PGRST204/.test(e.code || "") || /column .* does not exist|schema cache/i.test(e.message || "")); };
  P.q = function (fn) {
    return P.db.then(fn).then(function (r) { if (r && r.error) throw r.error; return r ? r.data : null; });
  };
  /* consulta longa: busca de 1000 em 1000 (o limite de cada resposta do Supabase) */
  P.todos = function (fn) {
    var tudo = [];
    function pag(i) {
      return P.q(function (sb) { return fn(sb).range(i, i + 999); }).then(function (l) {
        tudo = tudo.concat(l || []);
        return l && l.length === 1000 ? pag(i + 1000) : tudo;
      });
    }
    return pag(0);
  };
  /* o SQL de 03/11 (faixas do Kids, aulas antes do app, reserva em 48 h e ranking no app) */
  /* o SQL mais novo que o painel precisa (o plano família); os anteriores já foram rodados */
  P.SQL_ATUALIZA = "https://raw.githubusercontent.com/admopusdigital-lab/studio-evolution-bjj/main/supabase/migrations/20261124120000_equipe_gestao.sql";
  P.faltaAtualizar = function (e) { var m = (e && (e.message || "")) + " " + (e && e.code || ""); return /aulas_antes|responsavel_conta|faixa_check|42703|42P01|PGRST205|ranking_frequencia|produtos|cobrancas|pedidos_loja|vender_produto|foto|tecnicas|vencimento_check|produtos_foto|Bucket not found|permissoes|perfis_papel_check/.test(m); };
  P.avisoBanco = function () {
    var el = $("#dbAviso");
    if (!el || !el.hidden) return;
    el.innerHTML = "<b>Falta atualizar o banco de dados.</b>Sem isso não dá para usar o Estoque, a loja do app e os outros valores do aluno (taxa de matrícula, produto, valor avulso). " +
      'Abra o Supabase → SQL Editor → New query, cole <a href="' + P.SQL_ATUALIZA + '" target="_blank" rel="noopener">este arquivo</a> inteiro e clique em Run. Depois, recarregue esta página.';
    el.hidden = false;
  };
  P.erro = function (e, oQue) {
    if (P.faltaAtualizar(e)) { P.avisoBanco(); P.toast("O banco ainda não foi atualizado. Veja o aviso no topo do painel."); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    var m = e && e.message ? e.message : "";
    var rede = !e || /fetch|network|Failed/i.test(m);
    P.toast((oQue || "Não deu para salvar") + (rede ? ". Confira a internet e tente de novo." : ": " + m));
    if (window.console) console.warn(e);
  };

  /* ---------- quem está usando ---------- */
  var ses = Acesso.sessao();
  if (ses && ses.nome) {
    $("#whoAv").textContent = P.ini(ses.nome);
    $("#whoNome").innerHTML = P.esc(ses.nome) + "<br><small>" + (ses.papel === "gestao" ? "Equipe" : "Professor") + " · Studio Evolution</small>";
  }

  /* ---------- quem pode o quê: o professor vê tudo; o usuário de gestão, só as áreas que o professor liberou.
     A regra de verdade está no banco (privado.pode); aqui o painel só mostra as abas certas ---------- */
  P.papel = (ses && ses.papel) || "professor";
  P.permissoes = [];
  P.AREAS = [["hoje", "Hoje e Modo tatame"], ["alunos", "Alunos"], ["graduacoes", "Graduações"], ["ranking", "Ranking"], ["movimentos", "Movimentos"],
    ["interessados", "Interessados"], ["financeiro", "Financeiro"], ["estoque", "Estoque e loja"], ["configuracoes", "Configurações"]];
  var AREA_ABA = { hoje: "hoje", tatame: "hoje", alunos: "alunos", grad: "graduacoes", rank: "ranking", mov: "movimentos", leads: "interessados", fin: "financeiro", estoque: "estoque", config: "configuracoes", equipe: "dono" };
  P.ehDono = function () { return P.papel !== "gestao"; };
  P.pode = function (area) { if (P.ehDono()) return true; return area !== "dono" && P.permissoes.indexOf(area) >= 0; };
  P.podeAba = function (aba) { var ar = AREA_ABA[aba]; return !ar || P.pode(ar); };

  /* ---------- tema (o botão do topo) ---------- */
  var pnLook = $("#pnLook");
  function pnPaint() { pnLook.textContent = document.documentElement.getAttribute("data-look") === "black" ? "Versão clara" : "Versão black"; }
  pnPaint();
  new MutationObserver(pnPaint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-look"] });
  pnLook.addEventListener("click", function () { Site.paintLook(document.documentElement.getAttribute("data-look") === "black" ? "light" : "black"); });
  /* Sair: o portão do acesso.js cuida dos links [data-sair] */

  /* ---------- abas ---------- */
  var views = $$(".dv"), side = $$(".dash-side button[data-go]"), cur = "hoje", aoAbrir = {};
  P.aoAbrir = function (nome, fn) { (aoAbrir[nome] = aoAbrir[nome] || []).push(fn); };
  P.atual = function () { return cur; };
  /* esconde as abas que a pessoa não pode ver (e o link de Acessos, que é só do professor) */
  function aplicaPermissoes() {
    side.forEach(function (b) { b.hidden = !P.podeAba(b.dataset.go); });
    var ac = $('.pn-nav a[href="acessos.html"], a[href="acessos.html"]');
    if (ac) ac.hidden = !P.ehDono();
  }
  aplicaPermissoes();
  P.carregarPermissoes = function () {
    if (P.ehDono()) return Promise.resolve();
    return P.db.then(function (sb) {
      return sb.auth.getUser().then(function (u) {
        var id = u && u.data && u.data.user && u.data.user.id;
        return id ? sb.from("perfis").select("papel, permissoes").eq("id", id).maybeSingle() : { data: null };
      });
    }).then(function (r) {
      var p = r && r.data;
      if (p && p.papel === "professor") P.papel = "professor";
      P.permissoes = (p && p.permissoes) || [];
      aplicaPermissoes();
    }).catch(function () { aplicaPermissoes(); });
  };
  P.go = function (nome, foco) {
    /* aba sem permissão: vai para a primeira liberada */
    if (!P.podeAba(nome)) {
      var livre = side.filter(function (b) { return P.podeAba(b.dataset.go); })[0];
      if (!livre) { P.semAreas(); return; }
      nome = livre.dataset.go;
    }
    P.fecharFicha();
    cur = nome;
    views.forEach(function (v) { v.classList.toggle("on", v.dataset.v === nome); });
    side.forEach(function (b) { b.setAttribute("aria-current", b.dataset.go === nome ? "true" : "false"); });
    try { sessionStorage.setItem("evo-painel-aba", nome); } catch (e) {}
    (aoAbrir[nome] || []).forEach(function (fn) { fn(); });
    var v = $('.dv[data-v="' + nome + '"]');
    if (window.scrollY > 60) window.scrollTo({ top: 0, behavior: "auto" });
    if (foco) focusSoft($("h3", v), { preventScroll: true });
    var b = side.filter(function (x) { return x.dataset.go === nome; })[0], box = $(".dash-side");
    if (b && box.scrollWidth > box.clientWidth + 1) box.scrollTo({ left: b.offsetLeft - 16, behavior: Site.reduce ? "auto" : "smooth" });
  };
  side.forEach(function (b) { b.addEventListener("click", function () { P.go(b.dataset.go); }); });
  /* atalhos (KPIs): levam à aba, com o filtro certo */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-goto]");
    if (!b) return;
    if (b.dataset.chip && P.filtroAlunos) P.filtroAlunos(b.dataset.chip);
    P.go(b.dataset.goto, true);
  });
  P.selo = function (id, n) { var el = $("#" + id); el.textContent = n; el.hidden = !n; };

  /* ---------- a ficha (gaveta à direita) ---------- */
  var drawer = $("#drawer"), scrim = $("#drScrim"), voltaFoco = null;
  P.abrirFicha = function (html, titulo) {
    if (!drawer.classList.contains("on")) voltaFoco = document.activeElement;
    /* cada ficha põe o próprio onclick; o da ficha anterior sai */
    drawer.onclick = null;
    /* cada ficha aberta ganha um número: a resposta que chega depois de trocar de ficha é descartada */
    P.fichaN = (P.fichaN || 0) + 1;
    drawer.innerHTML = '<div class="dr-top"><div><h4 id="drName" tabindex="-1">' + P.esc(titulo) + '</h4><p id="drSub"></p></div><button class="dr-x" type="button" data-dr-x aria-label="Fechar"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></button></div><div class="dr-body">' + html + "</div>";
    drawer.scrollTop = 0;
    drawer.classList.add("on"); scrim.classList.add("on");
    document.body.style.overflow = "hidden";
    focusSoft($("#drName"), { preventScroll: true });
    return drawer;
  };
  /* quem precisa saber que a ficha fechou (o Financeiro recarrega o que foi pago pela ficha) */
  var aoFechar = [];
  P.aoFecharFicha = function (fn) { aoFechar.push(fn); };
  P.fecharFicha = function () {
    if (!drawer.classList.contains("on")) return;
    P.fichaN = (P.fichaN || 0) + 1;
    drawer.classList.remove("on"); scrim.classList.remove("on");
    aoFechar.forEach(function (fn) { try { fn(cur); } catch (e) {} });
    document.body.style.overflow = "";
    if (voltaFoco && document.contains(voltaFoco)) focusSoft(voltaFoco, { preventScroll: true });
    voltaFoco = null;
  };
  P.ficha = drawer;
  scrim.addEventListener("click", P.fecharFicha);
  drawer.addEventListener("click", function (e) { if (e.target.closest("[data-dr-x]")) P.fecharFicha(); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && drawer.classList.contains("on")) P.fecharFicha(); });

  /* ---------- formulários ---------- */
  P.erroForm = function (form, el, msg) {
    $$("[aria-invalid]", form).forEach(function (f) { f.removeAttribute("aria-invalid"); });
    var e = $(".crm-err", form);
    if (e) e.textContent = msg || "";
    if (el) { el.setAttribute("aria-invalid", "true"); focusSoft(el, { preventScroll: false }); }
    return false;
  };
  P.aparece = function (el) { if (anim && el && !el.hidden) gsap.from(el, { opacity: 0, y: 8, duration: 0.45, ease: "power2.out", clearProps: "opacity,transform" }); };
  P.mostra = function (el) { if (el) el.scrollIntoView({ block: "nearest", behavior: Site.reduce ? "auto" : "smooth" }); };

  /* ---------- os alunos: um cadastro só, lido uma vez e usado por todas as abas ---------- */
  P.alunos = [];
  P.porId = {};
  var ouvintes = [];
  P.aoMudarAlunos = function (fn) { ouvintes.push(fn); };
  P.carregarAlunos = function () {
    return P.todos(function (sb) { return sb.from("alunos").select("*").order("nome"); }).then(function (l) {
      P.alunos = l;
      P.porId = {};
      l.forEach(function (a) { P.porId[a.id] = a; });
      ouvintes.forEach(function (fn) { fn(); });
      return l;
    });
  };
  /* presenças do último ano (para a última aula, o mês, a frequência e as aulas desde o grau) */
  P.pres = [];
  P.carregarPresencas = function () {
    var desde = P.somaDias(P.hoje(), -370);
    return P.todos(function (sb) { return sb.from("presencas").select("id, aluno, data, hora, turma, como, chegou_em").gte("data", desde).order("data", { ascending: false }); })
      .then(function (l) { P.pres = l; return l; });
  };
  P.ultima = function (id) { for (var i = 0; i < P.pres.length; i++) if (P.pres[i].aluno === id) return P.pres[i].data; return null; };
  P.noMes = function (id, mes) { mes = mes || P.mesIni(P.hoje()); return P.pres.filter(function (p) { return p.aluno === id && P.mesIni(p.data) === mes; }).length; };
  /* sumido: ativo, sem treinar há 14 dias ou mais (quem começou há menos de 14 dias não conta) */
  P.sumido = function (a) {
    if (!a.ativo) return false;
    var u = P.ultima(a.id), base = u || a.inicio;
    return P.difDias(base, P.hoje()) >= 14;
  };
  /* aniversário: em quantos dias é o próximo (0 = hoje) e a idade que a pessoa completa; 29/02 vira 28/02 nos anos comuns */
  P.aniversario = function (a) {
    if (!a || !a.nascimento) return null;
    var n = String(a.nascimento).split("-"), h = P.dia(P.hoje()), ano = h.getFullYear();
    function data(y) { var d = new Date(y, +n[1] - 1, +n[2]); if (d.getMonth() !== +n[1] - 1) d = new Date(y, +n[1] - 1, 28); return d; }
    var prox = data(ano);
    if (prox < h) { prox = data(ano + 1); }
    return { dias: Math.round((prox - h) / 864e5), idade: prox.getFullYear() - +n[0], data: prox };
  };
  /* o grau lançado no cadastro é o que o aluno JÁ TINHA (dado antes, pelo professor, depois de avaliar), não graduação nova */
  P.NOTA_CADASTRO = "Grau que já tinha antes do app";
  P.doCadastro = function (g) { return !!(g && g.nota && /ao entrar no Studio|antes do app/i.test(g.nota)); };
  P.notaGrau = function (g) { return P.doCadastro(g) ? "já tinha antes do app" : (g && g.nota) || ""; };
  P.ativos = function () { return P.alunos.filter(function (a) { return a.ativo; }); };
  /* o professor (Tiago Dias Camargo) pode ter cadastro de aluno para marcar presença: fica fora do ranking e
     das listas de graduação. Vale a conta de professor ligada ao cadastro ou o nome */
  P.contasProf = {};
  P.ehProfessor = function (a) {
    if (!a) return false;
    if (a.conta && P.contasProf[a.conta]) return true;
    var n = String(a.nome || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
    return n === "tiago dias camargo";
  };
  P.alunosDeVerdade = function () { return P.ativos().filter(function (a) { return !P.ehProfessor(a); }); };

  /* ---------- volta para a aba em que estava ---------- */
  var aba = null;
  try { aba = sessionStorage.getItem("evo-painel-aba"); } catch (e) {}
  /* usuário de gestão sem nenhuma área liberada */
  P.semAreas = function () {
    views.forEach(function (v) { v.classList.remove("on"); });
    var m = $(".dash-main"), av = $("#semAreas");
    if (!av) { av = document.createElement("div"); av.id = "semAreas"; av.className = "empty-big"; m.appendChild(av); }
    av.innerHTML = "<b>Ainda sem áreas liberadas.</b>Peça ao professor para marcar, na aba Equipe, o que você pode ver no painel.";
  };
  P.iniciar = function () {
    P.db.then(function (sb) { return sb.from("perfis").select("id").eq("papel", "professor"); }).then(function (r) {
      (r && r.data || []).forEach(function (x) { P.contasProf[x.id] = true; });
    }).catch(function () {});
    /* o banco já recebeu a atualização de 03/11? (a coluna aulas_antes existe) */
    P.db.then(function (sb) { return Promise.all([sb.from("alunos").select("aulas_antes, responsavel_conta, foto").limit(1), sb.from("tecnicas_semana").select("id").limit(1)]); })
      .then(function (rs) { if (rs.some(function (r) { return r && r.error && P.faltaAtualizar(r.error); })) P.avisoBanco(); }).catch(function () {});
    return P.carregarPermissoes().then(function () { return Promise.all([P.carregarAlunos(), P.carregarPresencas()]); }).catch(function (e) { P.erro(e, "Não deu para carregar os dados"); })
      .then(function () { P.go(aba && $('.dv[data-v="' + aba + '"]') ? aba : "hoje"); });
  };
  /* os outros arquivos registram as abas; o início roda depois de todos carregarem */
  window.addEventListener("load", function () { P.iniciar(); });
})();
