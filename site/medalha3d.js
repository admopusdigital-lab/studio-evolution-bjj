/* Medalha da Equipe TRUE em 3D (Three.js r149, o mesmo que a faixa 3D carrega).
   Frente com a logo da TRUE em relevo e esmalte preto, verso com a logo do Studio Evolution, campo de ouro
   escovado em círculos, aro polido e borda serrilhada. Os mapas saem de tools/medalha-mapas.py.
   Ao entrar na tela, dá uma volta inteira devagar e para de frente; dá para girar arrastando, com inércia,
   e ela acompanha a rolagem com um leve giro. Sem WebGL, Medalha3D devolve null e fica a foto. */
(function () {
  var THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js";
  function loadThree() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (window.__threeP) return window.__threeP;
    window.__threeP = new Promise(function (ok, fail) {
      var s = document.createElement("script");
      s.src = THREE_URL; s.async = true;
      s.onload = function () { window.THREE ? ok(window.THREE) : fail(); };
      s.onerror = fail;
      document.head.appendChild(s);
    });
    return window.__threeP;
  }
  function hasGL() {
    try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }

  function create(canvas, o) {
    var THREE = window.THREE, small = !!o.small, reduce = !!o.reduce;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);

    /* estúdio para o ouro: sala escura, softbox grande em cima, faixas de luz nas laterais e um rebatedor quente */
    var pm = new THREE.PMREMGenerator(renderer);
    var env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a0908, side: THREE.BackSide })));
    function panel(w, h, hex, k, pos) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(hex).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(pos[0], pos[1], pos[2]); m.lookAt(0, 0, 0); env.add(m);
    }
    panel(18, 6, 0xffffff, 4.0, [0, 14, 6]);
    panel(3, 16, 0xfff6ea, 2.6, [-14, 2, 8]);
    panel(3, 16, 0xffe4b8, 2.2, [14, 2, 6]);
    panel(14, 3, 0xffd9a0, 1.2, [0, -9, 10]);
    panel(10, 10, 0x6b5a40, 0.6, [0, 4, -16]);
    var envRT = pm.fromScene(env, 0.02);
    scene.environment = envRT.texture;
    pm.dispose();

    var key = new THREE.DirectionalLight(0xfff1dc, 2.2);
    key.position.set(-3, 7, 6); key.castShadow = true;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    var sc = key.shadow.camera; sc.left = -3; sc.right = 3; sc.top = 3; sc.bottom = -3; sc.near = 1; sc.far = 25;
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    scene.add(key);
    var rim = new THREE.DirectionalLight(0xffd79a, 1.6); rim.position.set(4, 2, -5); scene.add(rim);

    var ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.ShadowMaterial({ opacity: 0.45 }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.32; ground.receiveShadow = true;
    scene.add(ground);

    /* ---------- a medalha ---------- */
    var R = 1, T = 0.12, NR = small ? 120 : 220, NS = small ? 240 : 420;
    /* face em grade polar: anéis e raios, para o relevo (displacement) ter vértices em toda parte */
    function face() {
      var pos = [], uv = [], nrm = [], idx = [], i, j;
      pos.push(0, 0, 0); uv.push(0.5, 0.5); nrm.push(0, 0, 1);
      for (i = 1; i <= NR; i++) {
        var r = i / NR;
        for (j = 0; j < NS; j++) {
          var a = j / NS * Math.PI * 2, x = Math.cos(a) * r, y = Math.sin(a) * r;
          pos.push(x * R, y * R, 0); uv.push(0.5 + x * 0.5, 0.5 + y * 0.5); nrm.push(0, 0, 1);
        }
      }
      for (j = 0; j < NS; j++) idx.push(0, 1 + j, 1 + (j + 1) % NS);
      for (i = 1; i < NR; i++) for (j = 0; j < NS; j++) {
        var a0 = 1 + (i - 1) * NS + j, a1 = 1 + (i - 1) * NS + (j + 1) % NS, b0 = a0 + NS, b1 = a1 + NS;
        idx.push(a0, b0, b1, a0, b1, a1);
      }
      var g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      g.setIndex(idx);
      return g;
    }
    var tl = new THREE.TextureLoader(), maxAn = renderer.capabilities.getMaxAnisotropy();
    function tex(url) { var t = tl.load(url); t.anisotropy = maxAn; return t; }
    var GOLD = new THREE.Color(1.0, 0.72, 0.31);
    function faceMat(set) {
      var orm = tex(set.orm), nm = tex(set.normal);
      var m = new THREE.MeshPhysicalMaterial({
        color: GOLD, metalness: 1, roughness: 1, roughnessMap: orm, metalnessMap: orm,
        displacementMap: orm, displacementScale: 0.035, normalMap: nm, normalScale: new THREE.Vector2(1, 1),
        envMapIntensity: 1.35, clearcoat: 0.0
      });
      /* onde não é metal (o esmalte), a cor vira preto brilhante */
      m.onBeforeCompile = function (sh) {
        sh.fragmentShader = sh.fragmentShader.replace("#include <metalnessmap_fragment>",
          "#include <metalnessmap_fragment>\n  diffuseColor.rgb = mix(vec3(.006, .006, .007), diffuseColor.rgb, metalnessFactor);");
      };
      return m;
    }
    var front = new THREE.Mesh(face(), faceMat(o.front));
    front.position.z = T / 2;
    var back = new THREE.Mesh(face(), faceMat(o.back));
    back.rotation.y = Math.PI; back.position.z = -T / 2;

    /* borda serrilhada: um normal map de ranhuras desenhado na hora */
    var ec = document.createElement("canvas"); ec.width = 2048; ec.height = 8;
    var ex = ec.getContext("2d"), ed = ex.createImageData(2048, 8);
    for (var x = 0; x < 2048; x++) {
      var s = Math.sin(x / 2048 * Math.PI * 2 * 180), nx = Math.round((0.5 + 0.42 * s) * 255);
      for (var y = 0; y < 8; y++) { var p = (y * 2048 + x) * 4; ed.data[p] = nx; ed.data[p + 1] = 128; ed.data[p + 2] = 230; ed.data[p + 3] = 255; }
    }
    ex.putImageData(ed, 0, 0);
    var edgeN = new THREE.CanvasTexture(ec); edgeN.anisotropy = maxAn;
    var edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 360, 1, true),
      new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.22, normalMap: edgeN, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 1.35 }));
    edge.rotation.x = Math.PI / 2;

    var coin = new THREE.Group();
    [front, back, edge].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; coin.add(m); });
    var holder = new THREE.Group(); holder.add(coin); scene.add(holder);

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var tn = Math.tan(camera.fov * Math.PI / 360);
      var d = Math.max(1.22 / tn, 1.22 / (tn * camera.aspect));
      camera.position.set(0, 0.25, d);
      camera.lookAt(0, -0.05, 0);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    /* ---------- movimento ---------- */
    var S = { rot: reduce ? 0 : -0.5, vel: 0, drag: false, lastX: 0, lastT: 0, idleT: 0, scroll: 0, tx: 0, ty: 0, cx: 0, cy: 0, t: 0, intro: false };
    var tw = null;
    function intro() {
      if (S.intro || reduce || !window.gsap) return;
      S.intro = true;
      /* uma volta inteira devagar: mostra o verso do Studio e para de frente */
      tw = gsap.to(S, { rot: Math.PI * 2, duration: 3.6, ease: "power3.inOut", onComplete: function () { S.rot = 0; tw = null; } });
    }
    function onDown(e) {
      if (tw) { tw.kill(); tw = null; }
      S.drag = true; S.lastX = e.clientX; S.lastT = performance.now(); S.vel = 0;
      canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    }
    function onMoveDrag(e) {
      if (!S.drag) return;
      var now = performance.now(), dx = e.clientX - S.lastX, dt = Math.max(1, now - S.lastT) / 1000;
      var d = dx * 0.011;
      S.rot += d; S.vel = d / dt * 0.6 + S.vel * 0.4;
      S.lastX = e.clientX; S.lastT = now; S.idleT = 0;
    }
    function onUp() { S.drag = false; }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMoveDrag);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    function onHover(e) {
      var r = canvas.getBoundingClientRect();
      S.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.35;
      S.ty = ((e.clientY - r.top) / r.height - 0.5) * 0.3;
    }
    function onLeave() { S.tx = 0; S.ty = 0; }
    if (o.fine && !reduce) { (o.hover || canvas).addEventListener("mousemove", onHover); (o.hover || canvas).addEventListener("mouseleave", onLeave); }

    var raf = 0, visible = true, last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.033, (now - (last || now)) / 1000); last = now;
      S.t += dt;
      if (!S.drag && !tw) {
        /* inércia do giro e, quando quase para, volta devagar para a face mais próxima */
        S.rot += S.vel * dt; S.vel *= Math.pow(0.08, dt);
        if (Math.abs(S.vel) < 0.35) {
          S.idleT += dt;
          var target = Math.round(S.rot / Math.PI) * Math.PI;
          S.rot += (target - S.rot) * Math.min(1, dt * 2.2);
        }
      }
      S.cx += (S.tx - S.cx) * 0.06; S.cy += (S.ty - S.cy) * 0.06;
      holder.rotation.y = S.rot + S.scroll + S.cx;
      holder.rotation.x = S.cy + (reduce ? 0 : 0.04 * Math.sin(S.t * 0.7));
      holder.position.y = reduce ? 0 : 0.035 * Math.sin(S.t * 1.1);
      renderer.render(scene, camera);
    }
    function start() { if (!raf && visible) { last = 0; raf = requestAnimationFrame(frame); } }
    function stop() { cancelAnimationFrame(raf); raf = 0; }
    var io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) { start(); if (es[0].intersectionRatio > 0.35) intro(); } else stop();
      }, { threshold: [0, 0.35, 0.6] });
      io.observe(canvas);
    }
    renderer.render(scene, camera);
    start();

    return {
      /* progresso da rolagem na seção (0 a 1): um leve giro que acompanha */
      scroll: function (p) { S.scroll = reduce ? 0 : (p - 0.5) * 0.7; },
      spin: function () { if (tw) tw.kill(); S.intro = false; S.rot = S.rot % (Math.PI * 2); intro(); },
      destroy: function () {
        stop(); if (io) io.disconnect();
        window.removeEventListener("resize", resize);
        renderer.dispose(); envRT.dispose();
      }
    };
  }

  window.Medalha3D = {
    supported: hasGL,
    mount: function (canvas, o, done) {
      if (!hasGL()) { done(null); return; }
      loadThree().then(function () {
        var api = null;
        try { api = create(canvas, o); } catch (e) { if (window.console) console.warn("Medalha3D", e); api = null; }
        done(api);
      }, function () { done(null); });
    }
  };
})();
