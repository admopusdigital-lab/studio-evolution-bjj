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
  P.dia = function (iso) { var p = String(iso).slice(0, 10).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
  P.somaDias = function (iso, n) { var d = P.dia(iso); d.setDate(d.getDate() + n); return P.iso(d); };
  P.difDias = function (a, b) { return Math.round((P.dia(b) - P.dia(a)) / 864e5); };
  P.mesIni = function (iso) { return String(iso).slice(0, 7) + "-01"; };
  P.somaMes = function (mes, n) { var d = P.dia(mes); d.setMonth(d.getMonth() + n, 1); return P.iso(d); };
  P.hm = function (ts) { var d = new Date(ts); return P.two(d.getHours()) + ":" + P.two(d.getMinutes()); };
  P.agoraMin = function () { var d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  P.mins = function (t) { var p = String(t).split(":"); return +p[0] * 60 + +p[1]; };
  P.dataBR = function (iso) { var p = String(iso).slice(0, 10).split("-"); return p[2] + "/" + p[1]; };
  P.dataBRano = function (iso) { var p = String(iso).slice(0, 10).split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
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
  P.num = function (t) { var s = String(t || "").replace(/[^\d,.-]/g, ""); if (s.indexOf(",") >= 0) s = s.replace(/\./g, "").replace(",", "."); var v = parseFloat(s); return isFinite(v) ? v : NaN; };

  /* ---------- faixas e turmas ---------- */
  P.FAIXAS = { branca: "Branca", cinza: "Cinza", amarela: "Amarela", laranja: "Laranja", verde: "Verde", azul: "Azul", roxa: "Roxa", marrom: "Marrom", preta: "Preta" };
  P.FX_AD = ["branca", "azul", "roxa", "marrom", "preta"];
  P.FX_KD = ["branca", "cinza", "amarela", "laranja", "verde"];
  P.beltTxt = function (f, g) { return (P.FAIXAS[f] || f) + " · " + (g ? g + (g === 1 ? " grau" : " graus") : "sem grau"); };
  P.belt = function (f, g) { return '<span class="bl"><i class="belt-s" style="--b:var(--b-' + f + ')"></i><span>' + P.beltTxt(f, g) + "</span></span>"; };
  P.TURMAS = { adulto: "Adulto", feminino: "Feminino", kids1: "Kids 1", kids2: "Kids 2" };
  /* a turma na grade (Site.GRADE): o Feminino treina junto com o Adulto */
  P.GRADE_TURMA = { adulto: "Adulto", feminino: "Adulto", kids1: "Kids 1", kids2: "Kids 2" };
  P.HORAS = { adulto: ["08:00", "11:00", "19:00", "20:30"], feminino: ["08:00", "11:00", "19:00", "20:30"], kids1: ["09:00", "18:00"], kids2: ["09:00", "18:00"] };
  P.kid = function (t) { return /^kids/.test(t); };
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
  /* uma consulta: devolve os dados ou falha com a mensagem do banco */
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
  P.erro = function (e, oQue) {
    var m = e && e.message ? e.message : "";
    var rede = !e || /fetch|network|Failed/i.test(m);
    P.toast((oQue || "Não deu para salvar") + (rede ? ". Confira a internet e tente de novo." : ": " + m));
    if (window.console) console.warn(e);
  };

  /* ---------- quem está usando ---------- */
  var ses = Acesso.sessao();
  if (ses && ses.nome) {
    $("#whoAv").textContent = P.ini(ses.nome);
    $("#whoNome").innerHTML = P.esc(ses.nome) + "<br><small>Professor · Studio Evolution</small>";
  }

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
  P.go = function (nome, foco) {
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
    drawer.innerHTML = '<div class="dr-top"><div><h4 id="drName" tabindex="-1">' + P.esc(titulo) + '</h4><p id="drSub"></p></div><button class="dr-x" type="button" data-dr-x aria-label="Fechar"><svg class="ic" aria-hidden="true" focusable="false"><use href="#i-x"/></svg></button></div><div class="dr-body">' + html + "</div>";
    drawer.scrollTop = 0;
    drawer.classList.add("on"); scrim.classList.add("on");
    document.body.style.overflow = "hidden";
    focusSoft($("#drName"), { preventScroll: true });
    return drawer;
  };
  P.fecharFicha = function () {
    if (!drawer.classList.contains("on")) return;
    drawer.classList.remove("on"); scrim.classList.remove("on");
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
  P.ativos = function () { return P.alunos.filter(function (a) { return a.ativo; }); };

  /* ---------- volta para a aba em que estava ---------- */
  var aba = null;
  try { aba = sessionStorage.getItem("evo-painel-aba"); } catch (e) {}
  P.iniciar = function () {
    return Promise.all([P.carregarAlunos(), P.carregarPresencas()]).catch(function (e) { P.erro(e, "Não deu para carregar os dados"); })
      .then(function () { P.go(aba && $('.dv[data-v="' + aba + '"]') ? aba : "hoje"); });
  };
  /* os outros arquivos registram as abas; o início roda depois de todos carregarem */
  window.addEventListener("load", function () { P.iniciar(); });
})();
