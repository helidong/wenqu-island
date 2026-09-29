/* 文曲岛奇遇 — 核心：工具、存档、声音、界面组件 */
(function () {
  'use strict';
  const GD = window.GD = window.GD || {};
  ['hanzi','combos','pictos','chengyu','chengyuChains','poems','poets','dynasties','figures','historyQ','relics','facts']
    .forEach(k => { if (!Array.isArray(GD[k])) GD[k] = []; });

  /* ---------- 工具 ---------- */
  const U = window.U = {
    $: (s, r = document) => r.querySelector(s),
    $$: (s, r = document) => Array.from(r.querySelectorAll(s)),
    rand: (a, b) => a + Math.random() * (b - a),
    ri: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
    pick: arr => arr[Math.floor(Math.random() * arr.length)],
    shuffle(arr) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    sample(arr, n) { return U.shuffle(arr).slice(0, n); },
    uniq: arr => Array.from(new Set(arr)),
    esc: s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
    // 用确定的种子生成随机数（宝箱位置等每次一致）
    seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; },
    yearStr(y) { return y < 0 ? `前${-y}年` : `${y}年`; }
  };

  /* ---------- 拼音工具 ---------- */
  const TONE = { a: 'āáǎà', o: 'ōóǒò', e: 'ēéěè', i: 'īíǐì', u: 'ūúǔù', 'ü': 'ǖǘǚǜ' };
  const UNMARK = {};
  Object.entries(TONE).forEach(([v, s]) => [...s].forEach((c, i) => { UNMARK[c] = [v, i + 1]; }));
  const PY = window.PY = {
    split(py) { // 'huā' -> {base:'hua', tone:1}
      let tone = 5, base = '';
      for (const ch of py.normalize('NFC')) { if (UNMARK[ch]) { base += UNMARK[ch][0]; tone = UNMARK[ch][1]; } else base += ch; }
      return { base: base.toLowerCase(), tone };
    },
    mark(base, tone) {
      if (tone < 1 || tone > 4) return base;
      let idx = -1;
      if (base.includes('a')) idx = base.indexOf('a');
      else if (base.includes('e')) idx = base.indexOf('e');
      else if (base.includes('ou')) idx = base.indexOf('o');
      else { for (let i = base.length - 1; i >= 0; i--) if ('iouü'.includes(base[i])) { idx = i; break; } }
      if (idx < 0) return base;
      const v = base[idx];
      return base.slice(0, idx) + TONE[v][tone - 1] + base.slice(idx + 1);
    },
    INITS: ['zh', 'ch', 'sh', 'b', 'p', 'm', 'f', 'd', 't', 'n', 'l', 'g', 'k', 'h', 'j', 'q', 'x', 'r', 'z', 'c', 's', 'y', 'w'],
    WHOLE: ['zhi', 'chi', 'shi', 'ri', 'zi', 'ci', 'si', 'yi', 'wu', 'yu', 'ye', 'yue', 'yuan', 'yin', 'yun', 'ying'],
    parts(py) { // 声母+韵母（整体认读返回 null）
      const { base, tone } = PY.split(py);
      if (PY.WHOLE.includes(base)) return null;
      const ini = PY.INITS.find(i => base.startsWith(i)) || '';
      let fin = base.slice(ini.length);
      if (['j', 'q', 'x', 'y'].includes(ini) && fin.startsWith('u')) fin = 'ü' + fin.slice(1);
      if (!fin) return null;
      return { ini, fin, tone, base };
    },
    // 容易混淆的干扰项
    confusers(py) {
      const { base, tone } = PY.split(py);
      const out = new Set();
      [1, 2, 3, 4].forEach(t => t !== tone && out.add(PY.mark(base, t)));
      const swaps = [['zh', 'z'], ['ch', 'c'], ['sh', 's'], ['n', 'l'], ['f', 'h'], ['b', 'p'], ['d', 't'], ['g', 'k'], ['j', 'q'], ['ang', 'an'], ['eng', 'en'], ['ing', 'in'], ['ong', 'eng']];
      swaps.forEach(([a, b]) => {
        if (base.includes(a)) out.add(PY.mark(base.replace(a, b), tone));
        else if (base.includes(b) && !base.includes(a)) out.add(PY.mark(base.replace(b, a), tone));
      });
      out.delete(py);
      return U.shuffle([...out]);
    }
  };

  /* ---------- 存档 ---------- */
  const SAVE_KEY = 'wenqu-island-v1';
  const RANKS = [
    { n: '童生', xp: 0 }, { n: '秀才', xp: 200 }, { n: '举人', xp: 600 }, { n: '贡士', xp: 1200 },
    { n: '进士', xp: 2000 }, { n: '探花', xp: 3200 }, { n: '榜眼', xp: 4600 }, { n: '状元', xp: 6200 }
  ];
  const fresh = () => ({
    xp: 0, coins: 30, spirits: 0,
    learned: { hanzi: {}, chengyu: {}, poems: {}, dyn: {}, figures: {} },
    seals: {}, best: {}, chests: {}, facts: {}, owned: {}, wear: { hat: null, robe: null, pet: null, cloud: false },
    settings: { voice: true, sfx: true, music: true, rate: 0.85 },
    stats: { correct: 0, played: 0 }, visited: {}, pos: null, t: 0.3
  });
  const S = window.S = (() => {
    let s = fresh();
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) s = deepMerge(fresh(), JSON.parse(raw)); } catch (e) { /* 无存储时正常运行 */ }
    return s;
  })();
  function deepMerge(a, b) {
    for (const k in b) {
      if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]);
      else a[k] = b[k];
    }
    return a;
  }
  let saveTimer = 0;
  const Save = window.Save = {
    now() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } },
    soon() { clearTimeout(saveTimer); saveTimer = setTimeout(Save.now, 400); },
    reset() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } location.reload(); },
    rank(xp = S.xp) { let r = 0; RANKS.forEach((k, i) => { if (xp >= k.xp) r = i; }); return r; },
    RANKS
  };

  /* ---------- 奖励 ---------- */
  const Reward = window.Reward = {
    give(xp, coins, silent) {
      const before = Save.rank();
      S.xp += xp; S.coins += coins;
      const after = Save.rank();
      HUD.update();
      Save.soon();
      if (after > before) {
        Sfx.fanfare();
        UI.toast({ big: RANKS[after].n[0], t1: `高中「${RANKS[after].n}」！`, t2: '继续探索，向状元进发', ms: 4200 });
        if (window.World) World.celebrate();
      } else if (!silent && (xp || coins)) {
        UI.toast({ big: '赏', t1: `+${xp} 学识  +${coins} 铜钱`, ms: 1800 });
      }
    },
    learn(kind, key, xp = 5) {
      if (S.learned[kind][key]) return false;
      S.learned[kind][key] = Date.now();
      Reward.give(xp, 1, true);
      return true;
    },
    seal(id, name) {
      const first = !S.seals[id];
      S.seals[id] = name;
      Save.soon(); HUD.update();
      return first;
    }
  };

  /* ---------- 语音 ---------- */
  let zhVoice = null;
  function pickVoice() {
    if (!('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices();
    zhVoice = vs.find(v => /zh[-_]CN/i.test(v.lang) && /Tingting|婷婷|Xiaoxiao|晓晓|Google/i.test(v.name))
      || vs.find(v => /zh[-_]CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  const Voice = window.Voice = {
    ok: 'speechSynthesis' in window,
    say(text, opts = {}) {
      if (!Voice.ok || !S.settings.voice || !text) return;
      try {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'zh-CN'; if (zhVoice) u.voice = zhVoice;
        u.rate = opts.rate || S.settings.rate; u.pitch = opts.pitch || 1.05;
        if (opts.onend) u.onend = opts.onend;
        Music.duck(true); u.addEventListener('end', () => Music.duck(false));
        speechSynthesis.speak(u);
      } catch (e) { /* ignore */ }
    },
    stop() { try { Voice.ok && speechSynthesis.cancel(); } catch (e) { } Music.duck(false); }
  };

  /* ---------- 音效（WebAudio 合成） ---------- */
  let AC = null, master = null;
  function ac() {
    if (!AC) {
      const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
      AC = new C(); master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }
  function tone(freq, dur = 0.15, type = 'sine', vol = 0.3, when = 0, dest) {
    const a = ac(); if (!a) return;
    const t = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  // 类古筝拨弦：三角波 + 快衰减 + 微泛音
  function pluck(freq, when = 0, vol = 0.18, dest) {
    tone(freq, 1.6, 'triangle', vol, when, dest); tone(freq * 2, 0.6, 'sine', vol * 0.35, when, dest); tone(freq * 3.01, 0.25, 'sine', vol * 0.12, when, dest);
  }
  const PENTA = [0, 2, 4, 7, 9]; // 宫商角徵羽
  const note = (deg, base = 293.66) => base * Math.pow(2, (PENTA[((deg % 5) + 5) % 5] + 12 * Math.floor(deg / 5)) / 12);
  const Sfx = window.Sfx = {
    unlock() { ac(); },
    on: () => S.settings.sfx,
    ok() { if (!Sfx.on()) return; pluck(note(5), 0, .22); pluck(note(7), .08, .22); },
    no() { if (!Sfx.on()) return; tone(196, .22, 'square', .07); tone(155, .3, 'square', .06, .1); },
    click() { if (!Sfx.on()) return; tone(880, .05, 'sine', .08); },
    coin() { if (!Sfx.on()) return; tone(1318, .08, 'square', .06); tone(1760, .18, 'square', .06, .07); },
    spirit() { if (!Sfx.on()) return; [7, 9, 11, 12].forEach((d, i) => pluck(note(d), i * .06, .16)); },
    chest() { if (!Sfx.on()) return; [0, 2, 4, 5, 7, 10].forEach((d, i) => pluck(note(d), i * .07, .2)); },
    fanfare() { if (!Sfx.on()) return; [0, 2, 4, 7, 9, 10, 12].forEach((d, i) => pluck(note(d, 220), i * .09, .24)); tone(110, 1.2, 'sine', .15, .6); },
    pop() { if (!Sfx.on()) return; tone(600, .06, 'triangle', .15); tone(1200, .05, 'sine', .08, .03); },
    jump() { if (!Sfx.on()) return; const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(700, t + .15); g.gain.setValueAtTime(.08, t); g.gain.exponentialRampToValueAtTime(.0001, t + .2); o.connect(g); g.connect(master); o.start(t); o.stop(t + .25); },
    whoosh() { if (!Sfx.on()) return; const a = ac(); if (!a) return; const len = a.sampleRate * .5, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / len); const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(); f.type = 'bandpass'; f.frequency.value = 900; g.gain.value = .25; s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start(); },
    streak(n) { if (!Sfx.on()) return; pluck(note(5 + Math.min(n, 8)), 0, .2); }
  };

  /* ---------- 背景音乐：五声音阶即兴 ---------- */
  let musicBus = null, musicTimer = 0, musicDeg = 5;
  const Music = window.Music = {
    start() {
      const a = ac(); if (!a || musicTimer) return;
      musicBus = a.createGain(); musicBus.gain.value = S.settings.music ? 0.55 : 0; musicBus.connect(master);
      const loop = () => {
        if (!AC) return;
        if (S.settings.music) {
          musicDeg = U.clamp(musicDeg + U.pick([-2, -1, -1, 1, 1, 2, 0]), 2, 11);
          pluck(note(musicDeg), 0, .09, musicBus);
          if (Math.random() < .3) pluck(note(musicDeg - 5), 0.02, .06, musicBus);
          if (Math.random() < .15) pluck(note(musicDeg + 2), .25, .05, musicBus);
        }
        musicTimer = setTimeout(loop, U.pick([450, 600, 600, 900, 1200, 1800]));
      };
      loop();
    },
    set(on) { S.settings.music = on; if (musicBus) musicBus.gain.value = on ? .55 : 0; },
    duck(d) { if (musicBus && AC) musicBus.gain.setTargetAtTime(S.settings.music ? (d ? .12 : .55) : 0, AC.currentTime, .2); }
  };

  /* ---------- 界面：Toast / Modal / HUD ---------- */
  const UI = window.UI = {
    open: false,
    toast({ big = '', t1 = '', t2 = '', ms = 2200 }) {
      const box = U.$('#toasts');
      const el = U.h(`<div class="toast">${big ? `<div class="big">${U.esc(big)}</div>` : ''}<div><div class="t1">${U.esc(t1)}</div>${t2 ? `<div class="t2">${U.esc(t2)}</div>` : ''}</div></div>`);
      box.appendChild(el);
      while (box.children.length > 3) box.firstChild.remove();
      setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
    },
    // 打开卷轴弹窗；返回 {body, foot, close, setTitle}
    modal({ title, sub = '', back = null, onClose = null, wide = false }) {
      const m = U.$('#modal');
      m.innerHTML = '';
      const sc = U.h(`<div class="scroll" role="dialog" aria-modal="true" aria-label="${U.esc(title)}"><div class="paper">
        <div class="mhead">${back ? '<button class="iconbtn" data-act="back" aria-label="返回">‹ 返回</button>' : ''}
          <div class="grow"><h2></h2><div class="sub"></div></div>
          <button class="iconbtn" data-act="close" aria-label="关闭">✕</button></div>
        <div class="mbody"></div><div class="mfoot" hidden></div></div></div>`);
      if (wide) sc.style.width = 'min(1000px,100%)';
      m.appendChild(sc);
      const api = {
        body: U.$('.mbody', sc), foot: U.$('.mfoot', sc),
        setTitle(t, s) { U.$('h2', sc).textContent = t; U.$('.sub', sc).textContent = s || ''; },
        close() { UI.close(); },
        cleanup: onClose
      };
      api.setTitle(title, sub);
      U.$('[data-act=close]', sc).onclick = () => { Sfx.click(); UI.close(); };
      if (back) U.$('[data-act=back]', sc).onclick = () => { Sfx.click(); api.cleanup && api.cleanup(); api.cleanup = null; Voice.stop(); back(); };
      m.hidden = false; UI.open = true; UI.cur = api;
      const pr = U.$('#prompt'); if (pr) pr.hidden = true;
      document.body.classList.add('modal-open');
      if (window.World) World.pause(true);
      return api;
    },
    close() {
      const m = U.$('#modal');
      if (UI.cur && UI.cur.cleanup) { try { UI.cur.cleanup(); } catch (e) { } }
      UI.cur = null; m.hidden = true; m.innerHTML = ''; UI.open = false;
      Voice.stop();
      document.body.classList.remove('modal-open');
      if (window.World) World.pause(false);
    },
    sealHTML(text, off) { return `<span class="seal${off ? ' off' : ''}">${U.esc(text)}</span>`; },
    stars(n, max = 3) { return `<span class="stars" aria-label="${n}星">${'★'.repeat(n)}${'☆'.repeat(max - n)}</span>`; }
  };

  const HUD = window.HUD = {
    chestTotal: 0,
    update() {
      const r = Save.rank(), R = RANKS[r], N = RANKS[r + 1];
      U.$('#rank-seal').textContent = R.n; U.$('#rank-name').textContent = R.n;
      U.$('#rank-next').textContent = N ? `距${N.n} ${N.xp - S.xp}` : '学富五车';
      U.$('#xp-fill').style.width = N ? `${((S.xp - R.xp) / (N.xp - R.xp)) * 100}%` : '100%';
      U.$('#c-coins').textContent = S.coins;
      U.$('#c-spirits').textContent = S.spirits;
      U.$('#c-chests').textContent = `${Object.keys(S.chests).length}/${HUD.chestTotal}`;
      U.$('#c-seals').textContent = Object.keys(S.seals).length;
    }
  };
})();
