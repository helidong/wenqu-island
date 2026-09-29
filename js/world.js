/* 文曲岛奇遇 — 3D 世界 */
(function () {
  'use strict';
  const T = window.THREE;
  const W = window.World = {};
  const G = () => window.Games;

  const KAI = '"Kaiti SC","STKaiti","KaiTi","楷体","Ma Shan Zheng",serif';
  const BRUSH = '"Ma Shan Zheng","Kaiti SC","STKaiti","KaiTi",serif';
  const ss = (a, b, x) => { const t = U.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const gauss = (x, z, cx, cz, s) => Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s));

  /* ---------- 区域 ---------- */
  const ZONES = W.zones = [
    { id: 'center', name: '文曲广场', sub: '一切从这里开始', x: 0, z: 0, r: 20 },
    { id: 'pinyin', name: '拼音村', sub: '声母 · 韵母 · 声调', x: 60, z: -55, r: 22 },
    { id: 'hanzi', name: '汉字林', sub: '仓颉造字的地方', x: 80, z: 22, r: 24 },
    { id: 'chengyu', name: '成语城', sub: '一个成语一个故事', x: 10, z: 80, r: 26 },
    { id: 'poem', name: '诗词山', sub: '欲穷千里目，更上一层楼', x: -66, z: 30, r: 20 },
    { id: 'history', name: '历史长廊', sub: '上下五千年', x: -48, z: -58, r: 32 }
  ];
  const PEAK = { x: -90, z: 50 };
  const ISLET = { x: 122, z: -62 };

  /* ---------- 地形 ---------- */
  function islandR(x, z) { const a = Math.atan2(z, x); return 130 + 8 * Math.sin(3 * a) + 5 * Math.sin(5 * a + 1); }
  function rawH(x, z) {
    const d = Math.hypot(x, z), R = islandR(x, z);
    const edge = 1 - ss(R - 28, R + 4, d);
    const n = 2.4 + 1.5 * Math.sin(x * 0.05) * Math.cos(z * 0.045) + 1.0 * Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.7) + 0.45 * Math.sin(x * 0.23 + z * 0.19);
    let h = n * edge + (edge - 1) * 7;
    h += 30 * gauss(x, z, PEAK.x, PEAK.z, 15);
    h += 8 * gauss(x, z, 30, -98, 11);
    h += 6 * gauss(x, z, 104, 64, 9);
    h += 11.5 * gauss(x, z, ISLET.x, ISLET.z, 9) * (1 - edge);
    return h;
  }
  ZONES.forEach(zn => { zn.h = Math.max(2.4, rawH(zn.x, zn.z)); });
  let BRIDGE = null; // {ax,az,bx,bz}
  const PATHS = []; // [ax,az,bx,bz]
  function segDist(x, z, s) {
    const [ax, az, bx, bz] = s, dx = bx - ax, dz = bz - az;
    const t = U.clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - (ax + dx * t), z - (az + dz * t));
  }
  function groundH(x, z) {
    let h = rawH(x, z);
    for (const zn of ZONES) {
      const d = Math.hypot(x - zn.x, z - zn.z);
      if (d < zn.r * 1.2) h = U.lerp(h, zn.h, 1 - ss(zn.r * 0.72, zn.r * 1.18, d));
    }
    return h;
  }
  function height(x, z) {
    let h = groundH(x, z);
    if (BRIDGE && h < 1.35 && segDist(x, z, BRIDGE) < 1.6) h = 1.35;
    return h;
  }
  W.height = height;
  const isLand = (x, z, min = 0.6) => height(x, z) > min;
  function nearZoneCore(x, z, k = 0.9) { return ZONES.some(zn => Math.hypot(x - zn.x, z - zn.z) < zn.r * k); }
  function onPath(x, z, w = 2.6) { return PATHS.some(p => segDist(x, z, p) < w); }

  /* ---------- 基础 ---------- */
  let renderer, scene, camera, sun, hemi, skyMat, sky, water, waterPos, waterBase;
  let paused = false, started = false;
  const clock = new T.Clock();
  const clickables = [];
  const inters = [];
  const colliders = [];
  const anims = []; // (t, dt) => void
  const M = {}; // 材质缓存
  function mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!M[key]) M[key] = new T.MeshLambertMaterial(Object.assign({ color, flatShading: true }, opts));
    return M[key];
  }
  function mesh(geo, material, x = 0, y = 0, z = 0, shadow = true) {
    const m = new T.Mesh(geo, typeof material === 'number' ? mat(material) : material);
    m.position.set(x, y, z); if (shadow) { m.castShadow = true; m.receiveShadow = true; }
    return m;
  }
  function textCanvas(text, o = {}) {
    const w = o.w || 256, h = o.h || 256, c = document.createElement('canvas');
    c.width = w; c.height = h; const g = c.getContext('2d');
    if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
    if (o.border) { g.strokeStyle = o.border; g.lineWidth = o.bw || 10; g.strokeRect(o.bw / 2 || 5, o.bw / 2 || 5, w - (o.bw || 10), h - (o.bw || 10)); }
    g.fillStyle = o.fg || '#1B2226'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const size = o.size || Math.floor(h * 0.7);
    g.font = `${o.weight || ''} ${size}px ${o.font || KAI}`;
    if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = o.blur || 24; }
    if (o.vertical) {
      const chars = [...text], step = h / (chars.length + 0.4);
      g.font = `${o.weight || ''} ${Math.min(size, step * 0.9)}px ${o.font || KAI}`;
      chars.forEach((ch, i) => g.fillText(ch, w / 2, step * (i + 0.7)));
    } else g.fillText(text, w / 2, h / 2 + (o.dy || size * 0.04));
    return c;
  }
  function tex(text, o) { const t = new T.CanvasTexture(textCanvas(text, o)); t.anisotropy = 4; return t; }
  function label(text, o = {}) {
    const w = Math.max(160, [...text].length * 46 + 40);
    const c = document.createElement('canvas'); c.width = w; c.height = 72;
    const g = c.getContext('2d');
    g.fillStyle = o.bg || 'rgba(18,30,38,.78)';
    const r = 30; g.beginPath(); g.moveTo(r, 4); g.arcTo(w - 4, 4, w - 4, 68, r); g.arcTo(w - 4, 68, 4, 68, r); g.arcTo(4, 68, 4, 4, r); g.arcTo(4, 4, w - 4, 4, r); g.fill();
    g.fillStyle = o.fg || '#F6EEDB'; g.font = `40px ${o.font || BRUSH}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, 38);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: new T.CanvasTexture(c), depthWrite: false, transparent: true }));
    const s = o.scale || 0.9; sp.scale.set(s * w / 72, s, 1); sp.renderOrder = 5;
    return sp;
  }
  function addCollider(x, z, r) { colliders.push({ x, z, r }); }
  function addInter(o) { inters.push(o); if (o.mesh) { o.mesh.traverse(m => { m.userData.inter = o; }); clickables.push(o.mesh); } return o; }

  /* ---------- 构件：屋顶/房屋/亭/牌坊/塔/碑 ---------- */
  function roof(w, d, h, color) {
    const g = new T.Group();
    const cone = mesh(new T.ConeGeometry(0.72, 1, 4, 1), color);
    cone.rotation.y = Math.PI / 4; cone.scale.set(w, h, d); cone.position.y = h / 2; g.add(cone);
    const eave = mesh(new T.BoxGeometry(w * 1.02, 0.12, d * 1.02), color); eave.position.y = 0.02; g.add(eave);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
      const tip = mesh(new T.ConeGeometry(0.1, 0.5, 4), color); tip.position.set(sx * w * 0.5, 0.18, sz * d * 0.5);
      tip.rotation.z = -sx * 0.9; tip.rotation.x = sz * 0.9; g.add(tip);
    });
    const ridge = mesh(new T.BoxGeometry(0.18, 0.18, 0.18), 0xD9A43B); ridge.position.y = h + 0.05; g.add(ridge);
    return g;
  }
  function house(o) {
    const { w = 5, d = 4, h = 2.6, wall = 0xF1EBDD, roofC = 0x3D4A55, pillar = 0xA8322A, stories = 1 } = o;
    const g = new T.Group();
    const base = mesh(new T.BoxGeometry(w + 0.6, 0.4, d + 0.6), 0xB8AE9C); base.position.y = 0.2; g.add(base);
    let y = 0.4;
    for (let s = 0; s < stories; s++) {
      const sw = w * (1 - s * 0.12), sd = d * (1 - s * 0.12);
      const walls = mesh(new T.BoxGeometry(sw, h, sd), wall); walls.position.y = y + h / 2; g.add(walls);
      [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(([sx, sz]) => {
        const p = mesh(new T.CylinderGeometry(0.16, 0.16, h, 6), pillar); p.position.set(sx * sw / 2, y + h / 2, sz * sd / 2); g.add(p);
      });
      const door = mesh(new T.BoxGeometry(sw * 0.28, h * 0.72, 0.08), 0x8E2419); door.position.set(0, y + h * 0.36, sd / 2 + 0.03); g.add(door);
      [-1, 1].forEach(sx => { const win = mesh(new T.BoxGeometry(sw * 0.16, h * 0.3, 0.06), 0x5A3A22); win.position.set(sx * sw * 0.3, y + h * 0.6, sd / 2 + 0.03); g.add(win); });
      y += h;
      const r = roof(sw + 1.2, sd + 1.2, s === stories - 1 ? h * 0.75 : h * 0.35, roofC); r.position.y = y; g.add(r);
      y += s === stories - 1 ? 0 : h * 0.3;
    }
    g.userData.top = y;
    return g;
  }
  function pavilion(r = 3, h = 3, pillar = 0xA8322A, roofC = 0x2F6B5A) {
    const g = new T.Group();
    const base = mesh(new T.CylinderGeometry(r + 0.5, r + 0.8, 0.6, 6), 0xC9C0AE); base.position.y = 0.3; g.add(base);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, p = mesh(new T.CylinderGeometry(0.15, 0.15, h, 6), pillar);
      p.position.set(Math.cos(a) * r, 0.6 + h / 2, Math.sin(a) * r); g.add(p);
    }
    const rf = mesh(new T.ConeGeometry(r + 1.4, h * 0.8, 6), roofC); rf.position.y = 0.6 + h + h * 0.4; g.add(rf);
    const band = mesh(new T.CylinderGeometry(r + 1.45, r + 1.45, 0.2, 6), roofC); band.position.y = 0.6 + h; g.add(band);
    const fin = mesh(new T.SphereGeometry(0.28, 8, 6), 0xD9A43B); fin.position.y = 0.6 + h * 1.8 + 0.2; g.add(fin);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2, t = mesh(new T.ConeGeometry(0.12, 0.6, 4), roofC);
      t.position.set(Math.cos(a) * (r + 1.4), 0.6 + h + 0.2, Math.sin(a) * (r + 1.4)); t.rotation.z = Math.cos(a) * -0.9; t.rotation.x = Math.sin(a) * 0.9; g.add(t);
    }
    return g;
  }
  function paifang(text, o = {}) {
    const { w = 6, h = 5, color = 0xA8322A, roofC = 0x2F4F6B, plaqueBg = '#1E5B78', plaqueFg = '#F3DFA8', font = BRUSH } = o;
    const g = new T.Group();
    [-1, 1].forEach(sx => {
      const p = mesh(new T.BoxGeometry(0.5, h, 0.5), color); p.position.set(sx * w / 2, h / 2, 0); g.add(p);
      const b = mesh(new T.BoxGeometry(0.9, 0.7, 0.9), 0xB8AE9C); b.position.set(sx * w / 2, 0.35, 0); g.add(b);
    });
    const beam = mesh(new T.BoxGeometry(w + 1.2, 0.45, 0.5), color); beam.position.y = h - 0.2; g.add(beam);
    const beam2 = mesh(new T.BoxGeometry(w + 0.4, 0.3, 0.45), color); beam2.position.y = h - 1.5; g.add(beam2);
    const r = roof(w + 2, 1.6, 0.9, roofC); r.position.y = h + 0.05; g.add(r);
    if (text) {
      const len = [...text].length;
      const pw = Math.min(w - 0.6, 0.9 + len * 0.95);
      const t = tex(text, { w: 128 + len * 110, h: 150, bg: plaqueBg, fg: plaqueFg, font, size: 104, border: '#D9A43B', bw: 10 });
      const pm = new T.MeshBasicMaterial({ map: t });
      const plaque = new T.Mesh(new T.BoxGeometry(pw, 1.0, 0.12), [mat(0x5A3A22), mat(0x5A3A22), mat(0x5A3A22), mat(0x5A3A22), pm, pm]);
      plaque.position.y = h - 0.85; g.add(plaque);
    }
    return g;
  }
  function pagoda(levels = 5, r = 2.4, wall = 0xF1EBDD, roofC = 0x2F6B5A) {
    const g = new T.Group(); let y = 0;
    const base = mesh(new T.CylinderGeometry(r + 1, r + 1.3, 0.6, 8), 0xC9C0AE); base.position.y = 0.3; g.add(base); y = 0.6;
    for (let i = 0; i < levels; i++) {
      const rr = r * (1 - i * 0.12), hh = 2.2 - i * 0.12;
      const body = mesh(new T.CylinderGeometry(rr, rr, hh, 8), wall); body.position.y = y + hh / 2; g.add(body);
      const rf = mesh(new T.ConeGeometry(rr + 1.1, 0.9, 8), roofC); rf.position.y = y + hh + 0.3; g.add(rf);
      y += hh + 0.5;
    }
    const sp = mesh(new T.ConeGeometry(0.25, 2, 6), 0xD9A43B); sp.position.y = y + 0.8; g.add(sp);
    g.userData.top = y;
    return g;
  }
  function stele(ch) {
    const g = new T.Group();
    const turtle = mesh(new T.SphereGeometry(0.9, 7, 5), 0x7C837A); turtle.scale.set(1, 0.5, 1.4); turtle.position.y = 0.35; g.add(turtle);
    const head = mesh(new T.SphereGeometry(0.3, 6, 5), 0x7C837A); head.position.set(0, 0.45, 1.25); g.add(head);
    const t = tex(ch, { w: 256, h: 320, bg: '#9FA69B', fg: '#2A2F2C', size: 200, font: KAI, border: '#7C837A', bw: 14 });
    const face = new T.MeshLambertMaterial({ map: t });
    const stone = mat(0x9FA69B);
    const slab = new T.Mesh(new T.BoxGeometry(1.4, 1.9, 0.35), [stone, stone, stone, stone, face, face]);
    slab.position.y = 1.55; slab.castShadow = true; g.add(slab);
    const cap = mesh(new T.BoxGeometry(1.6, 0.25, 0.5), 0x7C837A); cap.position.y = 2.6; g.add(cap);
    return g;
  }
  function lantern(x, z, y0) {
    const g = new T.Group();
    const post = mesh(new T.CylinderGeometry(0.07, 0.09, 2.4, 5), 0x5A3A22); post.position.y = 1.2; g.add(post);
    const arm = mesh(new T.BoxGeometry(0.7, 0.07, 0.07), 0x5A3A22); arm.position.set(0.3, 2.35, 0); g.add(arm);
    const lm = new T.MeshLambertMaterial({ color: 0xD8392B, emissive: 0x000000 });
    const l = new T.Mesh(new T.SphereGeometry(0.28, 8, 6), lm); l.scale.y = 1.2; l.position.set(0.6, 2.0, 0); g.add(l);
    g.position.set(x, y0, z); scene.add(g); LANTERNS.push(lm);
    return g;
  }
  const LANTERNS = [];

  /* ---------- 人物 ---------- */
  function person(o = {}) {
    const { robe = 0x3E7FA0, trim = 0xF1EBDD, skin = 0xF3D2B3, hat = 'bun', beard = false, item = null, scale = 1, fourEyes = false, hair = 0x1B1B1B } = o;
    const g = new T.Group(); const body = new T.Group(); g.add(body);
    const robeM = mesh(new T.CylinderGeometry(0.34, 0.62, 1.15, 8), robe); robeM.position.y = 0.62; body.add(robeM);
    const belt = mesh(new T.CylinderGeometry(0.37, 0.37, 0.12, 8), trim); belt.position.y = 0.92; body.add(belt);
    const collar = mesh(new T.ConeGeometry(0.3, 0.25, 8), trim); collar.position.y = 1.18; collar.rotation.x = Math.PI; body.add(collar);
    const head = mesh(new T.SphereGeometry(0.34, 12, 10), skin); head.position.y = 1.52; body.add(head);
    const eyeM = mat(0x111111);
    const eyes = fourEyes ? [[-0.12, 1.6], [0.12, 1.6], [-0.1, 1.47], [0.1, 1.47]] : [[-0.12, 1.54], [0.12, 1.54]];
    eyes.forEach(([ex, ey]) => { const e = mesh(new T.SphereGeometry(0.045, 6, 5), eyeM, ex, ey, 0.3, false); body.add(e); });
    const cheekM = mat(0xF2A3A0);
    [-1, 1].forEach(s => { const c = mesh(new T.SphereGeometry(0.05, 6, 4), cheekM, s * 0.2, 1.44, 0.27, false); c.scale.z = 0.4; body.add(c); });
    const hairM = mesh(new T.SphereGeometry(0.35, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hair); hairM.position.y = 1.55; hairM.rotation.x = -0.25; body.add(hairM);
    const hatG = new T.Group(); hatG.position.y = 1.75; body.add(hatG);
    const arms = [];
    [-1, 1].forEach(s => {
      const pivot = new T.Group(); pivot.position.set(s * 0.36, 1.12, 0);
      const arm = mesh(new T.CylinderGeometry(0.1, 0.14, 0.62, 6), robe); arm.position.y = -0.3; pivot.add(arm);
      const hand = mesh(new T.SphereGeometry(0.09, 6, 5), skin); hand.position.y = -0.64; pivot.add(hand);
      pivot.rotation.z = s * 0.18; body.add(pivot); arms.push(pivot);
    });
    const feet = [-1, 1].map(s => { const f = mesh(new T.BoxGeometry(0.16, 0.1, 0.3), 0x222222); f.position.set(s * 0.15, 0.05, 0.05); g.add(f); return f; });
    if (beard) { const b = mesh(new T.ConeGeometry(0.14, 0.45, 6), 0x3a3a3a); b.position.set(0, 1.25, 0.25); b.rotation.x = Math.PI; body.add(b); }
    if (item) addItem(arms[1], item);
    const parts = { g, body, robeM, arms, feet, hatG, head, robeColor: robe };
    setHat(parts, hat);
    g.scale.setScalar(scale);
    g.userData.parts = parts;
    return g;
  }
  function addItem(armPivot, item) {
    let m;
    if (item === 'brush') { m = new T.Group(); m.add(mesh(new T.CylinderGeometry(0.04, 0.04, 0.9, 5), 0x6b4a2b)); const tip = mesh(new T.ConeGeometry(0.07, 0.22, 6), 0x111111); tip.position.y = -0.55; tip.rotation.x = Math.PI; m.add(tip); }
    else if (item === 'fan') { m = mesh(new T.CircleGeometry(0.4, 8, 0, Math.PI), new T.MeshLambertMaterial({ color: 0xF6EEDB, side: T.DoubleSide })); m.rotation.x = -Math.PI / 2; }
    else if (item === 'gourd') { m = new T.Group(); m.add(mesh(new T.SphereGeometry(0.16, 8, 6), 0xD9A43B)); const s = mesh(new T.SphereGeometry(0.11, 8, 6), 0xD9A43B); s.position.y = 0.2; m.add(s); }
    else if (item === 'scroll') { m = mesh(new T.CylinderGeometry(0.08, 0.08, 0.7, 8), 0xF3DFA8); m.rotation.z = Math.PI / 2; }
    else if (item === 'sword') { m = mesh(new T.BoxGeometry(0.06, 1.1, 0.12), 0xC9CED3); m.position.y = -0.3; }
    else if (item === 'bamboo') { m = mesh(new T.BoxGeometry(0.45, 0.6, 0.06), 0xC9B06B); }
    if (m) { m.position.y += -0.7; m.position.z = 0.15; armPivot.add(m); }
  }
  function setHat(p, hat) {
    const H = p.hatG; while (H.children.length) H.remove(H.children[0]);
    if (hat === 'bun') { const b = mesh(new T.SphereGeometry(0.15, 8, 6), 0x1B1B1B); b.position.y = 0.02; H.add(b); const band = mesh(new T.TorusGeometry(0.12, 0.03, 4, 10), 0xC0392B); band.rotation.x = Math.PI / 2; band.position.y = -0.04; H.add(band); }
    if (hat === 'twin') { [-1, 1].forEach(s => { const b = mesh(new T.SphereGeometry(0.13, 8, 6), 0x1B1B1B); b.position.set(s * 0.22, 0, 0); H.add(b); }); }
    if (hat === 'scholar') { const c = mesh(new T.BoxGeometry(0.5, 0.3, 0.45), 0x1B1B1B); c.position.y = 0; H.add(c); [-1, 1].forEach(s => { const w = mesh(new T.BoxGeometry(0.55, 0.04, 0.08), 0x1B1B1B); w.position.set(s * 0.5, 0.02, -0.12); H.add(w); }); }
    if (hat === 'zhuangyuan') { const c = mesh(new T.CylinderGeometry(0.3, 0.34, 0.3, 10), 0x1B1B1B); H.add(c); [-1, 1].forEach(s => { const w = mesh(new T.BoxGeometry(0.5, 0.05, 0.1), 0x1B1B1B); w.position.set(s * 0.52, 0.05, -0.1); w.rotation.z = s * 0.15; H.add(w); }); const f = mesh(new T.SphereGeometry(0.1, 8, 6), 0xC0392B); f.position.set(0.18, 0.12, 0.28); H.add(f); }
    if (hat === 'crown') { const c = mesh(new T.CylinderGeometry(0.2, 0.25, 0.25, 8), 0x1B1B1B); H.add(c); const bd = mesh(new T.BoxGeometry(0.8, 0.05, 0.55), 0x1B1B1B); bd.position.y = 0.15; H.add(bd); for (let i = -3; i <= 3; i++) { const bead = mesh(new T.CylinderGeometry(0.015, 0.015, 0.35, 3), 0xD9A43B); bead.position.set(i * 0.1, -0.02, 0.27); H.add(bead); } }
    if (hat === 'straw') { const c = mesh(new T.ConeGeometry(0.75, 0.4, 12), 0xC9B06B); c.position.y = 0.05; H.add(c); }
    if (hat === 'helmet') { const c = mesh(new T.ConeGeometry(0.38, 0.5, 8), 0x8C8F86); c.position.y = 0.1; H.add(c); const t = mesh(new T.ConeGeometry(0.08, 0.3, 5), 0xC0392B); t.position.y = 0.45; H.add(t); }
    if (hat === 'hood') { const c = mesh(new T.BoxGeometry(0.45, 0.32, 0.45), 0x2B3A4A); H.add(c); }
    if (hat === 'flower') { const b = mesh(new T.SphereGeometry(0.17, 8, 6), 0x1B1B1B); H.add(b); const f = mesh(new T.SphereGeometry(0.09, 6, 5), 0xE86A8A); f.position.set(0.18, 0.05, 0.08); H.add(f); }
    if (hat === 'monk') { /* 光头 */ }
  }
  function npc(o) {
    const p = person(o);
    const y = height(o.x, o.z) + (o.dy || 0);
    p.position.set(o.x, y, o.z);
    if (o.face != null) p.rotation.y = o.face; else p.rotation.y = Math.atan2(-o.x, -o.z);
    scene.add(p);
    const tag = label(o.name, { scale: 0.8 * (o.scale || 1) }); tag.position.set(0, 2.45, 0); p.add(tag);
    let mark = null;
    if (o.master) {
      mark = new T.Sprite(new T.SpriteMaterial({ map: tex('学', { w: 128, h: 128, fg: '#FFF4E6', font: BRUSH, size: 84, bg: '#C0392B' }), depthWrite: false }));
      mark.scale.set(0.75, 0.75, 1); mark.position.y = 3.2; p.add(mark);
    }
    addCollider(o.x, o.z, 0.7 * (o.scale || 1));
    const phase = Math.random() * 6;
    anims.push(t => {
      const parts = p.userData.parts;
      parts.body.position.y = Math.sin(t * 2 + phase) * 0.03;
      parts.arms[1].rotation.x = Math.sin(t * 1.3 + phase) * 0.15 - 0.2;
      if (mark) { mark.position.y = 3.2 + Math.sin(t * 3) * 0.12; }
    });
    addInter({ x: o.x, z: o.z, r: o.r || 3.2, text: o.say || `与${o.name}交谈`, act: o.act, mesh: p, npc: p });
    return p;
  }

  /* ---------- 树木（实例化） ---------- */
  function buildTrees() {
    const rng = U.seeded(7);
    const kinds = {
      pine: { trunk: [0.15, 0.22, 1.2, 0x6b4a2b], crown: new T.ConeGeometry(1.1, 2.6, 7), color: 0x2F6B4A, list: [] },
      round: { trunk: [0.15, 0.2, 1.3, 0x6b4a2b], crown: new T.IcosahedronGeometry(1.25, 0), color: 0x5E9E4E, list: [] },
      peach: { trunk: [0.13, 0.18, 1.2, 0x5a3a22], crown: new T.IcosahedronGeometry(1.15, 0), color: 0xF2A7BF, list: [] },
      maple: { trunk: [0.14, 0.2, 1.2, 0x5a3a22], crown: new T.IcosahedronGeometry(1.2, 0), color: 0xD9643B, list: [] },
      willow: { trunk: [0.16, 0.22, 1.6, 0x5a3a22], crown: new T.ConeGeometry(1.4, 3, 8, 1, true), color: 0x8CC66A, list: [] },
      bamboo: { trunk: [0.07, 0.07, 5.5, 0x6FA84F], crown: new T.IcosahedronGeometry(0.7, 0), color: 0x5FA048, list: [] }
    };
    const place = (kind, x, z, s = 1) => {
      const y = height(x, z); if (y < 0.9) return false;
      if (onPath(x, z, 2.4) || nearZoneCore(x, z, kind === 'bamboo' ? 0.55 : 0.85)) return false;
      kinds[kind].list.push([x, y, z, s, rng() * 6.28]); addCollider(x, z, kind === 'bamboo' ? 0.25 : 0.55);
      return true;
    };
    const hz = ZONES.find(z => z.id === 'hanzi'), pz = ZONES.find(z => z.id === 'poem');
    // 汉字林竹海
    for (let i = 0, n = 0; i < 2600 && n < 260; i++) {
      const a = rng() * 6.28, d = 12 + rng() * 26, x = hz.x + Math.cos(a) * d, z = hz.z + Math.sin(a) * d;
      if (Math.hypot(x - hz.x, z - hz.z) < 16 && Math.abs(Math.atan2(z - hz.z, x - hz.x) - Math.atan2(-hz.z, -hz.x)) < 0.35) continue;
      if (place('bamboo', x, z, 0.8 + rng() * 0.5)) n++;
    }
    for (let i = 0, n = 0; i < 4000 && n < 330; i++) {
      const x = (rng() * 2 - 1) * 128, z = (rng() * 2 - 1) * 128, y = height(x, z);
      if (y < 1.1) continue;
      const dp = Math.hypot(x - pz.x, z - pz.z), dh = Math.hypot(x - hz.x, z - hz.z);
      let k;
      if (y > 14) k = 'pine';
      else if (dp < 40) k = rng() < 0.55 ? 'pine' : (rng() < 0.5 ? 'willow' : 'peach');
      else if (dh < 42) k = rng() < 0.6 ? 'bamboo' : 'round';
      else if (z < -40 && x < 0) k = rng() < 0.5 ? 'maple' : 'round';
      else { const r = rng(); k = r < 0.4 ? 'round' : r < 0.62 ? 'peach' : r < 0.85 ? 'pine' : 'maple'; }
      if (place(k, x, z, 0.75 + rng() * 0.6)) n++;
    }
    const dummy = new T.Object3D();
    Object.values(kinds).forEach(k => {
      if (!k.list.length) return;
      const [r1, r2, th, tc] = k.trunk;
      const trunkI = new T.InstancedMesh(new T.CylinderGeometry(r1, r2, th, 5), mat(tc), k.list.length);
      const crownI = new T.InstancedMesh(k.crown, k === kinds.willow ? new T.MeshLambertMaterial({ color: k.color, flatShading: true, side: T.DoubleSide }) : mat(k.color), k.list.length);
      const col = new T.Color();
      k.list.forEach(([x, y, z, s, rot], i) => {
        dummy.position.set(x, y + th * s / 2, z); dummy.rotation.set(0, rot, 0); dummy.scale.set(s, s, s); dummy.updateMatrix(); trunkI.setMatrixAt(i, dummy.matrix);
        const cy = k === kinds.bamboo ? y + th * s : k === kinds.willow ? y + th * s + 0.6 * s : y + th * s + (k === kinds.pine ? 1.1 : 0.8) * s;
        dummy.position.set(x, cy, z); dummy.scale.set(s, s * (k === kinds.bamboo ? 1.4 : 1), s); dummy.updateMatrix(); crownI.setMatrixAt(i, dummy.matrix);
        col.setHex(k.color).offsetHSL((Math.sin(x * 12.9 + z * 78.2) * 0.5) * 0.04, 0, (Math.cos(x * 3.1 + z) * 0.5) * 0.1); crownI.setColorAt(i, col);
      });
      trunkI.castShadow = crownI.castShadow = true; trunkI.receiveShadow = crownI.receiveShadow = true;
      if (crownI.instanceColor) crownI.instanceColor.needsUpdate = true;
      scene.add(trunkI, crownI);
    });
    // 石头与花
    const rocks = [], flowers = [];
    for (let i = 0; i < 1800 && rocks.length < 90; i++) { const x = (rng() * 2 - 1) * 130, z = (rng() * 2 - 1) * 130, y = height(x, z); if (y > 0.2 && !nearZoneCore(x, z, 0.9) && !onPath(x, z)) rocks.push([x, y, z, 0.4 + rng() * 1.2]); }
    for (let i = 0; i < 3000 && flowers.length < 420; i++) { const x = (rng() * 2 - 1) * 120, z = (rng() * 2 - 1) * 120, y = height(x, z); if (y > 1 && y < 12 && !onPath(x, z, 2) && !nearZoneCore(x, z, 0.5)) flowers.push([x, y, z]); }
    const rI = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), mat(0x8C8F86), rocks.length);
    rocks.forEach(([x, y, z, s], i) => { dummy.position.set(x, y + s * 0.3, z); dummy.rotation.set(s, s * 3, 0); dummy.scale.set(s, s * 0.7, s); dummy.updateMatrix(); rI.setMatrixAt(i, dummy.matrix); addCollider(x, z, s * 0.8); });
    rI.castShadow = rI.receiveShadow = true; scene.add(rI);
    const fI = new T.InstancedMesh(new T.IcosahedronGeometry(0.16, 0), new T.MeshLambertMaterial({ color: 0xffffff }), flowers.length);
    const fc = [0xF2E36B, 0xE86A8A, 0xFFFFFF, 0xB58BE0, 0xF29E4C], col = new T.Color();
    flowers.forEach(([x, y, z], i) => { dummy.position.set(x, y + 0.2, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); fI.setMatrixAt(i, dummy.matrix); fI.setColorAt(i, col.setHex(fc[i % fc.length])); });
    if (fI.instanceColor) fI.instanceColor.needsUpdate = true;
    scene.add(fI);
  }

  /* ---------- 地形网格 / 水 / 天空 ---------- */
  function buildTerrain() {
    const S = 320, N = 200;
    const geo = new T.PlaneGeometry(S, S, N, N); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, colors = new Float32Array(pos.count * 3), c = new T.Color();
    const sand = new T.Color(0xE6D6A2), grass = new T.Color(0x86BF62), grass2 = new T.Color(0x5E9E4E), rock = new T.Color(0x8C8F86), snow = new T.Color(0xEDEDE6), dirt = new T.Color(0xCDB88C), sea = new T.Color(0x6FA9B0), plaza = new T.Color(0xCFC6B2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), y = height(x, z);
      pos.setY(i, y);
      if (y < 0.3) c.copy(sea).lerp(sand, U.clamp((y + 3) / 3.3, 0, 1));
      else if (y < 1.25) c.copy(sand);
      else if (y < 13) { c.copy(grass).lerp(grass2, (Math.sin(x * 0.07) * Math.cos(z * 0.06) + 1) / 2 * 0.8); }
      else if (y < 24) c.copy(grass2).lerp(rock, (y - 13) / 11);
      else c.copy(rock).lerp(snow, U.clamp((y - 24) / 5, 0, 1));
      if (y > 1 && onPath(x, z, 1.8)) c.lerp(dirt, 0.85);
      for (const zn of ZONES) { if (Math.hypot(x - zn.x, z - zn.z) < (zn.id === 'history' ? 0 : zn.r * 0.45)) c.lerp(plaza, 0.8); }
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new T.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    m.receiveShadow = true; m.name = 'terrain'; scene.add(m);
    W.terrain = m;
    // 海
    const wg = new T.PlaneGeometry(900, 900, 90, 90); wg.rotateX(-Math.PI / 2);
    water = new T.Mesh(wg, new T.MeshPhongMaterial({ color: 0x2E8FB0, transparent: true, opacity: 0.82, shininess: 80, flatShading: true, specular: 0x88ccee }));
    water.position.y = 0.05; scene.add(water);
    waterPos = wg.attributes.position; waterBase = Float32Array.from(waterPos.array);
  }
  function buildSky() {
    skyMat = new T.ShaderMaterial({
      uniforms: { top: { value: new T.Color(0x4A9BD1) }, bottom: { value: new T.Color(0xD6ECF3) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = max(vP.y, 0.0); gl_FragColor = vec4(mix(bottom, top, pow(h, 0.55)), 1.0); }',
      side: T.BackSide, depthWrite: false, fog: false
    });
    sky = new T.Mesh(new T.SphereGeometry(600, 24, 12), skyMat); scene.add(sky);
    // 星星
    const sg = new T.BufferGeometry(), sp = [];
    for (let i = 0; i < 700; i++) { const a = Math.random() * 6.28, b = Math.random() * 1.4 + 0.1, r = 560; sp.push(Math.cos(a) * Math.cos(b) * r, Math.sin(b) * r, Math.sin(a) * Math.cos(b) * r); }
    sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    W.stars = new T.Points(sg, new T.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    scene.add(W.stars);
    W.moon = new T.Mesh(new T.SphereGeometry(14, 16, 12), new T.MeshBasicMaterial({ color: 0xFFF4D0, fog: false })); scene.add(W.moon);
    W.sunDisc = new T.Mesh(new T.SphereGeometry(16, 16, 12), new T.MeshBasicMaterial({ color: 0xFFE9A8, fog: false })); scene.add(W.sunDisc);
    // 云
    W.clouds = [];
    const cm = new T.MeshLambertMaterial({ color: 0xffffff, flatShading: true, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 16; i++) {
      const g = new T.Group(); const n = U.ri(3, 6);
      for (let j = 0; j < n; j++) { const b = new T.Mesh(new T.IcosahedronGeometry(U.rand(3, 6), 0), cm); b.position.set(j * 4 - n * 2, U.rand(-1, 1.5), U.rand(-2, 2)); g.add(b); }
      g.position.set(U.rand(-200, 200), U.rand(48, 70), U.rand(-200, 200)); g.userData.v = U.rand(1, 3);
      scene.add(g); W.clouds.push(g);
    }
  }

  /* ---------- 各区域 ---------- */
  function Y(x, z) { return height(x, z); }
  const SOLIDS = []; // 会挡住镜头的建筑
  function put(obj, x, z, rot = 0, collR = 0, dy = 0) { obj.position.set(x, Y(x, z) + dy, z); obj.rotation.y = rot; scene.add(obj); SOLIDS.push(obj); if (collR) addCollider(x, z, collR); return obj; }
  const faceTo = (x, z, tx, tz) => Math.atan2(tx - x, tz - z);

  function buildCenter() {
    const zn = ZONES[0];
    const plaza = mesh(new T.CylinderGeometry(11, 11.5, 0.4, 32), 0xCFC6B2); plaza.position.set(0, zn.h, 0); scene.add(plaza);
    const ring = mesh(new T.TorusGeometry(11, 0.25, 4, 48), 0xB8AE9C); ring.rotation.x = Math.PI / 2; ring.position.set(0, zn.h + 0.2, 0); scene.add(ring);
    // 太极八卦纹地砖
    const bagua = mesh(new T.CylinderGeometry(4.5, 4.5, 0.1, 8), 0x9C8F76); bagua.position.set(0, zn.h + 0.25, 0); scene.add(bagua);
    // 文曲星像
    const ped = mesh(new T.CylinderGeometry(1.8, 2.2, 1.6, 8), 0xB8AE9C); ped.position.set(0, zn.h + 1, 0); scene.add(ped);
    const statue = person({ robe: 0xD9A43B, trim: 0xF3DFA8, skin: 0xE8C77A, hair: 0xB8862F, hat: 'scholar', beard: true, item: 'brush', scale: 2.2 });
    statue.position.set(0, zn.h + 1.8, 0); scene.add(statue);
    const halo = new T.Mesh(new T.TorusGeometry(1.2, 0.06, 6, 30), new T.MeshBasicMaterial({ color: 0xFFE9A8 })); halo.position.set(0, zn.h + 6.2, -0.4); scene.add(halo);
    anims.push(t => { halo.rotation.z = t * 0.5; statue.userData.parts.arms[1].rotation.x = -0.6 + Math.sin(t) * 0.2; });
    addCollider(0, 0, 2.4);
    const tag = label('文曲星君', { scale: 1.1 }); tag.position.set(0, zn.h + 7.6, 0); scene.add(tag);
    addInter({ x: 0, z: 0, r: 5, text: '拜见文曲星君', act: () => G().hub(), mesh: statue });
    // 路标
    ZONES.slice(1).forEach(z => {
      const a = Math.atan2(z.z, z.x), x = Math.cos(a) * 9, zz = Math.sin(a) * 9;
      const g = new T.Group();
      g.add(mesh(new T.CylinderGeometry(0.1, 0.1, 2.6, 5), 0x6b4a2b, 0, 1.3, 0));
      const board = new T.Mesh(new T.BoxGeometry(2.2, 0.6, 0.1), [mat(0x6b4a2b), mat(0x6b4a2b), mat(0x6b4a2b), mat(0x6b4a2b), new T.MeshBasicMaterial({ map: tex(z.name, { w: 360, h: 100, bg: '#F2ECDF', fg: '#1B2226', font: BRUSH, size: 72 }) }), new T.MeshBasicMaterial({ map: tex(z.name, { w: 360, h: 100, bg: '#F2ECDF', fg: '#1B2226', font: BRUSH, size: 72 }) })]);
      board.position.set(0, 2.3, 0); g.add(board);
      g.position.set(x, zn.h + 0.2, zz); g.rotation.y = -a; scene.add(g);
    });
    // 告示栏：每日一字一诗
    const nb = new T.Group();
    [-1, 1].forEach(s => nb.add(mesh(new T.BoxGeometry(0.2, 2.8, 0.2), 0x6b4a2b, s * 1.4, 1.4, 0)));
    const paperB = new T.Mesh(new T.BoxGeometry(2.6, 1.6, 0.1), [mat(0x6b4a2b), mat(0x6b4a2b), mat(0x6b4a2b), mat(0x6b4a2b), new T.MeshBasicMaterial({ map: tex('今日功课', { w: 400, h: 240, bg: '#F2ECDF', fg: '#C0392B', font: BRUSH, size: 80, border: '#8E2419', bw: 12 }) }), mat(0x6b4a2b)]);
    paperB.position.y = 1.9; nb.add(paperB); nb.add(roof(3.4, 0.8, 0.5, 0x3D4A55)); nb.children[nb.children.length - 1].position.y = 2.8;
    put(nb, 6, 6.5, faceTo(6, 6.5, 0, 0), 1.2, 0.2);
    addInter({ x: 6, z: 6.5, r: 3, text: '看看今日功课', act: () => G().daily(), mesh: nb });
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; lantern(Math.cos(a) * 12.5, Math.sin(a) * 12.5, zn.h); }
    // 小墨：向导书童
    npc({ name: '书童小墨', x: -4, z: 5, robe: 0x5E9E4E, hat: 'twin', act: () => G().guide(), say: '问问小墨怎么玩', scale: 0.85 });
  }

  function buildPinyin() {
    const zn = ZONES.find(z => z.id === 'pinyin');
    const pastel = [0xF6D6A8, 0xCFE5D8, 0xF4C7C3, 0xD5DDF2, 0xF3E3A0];
    const roofs = [0xC0392B, 0x2F6B5A, 0x1E5B78, 0xD9A43B, 0x7A4E9C];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + 0.5, x = zn.x + Math.cos(a) * 14, z = zn.z + Math.sin(a) * 14;
      const hs = house({ w: 4.2, d: 3.6, h: 2.3, wall: pastel[i], roofC: roofs[i] });
      put(hs, x, z, faceTo(x, z, zn.x, zn.z), 3);
    }
    npc({ name: '音韵先生', x: zn.x, z: zn.z, robe: 0x7A4E9C, hat: 'scholar', beard: true, item: 'fan', master: true, act: () => G().zoneMenu('pinyin'), say: '向音韵先生学拼音' });
    // 漂浮的声母方块
    const cubeG = new T.BoxGeometry(1.1, 1.1, 1.1);
    const cols = ['#C0392B', '#1E5B78', '#3E8E6E', '#D9A43B', '#7A4E9C', '#E86A8A'];
    GD.initials.forEach((it, i) => {
      const a = i / GD.initials.length * Math.PI * 2, r = 8;
      const t = tex(it.p, { w: 128, h: 128, bg: cols[i % cols.length], fg: '#fff', font: '"Helvetica Neue",Arial,Roboto,sans-serif', weight: 700, size: it.p.length > 1 ? 64 : 84 });
      const m = new T.Mesh(cubeG, new T.MeshLambertMaterial({ map: t }));
      const x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r, y0 = zn.h + 3.2;
      m.position.set(x, y0, z); m.castShadow = true; scene.add(m);
      const ph = i * 0.7;
      anims.push(tt => { m.position.y = y0 + Math.sin(tt * 1.5 + ph) * 0.4; m.rotation.y = tt * 0.6 + ph; m.rotation.x = Math.sin(tt * 0.4 + ph) * 0.3; });
      m.userData.onClick = () => { Voice.say(it.rep); UI.toast({ big: it.p, t1: `声母 ${it.p}`, t2: `读作「${it.rep}」· ${it.tip}`, ms: 1800 }); Sfx.pop(); m.scale.setScalar(1.4); setTimeout(() => m.scale.setScalar(1), 180); };
      clickables.push(m);
    });
    // 声调钟
    const tones = [['ā', '一声平', '妈'], ['á', '二声扬', '麻'], ['ǎ', '三声拐弯', '马'], ['à', '四声降', '骂']];
    const dirA = Math.atan2(-zn.z, -zn.x) + Math.PI; // 背离广场一侧
    tones.forEach((tn, i) => {
      const off = (i - 1.5) * 4, bx = zn.x + Math.cos(dirA) * 19 + Math.cos(dirA + Math.PI / 2) * off, bz = zn.z + Math.sin(dirA) * 19 + Math.sin(dirA + Math.PI / 2) * off;
      const g = new T.Group();
      [-1, 1].forEach(s => g.add(mesh(new T.BoxGeometry(0.2, 3, 0.2), 0x6b4a2b, s * 0.9, 1.5, 0)));
      g.add(mesh(new T.BoxGeometry(2.2, 0.2, 0.25), 0x6b4a2b, 0, 3, 0));
      const bell = mesh(new T.CylinderGeometry(0.35, 0.65, 1.1, 10), [0xC0392B, 0x3E8E6E, 0x1E5B78, 0xD9A43B][i], 0, 2.2, 0); g.add(bell);
      const sign = new T.Mesh(new T.PlaneGeometry(1.4, 0.7), new T.MeshBasicMaterial({ map: tex('m' + tn[0], { w: 200, h: 100, bg: '#F2ECDF', fg: '#1B2226', font: '"Helvetica Neue",Arial,Roboto,sans-serif', size: 70 }), side: T.DoubleSide }));
      sign.position.set(0, 0.9, 0.12); g.add(sign);
      put(g, bx, bz, faceTo(bx, bz, zn.x, zn.z), 0.6);
      addInter({ x: bx, z: bz, r: 1.9, text: `敲响「${tn[1]}」钟`, mesh: g, act: () => { Voice.say(tn[2]); Sfx.pop(); UI.toast({ big: 'm' + tn[0], t1: tn[1], t2: `m${tn[0]} —「${tn[2]}」`, ms: 1600 }); let k = 0; const sw = () => { bell.rotation.z = Math.sin(k) * 0.4 * (1 - k / 12); if (++k < 12) requestAnimationFrame(sw); else bell.rotation.z = 0; }; sw(); } });
    });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; lantern(zn.x + Math.cos(a) * 19.5, zn.z + Math.sin(a) * 19.5, Y(zn.x + Math.cos(a) * 19.5, zn.z + Math.sin(a) * 19.5)); }
    const gate = paifang('拼音村', { w: 5.5, color: 0xD9A43B, roofC: 0xC0392B });
    const ga = Math.atan2(-zn.z, -zn.x), gx = zn.x + Math.cos(ga) * 20, gz = zn.z + Math.sin(ga) * 20;
    put(gate, gx, gz, -ga + Math.PI / 2); addCollider(gx + Math.cos(ga + Math.PI / 2) * 2.8, gz + Math.sin(ga + Math.PI / 2) * 2.8, 0.5); addCollider(gx - Math.cos(ga + Math.PI / 2) * 2.8, gz - Math.sin(ga + Math.PI / 2) * 2.8, 0.5);
  }

  function buildHanzi() {
    const zn = ZONES.find(z => z.id === 'hanzi');
    const altar = mesh(new T.CylinderGeometry(3, 3.4, 0.8, 8), 0x9FA69B); altar.position.set(zn.x, zn.h + 0.4, zn.z); scene.add(altar); addCollider(zn.x, zn.z, 3.2);
    npc({ name: '仓颉', x: zn.x, z: zn.z, dy: 0.8, robe: 0x6b4a2b, trim: 0xC9B06B, hat: 'straw', beard: true, fourEyes: true, item: 'bamboo', master: true, act: () => G().zoneMenu('hanzi'), say: '向仓颉学汉字', r: 5.2 });
    // 石碑环
    const inHz = c => GD.hanzi.some(h => h.c === c);
    const pics = GD.pictos.map(p => p.c).filter(inHz).concat(GD.hanzi.filter(h => h.lv === 1).map(h => h.c));
    const chars = U.uniq(pics).slice(0, 24);
    chars.forEach((ch, i) => {
      const a = i / chars.length * Math.PI * 2, r = 11 + (i % 2) * 2.2, x = zn.x + Math.cos(a) * r, z = zn.z + Math.sin(a) * r;
      const st = stele(ch); put(st, x, z, faceTo(x, z, zn.x, zn.z), 0.9);
      addInter({ x, z, r: 2.2, text: `读石碑「${ch}」`, mesh: st, act: () => G().hanziCard(ch) });
    });
    const gate = paifang('汉字林', { w: 5.5, color: 0x3E8E6E, roofC: 0x2F4F6B });
    const ga = Math.atan2(-zn.z, -zn.x), gx = zn.x + Math.cos(ga) * 19, gz = zn.z + Math.sin(ga) * 19;
    put(gate, gx, gz, -ga + Math.PI / 2);
    // 飘浮的甲骨
    for (let i = 0; i < 6; i++) {
      const b = mesh(new T.BoxGeometry(1.4, 0.12, 0.8), 0xE8DCC0); const ph = i;
      const x = zn.x + Math.cos(i) * 5, z = zn.z + Math.sin(i) * 5; b.position.set(x, zn.h + 4, z); scene.add(b);
      anims.push(t => { b.position.y = zn.h + 4 + Math.sin(t + ph) * 0.5; b.rotation.y = t * 0.3 + ph; });
    }
  }

  function buildChengyu() {
    const zn = ZONES.find(z => z.id === 'chengyu');
    const cx = zn.x, cz = zn.z;
    // 城门
    const gate = paifang('成语城', { w: 7, h: 6, color: 0xA8322A, roofC: 0x2F4F6B });
    put(gate, cx, cz - 19, 0); addCollider(cx - 3.5, cz - 19, 0.6); addCollider(cx + 3.5, cz - 19, 0.6);
    // 城墙
    const wallM = mat(0x9C8F76);
    [[-1], [1]].forEach(([s]) => {
      const wl = mesh(new T.BoxGeometry(12, 3, 1), wallM); wl.position.set(cx + s * 10.5, zn.h + 1.5, cz - 19); scene.add(wl);
      for (let k = 0; k < 6; k++) { const m = mesh(new T.BoxGeometry(0.9, 0.6, 1), wallM); m.position.set(cx + s * (5 + k * 2), zn.h + 3.3, cz - 19); scene.add(m); }
      for (let k = -5; k <= 5; k++) addCollider(cx + s * (5 + (k + 5) * 1.1), cz - 19, 0.7);
    });
    // 街道两侧店铺，牌匾写成语
    const plaqueWords = ['守株待兔', '画龙点睛', '亡羊补牢', '胸有成竹', '井底之蛙', '对牛弹琴', '狐假虎威', '刻舟求剑'].filter(w => GD.chengyu.some(c => c.w === w));
    const extra = GD.chengyu.filter(c => c.story).map(c => c.w);
    const words = U.uniq(plaqueWords.concat(extra)).slice(0, 8);
    const walls = [0xF1EBDD, 0xE8DCC0, 0xF1EBDD, 0xEADFC9];
    for (let i = 0; i < 8; i++) {
      const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), x = cx + side * 8, z = cz - 11 + row * 7.5;
      const hs = house({ w: 5, d: 4.4, h: 2.5, wall: walls[i % 4], roofC: 0x3D4A55, stories: i === 3 ? 2 : 1 });
      put(hs, x, z, side > 0 ? -Math.PI / 2 : Math.PI / 2, 3.2);
      const w = words[i];
      if (w) {
        const pm = new T.Mesh(new T.PlaneGeometry(3.2, 0.8), new T.MeshBasicMaterial({ map: tex(w, { w: 420, h: 105, bg: '#1B2226', fg: '#F3DFA8', font: BRUSH, size: 74, border: '#D9A43B', bw: 6 }) }));
        pm.position.set(x - side * 2.56, Y(x, z) + 3.3, z); pm.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2; scene.add(pm);
        addInter({ x: x - side * 3.2, z, r: 2.4, text: `看牌匾「${w}」`, mesh: hs, act: () => G().chengyuCard(w) });
      }
      lantern(x - side * 3.4, z + 2.2, Y(x, z));
    }
    // 茶馆：说书人
    const tea = house({ w: 9, d: 6, h: 3, wall: 0xE8DCC0, roofC: 0x2F4F6B, stories: 2 });
    put(tea, cx, cz + 17, Math.PI, 5.5);
    const sign = new T.Mesh(new T.PlaneGeometry(3.6, 1), new T.MeshBasicMaterial({ map: tex('说书茶馆', { w: 460, h: 128, bg: '#8E2419', fg: '#F3DFA8', font: BRUSH, size: 88 }) }));
    sign.position.set(cx, Y(cx, cz + 17) + 4, cz + 13.9); sign.rotation.y = Math.PI; scene.add(sign);
    npc({ name: '说书人', x: cx, z: cz + 11.5, robe: 0x2B3A4A, hat: 'hood', beard: true, item: 'fan', master: true, act: () => G().zoneMenu('chengyu'), say: '听说书人讲成语', face: Math.PI });
    const table = mesh(new T.BoxGeometry(2, 0.9, 1), 0x6b4a2b); table.position.set(cx, zn.h + 0.45, cz + 10.2); scene.add(table);
    // 杂货铺掌柜
    npc({ name: '杂货铺掌柜', x: cx + 4.5, z: cz - 12, robe: 0xB8862F, hat: 'hood', act: () => G().shop(), say: '逛逛杂货铺', face: -Math.PI / 2 });
    // 彩蛋：守株待兔
    const sx = cx - 15, sz = cz - 2;
    const stump = mesh(new T.CylinderGeometry(0.6, 0.75, 0.8, 8), 0x6b4a2b); put(stump, sx, sz, 0, 0.8, 0.4);
    const rabbit = makeRabbit(); put(rabbit, sx + 1, sz + 0.3, -1.2);
    const farmer = person({ robe: 0x8C7A5B, hat: 'straw' }); put(farmer, sx - 1.3, sz, 1.4); farmer.userData.parts.body.rotation.x = 0.2;
    addInter({ x: sx, z: sz, r: 2.8, text: '这个农夫在等什么？', mesh: stump, act: () => G().chengyuCard('守株待兔') });
    // 彩蛋：井底之蛙
    const wx = cx + 15, wz = cz + 4;
    const well = new T.Group();
    well.add(mesh(new T.CylinderGeometry(1, 1.1, 1, 10, 1, true), new T.MeshLambertMaterial({ color: 0x9C8F76, side: T.DoubleSide, flatShading: true }), 0, 0.5, 0));
    const wtr = new T.Mesh(new T.CircleGeometry(0.95, 10), new T.MeshLambertMaterial({ color: 0x2E6F85 })); wtr.rotation.x = -Math.PI / 2; wtr.position.y = 0.6; well.add(wtr);
    const frog = new T.Group(); frog.add(mesh(new T.SphereGeometry(0.22, 8, 6), 0x5E9E4E)); [-1, 1].forEach(s => frog.add(mesh(new T.SphereGeometry(0.07, 6, 4), 0xffffff, s * 0.1, 0.16, 0.1)));
    frog.position.y = 0.72; well.add(frog);
    anims.push(t => { frog.position.y = 0.72 + Math.max(0, Math.sin(t * 2)) * 0.3; });
    put(well, wx, wz, 0, 1.2);
    addInter({ x: wx, z: wz, r: 2.6, text: '井里有只青蛙', mesh: well, act: () => G().chengyuCard('井底之蛙') });
    // 彩蛋：刻舟求剑（海边小船）
    const bp = shoreFrom(cx, cz, Math.atan2(cz, cx) + 0.15, 2);
    if (bp) {
      const boat = makeBoat(); boat.position.set(bp.x, 0.2, bp.z); boat.rotation.y = Math.atan2(bp.x - cx, bp.z - cz); scene.add(boat);
      anims.push(t => { boat.position.y = 0.15 + Math.sin(t * 1.3) * 0.08; boat.rotation.z = Math.sin(t) * 0.05; });
      addInter({ x: bp.lx, z: bp.lz, r: 4, text: '船上的人在船舷刻记号', mesh: boat, act: () => G().chengyuCard('刻舟求剑') });
    }
  }
  function makeRabbit() {
    const g = new T.Group();
    const b = mesh(new T.SphereGeometry(0.3, 8, 6), 0xF4F1EA); b.scale.set(1, 0.85, 1.2); b.position.y = 0.28; g.add(b);
    const h = mesh(new T.SphereGeometry(0.2, 8, 6), 0xF4F1EA, 0, 0.55, 0.28); g.add(h);
    [-1, 1].forEach(s => { const e = mesh(new T.CylinderGeometry(0.05, 0.06, 0.4, 5), 0xF4F1EA, s * 0.08, 0.85, 0.24); e.rotation.z = s * 0.2; g.add(e); });
    g.add(mesh(new T.SphereGeometry(0.03, 4, 4), 0xC0392B, 0.08, 0.6, 0.45)); g.add(mesh(new T.SphereGeometry(0.03, 4, 4), 0xC0392B, -0.08, 0.6, 0.45));
    return g;
  }
  function makeBoat() {
    const g = new T.Group();
    const hull = mesh(new T.BoxGeometry(1.6, 0.6, 4.4), 0x6b4a2b); hull.position.y = 0.2; g.add(hull);
    [-1, 1].forEach(s => { const t = mesh(new T.ConeGeometry(0.8, 1, 4), 0x6b4a2b); t.rotation.x = s * Math.PI / 2; t.position.set(0, 0.2, s * 2.6); t.scale.set(1, 1, 0.4); g.add(t); });
    const man = person({ robe: 0x3E7FA0, hat: 'scholar', item: 'sword' }); man.position.set(0, 0.5, 0.5); man.rotation.y = Math.PI / 2; g.add(man);
    return g;
  }
  function shoreFrom(cx, cz, ang, back = 2) {
    for (let d = 0; d < 80; d += 0.5) {
      const x = cx + Math.cos(ang) * d, z = cz + Math.sin(ang) * d;
      if (groundH(x, z) < -0.8) {
        const lx = cx + Math.cos(ang) * (d - 5 - back), lz = cz + Math.sin(ang) * (d - 5 - back);
        return { x: cx + Math.cos(ang) * (d + back), z: cz + Math.sin(ang) * (d + back), lx, lz };
      }
    }
    return null;
  }

  function buildPoem() {
    const zn = ZONES.find(z => z.id === 'poem');
    const pv = pavilion(3, 3.2, 0xA8322A, 0x2F6B5A); put(pv, zn.x, zn.z, 0);
    const pvName = new T.Mesh(new T.PlaneGeometry(2.4, 0.7), new T.MeshBasicMaterial({ map: tex('醉月亭', { w: 300, h: 88, bg: '#1B2226', fg: '#F3DFA8', font: BRUSH, size: 66 }), side: T.DoubleSide }));
    pvName.position.set(zn.x, zn.h + 3.6, zn.z + 3.1); scene.add(pvName);
    [0, 1, 2, 3, 4, 5].forEach(i => { const a = i / 6 * Math.PI * 2; addCollider(zn.x + Math.cos(a) * 3, zn.z + Math.sin(a) * 3, 0.3); });
    npc({ name: '李白', x: zn.x, z: zn.z, dy: 0.6, robe: 0xF1EBDD, trim: 0x1E5B78, hat: 'scholar', beard: true, item: 'gourd', master: true, act: () => G().zoneMenu('poem'), say: '和诗仙李白对诗', r: 5.5 });
    const poets = [
      ['杜甫', -58, 17, 0x6b6f5a, 'hood', true], ['白居易', -54, 28, 0x8C7A5B, 'scholar', true], ['苏轼', -72, 18, 0x2B3A4A, 'hood', true],
      ['李清照', -60, 42, 0xE8A0B4, 'flower', false], ['孟浩然', -76, 36, 0x5E9E4E, 'straw', true], ['王维', -80, 26, 0xDCE7E3, 'hood', true]
    ];
    poets.forEach(([n, x, z, robe, hat, beard]) => npc({ name: n, x, z, robe, hat, beard, act: () => G().poetCard(n), say: `拜访${n}` }));
    // 杜甫草堂
    const hut = house({ w: 4, d: 3.5, h: 2.1, wall: 0xC9B06B, roofC: 0xB8A060 }); put(hut, -55, 13, faceTo(-55, 13, zn.x, zn.z), 3);
    // 鹅池
    const px = -52, pz = 38, py = Y(px, pz);
    const pond = new T.Mesh(new T.CircleGeometry(5, 20), new T.MeshPhongMaterial({ color: 0x3E9BB5, shininess: 90 })); pond.rotation.x = -Math.PI / 2; pond.position.set(px, py + 0.08, pz); scene.add(pond);
    addCollider(px, pz, 4.6);
    const geese = [];
    for (let i = 0; i < 3; i++) {
      const g = new T.Group(); const b = mesh(new T.SphereGeometry(0.35, 8, 6), 0xffffff); b.scale.set(0.8, 0.7, 1.2); g.add(b);
      const n = mesh(new T.CylinderGeometry(0.07, 0.09, 0.6, 6), 0xffffff, 0, 0.35, 0.3); n.rotation.x = -0.4; g.add(n);
      g.add(mesh(new T.SphereGeometry(0.12, 6, 5), 0xffffff, 0, 0.66, 0.42)); g.add(mesh(new T.ConeGeometry(0.05, 0.16, 5), 0xE8962B, 0, 0.64, 0.56)).children;
      const beak = g.children[g.children.length - 1]; beak.rotation.x = Math.PI / 2;
      scene.add(g); geese.push(g);
    }
    anims.push(t => geese.forEach((g, i) => { const a = t * 0.3 + i * 2.1; g.position.set(px + Math.cos(a) * 2.8, py + 0.2, pz + Math.sin(a) * 2.8); g.rotation.y = -a; }));
    addInter({ x: px, z: pz, r: 6.5, text: '鹅鹅鹅，曲项向天歌', mesh: pond, act: () => G().poemByTitle('咏鹅') });
    // 柳树环池
    for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28 + 0.3; willow(px + Math.cos(a) * 6.6, pz + Math.sin(a) * 6.6); }
    // 瀑布
    const fx = -79, fz = 38, top = Y(-83, 42) + 1, bot = Y(fx, fz);
    const fc = document.createElement('canvas'); fc.width = 64; fc.height = 256; const g2 = fc.getContext('2d');
    for (let i = 0; i < 90; i++) { g2.fillStyle = `rgba(255,255,255,${U.rand(.3, .9)})`; g2.fillRect(U.rand(0, 64), U.rand(0, 256), U.rand(1, 4), U.rand(20, 70)); }
    const ftex = new T.CanvasTexture(fc); ftex.wrapS = ftex.wrapT = T.RepeatWrapping;
    const fall = new T.Mesh(new T.PlaneGeometry(3, Math.max(4, top - bot + 2)), new T.MeshBasicMaterial({ map: ftex, color: 0xBFE6F2, transparent: true, opacity: 0.85, side: T.DoubleSide }));
    fall.position.set(fx - 1.2, (top + bot) / 2 + 0.5, fz + 1.2); fall.rotation.y = faceTo(fx, fz, zn.x, zn.z); scene.add(fall);
    anims.push((t, dt) => { ftex.offset.y += dt * 1.2; });
    const pool = new T.Mesh(new T.CircleGeometry(2.6, 16), new T.MeshPhongMaterial({ color: 0x5FB8D0 })); pool.rotation.x = -Math.PI / 2; pool.position.set(fx, bot + 0.1, fz); scene.add(pool);
    addInter({ x: fx, z: fz, r: 4.5, text: '飞流直下三千尺', mesh: fall, act: () => G().poemByTitle('望庐山瀑布') });
    // 山顶鹳雀楼
    const lou = pagoda(4, 2.6, 0xE8DCC0, 0x2F4F6B); put(lou, PEAK.x, PEAK.z, 0.3, 3.4);
    const louTag = label('鹳雀楼', { scale: 1.3 }); louTag.position.set(PEAK.x, Y(PEAK.x, PEAK.z) + lou.userData.top + 3.5, PEAK.z); scene.add(louTag);
    npc({ name: '王之涣', x: PEAK.x + 4, z: PEAK.z - 2, robe: 0x1E5B78, hat: 'scholar', beard: true, act: () => G().poemByTitle('登鹳雀楼', true), say: '欲穷千里目，更上一层楼' });
    PATHS.length; // 路径已在初始化时登记
    // 月下亭灯
    for (let i = 0; i < 4; i++) { const a = i / 4 * 6.28 + 0.8; lantern(zn.x + Math.cos(a) * 7, zn.z + Math.sin(a) * 7, zn.h); }
  }
  function willow(x, z) {
    const g = new T.Group();
    g.add(mesh(new T.CylinderGeometry(0.16, 0.22, 2, 5), 0x5a3a22, 0, 1, 0));
    const c = new T.Mesh(new T.ConeGeometry(1.5, 3.2, 8, 1, true), new T.MeshLambertMaterial({ color: 0x9ACD6A, side: T.DoubleSide, flatShading: true })); c.position.y = 2.4; c.castShadow = true; g.add(c);
    put(g, x, z, 0, 0.4);
  }

  let GATES = [];
  function buildHistory() {
    const zn = ZONES.find(z => z.id === 'history');
    const R = 22, dyn = GD.dynasties;
    const a0 = Math.atan2(-zn.z, -zn.x);
    const span = Math.PI * 2 - 0.7;
    const featured = { '远古': '黄帝', '夏': '大禹', '商': '商汤', '西周': '周武王', '春秋': '孔子', '战国': '屈原', '秦': '秦始皇', '西汉': '张骞', '东汉': '蔡伦', '三国': '诸葛亮', '东晋': '王羲之', '南北朝': '祖冲之', '隋': '隋文帝', '唐': '唐太宗', '北宋': '毕昇', '南宋': '岳飞', '元': '郭守敬', '明': '郑和', '清': '林则徐' };
    const looks = { '皇帝': ['crown', 0xD9A43B], '军事家': ['helmet', 0x8E2419], '民族英雄': ['helmet', 0x8E2419], '思想家': ['hood', 0x6b6f5a], '科学家': ['scholar', 0x1E5B78], '发明家': ['scholar', 0x3E8E6E], '文学家': ['scholar', 0xF1EBDD], '航海家': ['scholar', 0x1E5B78], '政治家': ['scholar', 0x8C2A2A], '外交家': ['hood', 0x7A4E9C] };
    dyn.forEach((d, i) => {
      const a = a0 + 0.35 + i / Math.max(1, dyn.length - 1) * span;
      const x = zn.x + Math.cos(a) * R, z = zn.z + Math.sin(a) * R;
      const col = new T.Color(d.color || '#8C2A2A').getHex();
      const gate = paifang(d.n, { w: 3.6, h: 4.2, color: col, roofC: 0x2F4F6B, plaqueBg: d.color || '#8C2A2A', plaqueFg: '#FFF8EA' });
      put(gate, x, z, -a); // 门洞沿切线方向
      const rx = Math.cos(a), rz = Math.sin(a);
      addCollider(x + rx * 1.8, z + rz * 1.8, 0.45); addCollider(x - rx * 1.8, z - rz * 1.8, 0.45);
      const yr = label(`${U.yearStr(d.start)} — ${U.yearStr(d.end)}`, { scale: 0.55, font: '"Helvetica Neue",Arial,Roboto,sans-serif' }); yr.position.set(x, Y(x, z) + 5.9, z); scene.add(yr);
      addInter({ x, z, r: 2.6, text: `了解「${d.full || d.n}」`, mesh: gate, act: () => G().dynastyCard(d.n) });
      GATES.push({ x, z, d });
      const fname = featured[d.n] || (GD.figures.find(f => f.d === d.n) || {}).n;
      const fig = GD.figures.find(f => f.n === fname);
      if (fig) {
        const fx = zn.x + Math.cos(a) * (R + 4), fz = zn.z + Math.sin(a) * (R + 4);
        const lk = looks[fig.role] || ['hood', 0x5E6E7A];
        npc({ name: fig.n, x: fx, z: fz, robe: lk[1], hat: lk[0], beard: !/武则天|文成|花木兰|李清照/.test(fig.n), act: () => G().figureCard(fig.n), say: `和${fig.n}聊聊`, r: 2.4 });
      }
    });
    // 中央史馆 + 鼎
    const hall = house({ w: 7, d: 5, h: 3, wall: 0xE8DCC0, roofC: 0xD9A43B, stories: 1 }); put(hall, zn.x - Math.cos(a0) * 5, zn.z - Math.sin(a0) * 5, faceTo(zn.x, zn.z, 0, 0), 4.2);
    npc({ name: '司马迁', x: zn.x + Math.cos(a0) * 2, z: zn.z + Math.sin(a0) * 2, robe: 0x2B3A4A, hat: 'scholar', beard: true, item: 'scroll', master: true, act: () => G().zoneMenu('history'), say: '请太史公讲历史' });
    const ding = makeDing(); const dx = zn.x + Math.cos(a0 + 1.4) * 7, dz = zn.z + Math.sin(a0 + 1.4) * 7; put(ding, dx, dz, 0, 1.6);
    addInter({ x: dx, z: dz, r: 3, text: '参观文物珍宝馆', mesh: ding, act: () => G().relics() });
    // 兵马俑坑
    const tx = -18, tz = -92;
    if (isLand(tx, tz, 1)) {
      const pit = mesh(new T.BoxGeometry(12, 0.3, 7), 0xB39A6E); pit.position.set(tx, Y(tx, tz) + 0.05, tz); scene.add(pit);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
        const w = person({ robe: 0x9C7A55, trim: 0x8C6A45, skin: 0xA8865C, hair: 0x8C6A45, hat: 'bun' });
        w.position.set(tx - 5 + c * 2, Y(tx, tz) + 0.2, tz - 2 + r * 2); w.scale.setScalar(0.85); scene.add(w);
      }
      addCollider(tx, tz, 5.5);
      addInter({ x: tx, z: tz + 5, r: 5, text: '这是秦始皇的兵马俑', act: () => G().relicCard('兵马俑') });
    }
    // 长城
    const gwx = 20, gwz = -104;
    const gwY = Y(gwx, gwz);
    if (gwY > 1) {
      for (let i = -6; i <= 6; i++) {
        const x = gwx + i * 2.2, z = gwz + Math.sin(i * 0.5) * 2, y = Y(x, z);
        const seg = mesh(new T.BoxGeometry(2.3, 2.6, 2.2), 0xA89C84); seg.position.set(x, y + 1, z); scene.add(seg);
        [-1, 1].forEach(s => { const m = mesh(new T.BoxGeometry(0.7, 0.6, 0.3), 0xA89C84); m.position.set(x, y + 2.6, z + s * 0.95); scene.add(m); });
        addCollider(x, z, 1.1);
      }
      const tower = house({ w: 3.5, d: 3.5, h: 3.2, wall: 0xA89C84, roofC: 0x3D4A55, pillar: 0x8C7A5B }); put(tower, gwx, gwz + 0.2, 0, 2.2, 2.2);
      addInter({ x: gwx, z: gwz + 4, r: 4.5, text: '登上长城看一看', act: () => G().relicCard('长城') });
    }
  }
  function makeDing() {
    const g = new T.Group(); const bronze = 0x5E7F6B;
    g.add(mesh(new T.BoxGeometry(2, 1.4, 1.6), bronze, 0, 1.4, 0));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => g.add(mesh(new T.CylinderGeometry(0.16, 0.2, 0.9, 6), bronze, x * 0.8, 0.45, z * 0.6)));
    [-1, 1].forEach(s => g.add(mesh(new T.TorusGeometry(0.3, 0.07, 4, 8, Math.PI), bronze, s * 0.7, 2.1, 0)));
    return g;
  }

  /* ---------- 小岛宝塔 + 栈桥 ---------- */
  function buildIslet() {
    const a = Math.atan2(ISLET.z, ISLET.x);
    let sx = 0, sz = 0;
    for (let d = 90; d < 140; d += 0.5) { const x = Math.cos(a) * d, z = Math.sin(a) * d; if (groundH(x, z) < 1.2) { sx = Math.cos(a) * (d - 3); sz = Math.sin(a) * (d - 3); break; } }
    const ex = ISLET.x - Math.cos(a) * 4, ez = ISLET.z - Math.sin(a) * 4;
    BRIDGE = [sx, sz, ex, ez];
    const len = Math.hypot(ex - sx, ez - sz), n = Math.ceil(len / 1.1);
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = U.lerp(sx, ex, t), z = U.lerp(sz, ez, t);
      const plank = mesh(new T.BoxGeometry(3, 0.16, 1), 0x8B6A45); plank.position.set(x, 1.2, z); plank.rotation.y = -a + Math.PI / 2; scene.add(plank);
      if (i % 3 === 0) [-1, 1].forEach(s => { const p = mesh(new T.CylinderGeometry(0.1, 0.1, 3, 5), 0x5a3a22); p.position.set(x + Math.cos(a + Math.PI / 2) * s * 1.5, 0.3, z + Math.sin(a + Math.PI / 2) * s * 1.5); scene.add(p); });
    }
    const pg = pagoda(6, 1.8, 0xF1EBDD, 0x7A4E9C); put(pg, ISLET.x + 1.5, ISLET.z + 1, 0, 2.6);
  }

  /* ---------- 宝箱 ---------- */
  const CHESTS = [];
  function buildChests() {
    const rng = U.seeded(2026);
    const spots = [
      { x: PEAK.x - 3.5, z: PEAK.z + 3.5, hint: '山顶' }, { x: ISLET.x - 2, z: ISLET.z - 2.5, hint: '小岛' },
      { x: -79 + 3, z: 38 - 2.5, hint: '瀑布' }, { x: 10 + 4, z: 80 + 21, hint: '茶馆后' }, { x: 30, z: -99, hint: '长城边' }
    ];
    for (let i = 0; i < 4000 && spots.length < 42; i++) {
      const x = (rng() * 2 - 1) * 125, z = (rng() * 2 - 1) * 125, y = height(x, z);
      if (y < 1.3 || y > 26 || nearZoneCore(x, z, 1.0) || onPath(x, z, 3)) continue;
      if (spots.some(s => Math.hypot(s.x - x, s.z - z) < 13)) continue;
      if (colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 1)) continue;
      spots.push({ x, z });
    }
    HUD.chestTotal = spots.length;
    spots.forEach((s, i) => {
      const id = 'c' + i, open = !!S.chests[id];
      const g = new T.Group();
      g.add(mesh(new T.BoxGeometry(1.1, 0.6, 0.75), 0x8B5A2B, 0, 0.3, 0));
      g.add(mesh(new T.BoxGeometry(1.14, 0.1, 0.79), 0xD9A43B, 0, 0.55, 0));
      const lidP = new T.Group(); lidP.position.set(0, 0.6, -0.37); g.add(lidP);
      const lid = mesh(new T.CylinderGeometry(0.37, 0.37, 1.1, 8, 1, false, 0, Math.PI), 0x8B5A2B); lid.rotation.z = Math.PI / 2; lid.position.z = 0.37; lidP.add(lid);
      const lock = mesh(new T.BoxGeometry(0.18, 0.22, 0.06), 0xD9A43B, 0, 0.5, 0.39); g.add(lock);
      const glow = new T.Mesh(new T.RingGeometry(0.8, 1.2, 24), new T.MeshBasicMaterial({ color: 0xFFE9A8, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false }));
      glow.rotation.x = -Math.PI / 2; glow.position.y = 0.05; g.add(glow);
      if (open) { lidP.rotation.x = -1.9; glow.visible = false; }
      put(g, s.x, s.z, rng() * 6.28, 0.7);
      const c = { id, g, lidP, glow, x: s.x, z: s.z, open };
      anims.push(t => { if (!c.open) { glow.material.opacity = 0.35 + Math.sin(t * 3 + i) * 0.25; glow.scale.setScalar(1 + Math.sin(t * 3 + i) * 0.1); } });
      c.inter = addInter({ x: s.x, z: s.z, r: 2.2, text: open ? '空宝箱' : '打开宝箱', mesh: g, act: () => openChest(c) });
      CHESTS.push(c);
    });
  }
  function openChest(c) {
    if (c.open) { UI.toast({ big: '空', t1: '这个宝箱已经打开过了', ms: 1400 }); return; }
    c.open = true; S.chests[c.id] = Date.now(); c.inter.text = '空宝箱';
    let k = 0; const anim = () => { c.lidP.rotation.x = -1.9 * Math.min(1, ++k / 20); if (k < 20) requestAnimationFrame(anim); }; anim();
    c.glow.visible = false; Sfx.chest(); burst(c.x, Y(c.x, c.z) + 1, c.z, 0xFFD36B);
    setTimeout(() => G().chest(), 500);
    HUD.update(); Save.soon();
  }

  /* ---------- 字灵 ---------- */
  const SPIRITS = [];
  function spiritTexture(ch) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 6, 64, 64, 62); grd.addColorStop(0, 'rgba(255,214,110,.75)'); grd.addColorStop(1, 'rgba(255,190,60,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill();
    g.font = `88px ${KAI}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 7; g.strokeStyle = '#7A3E0A'; g.strokeText(ch, 64, 68); g.fillStyle = '#FFF6D0'; g.fillText(ch, 64, 68);
    return new T.CanvasTexture(c);
  }
  function randomLand(rng = Math.random) {
    for (let i = 0; i < 200; i++) { const x = (rng() * 2 - 1) * 120, z = (rng() * 2 - 1) * 120; const y = height(x, z); if (y > 1.2 && y < 28 && !colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 0.8)) return { x, z }; }
    return { x: 5, z: 5 };
  }
  function pickSpiritChar() {
    const pool = GD.hanzi.length ? GD.hanzi : [{ c: '字', py: 'zì' }];
    const unseen = pool.filter(h => !S.learned.hanzi[h.c]);
    return U.pick(unseen.length > 20 && Math.random() < 0.75 ? unseen.slice(0, 160) : pool);
  }
  function makeSpirit() {
    const h = pickSpiritChar(), p = randomLand();
    const sp = new T.Sprite(new T.SpriteMaterial({ map: spiritTexture(h.c), transparent: true, depthWrite: false }));
    sp.scale.set(2.1, 2.1, 1); const y0 = Y(p.x, p.z) + 1.6;
    sp.position.set(p.x, y0, p.z); scene.add(sp);
    const s = { sp, h, x: p.x, z: p.z, y0, ph: Math.random() * 6 };
    SPIRITS.push(s); return s;
  }
  function collectSpirit(s) {
    scene.remove(s.sp); s.sp.material.map.dispose(); s.sp.material.dispose();
    SPIRITS.splice(SPIRITS.indexOf(s), 1);
    S.spirits++; Sfx.spirit(); Voice.say(s.h.c);
    burst(s.x, s.y0, s.z, 0xFFE38A);
    const w = (s.h.words && s.h.words[0]) || '';
    UI.toast({ big: s.h.c, t1: `收集字灵「${s.h.c}」 ${s.h.py || ''}`, t2: w ? `组词：${s.h.words.join('、')}` : '点图鉴可以复习', ms: 2600 });
    Reward.give(3, 1, true);
    if (S.spirits % 10 === 0) { Reward.give(30, 10, true); UI.toast({ big: '灵', t1: `已收集 ${S.spirits} 个字灵！`, t2: '奖励 30 学识、10 铜钱', ms: 3000 }); }
    setTimeout(makeSpirit, 4000);
  }

  /* ---------- 粒子 ---------- */
  const BURSTS = [];
  function burst(x, y, z, color = 0xFFD36B, n = 40, spread = 4) {
    const g = new T.BufferGeometry(), p = new Float32Array(n * 3), v = [];
    for (let i = 0; i < n; i++) { p.set([x, y, z], i * 3); v.push(U.rand(-1, 1) * spread, U.rand(1, 2.2) * spread, U.rand(-1, 1) * spread); }
    g.setAttribute('position', new T.BufferAttribute(p, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color, size: 0.35, transparent: true, depthWrite: false }));
    scene.add(pts); BURSTS.push({ pts, v, life: 1.4 });
  }
  W.celebrate = () => {
    if (!player) return;
    const cs = [0xFF6B6B, 0xFFD36B, 0x6BD3FF, 0xB58BE0, 0x8BE09A];
    for (let i = 0; i < 6; i++) setTimeout(() => burst(player.position.x + U.rand(-4, 4), player.position.y + U.rand(5, 9), player.position.z + U.rand(-4, 4), U.pick(cs), 60, 5), i * 250);
  };

  /* ---------- 玩家 ---------- */
  let player, pet = null, cloudMesh = null;
  const P = { vx: 0, vz: 0, vy: 0, onGround: true, face: 0, walk: 0, target: null, onArrive: null };
  const cam = { yaw: 0.6, pitch: 0.42, dist: 11, tYaw: 0.6 };
  const keys = {};
  const joy = { x: 0, y: 0, active: false };
  function buildPlayer() {
    player = person({ robe: 0x3E7FA0, hat: 'twin', item: null });
    const pos = S.pos || { x: 3, z: 16 };
    player.position.set(pos.x, Y(pos.x, pos.z), pos.z);
    scene.add(player);
    const shadowDisc = new T.Mesh(new T.CircleGeometry(0.6, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false }));
    shadowDisc.rotation.x = -Math.PI / 2; scene.add(shadowDisc); P.disc = shadowDisc;
    W.applyWear();
  }
  const ROBES = { qing: 0x3E7FA0, hong: 0xB8322A, bai: 0xEDE7DA, zi: 0x7A4E9C, huang: 0xD9A43B, lv: 0x3E8E6E };
  W.applyWear = () => {
    if (!player) return;
    const p = player.userData.parts;
    const robe = ROBES[S.wear.robe] || ROBES.qing;
    p.robeM.material = mat(robe); p.arms.forEach(a => { a.children[0].material = mat(robe); });
    setHat(p, S.wear.hat || 'twin');
    if (pet) { scene.remove(pet); pet = null; }
    if (S.wear.pet) { pet = makePet(S.wear.pet); pet.position.copy(player.position); scene.add(pet); }
    if (cloudMesh) { player.remove(cloudMesh); cloudMesh = null; }
    if (S.wear.cloud) {
      cloudMesh = new T.Group(); const cm = new T.MeshLambertMaterial({ color: 0xFFFFFF, emissive: 0x333333, flatShading: true });
      for (let i = 0; i < 5; i++) { const b = new T.Mesh(new T.IcosahedronGeometry(U.rand(0.35, 0.55), 0), cm); b.position.set(U.rand(-0.6, 0.6), 0, U.rand(-0.5, 0.5)); cloudMesh.add(b); }
      cloudMesh.position.y = 0.05; player.add(cloudMesh);
    }
  };
  function makePet(kind) {
    const g = new T.Group();
    if (kind === 'panda') {
      const w = 0xF4F1EA, b = 0x1B1B1B;
      const body = mesh(new T.SphereGeometry(0.42, 10, 8), w, 0, 0.45, 0); body.scale.set(1, 0.9, 1.2); g.add(body);
      g.add(mesh(new T.SphereGeometry(0.3, 10, 8), w, 0, 0.85, 0.35));
      [-1, 1].forEach(s => { g.add(mesh(new T.SphereGeometry(0.1, 6, 5), b, s * 0.2, 1.1, 0.3)); g.add(mesh(new T.SphereGeometry(0.07, 6, 5), b, s * 0.11, 0.88, 0.6)); g.add(mesh(new T.SphereGeometry(0.13, 6, 5), b, s * 0.25, 0.2, 0.3)); g.add(mesh(new T.SphereGeometry(0.13, 6, 5), b, s * 0.25, 0.2, -0.3)); });
    } else if (kind === 'crane') {
      const body = mesh(new T.SphereGeometry(0.35, 8, 6), 0xffffff, 0, 0, 0); body.scale.set(0.8, 0.7, 1.4); g.add(body);
      const neck = mesh(new T.CylinderGeometry(0.05, 0.07, 0.8, 5), 0xffffff, 0, 0.35, 0.45); neck.rotation.x = 0.6; g.add(neck);
      g.add(mesh(new T.SphereGeometry(0.1, 6, 5), 0xC0392B, 0, 0.7, 0.68));
      const wings = [-1, 1].map(s => { const wg = mesh(new T.BoxGeometry(1.2, 0.04, 0.5), 0xF4F1EA, s * 0.7, 0.05, 0); g.add(wg); return wg; });
      g.userData.wings = wings; g.userData.fly = true;
    } else if (kind === 'rabbit') {
      const r = makeRabbit(); g.add(r); g.userData.hop = true;
    } else if (kind === 'qilin') {
      const gold = 0xD9A43B;
      const body = mesh(new T.BoxGeometry(0.6, 0.5, 1), gold, 0, 0.7, 0); g.add(body);
      g.add(mesh(new T.BoxGeometry(0.4, 0.4, 0.45), gold, 0, 1.1, 0.55));
      g.add(mesh(new T.ConeGeometry(0.06, 0.35, 5), 0xC0392B, 0, 1.45, 0.55));
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => g.add(mesh(new T.CylinderGeometry(0.07, 0.07, 0.5, 5), gold, x * 0.2, 0.25, z * 0.35)));
      g.add(mesh(new T.ConeGeometry(0.12, 0.5, 5), 0xC0392B, 0, 0.9, -0.6));
    }
    g.userData.kind = kind;
    return g;
  }

  /* ---------- 输入 ---------- */
  function setupInput(canvas) {
    addEventListener('keydown', e => {
      if (UI.open) { if (e.key === 'Escape') UI.close(); return; }
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); jump(); }
      if (e.code === 'KeyE' || e.code === 'Enter') { doInteract(); }
      if (e.code === 'KeyM') G().map();
      if (e.code === 'KeyB') G().book();
      if (e.code === 'KeyN') G().shop();
      if (/Arrow/.test(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => { keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
    // 视角拖动 + 点击
    let drag = null;
    const pts = new Map();
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      drag = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), id: e.pointerId, pinch: null };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; drag.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    canvas.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2 && drag && drag.pinch) {
        const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        cam.dist = U.clamp(cam.dist * drag.pinch / d, 5, 30); drag.pinch = d; return;
      }
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
      cam.tYaw -= dx * 0.006; cam.pitch = U.clamp(cam.pitch + dy * 0.004, 0.08, 1.25);
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (drag && drag.id === e.pointerId) {
        const moved = Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy), dt = performance.now() - drag.t;
        if (moved < 8 && dt < 400 && !drag.pinch) tap(e.clientX, e.clientY);
        drag = null;
      }
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('wheel', e => { e.preventDefault(); cam.dist = U.clamp(cam.dist + e.deltaY * 0.01, 5, 30); }, { passive: false });
    // 摇杆
    const jz = U.$('#joy'), knob = U.$('#joy i');
    let jid = null;
    const jmove = e => {
      const r = jz.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy), m = r.width / 2 - 10;
      if (d > m) { dx = dx / d * m; dy = dy / d * m; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; joy.x = dx / m; joy.y = dy / m;
    };
    jz.addEventListener('pointerdown', e => { e.stopPropagation(); jid = e.pointerId; jz.setPointerCapture(jid); joy.active = true; P.target = null; jmove(e); });
    jz.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jup = e => { if (e.pointerId !== jid) return; jid = null; joy.active = false; joy.x = joy.y = 0; knob.style.transform = ''; };
    jz.addEventListener('pointerup', jup); jz.addEventListener('pointercancel', jup);
    if (matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window) document.body.classList.add('touch');
    U.$('#prompt').addEventListener('click', () => doInteract());
  }
  const ray = new T.Raycaster(), ndc = new T.Vector2();
  function tap(cx, cy) {
    if (UI.open) return;
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set((cx - r.left) / r.width * 2 - 1, -(cy - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(clickables, true)[0];
    if (hit && hit.distance < 60) {
      let o = hit.object; while (o && !o.userData.onClick && !o.userData.inter) o = o.parent;
      if (o && o.userData.onClick) { o.userData.onClick(); return; }
      if (o && o.userData.inter) {
        const it = o.userData.inter, d = Math.hypot(player.position.x - it.x, player.position.z - it.z);
        if (d <= it.r + 0.5) { it.act(); return; }
        walkTo(it.x, it.z, it); return;
      }
    }
    const g = ray.intersectObject(W.terrain)[0];
    if (g && g.point.y > 0.5) { walkTo(g.point.x, g.point.z, null); markTarget(g.point); }
  }
  let tMark = null;
  function markTarget(p) {
    if (!tMark) { tMark = new T.Mesh(new T.RingGeometry(0.3, 0.5, 20), new T.MeshBasicMaterial({ color: 0xFFE9A8, transparent: true, depthWrite: false, side: T.DoubleSide })); tMark.rotation.x = -Math.PI / 2; scene.add(tMark); }
    tMark.position.set(p.x, p.y + 0.1, p.z); tMark.visible = true; tMark.userData.life = 1;
  }
  function walkTo(x, z, inter) { P.target = { x, z }; P.onArrive = inter; }
  function jump() { if (P.onGround) { P.vy = 7.5; P.onGround = false; Sfx.jump(); } }
  let nearInter = null;
  function doInteract() { if (UI.open) return; if (nearInter) { Sfx.click(); nearInter.act(); } }

  /* ---------- 更新 ---------- */
  let dayT = S.t || 0.3, curZone = null, bannerTimer = 0, lastSave = 0;
  const tmpC1 = new T.Color(), tmpC2 = new T.Color();
  const SKY = [
    [0.00, 0x0B1A33, 0x1D3557, 0.08, 0.38], [0.21, 0x1D3557, 0x3B5B8C, 0.15, 0.42], [0.26, 0x3B6FA8, 0xF2A774, 0.6, 0.6],
    [0.33, 0x5FA8D3, 0xCFE8EF, 1.0, 0.75], [0.5, 0x3F93CF, 0xD6ECF3, 1.1, 0.8], [0.68, 0x5A9AD0, 0xE7E2CC, 1.0, 0.75],
    [0.75, 0x6A7FB0, 0xF5B27A, 0.65, 0.6], [0.8, 0x2B3A67, 0xC06C5B, 0.25, 0.45], [0.86, 0x0F2240, 0x24406A, 0.1, 0.38], [1.0, 0x0B1A33, 0x1D3557, 0.08, 0.38]
  ];
  function skyAt(t) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (t >= a[0] && t <= b[0]) { const k = (t - a[0]) / (b[0] - a[0]); return { top: tmpC1.setHex(a[1]).lerp(new T.Color(b[1]), k), bot: tmpC2.setHex(a[2]).lerp(new T.Color(b[2]), k), sun: U.lerp(a[3], b[3], k), hemi: U.lerp(a[4], b[4], k) }; }
    }
    return { top: tmpC1.setHex(0x3F93CF), bot: tmpC2.setHex(0xD6ECF3), sun: 1, hemi: .8 };
  }
  const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
  function updateDay(dt) {
    if (S.settings.cycle !== false) dayT = (dayT + dt / 600) % 1; else dayT = 0.42;
    S.t = dayT;
    const s = skyAt(dayT);
    skyMat.uniforms.top.value.copy(s.top); skyMat.uniforms.bottom.value.copy(s.bot);
    scene.fog.color.copy(s.bot);
    sun.intensity = s.sun * 0.95; hemi.intensity = s.hemi;
    const night = U.clamp(1 - s.sun * 1.6, 0, 1);
    hemi.color.setHSL(0.58, 0.4 + night * 0.2, 0.75 - night * 0.25);
    const ang = (dayT - 0.25) * Math.PI * 2; // 日出=0
    const sx = Math.cos(ang), sy = Math.sin(ang);
    const px = player.position.x, pz = player.position.z;
    sun.position.set(px + sx * 50, Math.max(60, sy * 120), pz + 30);
    sun.target.position.set(px, 0, pz); sun.target.updateMatrixWorld();
    W.sunDisc.position.set(camera.position.x + sx * 420, sy * 420, camera.position.z - 150); W.sunDisc.visible = sy > -0.05;
    W.moon.position.set(camera.position.x - sx * 420, -sy * 420, camera.position.z - 150); W.moon.visible = -sy > -0.05;
    W.stars.material.opacity = night * 0.9; W.stars.position.copy(camera.position);
    sky.position.copy(camera.position);
    const lantOn = night > 0.35;
    LANTERNS.forEach(m => m.emissive.setHex(lantOn ? 0xFF6A2A : 0x000000));
    const hour = dayT * 24, idx = Math.floor(((hour + 1) % 24) / 2);
    const el = U.$('#clock'); const txt = `${SHICHEN[idx]}时${night > 0.5 ? ' · 夜' : ''}`; if (el.textContent !== txt) el.textContent = txt;
  }
  function updatePlayer(dt) {
    const p = player.position;
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz += 1; if (keys.KeyS || keys.ArrowDown) mz -= 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1; if (keys.KeyD || keys.ArrowRight) mx += 1;
    if (joy.active) { mx += joy.x; mz -= joy.y; }
    if (mx || mz) P.target = null;
    const fx = -Math.sin(cam.yaw), fz = -Math.cos(cam.yaw), rx = -fz, rz = fx;
    let dx = fx * mz + rx * mx, dz = fz * mz + rz * mx;
    if (P.target) {
      dx = P.target.x - p.x; dz = P.target.z - p.z; const d = Math.hypot(dx, dz);
      const stopR = P.onArrive ? Math.max(0.8, P.onArrive.r - 0.6) : 0.4;
      if (d < stopR) { const it = P.onArrive; P.target = null; P.onArrive = null; dx = dz = 0; if (it) it.act(); }
    }
    const len = Math.hypot(dx, dz);
    const run = keys.ShiftLeft || keys.ShiftRight || (joy.active && Math.hypot(joy.x, joy.y) > 0.92);
    const speed = (run ? 9.5 : 6) * (S.wear.cloud ? 1.55 : 1);
    if (len > 0.01) {
      const k = Math.min(1, len);
      dx = dx / len * speed * k * dt; dz = dz / len * speed * k * dt;
      let nx = p.x + dx, nz = p.z + dz;
      for (const c of colliders) {
        const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), min = c.r + 0.4;
        if (d < min && d > 0.0001) { nx = c.x + ddx / d * min; nz = c.z + ddz / d * min; }
      }
      if (height(nx, nz) > 0.35 || S.wear.cloud) { p.x = nx; p.z = nz; }
      else if (height(nx, p.z) > 0.35) p.x = nx; else if (height(p.x, nz) > 0.35) p.z = nz;
      else if (P.target) P.target = null;
      const lim = 160; p.x = U.clamp(p.x, -lim, lim); p.z = U.clamp(p.z, -lim, lim);
      const targetFace = Math.atan2(dx, dz);
      let df = targetFace - P.face; while (df > Math.PI) df -= Math.PI * 2; while (df < -Math.PI) df += Math.PI * 2;
      P.face += df * Math.min(1, dt * 12);
      P.walk += dt * speed * 1.6;
    } else P.walk *= 0.9;
    const gy = Math.max(height(p.x, p.z), S.wear.cloud ? 0.6 : -99) + (S.wear.cloud ? 0.35 : 0);
    P.vy -= 22 * dt; p.y += P.vy * dt;
    if (p.y <= gy) { p.y = gy; P.vy = 0; P.onGround = true; }
    player.rotation.y = P.face;
    const parts = player.userData.parts, sw = Math.sin(P.walk) * Math.min(1, len * 3);
    parts.arms[0].rotation.x = sw * 0.7; parts.arms[1].rotation.x = -sw * 0.7;
    parts.feet[0].position.z = 0.05 + sw * 0.22; parts.feet[1].position.z = 0.05 - sw * 0.22;
    parts.body.position.y = Math.abs(Math.cos(P.walk)) * 0.06 * Math.min(1, len * 3);
    P.disc.position.set(p.x, height(p.x, p.z) + 0.06, p.z);
    if (cloudMesh) cloudMesh.children.forEach((b, i) => { b.position.y = Math.sin(clock.elapsedTime * 3 + i) * 0.06; });
    // 宠物
    if (pet) {
      const bx = p.x - Math.sin(P.face) * 1.6 + Math.cos(P.face) * 1.1, bz = p.z - Math.cos(P.face) * 1.6 - Math.sin(P.face) * 1.1;
      pet.position.x += (bx - pet.position.x) * Math.min(1, dt * 4); pet.position.z += (bz - pet.position.z) * Math.min(1, dt * 4);
      const t = clock.elapsedTime;
      let py = height(pet.position.x, pet.position.z);
      if (pet.userData.fly) { py = Math.max(py, p.y) + 2.2 + Math.sin(t * 2) * 0.3; pet.userData.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 8) * 0.5 * (i ? -1 : 1); }); }
      if (pet.userData.hop) py += Math.abs(Math.sin(t * 6)) * 0.3 * Math.min(1, len * 4);
      pet.position.y += (py - pet.position.y) * Math.min(1, dt * 8);
      pet.rotation.y = Math.atan2(p.x - pet.position.x, p.z - pet.position.z);
    }
  }
  function updateCamera(dt) {
    let dy = cam.tYaw - cam.yaw; cam.yaw += dy * Math.min(1, dt * 10);
    const p = player.position;
    const cx = p.x + Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    const cz = p.z + Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist;
    let cy = p.y + 1.4 + Math.sin(cam.pitch) * cam.dist;
    // 镜头避障：玩家和镜头之间有建筑时把镜头拉近
    camHead.set(p.x, p.y + 1.4, p.z); camDir.set(cx, cy, cz).sub(camHead);
    const len = camDir.length(); camDir.normalize();
    camRay.set(camHead, camDir); camRay.far = len;
    const hit = camRay.intersectObjects(SOLIDS, true)[0];
    const want = hit ? Math.max(1.8, hit.distance - 0.6) : len;
    camCur = want < camCur ? want : U.lerp(camCur, want, Math.min(1, dt * 3));
    camera.position.copy(camHead).addScaledVector(camDir, Math.min(camCur, len));
    camera.position.y = Math.max(camera.position.y, height(camera.position.x, camera.position.z) + 1.2, 1.2);
    camera.lookAt(p.x, p.y + 1.4, p.z);
  }
  const camRay = new T.Raycaster(), camHead = new T.Vector3(), camDir = new T.Vector3();
  let camCur = 11;
  let promptShownFor = null;
  function updateInteract() {
    const p = player.position; let best = null, bd = 1e9;
    for (const it of inters) { const d = Math.hypot(p.x - it.x, p.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
    nearInter = best;
    const el = U.$('#prompt');
    if (best && !UI.open) {
      if (promptShownFor !== best || el.hidden || U.$('#prompt-text').textContent !== best.text) { U.$('#prompt-text').textContent = best.text; el.hidden = false; promptShownFor = best; }
      U.$('#prompt .k').textContent = document.body.classList.contains('touch') ? '点' : 'E';
    } else if (!el.hidden) { el.hidden = true; promptShownFor = null; }
    // 地区横幅
    let z = null;
    for (const zn of ZONES) if (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r * 0.9) z = zn;
    if (Math.hypot(p.x - PEAK.x, p.z - PEAK.z) < 7) z = { id: 'peak', name: '诗词山顶', sub: '一览众山小' };
    if (Math.hypot(p.x - ISLET.x, p.z - ISLET.z) < 8) z = { id: 'islet', name: '蓬莱小岛', sub: '海上仙山' };
    if (z && (!curZone || curZone.id !== z.id)) {
      U.$('#zb-name').textContent = z.name; U.$('#zb-sub').textContent = z.sub;
      U.$('#zone-banner').classList.add('show'); clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => U.$('#zone-banner').classList.remove('show'), 2600);
      if (!S.visited[z.id]) { S.visited[z.id] = 1; Reward.give(20, 5, true); UI.toast({ big: '游', t1: `初次来到「${z.name}」`, t2: '奖励 20 学识、5 铜钱', ms: 2600 }); }
    }
    curZone = z;
  }
  function updateSpirits(t) {
    const p = player.position;
    for (let i = SPIRITS.length - 1; i >= 0; i--) {
      const s = SPIRITS[i];
      s.sp.position.y = s.y0 + Math.sin(t * 2 + s.ph) * 0.35;
      if (Math.hypot(p.x - s.x, p.z - s.z) < 1.7 && Math.abs(p.y + 1 - s.sp.position.y) < 2.5) collectSpirit(s);
    }
  }
  function updateWater(t) {
    const a = waterPos.array;
    for (let i = 0; i < a.length; i += 3) { const x = waterBase[i], z = waterBase[i + 2]; a[i + 1] = Math.sin(x * 0.08 + t * 1.1) * 0.18 + Math.cos(z * 0.07 + t * 0.9) * 0.18; }
    waterPos.needsUpdate = true;
    water.geometry.computeVertexNormals();
  }

  /* ---------- 小地图 ---------- */
  let mapBase = null;
  function buildMapBase() {
    const N = 300, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
    const img = g.createImageData(N, N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / N * 2 - 1) * 150, z = (j / N * 2 - 1) * 150, y = height(x, z);
      let col;
      if (y < 0.3) col = [46 + y * 4, 110 + y * 6, 140 + y * 4];
      else if (y < 1.25) col = [230, 214, 162];
      else if (onPath(x, z, 1.8)) col = [205, 184, 140];
      else if (y < 13) col = [134 - y * 2, 191 - y * 3, 98 - y * 2];
      else col = [140 + (y - 13) * 3, 143 + (y - 13) * 3, 134 + (y - 13) * 3];
      const k = (j * N + i) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    mapBase = c;
  }
  const toMap = (x, z, N) => [(x / 150 + 1) / 2 * N, (z / 150 + 1) / 2 * N];
  W.drawMap = (cv, big = false) => {
    const g = cv.getContext('2d'), N = cv.width;
    g.clearRect(0, 0, N, N);
    g.save(); g.beginPath(); if (!big) { g.arc(N / 2, N / 2, N / 2, 0, Math.PI * 2); g.clip(); }
    g.drawImage(mapBase, 0, 0, N, N);
    const k = N / 300;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    ZONES.forEach(zn => {
      const [x, y] = toMap(zn.x, zn.z, N);
      g.fillStyle = 'rgba(192,57,43,.9)'; g.beginPath(); g.arc(x, y, 4 * k, 0, 7); g.fill();
      g.font = `${(big ? 17 : 15) * k}px ${BRUSH}`; g.lineWidth = 3 * k; g.strokeStyle = 'rgba(242,236,223,.95)'; g.strokeText(zn.name, x, y - 11 * k); g.fillStyle = '#1B2226'; g.fillText(zn.name, x, y - 11 * k);
    });
    if (big) {
      CHESTS.forEach(c => { if (c.open) { const [x, y] = toMap(c.x, c.z, N); g.fillStyle = '#8B5A2B'; g.fillRect(x - 3 * k, y - 2 * k, 6 * k, 4 * k); } });
      [[PEAK, '鹳雀楼'], [ISLET, '蓬莱岛']].forEach(([pt, n]) => { const [x, y] = toMap(pt.x, pt.z, N); g.font = `${12 * k}px ${BRUSH}`; g.fillStyle = '#1B2226'; g.fillText(n, x, y - 9 * k); g.beginPath(); g.arc(x, y, 3 * k, 0, 7); g.fill(); });
    }
    SPIRITS.forEach(s => { const [x, y] = toMap(s.x, s.z, N); g.fillStyle = '#FFD36B'; g.beginPath(); g.arc(x, y, 2.2 * k, 0, 7); g.fill(); });
    const [px, py] = toMap(player.position.x, player.position.z, N);
    g.translate(px, py); g.rotate(-P.face + Math.PI);
    g.fillStyle = '#C0392B'; g.strokeStyle = '#fff'; g.lineWidth = 2 * k;
    g.beginPath(); g.moveTo(0, -9 * k); g.lineTo(6 * k, 7 * k); g.lineTo(0, 3 * k); g.lineTo(-6 * k, 7 * k); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };

  /* ---------- 对外 ---------- */
  W.pause = v => { paused = v; if (v) { for (const k in keys) keys[k] = false; joy.active = false; } };
  W.teleport = id => {
    const zn = ZONES.find(z => z.id === id) || (id === 'peak' ? { x: PEAK.x + 5, z: PEAK.z - 5 } : id === 'islet' ? { x: ISLET.x - 3, z: ISLET.z + 3 } : null);
    if (!zn) return;
    const a = Math.atan2(-zn.z, -zn.x), d = zn.r ? ({ center: 7, pinyin: 11.5, hanzi: 6.5 }[zn.id] || 5) : 0;
    let x = zn.x + Math.cos(a) * d, z = zn.z + Math.sin(a) * d;
    for (let i = 0; i < 20 && colliders.some(c => Math.hypot(c.x - x, c.z - z) < c.r + 0.5); i++) { x += Math.cos(a) * 1; z += Math.sin(a) * 1; }
    burst(player.position.x, player.position.y + 1, player.position.z, 0xFFFFFF, 50, 3);
    player.position.set(x, height(x, z) + 0.5, z); P.target = null;
    cam.tYaw = cam.yaw = Math.atan2(x - zn.x, z - zn.z);
    Sfx.whoosh();
    setTimeout(() => burst(x, height(x, z) + 1, z, 0xFFFFFF, 50, 3), 100);
  };
  W.playerPos = () => player && { x: player.position.x, z: player.position.z };

  W.init = async function (canvas, progress) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    const lowEnd = (navigator.hardwareConcurrency || 4) <= 4 || matchMedia('(pointer: coarse)').matches;
    renderer.setPixelRatio(Math.min(devicePixelRatio, lowEnd ? 1.5 : 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = S.settings.shadows !== false;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    scene.fog = new T.Fog(0xD6ECF3, 90, 330);
    camera = new T.PerspectiveCamera(55, innerWidth / innerHeight, 0.3, 1400);
    hemi = new T.HemisphereLight(0xCFE8FF, 0x6B8E5A, 0.8); scene.add(hemi);
    sun = new T.DirectionalLight(0xFFF1D6, 1.0); sun.castShadow = true;
    sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 300 });
    sun.shadow.bias = -0.0008;
    scene.add(sun, sun.target);
    // 字体预载（画布文字需要）
    const txt = ZONES.map(z => z.name).join('') + GD.dynasties.map(d => d.n).join('') + '文曲星君今日功课醉月亭鹳雀楼说书茶馆学' + GD.chengyu.slice(0, 60).map(c => c.w).join('') + '音韵先生仓颉李白杜甫白居易苏轼李清照孟浩然王维王之涣司马迁杂货铺掌柜书童小墨' + GD.figures.map(f => f.n).join('');
    try { await Promise.race([document.fonts.load(`40px "Ma Shan Zheng"`, txt), new Promise(r => setTimeout(r, 3500))]); } catch (e) { }
    const step = async (msg, fn) => { progress(msg); await new Promise(r => setTimeout(r, 16)); fn(); };
    // 路径
    ZONES.slice(1).forEach(z => PATHS.push([0, 0, z.x * 0.82, z.z * 0.82]));
    const pz = ZONES.find(z => z.id === 'poem');
    PATHS.push([pz.x, pz.z, PEAK.x, PEAK.z]);
    await step('堆起山川…', () => { buildIslet(); buildTerrain(); buildSky(); });
    await step('修建广场…', buildCenter);
    await step('布置拼音村…', buildPinyin);
    await step('立起汉字碑…', buildHanzi);
    await step('开张成语城…', buildChengyu);
    await step('登上诗词山…', buildPoem);
    await step('铺开历史长廊…', buildHistory);
    await step('种下竹林花木…', buildTrees);
    await step('藏好宝箱…', buildChests);
    await step('唤醒字灵…', () => { for (let i = 0; i < 26; i++) makeSpirit(); buildPlayer(); buildMapBase(); });
    setupInput(canvas);
    addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });
    updateCamera(1);
    renderer.render(scene, camera);
  };
  W.setShadows = on => { renderer.shadowMap.enabled = on; scene.traverse(o => { if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { m.needsUpdate = true; }); } }); };
  W.start = function () {
    if (started) return; started = true;
    const mini = U.$('#minimap'); let mmT = 0;
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
      if (!paused) { updatePlayer(dt); updateInteract(); updateSpirits(t); }
      updateCamera(dt);
      updateDay(paused ? 0 : dt);
      anims.forEach(f => f(t, dt));
      W.clouds.forEach(c => { c.position.x += c.userData.v * dt; if (c.position.x > 260) c.position.x = -260; });
      updateWater(t);
      for (let i = BURSTS.length - 1; i >= 0; i--) {
        const b = BURSTS[i]; b.life -= dt; const a = b.pts.geometry.attributes.position;
        for (let j = 0; j < b.v.length / 3; j++) { b.v[j * 3 + 1] -= 9 * dt; a.array[j * 3] += b.v[j * 3] * dt; a.array[j * 3 + 1] += b.v[j * 3 + 1] * dt; a.array[j * 3 + 2] += b.v[j * 3 + 2] * dt; }
        a.needsUpdate = true; b.pts.material.opacity = Math.max(0, b.life / 1.4);
        if (b.life <= 0) { scene.remove(b.pts); b.pts.geometry.dispose(); BURSTS.splice(i, 1); }
      }
      if (tMark && tMark.visible) { tMark.userData.life -= dt; tMark.material.opacity = tMark.userData.life; if (tMark.userData.life <= 0) tMark.visible = false; }
      mmT += dt; if (mmT > 0.1) { mmT = 0; W.drawMap(mini); }
      if (t - lastSave > 5) { lastSave = t; S.pos = { x: player.position.x, z: player.position.z }; Save.soon(); }
      renderer.render(scene, camera);
    };
    loop();
  };
})();
