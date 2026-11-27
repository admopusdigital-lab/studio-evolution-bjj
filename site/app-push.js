/* App · Notificações (Perfil): o aluno liga os avisos do Studio neste aparelho.
   O navegador cria a inscrição (com a chave pública que a função "push" entrega) e o banco guarda pela função
   push_inscrever. Quem envia é o professor, pelo painel. No iPhone só funciona com o app na Tela de Início. */
(function () {
  "use strict";
  var antes = document.getElementById("apSenha");
  if (!antes || !window.Acesso || !Acesso.real || !Acesso.sessao()) return;
  var iphone = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  var instalado = (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true;
  var suporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  var box = document.createElement("div");
  box.className = "ap-push"; box.id = "apPush";
  box.innerHTML = '<div class="ap-row"><span>Notificações neste aparelho</span><span class="r" id="apPushSt"></span></div>' +
    '<p class="ap-push-t" id="apPushT"></p>' +
    '<div class="ap-push-b"><button type="button" class="ap-btn" id="apPushOn" hidden>Ativar as notificações</button>' +
    '<button type="button" class="ap-btn ghost" id="apPushTeste" hidden>Enviar um teste</button>' +
    '<button type="button" class="ap-link" id="apPushOff" hidden>Desativar neste aparelho</button></div>';
  antes.parentNode.insertBefore(box, antes);
  var st = box.querySelector("#apPushSt"), tx = box.querySelector("#apPushT"), bOn = box.querySelector("#apPushOn"), bT = box.querySelector("#apPushTeste"), bOff = box.querySelector("#apPushOff");
  var sub = null, ocupado = false;

  function pinta(msg) {
    var negado = suporta && Notification.permission === "denied";
    st.textContent = sub ? "ativadas" : "desativadas"; st.className = "r" + (sub ? " ok" : "");
    bOn.hidden = !!sub || !suporta || negado; bT.hidden = bOff.hidden = !sub;
    bOn.disabled = bT.disabled = bOff.disabled = ocupado;
    tx.textContent = msg || (!suporta ? (iphone && !instalado ? "No iPhone, primeiro coloque o app na Tela de Início: no Safari, toque em Compartilhar e em Adicionar à Tela de Início. Depois abra o app por lá e volte aqui." : "Este navegador não recebe notificações. Use o Chrome (Android) ou o app na Tela de Início (iPhone).")
      : negado ? "As notificações estão bloqueadas para este app. Libere nos ajustes do aparelho (ou do navegador) e volte aqui."
      : sub ? "Você recebe os avisos do Studio neste aparelho." : "Receba os avisos do Studio: mudança de horário, eventos e recados do professor.");
  }
  function b64(s) { var p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")), a = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) a[i] = r.charCodeAt(i); return a; }
  function erroDe(r) {
    var ctx = r.error && r.error.context, s = ctx && ctx.status;
    if (s === 404) return Promise.resolve("As notificações ainda não foram ativadas pelo Studio.");
    var le = ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
    return le.then(function (b) { return (b && b.erro) || "Não deu para falar com o servidor. Confira a internet e tente de novo."; });
  }
  function aparelho() { var u = navigator.userAgent; return /Android/.test(u) ? "Android" : iphone ? "iPhone" : "Computador"; }
  function reg() { return navigator.serviceWorker.ready; }

  function ativar() {
    ocupado = true; pinta("Ativando…");
    var db;
    Acesso.cliente().then(function (c) { db = c; return db.functions.invoke("push", { body: { acao: "chave" } }); }).then(function (r) {
      if (r.error || !r.data || !r.data.publica) return erroDe(r).then(function (m) { throw new Error(m); });
      var chave = r.data.publica;
      return Notification.requestPermission().then(function (p) {
        if (p !== "granted") throw new Error(p === "denied" ? "" : "Você precisa permitir as notificações para ativar.");
        return reg();
      }).then(function (g) { return g.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(chave) }); });
    }).then(function (s) {
      var j = s.toJSON();
      return db.rpc("push_inscrever", { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth, p_aparelho: aparelho() }).then(function (r) {
        if (r.error) { s.unsubscribe().catch(function () {}); throw new Error("As notificações ainda não foram ativadas pelo Studio."); }
        sub = s;
      });
    }).then(function () { ocupado = false; pinta("Pronto. Toque em Enviar um teste para ver chegar."); }, function (e) { ocupado = false; pinta(e && e.message); });
  }
  function desativar() {
    if (!sub) return;
    ocupado = true; pinta();
    var s = sub, fim = function () { sub = null; ocupado = false; pinta("Notificações desativadas neste aparelho."); };
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
