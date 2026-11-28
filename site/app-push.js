/* App · Avisos do Studio neste aparelho.
   1) Ajustes: o aluno liga, testa e desliga os avisos. O navegador cria a inscrição (com a chave pública que a função
      "push" entrega) e o banco guarda pela função push_inscrever. Quem envia é o professor, pelo painel.
   2) O pedido: quem ainda não tem os avisos ativos vê, ao abrir o app, uma folha pedindo para ativar (com a prévia de
      como o recado chega). "Agora não" adia por 3 dias. A permissão do sistema só é pedida depois do toque em "Ativar".
   No iPhone os avisos só funcionam com o app na Tela de Início: lá, o pedido ensina a instalar. */
(function () {
  "use strict";
  var antes = document.getElementById("apSenha");
  if (!antes || !window.Acesso || !Acesso.real || !Acesso.sessao()) return;
  var iphone = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var instalado = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  var ADIA = "evo-pede-avisos", DIAS = 3;

  var box = document.createElement("div");
  box.className = "ap-push"; box.id = "apPush";
  box.innerHTML = '<div class="ap-row"><span>Avisos neste aparelho</span><span class="r" id="apPushSt"></span></div>' +
    '<p class="ap-push-t" id="apPushT"></p>' +
    '<div class="ap-push-b"><button type="button" class="ap-btn" id="apPushOn" hidden>Ativar os avisos</button>' +
    '<button type="button" class="ap-btn ghost" id="apPushTeste" hidden>Enviar um teste</button>' +
    '<button type="button" class="ap-link" id="apPushOff" hidden>Desativar neste aparelho</button></div>';
  antes.parentNode.insertBefore(box, antes);
  var st = box.querySelector("#apPushSt"), tx = box.querySelector("#apPushT"), bOn = box.querySelector("#apPushOn"), bT = box.querySelector("#apPushTeste"), bOff = box.querySelector("#apPushOff");
  var sub = null, ocupado = false;

  function pinta(msg) {
    var negado = suporta && Notification.permission === "denied";
    st.textContent = sub ? "ativados" : "desativados"; st.className = "r" + (sub ? " ok" : "");
    bOn.hidden = !!sub || !suporta || negado; bT.hidden = bOff.hidden = !sub;
    bOn.disabled = bT.disabled = bOff.disabled = ocupado;
    tx.textContent = msg || (!suporta ? (iphone && !instalado ? "No iPhone, primeiro coloque o app na Tela de Início: no Safari, toque em Compartilhar e em Adicionar à Tela de Início. Depois abra o app por lá e volte aqui." : "Este navegador não recebe avisos. Use o Chrome (Android) ou o app na Tela de Início (iPhone).")
      : negado ? "Os avisos estão bloqueados para este app. Libere nos ajustes do aparelho (ou do navegador) e volte aqui."
      : sub ? "Você recebe os avisos do Studio neste aparelho." : "Receba os avisos do Studio: recados do professor, mudança de horário e eventos.");
    try { document.dispatchEvent(new CustomEvent("evo-push")); } catch (e) {}
  }
  function b64(s) { var p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function erroDe(r) {
    var ctx = r.error && r.error.context, s = ctx && ctx.status;
    if (s === 404) return Promise.resolve("Os avisos ainda não foram ativados pelo Studio.");
    var le = ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
    return le.then(function (b) { return (b && b.erro) || "Não deu para falar com o servidor. Confira a internet e tente de novo."; });
  }
  function aparelho() { var u = navigator.userAgent; return /Android/.test(u) ? "Android" : iphone ? "iPhone" : "Computador"; }
  function reg() { return navigator.serviceWorker.ready; }

  /* devolve { ok, msg }: os Ajustes e a folha do pedido usam o mesmo caminho */
  function ativar() {
    ocupado = true; pinta("Ativando…");
    var db;
    return Acesso.cliente().then(function (c) { db = c; return db.functions.invoke("push", { body: { acao: "chave" } }); }).then(function (r) {
      if (r.error || !r.data || !r.data.publica) return erroDe(r).then(function (m) { throw new Error(m); });
      var chave = r.data.publica;
      return Notification.requestPermission().then(function (p) {
        if (p !== "granted") throw new Error(p === "denied" ? "Os avisos ficaram bloqueados. Para liberar, abra os ajustes do aparelho." : "Você precisa permitir os avisos para ativar.");
        return reg();
      }).then(function (g) { return g.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(chave) }); });
    }).then(function (s) {
      var j = s.toJSON();
      return db.rpc("push_inscrever", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparelho: aparelho() }).then(function (r) {
        if (r.error) { s.unsubscribe().catch(function () {}); throw new Error("Os avisos ainda não foram ativados pelo Studio."); }
        sub = s;
      });
    }).then(function () { ocupado = false; pinta("Pronto. Toque em Enviar um teste para ver chegar."); return { ok: true }; },
      function (e) { ocupado = false; var m = (e && e.message) || "Não deu para ativar agora. Tente de novo."; pinta(m); return { ok: false, msg: m }; });
  }
  function desativar() {
    if (!sub) return;
    ocupado = true; pinta();
    var s = sub, fim = function () { sub = null; ocupado = false; pinta("Avisos desativados neste aparelho."); };
    Acesso.cliente().then(function (c) { return c.rpc("push_sair", { p_endpoint: s.endpoint }); }).then(function () { return s.unsubscribe(); }).then(fim, fim);
  }
  function teste() {
    ocupado = true; pinta("Enviando o teste…");
    Acesso.cliente().then(function (c) { return c.functions.invoke("push", { body: { acao: "teste" } }); }).then(function (r) {
      if (r.error) return erroDe(r).then(function (m) { ocupado = false; pinta(m); });
      ocupado = false; pinta(r.data && r.data.aparelhos ? "Teste enviado. Ele chega em alguns segundos." : "O teste não saiu. Desative e ative de novo neste aparelho.");
    }, function () { ocupado = false; pinta("Não deu para enviar o teste. Confira a internet."); });
  }
  bOn.addEventListener("click", ativar); bOff.addEventListener("click", desativar); bT.addEventListener("click", teste);

  /* "ativo" | "pode" (dá para ativar agora) | "instalar" (iPhone fora da Tela de Início) | "bloqueado" | "sem-suporte" */
  function estado() {
    if (!suporta) return Promise.resolve(iphone && !instalado ? "instalar" : "sem-suporte");
    if (Notification.permission === "denied") return Promise.resolve("bloqueado");
    if (sub) return Promise.resolve("ativo");
    var prazo = new Promise(function (ok) { setTimeout(function () { ok("pode"); }, 2500); });
    return Promise.race([prazo, reg().then(function (g) { return g.pushManager.getSubscription(); }).then(function (s) { return s ? "ativo" : "pode"; }, function () { return "pode"; })]);
  }

  /* ---------- o pedido ---------- */
  var ap = document.getElementById("ap"), folha = null, aberto = false;
  var SINO = '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-bell"/></svg>';
  function adiado() {
    try { var t = +localStorage.getItem(ADIA) || 0; return t && Date.now() - t < DIAS * 864e5; } catch (e) { return false; }
  }
  function fecha(adia) {
    if (!aberto) return;
    aberto = false; folha.hidden = true;
    if (adia) { try { localStorage.setItem(ADIA, String(Date.now())); } catch (e) {} }
    if (window.EvoApp) EvoApp.modal(false);
  }
  function monta(modo) {
    if (!folha) {
      folha = document.createElement("div");
      folha.className = "ap-pede"; folha.id = "apPede"; folha.hidden = true;
      folha.setAttribute("role", "dialog"); folha.setAttribute("aria-modal", "true"); folha.setAttribute("aria-labelledby", "apPedeT");
      ap.appendChild(folha);
      folha.addEventListener("click", function (e) {
        var b = e.target.closest("button");
        if (!b) return;
        if (b.id === "apPedeX") return fecha(true);
        if (b.id === "apPedeOk") return fecha(true);
        if (b.id === "apPedeOn") {
          var err = folha.querySelector(".ap-pede-e");
          b.classList.add("loading"); err.textContent = "";
          ativar().then(function (r) {
            b.classList.remove("loading");
            if (!r.ok) { err.textContent = r.msg; return; }
            folha.classList.add("ok");
            folha.querySelector("#apPedeT").textContent = "Avisos ativados";
            folha.querySelector(".ap-pede-s").textContent = "Pronto. Os recados do Studio chegam neste aparelho.";
            folha.querySelector(".ap-pede-i").innerHTML = '<svg class="ic" aria-hidden="true" focusable="false"><use href="#i-check"/></svg>';
            b.hidden = true; folha.querySelector("#apPedeX").textContent = "Fechar";
            setTimeout(function () { fecha(false); }, 1800);
          });
        }
      });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && aberto) fecha(true); });
    }
    var nome = window.EvoApp ? EvoApp.nome() : "", hora = window.EvoApp ? EvoApp.aula() : "";
    var previa = (nome ? nome + ", s" : "S") + "ua aula é hoje" + (hora ? " às " + hora : "") + ". Te esperamos no tatame.";
    folha.classList.remove("ok");
    folha.innerHTML = '<div class="ap-pede-in"><span class="ap-pede-i" aria-hidden="true">' + SINO + '</span><p class="ap-lb gold">Avisos do Studio</p>' +
      (modo === "instalar"
        ? '<h2 class="ap-hi" id="apPedeT" tabindex="-1">Instale o app para receber avisos</h2><p class="ap-pede-s">No iPhone, os recados do professor só chegam com o app na Tela de Início. Leva 10 segundos.</p>' +
          '<ol class="ap-pede-p"><li>No Safari, toque em <b>Compartilhar</b>.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li><li>Abra o app pelo ícone e ative os avisos.</li></ol>' +
          '<p class="ap-pede-e" role="alert"></p><button class="ap-btn" type="button" id="apPedeOk">Entendi</button>'
        : '<h2 class="ap-hi" id="apPedeT" tabindex="-1">Ative os avisos</h2><p class="ap-pede-s">Recados do professor, lembrete da aula e novidades do Studio chegam direto no seu celular. Dá para desligar quando quiser.</p>' +
          '<div class="ap-pede-n" aria-hidden="true"><span class="ico"></span><div><b>Studio Evolution BJJ</b><span></span></div><small>agora</small></div>' +
          '<p class="ap-pede-e" role="alert"></p><button class="ap-btn" type="button" id="apPedeOn">Ativar avisos</button><button class="ap-link" type="button" id="apPedeX">Agora não</button>') +
      "</div>";
    var pv = folha.querySelector(".ap-pede-n span:not(.ico)");
    if (pv) pv.textContent = previa;
  }
  /* forcado: pedido pelo aluno (primeiros passos); sem isso, só abre se a tela estiver livre e o pedido não foi adiado */
  function pedir(forcado) {
    if (aberto) return;
    estado().then(function (e) {
      if (e === "ativo") { if (forcado && window.EvoApp) EvoApp.toast("Os avisos já estão ativos neste aparelho."); return; }
      if (e === "bloqueado" || e === "sem-suporte") { if (forcado && window.EvoApp) EvoApp.ir("conta"); return; }
      if (!forcado && (adiado() || !window.EvoApp || !EvoApp.livre())) return;
      monta(e);
      aberto = true; folha.hidden = false;
      if (window.EvoApp) EvoApp.modal(true);
      var t = folha.querySelector("#apPedeT");
      if (t) { try { t.focus({ preventScroll: true }); } catch (x) {} }
    });
  }
  window.EvoPush = { estado: estado, ativar: ativar, pedir: pedir };
  /* ao abrir o app (dados na tela), pede para quem ainda não tem os avisos ativos; se um recado estiver aberto, espera ele fechar */
  var s0 = Acesso.sessao();
  if (s0 && s0.papel === "aluno") {
    document.addEventListener("evo-app-pronto", function () { setTimeout(function () { pedir(false); }, 1400); });
    document.addEventListener("evo-recado-fim", function () { setTimeout(function () { pedir(false); }, 700); });
  }

  if (!suporta) return pinta();
  pinta();
  reg().then(function (g) { return g.pushManager.getSubscription(); }).then(function (s) {
    if (!s) return;
    sub = s; pinta();
    /* garante que a inscrição deste aparelho está na conta de agora (troca de conta no mesmo aparelho) */
    var j = s.toJSON();
    Acesso.cliente().then(function (c) { return c.rpc("push_inscrever", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparelho: aparelho() }); }).catch(function () {});
  }).catch(function () {});
})();
