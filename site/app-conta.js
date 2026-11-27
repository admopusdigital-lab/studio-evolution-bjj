/* App · Excluir minha conta (Perfil). As lojas de aplicativos exigem que a conta possa ser apagada de dentro do app.
   Só aparece com o sistema do Studio ligado e para contas de aluno. A exclusão em si é da função excluir-conta. */
(function () {
  "use strict";
  var b = document.getElementById("apExc"), f = document.getElementById("apExcF");
  if (!b || !f || !window.Acesso || !Acesso.real) return;
  var s = Acesso.sessao();
  if (!s || s.papel !== "aluno") return;
  var campo = document.getElementById("apExcP"), err = document.getElementById("apExcErr"), bt = document.getElementById("apExcBtn");
  b.hidden = false;
  b.addEventListener("click", function () {
    var abre = f.hidden;
    f.hidden = !abre; b.setAttribute("aria-expanded", String(abre));
    err.textContent = "";
    if (abre) campo.focus(); else campo.value = "";
  });
  f.addEventListener("submit", function (e) {
    e.preventDefault();
    if (campo.value.trim().toUpperCase() !== "EXCLUIR") { err.textContent = "Digite EXCLUIR para confirmar."; campo.focus(); return; }
    bt.disabled = true; bt.textContent = "Excluindo…"; err.textContent = "";
    Acesso.excluirConta(campo.value).then(function (r) {
      if (r.ok) { location.replace("entrar.html?app&conta=excluida"); return; }
      bt.disabled = false; bt.textContent = "Excluir minha conta"; err.textContent = r.msg;
    });
  });
})();
