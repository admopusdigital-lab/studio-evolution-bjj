/* Painel · Aviso pelo app: o professor (ou a equipe) escreve um recado e ele chega como notificação no celular de quem
   ativou os avisos no app. Vai para a conta do aluno e para a do responsável. Quem envia é a função de servidor "push".
   Fica no Hoje, embaixo da chamada. */
(function () {
  "use strict";
  var $ = P.$, esc = P.esc;
  var hoje = $('.dv[data-v="hoje"]'), hj = hoje && $(".hj", hoje);
  if (!hj || !Acesso.real) return;
  var box = document.createElement("section");
  box.className = "pu"; box.id = "hPush"; box.setAttribute("aria-labelledby", "puT");
  box.innerHTML = '<div class="pu-h"><div><p class="fin-k" id="puT">Aviso pelo app</p><p class="pu-sub">Chega como notificação no celular de quem ativou os avisos no app (Perfil, Notificações).</p></div>' +
    '<button class="mini-btn ghost" type="button" id="puAbre" aria-expanded="false" aria-controls="puForm">Escrever um aviso</button></div>' +
    '<form class="pu-f" id="puForm" novalidate hidden>' +
      '<label class="crm-f"><span>Para quem</span><select class="crm-in" id="puPara"><option value="todos">Todos os alunos</option><option value="adulto">Adulto</option><option value="feminino">Feminino</option><option value="kids1">Kids 1</option><option value="kids2">Kids 2</option></select></label>' +
      '<label class="crm-f"><span>Título <small>(até 60 letras)</small></span><input class="crm-in" id="puTit" maxlength="60" autocomplete="off"></label>' +
      '<label class="crm-f"><span>Mensagem <small>(até 180 letras)</small></span><textarea class="crm-in" id="puTxt" maxlength="180" rows="3"></textarea></label>' +
      '<p class="pu-e" id="puErr" role="alert" hidden></p>' +
      '<div class="pu-b"><button class="mini-btn" type="submit" id="puEnv">Enviar agora</button><button class="mini-btn ghost" type="button" id="puFecha">Cancelar</button></div></form>' +
    '<ul class="pu-l" id="puL" aria-label="Últimos avisos enviados"></ul>';
  var passos = $("#hPassos", hoje);
  (passos || hj).parentNode.insertBefore(box, (passos || hj).nextSibling);
  var form = $("#puForm"), err = $("#puErr"), abre = $("#puAbre"), env = $("#puEnv");
  var ROT = { todos: "todos", adulto: "Adulto", feminino: "Feminino", kids1: "Kids 1", kids2: "Kids 2" };

  function mostra(v) { form.hidden = !v; abre.setAttribute("aria-expanded", String(v)); abre.hidden = v; err.hidden = true; if (v) $("#puTit").focus(); }
  function lista() {
    P.q(function (sb) { return sb.from("push_envios").select("titulo, corpo, para, aparelhos, criado_em").order("criado_em", { ascending: false }).limit(3); })
      .then(function (l) {
        $("#puL").innerHTML = (l || []).map(function (x) {
          return "<li><b>" + esc(x.titulo) + "</b><span>" + esc(x.corpo) + "</span><small>" + P.dataBR(String(x.criado_em).slice(0, 10)) + " · para " + esc(ROT[x.para] || x.para) + " · " + x.aparelhos + (x.aparelhos === 1 ? " aparelho" : " aparelhos") + "</small></li>";
        }).join("");
      }).catch(function () { $("#puL").innerHTML = ""; });
  }
  abre.addEventListener("click", function () { mostra(true); });
  $("#puFecha").addEventListener("click", function () { mostra(false); });
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var tit = $("#puTit").value.trim(), txt = $("#puTxt").value.trim();
    if (tit.length < 2 || txt.length < 2) { err.textContent = "Escreva o título e a mensagem."; err.hidden = false; (tit.length < 2 ? $("#puTit") : $("#puTxt")).focus(); return; }
    env.disabled = true; env.textContent = "Enviando…"; err.hidden = true;
    P.db.then(function (sb) { return sb.functions.invoke("push", { body: { acao: "enviar", titulo: tit, corpo: txt, para: $("#puPara").value } }); }).then(function (r) {
      env.disabled = false; env.textContent = "Enviar agora";
      if (r.error) {
        var ctx = r.error.context, st = ctx && ctx.status;
        var le = st === 404 ? Promise.resolve({ erro: "As notificações ainda não foram ativadas: falta publicar a função push no Supabase." }) : ctx && typeof ctx.json === "function" ? ctx.json().catch(function () { return {}; }) : Promise.resolve({});
        return le.then(function (b) { err.textContent = (b && b.erro) || "Não deu para enviar. Confira a internet e tente de novo."; err.hidden = false; });
      }
      var d = r.data || {};
      P.toast(d.aparelhos ? "Aviso enviado para " + d.aparelhos + (d.aparelhos === 1 ? " aparelho." : " aparelhos.") : "Ninguém desse grupo ativou as notificações no app ainda.");
      $("#puTit").value = ""; $("#puTxt").value = ""; mostra(false); lista();
    }, function () { env.disabled = false; env.textContent = "Enviar agora"; err.textContent = "Não deu para enviar. Confira a internet e tente de novo."; err.hidden = false; });
  });
  P.aoAbrir("hoje", lista);
  lista();
})();
