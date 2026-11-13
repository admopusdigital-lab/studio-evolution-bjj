/* Studio Evolution BJJ · fotos dos alunos (app e painel).
   A foto fica no Supabase Storage, no bucket privado "fotos", em <id do aluno>/<nome>.jpg; só quem tem conta
   de aluno ou de professor consegue ver (link assinado). Quem tem a foto ganha data-foto="<caminho>" no círculo
   das iniciais (.av); este arquivo troca as iniciais pela foto sozinho, em qualquer lista que aparecer na tela. */
(function () {
  var BUCKET = "fotos", DIAS = 7, CHAVE = "evo-fotos";
  var memo = {}, fila = {}, espera = null;
  try { memo = JSON.parse(localStorage.getItem(CHAVE) || "{}") || {}; } catch (e) { memo = {}; }
  var agora = function () { return Date.now(); };
  /* tira os links vencidos (ou quase) do guardado */
  Object.keys(memo).forEach(function (k) { if (!memo[k] || memo[k].ate < agora() + 36e5) delete memo[k]; });
  /* guarda só os links assinados (a prévia local da foto recém-enviada vale só nesta aba) */
  function guarda() {
    var o = {};
    Object.keys(memo).forEach(function (k) { if (!memo[k].local) o[k] = memo[k]; });
    try { localStorage.setItem(CHAVE, JSON.stringify(o)); } catch (e) {}
  }

  /* atributo para o círculo das iniciais: ' data-foto="..."' quando a pessoa tem foto */
  function attr(foto) { return foto ? ' data-foto="' + String(foto).replace(/[&"<>]/g, "") + '"' : ""; }

  /* a foto do celular vira um quadrado de 400 px, recortado no centro, em JPEG leve (~30 KB) */
  function reduz(file) {
    return new Promise(function (ok, erro) {
      if (!file || !/^image\//.test(file.type || "image/")) return erro(new Error("Escolha uma imagem."));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, h = img.naturalHeight, l = Math.min(w, h), T = 400, c = document.createElement("canvas");
        c.width = c.height = T;
        var g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, (w - l) / 2, (h - l) / 2, l, l, 0, 0, T, T);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { b ? ok(b) : erro(new Error("Não deu para ler essa imagem.")); }, "image/jpeg", 0.84);
      };
      img.onerror = function () { URL.revokeObjectURL(url); erro(new Error("Não deu para abrir essa imagem. Tente outra (JPG ou PNG).")); };
      img.src = url;
    });
  }

  /* envia a foto do aluno e devolve o caminho no bucket (nome novo a cada troca: o link antigo para de valer) */
  function envia(sb, alunoId, file) {
    return reduz(file).then(function (blob) {
      var nome = alunoId + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + ".jpg";
      return sb.storage.from(BUCKET).upload(nome, blob, { contentType: "image/jpeg", cacheControl: "604800", upsert: false }).then(function (r) {
        if (r.error) throw r.error;
        memo[nome] = { u: URL.createObjectURL(blob), ate: agora() + 36e5 * 2, local: true };
        return nome;
      });
    });
  }
  /* apaga a foto antiga do bucket (sem travar nada se não der) */
  function apaga(sb, caminho) {
    if (!caminho) return Promise.resolve();
    delete memo[caminho];
    return sb.storage.from(BUCKET).remove([caminho]).then(function () {}, function () {});
  }

  /* links assinados para os caminhos, em lote; guardados por 7 dias para o navegador reaproveitar a imagem */
  function links(sb, caminhos) {
    var falta = caminhos.filter(function (c) { return !memo[c]; });
    if (!falta.length) return Promise.resolve();
    return sb.storage.from(BUCKET).createSignedUrls(falta, DIAS * 86400).then(function (r) {
      (r.data || []).forEach(function (x) {
        if (x && x.signedUrl && !x.error) memo[x.path] = { u: x.signedUrl, ate: agora() + DIAS * 864e5 };
      });
      guarda();
    }, function () {});
  }

  function poe(el) {
    var c = el.getAttribute("data-foto"), m = memo[c];
    if (!m || el.getAttribute("data-foto-ok") === c) return;
    el.setAttribute("data-foto-ok", c);
    var velha = el.querySelector("img.ft");
    if (velha) velha.remove();
    var img = document.createElement("img");
    img.className = "ft"; img.alt = ""; img.decoding = "async"; img.loading = "lazy";
    img.onload = function () { el.classList.add("com-foto"); };
    img.onerror = function () { img.remove(); el.classList.remove("com-foto"); delete memo[c]; guarda(); };
    img.src = m.u;
    el.appendChild(img);
  }

  /* procura círculos com data-foto ainda sem a imagem e coloca */
  var cliente = null;
  function pinta(raiz) {
    if (!cliente) return;
    var els = Array.prototype.slice.call((raiz || document).querySelectorAll("[data-foto]")).filter(function (el) {
      return el.getAttribute("data-foto-ok") !== el.getAttribute("data-foto");
    });
    if (!els.length) return;
    var cs = {};
    els.forEach(function (el) { cs[el.getAttribute("data-foto")] = 1; });
    cliente.then(function (sb) { return links(sb, Object.keys(cs)); }).then(function () { els.forEach(poe); }).catch(function () {});
  }
  /* liga a troca automática: qualquer lista nova na tela recebe as fotos */
  function liga(promessaCliente) {
    cliente = promessaCliente;
    pinta(document);
    new MutationObserver(function () {
      clearTimeout(espera);
      espera = setTimeout(function () { pinta(document); }, 40);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-foto"] });
  }

  window.Fotos = { attr: attr, reduz: reduz, envia: envia, apaga: apaga, liga: liga, pinta: pinta };
})();
