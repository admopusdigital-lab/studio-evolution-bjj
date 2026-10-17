/* Medalha da Equipe TRUE em 3D, como foto de produto (Three.js r149, o mesmo que a faixa 3D carrega).
   Frente com a logo da TRUE em relevo e esmalte preto, verso com a logo do Studio Evolution; ouro escovado,
   aro polido, borda serrilhada, oclusão nas cavidades e marcas de uso (mapas de tools/medalha-mapas.py).
   Ela fica em pé sobre um piso preto que reflete, num estúdio com softboxes de luz suave. Ao entrar na tela
   dá uma volta inteira e para de frente; dá para girar arrastando, com inércia. Sem WebGL, fica a foto. */
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

  /* estúdio em panorama (equiretangular), com softboxes de borda suave: é o que o ouro reflete */
  function studio(THREE) {
    var W = 512, H = 256, data = new Float32Array(W * H * 4);
    function dir(x, y, z) { var l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; }
    /* [direção, meia-largura (rad), meia-altura (rad), intensidade, cor] */
    var boxes = [
      [dir(0, 0.55, 1), 0.55, 0.22, 7.0, [1, 0.97, 0.92]],     // softbox grande acima da câmera
      [dir(0, 1, 0.15), 0.7, 0.35, 3.0, [1, 0.98, 0.95]],      // teto
      [dir(-0.85, 0.15, 0.55), 0.12, 0.6, 5.0, [1, 0.96, 0.9]], // faixa à esquerda
      [dir(0.85, 0.05, 0.5), 0.1, 0.55, 3.6, [1, 0.84, 0.62]],  // faixa quente à direita
      [dir(0.35, 0.3, -1), 0.3, 0.3, 3.2, [1, 0.8, 0.5]]        // contraluz dourada
    ];
    for (var j = 0; j < H; j++) {
      var th = (j + 0.5) / H * Math.PI, sy = Math.cos(th), sr = Math.sin(th);
      for (var i = 0; i < W; i++) {
        var ph = (i + 0.5) / W * Math.PI * 2 - Math.PI;
        var d = [sr * Math.sin(ph), sy, sr * Math.cos(ph)];
        /* sala escura: o chão um pouco mais escuro que as paredes */
        var base = 0.018 + 0.02 * Math.max(0, sy) + 0.006 * Math.max(0, -sy);
        var r = base, g = base * 0.97, b = base * 0.92;
        for (var k = 0; k < boxes.length; k++) {
          var bx = boxes[k], c = bx[0];
          /* distância angular na horizontal e na vertical em relação ao centro do softbox */
          var cy = Math.asin(Math.max(-1, Math.min(1, c[1]))), dy = Math.asin(Math.max(-1, Math.min(1, d[1])));
          var ca = Math.atan2(c[0], c[2]), da = Math.atan2(d[0], d[2]);
          var ax = Math.abs(((da - ca + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.cos(dy), ay = Math.abs(dy - cy);
          var fx = 1 - smooth(bx[1] * 0.7, bx[1] * 1.15, ax), fy = 1 - smooth(bx[2] * 0.7, bx[2] * 1.15, ay);
          var f = fx * fy * bx[3];
          if (f > 0) { r += f * bx[4][0]; g += f * bx[4][1]; b += f * bx[4][2]; }
        }
        var p = (j * W + i) * 4; data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 1;
      }
    }
    var t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
    t.mapping = THREE.EquirectangularReflectionMapping; t.magFilter = THREE.LinearFilter; t.needsUpdate = true;
    return t;
  }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  function create(canvas, o) {
    var THREE = window.THREE, small = !!o.small, reduce = !!o.reduce;
    var renderer;
    try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
    catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.6 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

    var pm = new THREE.PMREMGenerator(renderer), envRT;
    if (renderer.capabilities.isWebGL2) {
      var eq = studio(THREE);
      envRT = pm.fromEquirectangular(eq);
      eq.dispose();
    } else {
      /* WebGL1: o mesmo estúdio, montado com painéis */
      var env = new THREE.Scene();
      env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: 0x0a0908, side: THREE.BackSide })));
      [[18, 6, 0xffffff, 5, [0, 9, 14]], [3, 16, 0xfff6ea, 3, [-14, 2, 8]], [3, 16, 0xffd9a8, 2.4, [14, 1, 7]], [8, 8, 0xffcc80, 2.2, [5, 4, -14]]].forEach(function (p) {
        var m = new THREE.Mesh(new THREE.PlaneGeometry(p[0], p[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(p[2]).multiplyScalar(p[3]), side: THREE.DoubleSide }));
        m.position.set(p[4][0], p[4][1], p[4][2]); m.lookAt(0, 0, 0); env.add(m);
      });
      envRT = pm.fromScene(env, 0.02);
    }
    scene.environment = envRT.texture;
    pm.dispose();

    var key = new THREE.DirectionalLight(0xfff1dc, 1.6);
    key.position.set(-2.5, 6, 5); key.castShadow = true;
    key.shadow.mapSize.set(small ? 1024 : 2048, small ? 1024 : 2048);
    var sc = key.shadow.camera; sc.left = -2.5; sc.right = 2.5; sc.top = 2.5; sc.bottom = -2.5; sc.near = 1; sc.far = 20;
    key.shadow.bias = -0.0003; key.shadow.normalBias = 0.015; key.shadow.radius = 4;
    scene.add(key);

    /* ---------- a medalha ---------- */
    var R = 1, T = 0.14, NR = small ? 150 : 300, NS = small ? 300 : 620, SUF = small ? "" : "-2k";
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
      g.setAttribute("uv2", new THREE.Float32BufferAttribute(uv, 2));
      g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
      g.setIndex(idx);
      return g;
    }
    var tl = new THREE.TextureLoader(), maxAn = renderer.capabilities.getMaxAnisotropy(), textures = [];
    function tex(url) { var t = tl.load(url); t.anisotropy = maxAn; textures.push(t); return t; }
    /* ouro de verdade (F0 do ouro), um pouco quente */
    var GOLD = new THREE.Color(1.0, 0.71, 0.29);
    function faceMat(set) {
      var orm = tex(set.base + "-orm" + SUF + ".webp"), nm = tex(set.base + "-normal" + SUF + ".webp"), ao = tex(set.base + "-ao" + SUF + ".webp");
      var m = new THREE.MeshPhysicalMaterial({
        color: GOLD, metalness: 1, roughness: 1, roughnessMap: orm, metalnessMap: orm,
        displacementMap: orm, displacementScale: 0.05, normalMap: nm, normalScale: new THREE.Vector2(1, 1),
        aoMap: ao, aoMapIntensity: 1, envMapIntensity: 1.0
      });
      /* onde não é metal (o esmalte), a cor vira preto brilhante */
      m.onBeforeCompile = function (sh) {
        sh.fragmentShader = sh.fragmentShader.replace("#include <metalnessmap_fragment>",
          "#include <metalnessmap_fragment>\n  diffuseColor.rgb = mix(vec3(.004, .004, .005), diffuseColor.rgb, metalnessFactor);");
      };
      return m;
    }
    var front = new THREE.Mesh(face(), faceMat(o.front));
    front.position.z = T / 2;
    var back = new THREE.Mesh(face(), faceMat(o.back));
    back.rotation.y = Math.PI; back.position.z = -T / 2;

    /* borda serrilhada: ranhuras finas desenhadas na hora como normal map */
    var ec = document.createElement("canvas"); ec.width = 4096; ec.height = 4;
    var ex = ec.getContext("2d"), ed = ex.createImageData(4096, 4);
    for (var x = 0; x < 4096; x++) {
      var s = Math.sin(x / 4096 * Math.PI * 2 * 220), nx = Math.round((0.5 + 0.45 * s) * 255);
      for (var y = 0; y < 4; y++) { var p = (y * 4096 + x) * 4; ed.data[p] = nx; ed.data[p + 1] = 128; ed.data[p + 2] = 225; ed.data[p + 3] = 255; }
    }
    ex.putImageData(ed, 0, 0);
    var edgeN = new THREE.CanvasTexture(ec); edgeN.anisotropy = maxAn; textures.push(edgeN);
    var edgeMat = new THREE.MeshPhysicalMaterial({ color: GOLD, metalness: 1, roughness: 0.2, normalMap: edgeN, normalScale: new THREE.Vector2(0.9, 0.9) });
    var edge = new THREE.Mesh(new THREE.CylinderGeometry(R, R, T, 512, 1, true), edgeMat);
    edge.rotation.x = Math.PI / 2;

    var coin = new THREE.Group();
    [front, back, edge].forEach(function (m) { m.castShadow = true; m.receiveShadow = true; coin.add(m); });
    var spin = new THREE.Group(); spin.add(coin);
    var stand = new THREE.Group(); stand.add(spin); scene.add(stand);

    /* ---------- o piso preto que reflete: a medalha espelhada por baixo, apagando com a distância ---------- */
    var FLOOR = -R - 0.004;
    var mirror = new THREE.Group(); mirror.add(spin.clone(true));
    mirror.scale.y = -1; mirror.position.y = 2 * FLOOR;
    scene.add(mirror);
    var fc = document.createElement("canvas"); fc.width = 4; fc.height = 256;
    var fx = fc.getContext("2d"), grad = fx.createLinearGradient(0, 0, 0, 256);
    /* de trás (alto do canvas) para a frente: atrás da medalha o piso é fosco; logo à frente o reflexo aparece e vai sumindo */
    [[0, 1], [0.49, 1], [0.5, 0.4], [0.6, 0.6], [0.72, 0.9], [1, 1]].forEach(function (st) { grad.addColorStop(st[0], "rgba(255,255,255," + st[1] + ")"); });
    fx.fillStyle = grad; fx.fillRect(0, 0, 4, 256);
    var fadeTex = new THREE.CanvasTexture(fc); textures.push(fadeTex);
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshBasicMaterial({ color: 0x050403, transparent: true, alphaMap: fadeTex, depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR + 0.001; floor.renderOrder = 2;
    scene.add(floor);
    var shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.ShadowMaterial({ opacity: 0.55 }));
    shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = FLOOR + 0.002; shadowFloor.receiveShadow = true; shadowFloor.renderOrder = 3;
    scene.add(shadowFloor);

    function resize() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      var tn = Math.tan(camera.fov * Math.PI / 360);
      /* a medalha ocupa quase toda a altura; o reflexo aparece embaixo */
      var d = Math.max(1.62 / tn, 1.25 / (tn * camera.aspect));
      camera.position.set(0, 0.38, d);
      camera.lookAt(0, -0.32, 0);
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    /* ---------- movimento ---------- */
    var S = { rot: reduce ? 0 : -0.5, vel: 0, drag: false, lastX: 0, lastT: 0, scroll: 0, tx: 0, cx: 0, t: 0, intro: false };
    var tw = null;
    function intro() {
      if (S.intro || reduce || !window.gsap) return;
      S.intro = true;
      /* uma volta inteira devagar: mostra o verso do Studio e para de frente */
      tw = gsap.to(S, { rot: Math.PI * 2, duration: 3.8, ease: "power3.inOut", onComplete: function () { S.rot = 0; tw = null; } });
    }
    function onDown(e) {
      if (tw) { tw.kill(); tw = null; }
      S.drag = true; S.lastX = e.clientX; S.lastT = performance.now(); S.vel = 0;
      if (canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    }
    function onMoveDrag(e) {
      if (!S.drag) return;
      var now = performance.now(), dx = e.clientX - S.lastX, dt = Math.max(1, now - S.lastT) / 1000;
      var d = dx * 0.01;
      S.rot += d; S.vel = d / dt * 0.6 + S.vel * 0.4;
      S.lastX = e.clientX; S.lastT = now;
    }
    function onUp() { S.drag = false; }
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMoveDrag);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    function onHover(e) { var r = canvas.getBoundingClientRect(); S.tx = ((e.clientX - r.left) / r.width - 0.5) * 0.3; }
    function onLeave() { S.tx = 0; }
    if (o.fine && !reduce) { (o.hover || canvas).addEventListener("mousemove", onHover); (o.hover || canvas).addEventListener("mouseleave", onLeave); }

    var raf = 0, visible = true, last = 0;
    function frame(now) {
      raf = requestAnimationFrame(frame);
      var dt = Math.min(0.033, (now - (last || now)) / 1000); last = now;
      S.t += dt;
      if (!S.drag && !tw) {
        /* inércia e, quando quase para, volta devagar para a face mais próxima */
        S.rot += S.vel * dt; S.vel *= Math.pow(0.08, dt);
        if (Math.abs(S.vel) < 0.35) S.rot += (Math.round(S.rot / Math.PI) * Math.PI - S.rot) * Math.min(1, dt * 2.2);
      }
      S.cx += (S.tx - S.cx) * 0.06;
      spin.rotation.y = S.rot + S.scroll + S.cx;
      mirror.children[0].rotation.y = spin.rotation.y;
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
      scroll: function (p) { S.scroll = reduce ? 0 : (p - 0.5) * 0.6; },
      destroy: function () {
        stop(); if (io) io.disconnect();
        window.removeEventListener("resize", resize);
        textures.forEach(function (t) { t.dispose(); });
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
