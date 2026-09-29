/* 文曲岛奇遇 — 学习与小游戏 */
(function () {
  'use strict';
  const Games = window.Games = {};
  const { $, $$, esc, pick, shuffle, sample, uniq } = U;
  const KAI_STYLE = 'font-family:var(--f-kai)';

  /* ====================== 通用 ====================== */
  function speakBtn(text, sm) { return `<button class="speak${sm ? ' sm' : ''}" data-say="${esc(text)}" aria-label="朗读">🔊</button>`; }
  function bindSpeak(root) { $$('[data-say]', root).forEach(b => b.onclick = e => { e.stopPropagation(); Voice.say(b.dataset.say); }); }
  function empty(body, msg = '这里的内容还在准备中，先去别处逛逛吧。') { body.innerHTML = `<p class="muted">${esc(msg)}</p>`; }
  const STAR = (score, total) => { const r = score / total; return r >= 0.9 ? 3 : r >= 0.7 ? 2 : r >= 0.4 ? 1 : 0; };

  function finish({ id, title, score, total, back, stars, sealName, again }) {
    stars = stars ?? STAR(score, total);
    S.stats.played++;
    const prev = S.best[id] || 0; if (score > prev) S.best[id] = score;
    const earned = stars >= 3 || score / total >= 0.8;
    let first = false;
    if (earned && sealName) first = Reward.seal(id, sealName);
    Reward.give(stars * 10 + (first ? 50 : 0), stars * 3 + (first ? 20 : 0), true);
    if (stars >= 2) Sfx.fanfare(); else Sfx.ok();
    const m = UI.modal({ title, sub: '本轮成绩', back });
    const words = ['再接再厉！', '有进步！', '真不错！', '了不起！'][stars];
    m.body.innerHTML = `<div class="result">
      ${earned && sealName ? `<span class="seal bigseal" style="writing-mode:vertical-rl">${esc(sealName)}</span>` : ''}
      <div class="score">${score} <span class="muted" style="font-size:22px">/ ${total}</span></div>
      ${UI.stars(stars)}
      <div style="font-family:var(--f-brush);font-size:28px">${words}</div>
      <div class="muted">获得 ${stars * 10 + (first ? 50 : 0)} 学识 · ${stars * 3 + (first ? 20 : 0)} 铜钱${first ? ' · 新印章「' + esc(sealName) + '」' : ''}</div>
      ${!earned && sealName ? `<div class="muted">答对 ${Math.ceil(total * 0.8)} 题以上可获得印章「${esc(sealName)}」</div>` : ''}
      <div class="row" style="justify-content:center"><button class="btn red" id="r-again">再来一次</button>${back ? '<button class="btn ghost" id="r-back">返回</button>' : ''}</div></div>`;
    $('#r-again').onclick = () => { Sfx.click(); again(); };
    if (back) $('#r-back').onclick = () => { Sfx.click(); back(); };
    if (first) setTimeout(() => UI.toast({ big: '印', t1: `获得印章「${sealName}」`, t2: '在图鉴里可以看到所有印章', ms: 3000 }), 600);
  }

  /* 通用选择题流程 */
  function runQuiz({ id, title, sub, back, rounds = 10, make, sealName }) {
    const again = () => runQuiz({ id, title, sub, back, rounds, make, sealName });
    const m = UI.modal({ title, sub, back });
    let i = 0, score = 0, combo = 0;
    const used = new Set();
    const next = () => {
      if (i >= rounds) return finish({ id, title, score, total: rounds, back, sealName, again });
      let q = null;
      for (let k = 0; k < 20 && !q; k++) { const c = make(i, used); if (c && !used.has(c.key)) q = c; }
      if (!q) q = make(i, used);
      if (!q) { empty(m.body); return; }
      used.add(q.key);
      const opts = shuffle(q.opts);
      m.body.innerHTML = `<div class="qwrap">
        <div class="qtop"><span>第 ${i + 1} / ${rounds} 题</span><div class="qprog"><i style="width:${i / rounds * 100}%"></i></div><span>得分 ${score}</span></div>
        <div class="combo">${combo >= 2 ? `连对 ×${combo}` : ''}</div>
        <div class="qhtml" style="display:flex;flex-direction:column;align-items:center;gap:10px">${q.html}</div>
        ${q.speak ? speakBtn(q.speak) : ''}
        <div class="opts">${opts.map((o, k) => `<button class="opt ${q.cls || ''}" data-k="${k}">${esc(o.t)}</button>`).join('')}</div>
        <div class="expl-wrap" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:10px"></div></div>`;
      bindSpeak(m.body);
      if (q.speak) setTimeout(() => Voice.say(q.speak), 250);
      $$('.opt', m.body).forEach(b => b.onclick = () => {
        const o = opts[+b.dataset.k];
        $$('.opt', m.body).forEach((bb, k) => { bb.disabled = true; if (opts[k].ok) bb.classList.add('ok'); });
        S.stats.played;
        if (o.ok) {
          score++; combo++; S.stats.correct++; Sfx.ok(); if (combo >= 3) Sfx.streak(combo);
          Reward.give(6 + Math.min(combo, 6), 1, true);
          if (q.learn) Reward.learn(q.learn[0], q.learn[1], 2);
        } else { combo = 0; b.classList.add('no'); Sfx.no(); }
        i++;
        const ex = $('.expl-wrap', m.body);
        if (q.explain || !o.ok) {
          ex.innerHTML = `${q.explain ? `<div class="explain">${q.explain}</div>` : ''}<button class="btn" id="q-next">${i >= rounds ? '看成绩' : '下一题 →'}</button>`;
          bindSpeak(ex);
          $('#q-next').onclick = () => { Sfx.click(); next(); };
          $('#q-next').focus();
        } else setTimeout(next, 750);
      });
    };
    next();
  }

  function menu({ title, sub, npc, face, say, items, back }) {
    const m = UI.modal({ title, sub, back });
    m.body.innerHTML = `${say ? `<div class="npc-say"><div class="npc-face">${esc(face || npc[0])}</div><div class="bubble"><b>${esc(npc)}：</b>${say}</div></div>` : ''}
      <div class="menu-grid">${items.map((it, k) => {
      const best = S.best[it.id], seal = S.seals[it.id];
      return `<button class="mcard" data-k="${k}"><span class="tag ${it.kind === '玩' ? 'play' : ''}">${it.kind === '玩' ? '闯关' : '学习'}</span>
          <span class="mt">${esc(it.t)}</span><span class="md">${esc(it.d)}</span>
          ${best != null ? `<span class="md" style="color:var(--ink-soft)">最好成绩 ${best}</span>` : ''}
          ${it.seal ? `<span class="stamp">${UI.sealHTML(it.seal, !seal)}</span>` : ''}</button>`;
    }).join('')}</div>`;
    $$('.mcard', m.body).forEach(b => b.onclick = () => { Sfx.click(); items[+b.dataset.k].run(); });
    if (say) { const plain = say.replace(/<[^>]+>/g, ''); setTimeout(() => Voice.say(plain), 200); }
    return m;
  }

  /* ====================== 题目生成器 ====================== */
  const Q = {};
  const hz = () => GD.hanzi;
  // 多音字单独朗读时读音不确定（如“种”可读 zhǒng/zhòng），不进听音、辨音类题目
  const POLY = new Set([...'种长还得的了地行重好为乐和觉分少空发干相间数教背当都差处场要中正大什么会没着便调转传结系称假将降更只奇朝冲弹藏曲难看兴把几血角露石似盛省率答缝散薄宿夹']);
  const hz1 = () => hz().filter(h => !POLY.has(h.c));
  const toned = () => hz1().filter(h => { const s = PY.split(h.py); return s.tone >= 1 && s.tone <= 4 && /^[a-zü]+$/.test(s.base); });
  Q.pyTone = () => {
    const h = pick(toned()); if (!h) return null;
    const { base, tone } = PY.split(h.py);
    return {
      key: 'tone' + h.c, speak: h.c, cls: 'py',
      html: `<div class="qprompt">听一听，「${esc(h.c)}」读第几声？</div><div class="qbig">${esc(h.c)}</div>`,
      opts: [1, 2, 3, 4].map(t => ({ t: PY.mark(base, t), ok: t === tone })),
      learn: ['hanzi', h.c]
    };
  };
  const FINALS = () => uniq(hz().map(h => PY.parts(h.py)).filter(Boolean).map(p => p.fin));
  Q.pyParts = () => {
    const pool = hz1().filter(h => PY.parts(h.py)); const h = pick(pool); if (!h) return null;
    const p = PY.parts(h.py), askIni = p.ini && Math.random() < 0.5;
    const right = askIni ? p.ini : p.fin;
    const others = askIni ? PY.INITS.filter(x => x !== right) : FINALS().filter(x => x !== right);
    const near = askIni ? { zh: 'z', z: 'zh', ch: 'c', c: 'ch', sh: 's', s: 'sh', n: 'l', l: 'n', b: 'd', d: 'b', p: 'q', q: 'p', f: 'h', h: 'f' }[right] : right.endsWith('ng') ? right.slice(0, -1) : right.endsWith('n') ? right + 'g' : null;
    const ds = uniq([near, ...sample(others, 5)].filter(x => x && x !== right)).slice(0, 3);
    return {
      key: 'parts' + h.c + askIni, speak: h.c, cls: 'py',
      html: `<div class="qprompt">「${esc(h.c)}」的<b>${askIni ? '声母' : '韵母'}</b>是哪个？</div><div class="qbig">${esc(h.c)}</div>`,
      opts: [{ t: right, ok: true }, ...ds.map(t => ({ t, ok: false }))],
      explain: `${esc(h.c)}：${p.ini ? `<b>${esc(p.ini)}</b> + ` : ''}<b>${esc(p.fin)}</b> → ${esc(h.py)}`,
      learn: ['hanzi', h.c]
    };
  };
  Q.hzPy = () => {
    const h = pick(hz1()); if (!h) return null;
    if (Math.random() < 0.5) {
      const ds = uniq(PY.confusers(h.py).concat(sample(hz(), 6).map(x => x.py))).filter(x => x !== h.py).slice(0, 3);
      return { key: 'hp' + h.c, speak: null, cls: 'py', html: `<div class="qprompt">这个字怎么读？</div><div class="qbig">${esc(h.c)}</div>`, opts: [{ t: h.py, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `${esc(h.c)}（${esc(h.py)}）组词：${esc((h.words || []).join('、'))} ${speakBtn(h.c, 1)}`, learn: ['hanzi', h.c] };
    }
    const b = PY.split(h.py).base;
    const same = hz().filter(x => x.c !== h.c && PY.split(x.py).base === b);
    const rad = hz().filter(x => x.c !== h.c && x.rad === h.rad);
    const ds = uniq(shuffle(same).slice(0, 2).concat(shuffle(rad).slice(0, 2), sample(hz(), 4)).map(x => x.c)).filter(c => c !== h.c && !(hz().find(z => z.c === c) || {}).py?.startsWith?.(h.py + '#')).slice(0, 3);
    return { key: 'ph' + h.c, speak: h.c, html: `<div class="qprompt">哪个字读作</div><div class="qmid" style="font-family:var(--f-sans)">${esc(h.py)}</div><div class="muted">提示：${esc((h.words || [])[0] || '').replace(h.c, '○')}</div>`, opts: [{ t: h.c, ok: true }, ...ds.map(t => ({ t, ok: false }))], learn: ['hanzi', h.c] };
  };
  Q.hzCombo = () => {
    const c = pick(GD.combos); if (!c) return null;
    const ds = uniq(shuffle(GD.combos.filter(x => x.c !== c.c && (x.parts.includes(c.parts[0]) || x.parts.includes(c.parts[1])))).map(x => x.c).concat(sample(GD.combos, 6).map(x => x.c))).filter(x => x !== c.c).slice(0, 3);
    return { key: 'cb' + c.c, speak: null, html: `<div class="qprompt">两个部件合在一起，是哪个字？</div><div class="qmid" style="font-size:52px">${esc(c.parts[0])} ＋ ${esc(c.parts[1])} ＝ ？</div>`, opts: [{ t: c.c, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `${esc(c.parts.join(' + '))} = <b style="${KAI_STYLE};font-size:22px">${esc(c.c)}</b>（${esc(c.py)}），如「${esc(c.w)}」 ${speakBtn(c.w, 1)}`, learn: ['hanzi', c.c] };
  };
  Q.hzPicto = () => {
    const p = pick(GD.pictos); if (!p) return null;
    const ds = sample(GD.pictos.filter(x => x.c !== p.c), 3).map(x => x.c);
    return { key: 'pc' + p.c, html: `<div class="qprompt">古人照着样子造了一个字，猜猜是哪个？</div><div class="qemoji">${esc(p.emoji)}</div><div class="muted">${esc(p.hint)}</div>`, opts: [{ t: p.c, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `<b style="${KAI_STYLE};font-size:24px">${esc(p.c)}</b> 是象形字：${esc(p.hint)} ${speakBtn(p.c, 1)}`, learn: ['hanzi', p.c] };
  };
  Q.cyFill = (i = 0) => {
    const c = pick(GD.chengyu); if (!c) return null;
    const chars = [...c.w], n = i >= 6 && Math.random() < 0.5 ? 2 : 1;
    const pos = sample([0, 1, 2, 3], n).sort();
    const shown = chars.map((ch, k) => pos.includes(k) ? '□' : ch).join('');
    const right = pos.map(k => chars[k]).join('');
    const ds = new Set();
    for (let t = 0; t < 40 && ds.size < 3; t++) { const o = pick(GD.chengyu); const s = pos.map(k => [...o.w][k]).join(''); if (s !== right && !pos.some((k, j) => [...s][j] === chars[k]) ) ds.add(s); }
    return { key: 'cf' + c.w, cls: '', html: `<div class="qprompt">把成语补完整</div><div class="qmid" style="font-size:clamp(40px,10vw,60px)">${esc(shown)}</div><div class="muted">意思：${esc(c.m)}</div>`, opts: [{ t: right, ok: true }, ...[...ds].map(t => ({ t, ok: false }))], explain: `<b style="${KAI_STYLE};font-size:22px">${esc(c.w)}</b>（${esc(c.py)}）${speakBtn(c.w, 1)}<br>${esc(c.ex || '')}`, learn: ['chengyu', c.w] };
  };
  Q.cyEmoji = () => {
    const c = pick(GD.chengyu.filter(x => x.emoji)); if (!c) return null;
    const ds = sample(GD.chengyu.filter(x => x.w !== c.w), 3).map(x => x.w);
    return { key: 'ce' + c.w, html: `<div class="qprompt">看图猜成语</div><div class="qemoji">${esc(c.emoji)}</div>`, opts: [{ t: c.w, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `<b style="${KAI_STYLE};font-size:22px">${esc(c.w)}</b>：${esc(c.m)} ${speakBtn(c.w, 1)}`, learn: ['chengyu', c.w] };
  };
  Q.cyMeaning = () => {
    const c = pick(GD.chengyu); if (!c) return null;
    const ds = sample(GD.chengyu.filter(x => x.w !== c.w), 3).map(x => x.w);
    return { key: 'cm' + c.w, html: `<div class="qprompt">哪个成语是这个意思？</div><div class="explain" style="font-size:17px">${esc(c.m)}</div>`, opts: [{ t: c.w, ok: true }, ...ds.map(t => ({ t, ok: false }))], learn: ['chengyu', c.w] };
  };
  const regular = () => GD.poems.filter(p => p.lines.length >= 4 && p.lines.every(l => [...l].length === [...p.lines[0]].length) && [5, 7].includes([...p.lines[0]].length));
  Q.poNext = () => {
    const p = pick(regular()); if (!p) return null;
    const k = pick([0, 2, 4, 6].filter(x => x + 1 < p.lines.length));
    const len = [...p.lines[0]].length;
    const pool = GD.poems.filter(x => x !== p).flatMap(x => x.lines.filter(l => [...l].length === len));
    const ds = sample(pool, 3);
    return { key: 'pn' + p.t + k, html: `<div class="qprompt">接下句 ·《${esc(p.t)}》${esc(p.a)}</div><div class="qmid">${esc(p.lines[k])}，</div>`, opts: [{ t: p.lines[k + 1], ok: true }, ...ds.map(t => ({ t, ok: false }))], cls: 'small', explain: `${esc(p.lines[k])}，${esc(p.lines[k + 1])}。 ${speakBtn(p.lines[k] + '，' + p.lines[k + 1], 1)}`, learn: ['poems', p.t + '|' + p.a] };
  };
  Q.poAuthor = () => {
    const p = pick(GD.poems.filter(x => GD.poets.some(y => y.n === x.a))); if (!p) return null;
    const ds = sample(uniq(GD.poets.map(x => x.n)).filter(n => n !== p.a), 3);
    return { key: 'pa' + p.t, html: `<div class="qprompt">这首诗的作者是谁？</div><div class="qmid" style="font-size:26px">《${esc(p.t)}》</div><div style="${KAI_STYLE};font-size:22px;line-height:1.7">${esc(p.lines[0])}，${esc(p.lines[1] || '')}……</div>`, opts: [{ t: p.a, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `《${esc(p.t)}》是${esc(p.d)}代${esc(p.a)}写的。`, learn: ['poems', p.t + '|' + p.a] };
  };
  Q.hiQ = () => {
    const q = pick(GD.historyQ); if (!q) return null;
    return { key: 'hq' + q.q, cls: 'small', html: `<div class="qprompt">历史小问答 · ${esc(q.d)}</div><div class="qmid" style="font-family:var(--f-sans);font-size:clamp(18px,4.2vw,22px);line-height:1.6;letter-spacing:0">${esc(q.q)}</div>`, opts: q.o.map((t, k) => ({ t, ok: k === q.a })), explain: esc(q.e || '') };
  };
  Q.hiFig = () => {
    const f = pick(GD.figures); if (!f) return null;
    const ds = sample(GD.figures.filter(x => x.n !== f.n), 3).map(x => x.n);
    return { key: 'hf' + f.n, html: `<div class="qprompt">猜猜我是谁？</div><div class="explain" style="font-size:17px">“${esc(f.clues[2] || f.clues[0])}”<br>“${esc(f.clues[3] || '')}”</div>`, opts: [{ t: f.n, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `<b>${esc(f.n)}</b>（${esc(f.d)}）：${esc(f.bio)}`, learn: ['figures', f.n] };
  };
  Q.hiDyn = () => {
    const d = pick(GD.dynasties.filter(x => x.events && x.events.length)); if (!d) return null;
    const ev = pick(d.events);
    const ds = sample(GD.dynasties.filter(x => x.n !== d.n), 3).map(x => x.n);
    return { key: 'hd' + ev, html: `<div class="qprompt">这件事发生在哪个时期？</div><div class="explain" style="font-size:17px">${esc(ev)}</div>`, opts: [{ t: d.n, ok: true }, ...ds.map(t => ({ t, ok: false }))], explain: `${esc(d.full || d.n)}（${U.yearStr(d.start)}—${U.yearStr(d.end)}）`, learn: ['dyn', d.n] };
  };

  /* ====================== 中心：文曲星君 ====================== */
  Games.hub = () => {
    const r = Save.rank(), R = Save.RANKS;
    menu({
      title: '文曲星君', sub: '掌管天下文章的星君', npc: '文曲星君', face: '文',
      say: `小书生，你现在是「<b>${R[r].n}</b>」。岛上五处学堂各有考官，集齐印章、积攒学识，就能一路考到<b>状元</b>！`,
      items: [
        { id: 'zy', t: '状元大挑战', d: '拼音、汉字、成语、诗词、历史混合 15 题', kind: '玩', seal: '魁星', run: zhuangyuan },
        { id: 'daily', t: '今日功课', d: '每天一个字、一首诗、一个成语', kind: '学', run: () => Games.daily(Games.hub) },
        { id: 'book', t: '我的图鉴', d: '学过的字词诗、印章和知识卡', kind: '学', run: () => Games.book() },
        { id: 'help', t: '怎么玩', d: '操作方法与探险提示', kind: '学', run: () => Games.guide(Games.hub) }
      ]
    });
  };
  function zhuangyuan() {
    const gens = [Q.pyTone, Q.pyParts, Q.hzPy, Q.hzCombo, Q.hzPicto, Q.cyFill, Q.cyEmoji, Q.cyMeaning, Q.poNext, Q.poAuthor, Q.hiQ, Q.hiFig, Q.hiDyn];
    runQuiz({ id: 'zy', title: '状元大挑战', sub: '五门功课一起考', back: Games.hub, rounds: 15, sealName: '魁星', make: i => pick(gens)(i) });
  }

  Games.guide = back => {
    const m = UI.modal({ title: '书童小墨', sub: '探险小指南', back });
    const zoneBtns = World.zones.slice(1).map(z => `<button class="btn small ${S.visited[z.id] ? 'ghost' : 'red'}" data-tp="${z.id}">${S.visited[z.id] ? '' : '未去过 · '}${esc(z.name)}</button>`).join('');
    m.body.innerHTML = `<div class="npc-say"><div class="npc-face">墨</div><div class="bubble">我是小墨！这座岛叫<b>文曲岛</b>，岛上藏着好多学问。跟着路走，就能到各个学堂。</div></div>
      <div class="cols2">
        <div class="note"><b>怎么走</b><br>电脑：WASD 或方向键移动，按住 Shift 跑，空格跳，拖动鼠标转视角，滚轮缩放。<br>手机：左下摇杆移动，拖动屏幕转视角，双指缩放。也可以<b>点一下地面</b>走过去。</div>
        <div class="note"><b>怎么学</b><br>头上有红色「学」字的是<b>考官</b>，靠近后按 E（手机点按钮）就能学习和闯关。石碑、牌匾、钟、池塘……很多东西都能互动！</div>
        <div class="note"><b>字灵</b><br>地上飘着金色的字，那是<b>字灵</b>。走过去就能收集，还会读给你听。每收集 10 个有额外奖励。小地图上的黄点就是字灵。</div>
        <div class="note"><b>宝箱</b><br>岛上藏着 ${HUD.chestTotal} 个宝箱，里面有<b>知识卡</b>和铜钱。山顶、海上小岛、瀑布边……都去找找！</div>
        <div class="note"><b>科举升级</b><br>学识从童生→秀才→举人→贡士→进士→探花→榜眼→<b>状元</b>。每个小游戏答对八成就能盖一枚<b>印章</b>。</div>
        <div class="note"><b>铜钱</b><br>去成语城的<b>杂货铺</b>买新衣服、帽子、小宠物，还有能在水上飞的<b>筋斗云</b>！</div>
      </div>
      <h3 style="font-family:var(--f-brush);font-weight:400;font-size:24px;margin:18px 0 8px">腾云驾雾，直接前往</h3><div class="row">${zoneBtns}</div>`;
    $$('[data-tp]', m.body).forEach(b => b.onclick = () => { UI.close(); World.teleport(b.dataset.tp); });
  };

  const dayIdx = n => { const d = new Date(); const k = d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); return n ? k % n : 0; };
  Games.daily = back => {
    const m = UI.modal({ title: '今日功课', sub: new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }), back });
    const h = hz()[dayIdx(hz().length)], p = GD.poems[dayIdx(GD.poems.length)], c = GD.chengyu[dayIdx(GD.chengyu.length)], f = GD.facts[dayIdx(GD.facts.length)];
    const today = new Date().toDateString(), claimed = S.dailyClaim === today;
    m.body.innerHTML = `<div class="cols2">
      ${h ? `<button class="li" data-a="h"><span class="qbig" style="font-size:56px">${esc(h.c)}</span><span class="grow"><span class="lbl">今日一字</span><br><span class="lt">${esc(h.py)} · ${esc((h.words || []).join('、'))}</span></span></button>` : ''}
      ${c ? `<button class="li" data-a="c"><span class="grow"><span class="lbl">今日成语</span><br><span class="lt" style="font-size:26px">${esc(c.w)}</span><br><span class="ls">${esc(c.m)}</span></span></button>` : ''}
      ${p ? `<button class="li" data-a="p"><span class="grow"><span class="lbl">今日一诗</span><br><span class="lt">《${esc(p.t)}》${esc(p.a)}</span><br><span class="ls" style="${KAI_STYLE};font-size:16px">${esc(p.lines[0])}，${esc(p.lines[1] || '')}</span></span></button>` : ''}
      ${f ? `<div class="li" style="cursor:default"><span class="grow"><span class="lbl">今日知识 · ${esc(f.cat)}</span><br><b>${esc(f.t)}</b><br><span class="ls" style="font-size:14px;color:var(--ink-2)">${esc(f.c)}</span></span></div>` : ''}
    </div><div class="row" style="margin-top:14px"><button class="btn red" id="claim" ${claimed ? 'disabled' : ''}>${claimed ? '今日奖励已领取' : '学完了，领取奖励（30 学识 · 10 铜钱）'}</button></div>`;
    const self = () => Games.daily(back);
    $$('[data-a]', m.body).forEach(b => b.onclick = () => { Sfx.click(); ({ h: () => Games.hanziCard(h.c, self), c: () => Games.chengyuCard(c.w, self), p: () => Games.poemView(p, self) })[b.dataset.a](); });
    $('#claim').onclick = () => { S.dailyClaim = today; Reward.give(30, 10); Save.soon(); $('#claim').disabled = true; $('#claim').textContent = '今日奖励已领取'; };
  };

  /* ====================== 各学堂菜单 ====================== */
  const ZONE_MENUS = {
    pinyin: () => menu({
      title: '拼音村', sub: '声母 · 韵母 · 声调', npc: '音韵先生', face: '音',
      say: '拼音是汉字的小拐杖！村子里飘着的<b>字母方块</b>点一下会发音，村口的四口<b>声调钟</b>也能敲响。来，跟我学吧！',
      items: [
        { id: 'py-chart', t: '拼音字母表', d: '23 个声母、24 个韵母、16 个整体认读音节，点一点就会读', kind: '学', run: pyChart },
        { id: 'py-tone', t: '听音辨声调', d: '听字音，选出正确的声调', kind: '玩', seal: '辨调', run: () => runQuiz({ id: 'py-tone', title: '听音辨声调', sub: '一声平，二声扬，三声拐弯，四声降', back: Games.zoneMenu.bind(null, 'pinyin'), make: Q.pyTone, sealName: '辨调' }) },
        { id: 'py-balloon', t: '拼音气球', d: '60 秒内戳破写着正确拼音的气球', kind: '玩', seal: '气球', run: pyBalloon },
        { id: 'py-parts', t: '声母韵母找一找', d: '找出一个字的声母和韵母', kind: '玩', seal: '声韵', run: () => runQuiz({ id: 'py-parts', title: '声母韵母找一找', sub: '把音节拆开来', back: Games.zoneMenu.bind(null, 'pinyin'), make: Q.pyParts, sealName: '声韵' }) }
      ]
    }),
    hanzi: () => menu({
      title: '汉字林', sub: '仓颉造字之地', npc: '仓颉', face: '颉',
      say: '我是仓颉，传说我有<b>四只眼睛</b>，看鸟兽的脚印创造了文字。林子里的<b>石碑</b>上都刻着字，去读一读吧！',
      items: [
        { id: 'hz-cards', t: '汉字卡片', d: `${hz().length} 个常用字：笔顺动画、拼音、部首、组词`, kind: '学', run: hzCards },
        { id: 'hz-write', t: '描红练字', d: '跟着笔顺在田字格里写一写', kind: '玩', seal: '笔墨', run: hzWrite },
        { id: 'hz-quiz', t: '字音大考验', d: '看字选拼音，看拼音选字', kind: '玩', seal: '识字', run: () => runQuiz({ id: 'hz-quiz', title: '字音大考验', sub: '看字选音 · 听音选字', back: Games.zoneMenu.bind(null, 'hanzi'), make: Q.hzPy, sealName: '识字' }) },
        { id: 'hz-combo', t: '偏旁拼字', d: '两个部件合起来是什么字？', kind: '玩', seal: '组字', run: () => runQuiz({ id: 'hz-combo', title: '偏旁拼字', sub: '女 + 马 = 妈', back: Games.zoneMenu.bind(null, 'hanzi'), make: Q.hzCombo, sealName: '组字' }) },
        { id: 'hz-picto', t: '象形字猜猜', d: '看图猜出古人造的字', kind: '玩', seal: '象形', run: () => runQuiz({ id: 'hz-picto', title: '象形字猜猜', sub: '汉字最早是画出来的', back: Games.zoneMenu.bind(null, 'hanzi'), make: Q.hzPicto, sealName: '象形' }) }
      ]
    }),
    chengyu: () => menu({
      title: '成语城', sub: '一个成语一个故事', npc: '说书人', face: '书',
      say: '啪！醒木一拍——各位看官，城里每块<b>牌匾</b>都藏着一个成语故事。城外还有个农夫守着树桩，井里有只青蛙，海边有人在船上刻记号……你认得出来吗？',
      items: [
        { id: 'cy-story', t: '成语故事会', d: `${GD.chengyu.filter(c => c.story).length} 个成语故事，可以听我讲`, kind: '学', run: cyStories },
        { id: 'cy-fill', t: '成语填空', d: '补上缺的字', kind: '玩', seal: '补阙', run: () => runQuiz({ id: 'cy-fill', title: '成语填空', sub: '四个字，缺了谁？', back: Games.zoneMenu.bind(null, 'chengyu'), make: Q.cyFill, sealName: '补阙' }) },
        { id: 'cy-emoji', t: '看图猜成语', d: '表情符号里藏着成语', kind: '玩', seal: '猜谜', run: () => runQuiz({ id: 'cy-emoji', title: '看图猜成语', sub: '开动脑筋', back: Games.zoneMenu.bind(null, 'chengyu'), make: Q.cyEmoji, sealName: '猜谜' }) },
        { id: 'cy-chain', t: '成语接龙', d: '上一个的尾字是下一个的头字', kind: '玩', seal: '接龙', run: cyChain },
        { id: 'cy-match', t: '释义连连看', d: '把成语和它的意思配成对', kind: '玩', seal: '释义', run: cyMatch }
      ]
    }),
    poem: () => menu({
      title: '诗词山', sub: '欲穷千里目，更上一层楼', npc: '李白', face: '白',
      say: '哈哈，小友来得正好！山下有<b>鹅池</b>和<b>瀑布</b>，山顶有<b>鹳雀楼</b>，杜甫、白居易他们也在附近散步。来，与我对几句诗！',
      items: [
        { id: 'po-lib', t: '诗词书阁', d: `${GD.poems.length} 首古诗词，可以朗读`, kind: '学', run: poLibrary },
        { id: 'po-next', t: '上句接下句', d: '选出正确的下一句', kind: '玩', seal: '对句', run: () => runQuiz({ id: 'po-next', title: '上句接下句', sub: '背诗小能手', back: Games.zoneMenu.bind(null, 'poem'), make: Q.poNext, sealName: '对句' }) },
        { id: 'po-order', t: '诗句排排队', d: '打乱的字，按顺序点回来', kind: '玩', seal: '排句', run: poOrder },
        { id: 'po-author', t: '猜猜作者', d: '这首诗是谁写的？', kind: '玩', seal: '识人', run: () => runQuiz({ id: 'po-author', title: '猜猜作者', sub: '诗人大集合', back: Games.zoneMenu.bind(null, 'poem'), make: Q.poAuthor, sealName: '识人' }) },
        { id: 'po-feihua', t: '飞花令', d: '找出所有含有令字的诗句', kind: '玩', seal: '飞花', run: poFeihua }
      ]
    }),
    history: () => menu({
      title: '历史长廊', sub: '上下五千年', npc: '司马迁', face: '史',
      say: '我是写《史记》的司马迁。沿着这条长廊走一圈，每道<b>牌坊</b>就是一个朝代，旁边还站着那个时代的名人。北边海岸有<b>长城</b>，东边还挖出了<b>兵马俑</b>！',
      items: [
        { id: 'hi-line', t: '朝代时间轴', d: `${GD.dynasties.length} 个时期，从远古到清朝`, kind: '学', run: hiTimeline },
        { id: 'hi-sort', t: '朝代排排队', d: '按时间先后排列朝代', kind: '玩', seal: '排序', run: hiSort },
        { id: 'hi-quiz', t: '历史知识问答', d: `${GD.historyQ.length} 道题随机出`, kind: '玩', seal: '博古', run: () => runQuiz({ id: 'hi-quiz', title: '历史知识问答', sub: '以史为镜', back: Games.zoneMenu.bind(null, 'history'), make: Q.hiQ, sealName: '博古' }) },
        { id: 'hi-guess', t: '人物猜猜看', d: '线索越少猜中，分数越高', kind: '玩', seal: '识英', run: hiGuess },
        { id: 'hi-relic', t: '文物珍宝馆', d: '鼎、兵马俑、清明上河图……', kind: '学', run: () => Games.relics(Games.zoneMenu.bind(null, 'history')) }
      ]
    })
  };
  Games.zoneMenu = id => ZONE_MENUS[id] && ZONE_MENUS[id]();

  /* ====================== 拼音 ====================== */
  function pyChart(tab = 'ini') {
    const back = () => Games.zoneMenu('pinyin');
    const m = UI.modal({ title: '拼音字母表', sub: '点一点，听一听', back });
    const tabs = [['ini', '声母'], ['fin', '韵母'], ['whole', '整体认读'], ['tone', '四个声调'], ['rhyme', '拼音儿歌']];
    const draw = t => {
      let html = `<div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === t ? 'on' : ''}" data-t="${k}">${n}</button>`).join('')}</div>`;
      if (t === 'ini') html += `<div class="pygrid">${GD.initials.map(x => `<button class="pyt" data-say="${esc(x.rep)}"><b>${esc(x.p)}</b><span>${esc(x.rep)}</span></button>`).join('')}</div><p class="muted" style="margin-top:12px">声母读得<b>轻、短</b>。y 和 w 也算声母。</p>`;
      if (t === 'fin') html += `<div class="pygrid">${GD.finals.map(x => `<button class="pyt ${x.kind.includes('鼻') ? 'k3' : x.kind === '单韵母' ? '' : 'k2'}" data-say="${esc(x.rep)}"><b>${esc(x.p)}</b><span>${esc(x.kind)}</span></button>`).join('')}</div><p class="muted" style="margin-top:12px">蓝色：单韵母 · 绿色：复韵母 · 红色：鼻韵母</p>`;
      if (t === 'whole') html += `<div class="pygrid">${GD.wholes.map(x => `<button class="pyt" data-say="${esc(x.rep)}"><b>${esc(x.p)}</b><span>${esc(x.rep)}</span></button>`).join('')}</div><p class="muted" style="margin-top:12px">整体认读音节不用拼，<b>直接读</b>。</p>`;
      if (t === 'tone') html += `<div class="list">${GD.toneSets.map(s => `<div class="li" style="cursor:default"><span class="lt" style="width:60px;font-family:var(--f-sans)">${esc(s.base)}</span>${s.chars.map((c, k) => `<button class="pyt" style="flex:1" data-say="${esc(c)}"><b style="font-size:20px">${esc(PY.mark(s.base, k + 1))}</b><span>${esc(c)}</span></button>`).join('')}</div>`).join('')}</div>`;
      if (t === 'rhyme') html += `<div class="list">${GD.pinyinRhymes.map(r => `<div class="rhyme"><div class="lbl">${esc(r.t)}</div>${esc(r.c)} ${speakBtn(r.c.replace(/[a-zü]+/gi, ''), 1)}</div>`).join('')}</div>`;
      m.body.innerHTML = html;
      bindSpeak(m.body);
      $$('.tab', m.body).forEach(b => b.onclick = () => { Sfx.click(); draw(b.dataset.t); });
      if (t !== 'rhyme') Reward.learn('hanzi', '__py_' + t, 5);
    };
    draw(tab);
  }

  function pyBalloon() {
    const back = () => Games.zoneMenu('pinyin');
    const m = UI.modal({ title: '拼音气球', sub: '戳破写着正确拼音的气球', back });
    const pool = toned();
    if (!pool.length) return empty(m.body);
    let score = 0, time = 60, target = null, alive = true, spawnT = 0;
    m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>⏱ <b id="bt">60</b> 秒</span><span>找一找：<b id="bc" style="${KAI_STYLE};font-size:30px;color:var(--cinnabar)"></b> ${speakBtn('', 1)}</span><span>戳中 <b id="bs">0</b></span></div><div class="balloon-field" id="bf"></div></div>`;
    const field = $('#bf'), sayBtn = $('.speak', m.body);
    sayBtn.onclick = () => target && Voice.say(target.c);
    const colors = ['#C0392B', '#1E5B78', '#3E8E6E', '#D9A43B', '#7A4E9C', '#E86A8A'];
    const round = () => {
      if (!alive) return;
      field.innerHTML = '';
      target = pick(pool);
      $('#bc').textContent = target.c; Voice.say(target.c);
      const opts = shuffle([target.py, ...PY.confusers(target.py).slice(0, 3)]);
      const lanes = shuffle([0, 1, 2, 3]);
      opts.forEach((py, k) => {
        const b = U.h(`<button class="balloon" aria-label="${esc(py)}"><div class="bb" style="background:${colors[(k + score) % colors.length]}">${esc(py)}</div></button>`);
        const W = field.clientWidth || 320;
        b.style.left = `${8 + lanes[k] * ((W - 110) / 3)}px`;
        const dur = 6.5 - Math.min(score, 10) * 0.25 + Math.random();
        b.style.transition = `bottom ${dur}s linear`;
        field.appendChild(b);
        setTimeout(() => { b.style.bottom = `${field.clientHeight + 20}px`; }, 30 + k * 250);
        b.onclick = () => {
          if (b.classList.contains('pop')) return;
          if (py === target.py) {
            b.classList.add('pop'); Sfx.pop(); Sfx.ok(); score++; $('#bs').textContent = score; Reward.give(4, 1, true); Reward.learn('hanzi', target.c, 1);
            setTimeout(round, 300);
          } else { Sfx.no(); b.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250 }); time = Math.max(0, time - 2); }
        };
      });
      clearTimeout(spawnT); spawnT = setTimeout(round, 8500);
    };
    const tick = setInterval(() => {
      if (!document.body.contains(field)) { clearInterval(tick); alive = false; clearTimeout(spawnT); return; }
      time--; $('#bt').textContent = time;
      if (time <= 0) { clearInterval(tick); alive = false; clearTimeout(spawnT); finish({ id: 'py-balloon', title: '拼音气球', score, total: 12, stars: score >= 12 ? 3 : score >= 8 ? 2 : score >= 4 ? 1 : 0, back, sealName: '气球', again: pyBalloon }); }
    }, 1000);
    m.cleanup = () => { alive = false; clearInterval(tick); clearTimeout(spawnT); };
    round();
  }

  /* ====================== 汉字 ====================== */
  let strokesP = null;
  function loadStrokes() {
    if (GD.strokes) return Promise.resolve();
    if (!strokesP) strokesP = new Promise(res => { const s = document.createElement('script'); s.src = 'js/data/strokes.js'; s.charset = 'utf-8'; s.onload = res; s.onerror = res; document.head.appendChild(s); setTimeout(res, 8000); });
    return strokesP;
  }
  const TZG = `<svg class="grid" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="0" y1="50" x2="100" y2="50" stroke="#E7A79F" stroke-dasharray="3 3" stroke-width=".6"/><line x1="50" y1="0" x2="50" y2="100" stroke="#E7A79F" stroke-dasharray="3 3" stroke-width=".6"/><line x1="0" y1="0" x2="100" y2="100" stroke="#F1CFC9" stroke-dasharray="2 3" stroke-width=".4"/><line x1="100" y1="0" x2="0" y2="100" stroke="#F1CFC9" stroke-dasharray="2 3" stroke-width=".4"/></svg>`;
  function makeWriter(el, ch, size, opts = {}) {
    if (!window.HanziWriter || !GD.strokes || !GD.strokes[ch]) { el.innerHTML = `<div style="${KAI_STYLE};font-size:${size * 0.78}px;line-height:${size}px;text-align:center">${esc(ch)}</div>`; return null; }
    return HanziWriter.create(el, ch, Object.assign({
      width: size, height: size, padding: 14, showOutline: true,
      strokeColor: '#1B2226', radicalColor: '#C0392B', outlineColor: '#E6DCC6', drawingColor: '#1E5B78', highlightColor: '#D9A43B',
      strokeAnimationSpeed: 1, delayBetweenStrokes: 220, drawingWidth: 26,
      charDataLoader: (c, onLoad, onErr) => GD.strokes[c] ? onLoad(GD.strokes[c]) : onErr()
    }, opts));
  }
  const CATS = () => uniq(hz().map(h => h.cat));
  function hzCards(cat) {
    const back = () => Games.zoneMenu('hanzi');
    const cats = CATS(); cat = cat || cats[0];
    const m = UI.modal({ title: '汉字卡片', sub: `已学会 ${Object.keys(S.learned.hanzi).filter(k => !k.startsWith('__')).length} / ${hz().length}`, back });
    if (!hz().length) return empty(m.body);
    const list = hz().filter(h => h.cat === cat);
    m.body.innerHTML = `<div class="tabs">${cats.map(c => `<button class="tab ${c === cat ? 'on' : ''}" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="chargrid">${list.map(h => `<button class="cg ${S.learned.hanzi[h.c] ? 'done' : ''}" data-h="${esc(h.c)}">${esc(h.c)}<small>${esc(h.py)}</small></button>`).join('')}</div>`;
    $$('.tab', m.body).forEach(b => b.onclick = () => { Sfx.click(); hzCards(b.dataset.c); });
    $$('.cg', m.body).forEach(b => b.onclick = () => { Sfx.click(); Games.hanziCard(b.dataset.h, () => hzCards(cat), list.map(x => x.c)); });
  }
  Games.hanziCard = async (ch, back, seq) => {
    const combo = GD.combos.find(c => c.c === ch), picto = GD.pictos.find(p => p.c === ch);
    const h = hz().find(x => x.c === ch) || { c: ch, py: combo ? combo.py : '', words: combo ? [combo.w] : [], s: '' };
    const m = UI.modal({ title: `「${ch}」`, sub: h.cat || '汉字', back });
    m.body.innerHTML = `<div class="hz-detail">
      <div style="display:flex;flex-direction:column;gap:10px;align-items:center"><div class="tzg" id="tzg">${TZG}<div class="hw" id="hw"></div></div>
        <div class="row" style="justify-content:center"><button class="btn small" id="anim">▶ 笔顺</button><button class="btn small green" id="trace">✎ 描一描</button></div></div>
      <div class="hz-meta">
        <div class="hz-py">${esc(h.py)} ${speakBtn(ch)}</div>
        <dl class="kv"><dt>部首</dt><dd style="${KAI_STYLE};font-size:20px">${esc(h.rad || '—')}</dd><dt>笔画</dt><dd id="strokes-n">—</dd>${h.lv ? `<dt>年级</dt><dd>${['', '一年级', '二年级', '三年级'][h.lv] || ''}</dd>` : ''}
        ${combo ? `<dt>字形</dt><dd>${esc(combo.parts.join(' + '))}</dd>` : ''}${picto ? `<dt>象形</dt><dd>${esc(picto.emoji)} ${esc(picto.hint)}</dd>` : ''}</dl>
        <div><div class="lbl">组词</div><div class="wordchips">${(h.words || []).map(w => `<span class="wordchip" data-say="${esc(w)}">${esc(w)}</span>`).join('')}</div></div>
        ${h.s ? `<div><div class="lbl">例句</div><div style="${KAI_STYLE};font-size:20px;line-height:1.6">${esc(h.s)} ${speakBtn(h.s, 1)}</div></div>` : ''}
        <div class="row" id="hz-nav"></div>
      </div></div>`;
    bindSpeak(m.body);
    Voice.say(ch);
    if (Reward.learn('hanzi', ch, 5)) UI.toast({ big: ch, t1: `学会了「${ch}」`, t2: '+5 学识', ms: 1500 });
    if (seq) {
      const k = seq.indexOf(ch), nav = $('#hz-nav');
      nav.innerHTML = `${k > 0 ? `<button class="btn small ghost" id="prev">‹ ${esc(seq[k - 1])}</button>` : ''}${k < seq.length - 1 ? `<button class="btn small ghost" id="next">${esc(seq[k + 1])} ›</button>` : ''}`;
      if (k > 0) $('#prev').onclick = () => Games.hanziCard(seq[k - 1], back, seq);
      if (k < seq.length - 1) $('#next').onclick = () => Games.hanziCard(seq[k + 1], back, seq);
    }
    await loadStrokes();
    if (!document.body.contains(m.body)) return;
    const size = Math.min(220, $('#tzg').clientWidth || 220);
    const wr = makeWriter($('#hw'), ch, size);
    if (GD.strokes && GD.strokes[ch]) $('#strokes-n').textContent = `${GD.strokes[ch].strokes.length} 画`;
    if (wr) setTimeout(() => wr.animateCharacter(), 300);
    $('#anim').onclick = () => wr && wr.animateCharacter();
    $('#trace').onclick = () => {
      if (!wr) return;
      wr.hideCharacter();
      wr.quiz({ showHintAfterMisses: 2, onCorrectStroke: () => Sfx.click(), onMistake: () => Sfx.no(), onComplete: ({ totalMistakes }) => { Sfx.ok(); Reward.give(totalMistakes <= 1 ? 8 : 4, 1); } });
    };
  };
  function hzWrite() {
    const back = () => Games.zoneMenu('hanzi');
    const m = UI.modal({ title: '描红练字', sub: '跟着笔顺写 5 个字', back });
    const pool = hz().filter(h => h.lv === 1);
    const list = sample(pool.length ? pool : hz(), 5);
    let i = 0, score = 0, wr = null;
    const nextChar = async () => {
      if (i >= list.length) return finish({ id: 'hz-write', title: '描红练字', score, total: list.length, back, sealName: '笔墨', again: hzWrite });
      const h = list[i];
      m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${i + 1} / ${list.length} 个</span><div class="qprog"><i style="width:${i / list.length * 100}%"></i></div><span>写好 ${score}</span></div>
        <div class="qprompt">写一写「${esc(h.c)}」 ${esc(h.py)} · ${esc((h.words || []).join('、'))} ${speakBtn(h.c, 1)}</div>
        <div class="tzg" style="width:260px;height:260px">${TZG}<div class="hw" id="hw"></div></div>
        <div class="muted" id="wmsg">按照笔顺，一笔一笔写。写错两次会有提示。</div>
        <div class="row" style="justify-content:center"><button class="btn small ghost" id="demo">看笔顺</button><button class="btn small ghost" id="skip">跳过</button></div></div>`;
      bindSpeak(m.body); Voice.say(h.c);
      await loadStrokes();
      if (!document.body.contains(m.body)) return;
      wr = makeWriter($('#hw'), h.c, Math.min(260, $('.tzg', m.body).clientWidth), { showCharacter: false });
      if (!wr) { $('#wmsg').textContent = '这个字暂时没有笔顺数据，看一看，下一个吧。'; }
      const startQuiz = () => wr && wr.quiz({
        showHintAfterMisses: 2, onMistake: () => Sfx.no(), onCorrectStroke: () => Sfx.click(),
        onComplete: ({ totalMistakes }) => {
          const good = totalMistakes <= 2; if (good) score++;
          Sfx.ok(); Reward.give(good ? 8 : 3, 1, true); Reward.learn('hanzi', h.c, 2);
          $('#wmsg').innerHTML = `<b>${good ? '写得真好！' : '写完了，再多练练～'}</b> 错了 ${totalMistakes} 笔`;
          i++; setTimeout(nextChar, 1400);
        }
      });
      startQuiz();
      $('#demo').onclick = () => { if (!wr) return; wr.cancelQuiz(); wr.showCharacter(); wr.animateCharacter({ onComplete: () => { wr.hideCharacter(); startQuiz(); } }); };
      $('#skip').onclick = () => { if (wr) wr.cancelQuiz(); i++; nextChar(); };
    };
    m.cleanup = () => { try { wr && wr.cancelQuiz(); } catch (e) { } };
    nextChar();
  }

  /* ====================== 成语 ====================== */
  const TAGS = () => uniq(GD.chengyu.map(c => c.tag));
  function cyStories(tag = '全部故事') {
    const back = () => Games.zoneMenu('chengyu');
    const m = UI.modal({ title: '成语故事会', sub: `已学 ${Object.keys(S.learned.chengyu).length} / ${GD.chengyu.length}`, back });
    const tabs = ['全部故事', ...TAGS(), '全部成语'];
    const list = tag === '全部故事' ? GD.chengyu.filter(c => c.story) : tag === '全部成语' ? GD.chengyu : GD.chengyu.filter(c => c.tag === tag);
    m.body.innerHTML = `<div class="tabs">${tabs.map(t => `<button class="tab ${t === tag ? 'on' : ''}" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div>
      <div class="cols2">${list.map(c => `<button class="li ${S.learned.chengyu[c.w] ? 'done' : ''}" data-w="${esc(c.w)}"><span class="grow"><span class="lt">${esc(c.w)}</span> ${c.emoji ? esc(c.emoji) : ''}<br><span class="ls">${esc(c.m)}</span></span>${c.story ? '<span class="tag" style="font-size:11px;background:var(--gold-soft);padding:2px 6px;border-radius:99px">故事</span>' : ''}</button>`).join('')}</div>`;
    $$('.tab', m.body).forEach(b => b.onclick = () => { Sfx.click(); cyStories(b.dataset.t); });
    $$('[data-w]', m.body).forEach(b => b.onclick = () => { Sfx.click(); Games.chengyuCard(b.dataset.w, () => cyStories(tag), list.map(x => x.w)); });
  }
  Games.chengyuCard = (w, back, seq) => {
    const c = GD.chengyu.find(x => x.w === w);
    const m = UI.modal({ title: w, sub: c ? (c.src || c.tag) : '成语', back });
    if (!c) return empty(m.body, '这个成语的故事还在路上。');
    const pys = c.py.split(/\s+/);
    m.body.innerHTML = `<div style="display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center">
      <div style="display:flex;gap:6px;justify-content:center;flex-wrap:wrap">${[...c.w].map((ch, k) => `<div style="display:flex;flex-direction:column;align-items:center;background:#fff;border:1.5px solid var(--paper-edge);border-radius:10px;padding:6px 10px"><span style="font-size:15px;color:var(--azurite)">${esc(pys[k] || '')}</span><span style="${KAI_STYLE};font-size:52px;line-height:1.1">${esc(ch)}</span></div>`).join('')}</div>
      <div class="row" style="justify-content:center">${speakBtn(c.w)}${c.emoji ? `<span style="font-size:36px">${esc(c.emoji)}</span>` : ''}</div>
      <div class="note"><div class="lbl">意思</div>${esc(c.m)}</div>
      ${c.story ? `<div class="note"><div class="lbl">故事 ${c.src ? '· 出自' + esc(c.src) : ''}</div><div style="${KAI_STYLE};font-size:18px;line-height:1.9">${esc(c.story)}</div><div class="row" style="margin-top:8px"><button class="btn small" id="tell">🔊 听故事</button></div></div>` : ''}
      ${c.ex ? `<div class="note"><div class="lbl">例句</div>${esc(c.ex)}</div>` : ''}
      <div class="row" id="cy-nav" style="justify-content:center"></div></div>`;
    bindSpeak(m.body); Voice.say(c.w);
    if (c.story) $('#tell').onclick = () => Voice.say(c.story, { rate: 0.95 });
    if (Reward.learn('chengyu', c.w, 6)) UI.toast({ big: c.w[0], t1: `学会成语「${c.w}」`, t2: '+6 学识', ms: 1500 });
    if (seq) {
      const k = seq.indexOf(w), nav = $('#cy-nav');
      nav.innerHTML = `${k > 0 ? `<button class="btn small ghost" id="prev">‹ ${esc(seq[k - 1])}</button>` : ''}${k < seq.length - 1 ? `<button class="btn small ghost" id="next">${esc(seq[k + 1])} ›</button>` : ''}`;
      if (k > 0) $('#prev').onclick = () => Games.chengyuCard(seq[k - 1], back, seq);
      if (k < seq.length - 1) $('#next').onclick = () => Games.chengyuCard(seq[k + 1], back, seq);
    }
  };
  function cyChain() {
    const back = () => Games.zoneMenu('chengyu');
    const m = UI.modal({ title: '成语接龙', sub: '尾字接头字', back });
    const chain = pick(GD.chengyuChains);
    if (!chain) return empty(m.body);
    let step = 1, score = 0;
    const total = chain.length - 1;
    const draw = (msg) => {
      if (step > total) return finish({ id: 'cy-chain', title: '成语接龙', score, total, back, sealName: '接龙', again: cyChain });
      const cur = chain[step - 1], need = [...cur].pop(), right = chain[step];
      const ds = sample(GD.chengyu.filter(c => c.w[0] !== need && !chain.includes(c.w)), 3).map(c => c.w);
      const opts = shuffle([{ t: right, ok: true }, ...ds.map(t => ({ t, ok: false }))]);
      m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${step} / ${total} 节</span><div class="qprog"><i style="width:${(step - 1) / total * 100}%"></i></div><span>接对 ${score}</span></div>
        <div class="row" style="justify-content:center;gap:4px">${chain.slice(0, step).map((w, k) => `<span style="${KAI_STYLE};font-size:${k === step - 1 ? 30 : 18}px;${k === step - 1 ? '' : 'color:var(--ink-soft)'}">${esc(w.slice(0, 3))}<b style="color:var(--cinnabar)">${esc(w.slice(3))}</b></span>${k < step - 1 ? '<span class="muted">→</span>' : ''}`).join('')}</div>
        <div class="qprompt">下一个成语要用「<b style="${KAI_STYLE};font-size:26px;color:var(--cinnabar)">${esc(need)}</b>」开头</div>
        <div class="opts">${opts.map((o, k) => `<button class="opt" data-k="${k}">${esc(o.t)}</button>`).join('')}</div>${msg || ''}</div>`;
      $$('.opt', m.body).forEach(b => b.onclick = () => {
        const o = opts[+b.dataset.k];
        $$('.opt', m.body).forEach((bb, k) => { bb.disabled = true; if (opts[k].ok) bb.classList.add('ok'); });
        if (o.ok) { score++; Sfx.ok(); Reward.give(8, 2, true); Reward.learn('chengyu', right, 2); } else { b.classList.add('no'); Sfx.no(); }
        step++; setTimeout(() => draw(), o.ok ? 700 : 1300);
      });
    };
    draw();
  }
  function cyMatch() {
    const back = () => Games.zoneMenu('chengyu');
    const boards = 3, per = 4; let board = 0, mistakes = 0;
    const m = UI.modal({ title: '释义连连看', sub: '先点成语，再点它的意思', back });
    const draw = () => {
      if (board >= boards) { const sc = Math.max(0, boards * per - mistakes); return finish({ id: 'cy-match', title: '释义连连看', score: sc, total: boards * per, back, sealName: '释义', again: cyMatch }); }
      const set = sample(GD.chengyu, per); const means = shuffle(set);
      let sel = null, done = 0;
      m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${board + 1} / ${boards} 组</span><div class="qprog"><i style="width:${board / boards * 100}%"></i></div><span>失误 ${mistakes}</span></div>
        <div class="match"><div class="col">${set.map((c, k) => `<button class="mitem w" data-w="${k}">${esc(c.w)}</button>`).join('')}</div>
        <div class="col">${means.map((c, k) => `<button class="mitem" data-m="${k}">${esc(c.m)}</button>`).join('')}</div></div></div>`;
      $$('[data-w]', m.body).forEach(b => b.onclick = () => { if (b.classList.contains('done')) return; $$('[data-w]', m.body).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel = +b.dataset.w; Voice.say(set[sel].w); });
      $$('[data-m]', m.body).forEach(b => b.onclick = () => {
        if (sel == null || b.classList.contains('done')) return;
        const mm = means[+b.dataset.m], wb = $(`[data-w="${sel}"]`, m.body);
        if (mm.w === set[sel].w) { b.classList.add('done'); wb.classList.add('done'); wb.classList.remove('sel'); Sfx.ok(); Reward.give(5, 1, true); Reward.learn('chengyu', mm.w, 2); sel = null; if (++done === per) { board++; setTimeout(draw, 600); } }
        else { mistakes++; Sfx.no(); b.classList.add('no'); setTimeout(() => b.classList.remove('no'), 400); }
      });
    };
    draw();
  }

  /* ====================== 诗词 ====================== */
  const pkey = p => p.t + '|' + p.a;
  function poLibrary(lv = 1) {
    const back = () => Games.zoneMenu('poem');
    const m = UI.modal({ title: '诗词书阁', sub: `已读 ${Object.keys(S.learned.poems).length} / ${GD.poems.length}`, back });
    const tabs = [[1, '一二年级'], [2, '三四年级'], [3, '五六年级'], [4, '初中'], [0, '词与曲']];
    const list = lv === 0 ? GD.poems.filter(p => /词|曲/.test(p.form)) : GD.poems.filter(p => p.lv === lv);
    m.body.innerHTML = `<div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === lv ? 'on' : ''}" data-l="${k}">${n}</button>`).join('')}</div>
      <div class="cols2">${list.map((p, k) => `<button class="li ${S.learned.poems[pkey(p)] ? 'done' : ''}" data-k="${k}"><span class="grow"><span class="lt">${esc(p.t)}</span> <span class="ls">${esc(p.d)} · ${esc(p.a)}</span><br><span class="ls" style="${KAI_STYLE};font-size:15px">${esc(p.lines[0])}，${esc(p.lines[1] || '')}</span></span></button>`).join('')}</div>`;
    $$('.tab', m.body).forEach(b => b.onclick = () => { Sfx.click(); poLibrary(+b.dataset.l); });
    $$('[data-k]', m.body).forEach(b => b.onclick = () => { Sfx.click(); Games.poemView(list[+b.dataset.k], () => poLibrary(lv), list); });
  }
  Games.poemByTitle = (t, reward) => {
    const p = GD.poems.find(x => x.t === t) || GD.poems.find(x => x.t.startsWith(t));
    if (!p) { UI.toast({ big: '诗', t1: t, t2: '这首诗还没收进书阁' }); return; }
    Games.poemView(p, null);
    if (reward && !S.visited['poem-' + t]) { S.visited['poem-' + t] = 1; Reward.give(40, 15); UI.toast({ big: '登', t1: '登高望远！', t2: '奖励 40 学识、15 铜钱', ms: 2800 }); }
  };
  Games.poemView = (p, back, seq) => {
    const m = UI.modal({ title: p.t, sub: `${p.d} · ${p.a} · ${p.form || ''}`, back });
    const poet = GD.poets.find(x => x.n === p.a);
    m.body.innerHTML = `<div class="poem"><div class="pt">${esc(p.t)}</div><div class="pa">〔${esc(p.d)}〕${esc(p.a)}</div>
      <div id="plines" style="margin:8px 0">${p.lines.map((l, k) => `<div class="pl" data-say="${esc(l)}" style="cursor:pointer">${esc(l)}${k % 2 ? '。' : '，'}</div>`).join('')}</div>
      <div class="row" style="justify-content:center"><button class="btn red" id="read">🔊 朗读全诗</button>${poet ? `<button class="btn ghost" id="poet">认识${esc(p.a)}</button>` : ''}</div>
      ${p.note ? `<div class="note" style="margin-top:10px"><div class="lbl">小贴士</div>${esc(p.note)}</div>` : ''}
      ${p.tags ? `<div class="row" style="justify-content:center">${p.tags.map(t => `<span class="wordchip" style="cursor:default;font-size:14px">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="row" id="po-nav" style="justify-content:center"></div></div>`;
    bindSpeak(m.body);
    const lines = $$('.pl', m.body);
    $('#read').onclick = () => {
      const seqL = [`${p.t}。${p.d}，${p.a}。`, ...p.lines];
      let k = 0;
      const nx = () => {
        if (!document.body.contains(m.body)) return;
        lines.forEach(l => l.classList.remove('hl'));
        if (k >= seqL.length) return;
        if (k > 0) lines[k - 1].classList.add('hl');
        const txt = seqL[k++];
        Voice.say(txt, { rate: 0.78, onend: () => setTimeout(nx, 150) });
      };
      nx();
    };
    if (poet) $('#poet').onclick = () => Games.poetCard(p.a, () => Games.poemView(p, back, seq));
    if (Reward.learn('poems', pkey(p), 8)) UI.toast({ big: '诗', t1: `读过《${p.t}》`, t2: '+8 学识', ms: 1500 });
    if (seq) {
      const k = seq.indexOf(p), nav = $('#po-nav');
      nav.innerHTML = `${k > 0 ? `<button class="btn small ghost" id="prev">‹ ${esc(seq[k - 1].t)}</button>` : ''}${k < seq.length - 1 ? `<button class="btn small ghost" id="next">${esc(seq[k + 1].t)} ›</button>` : ''}`;
      if (k > 0) $('#prev').onclick = () => Games.poemView(seq[k - 1], back, seq);
      if (k < seq.length - 1) $('#next').onclick = () => Games.poemView(seq[k + 1], back, seq);
    }
  };
  Games.poetCard = (n, back) => {
    const p = GD.poets.find(x => x.n === n);
    const m = UI.modal({ title: n, sub: p ? `${p.d}代 · ${p.life || ''}` : '诗人', back });
    const poems = GD.poems.filter(x => x.a === n);
    m.body.innerHTML = `${p ? `<div class="npc-say"><div class="npc-face">${esc(n.slice(-1))}</div><div class="bubble">${p.title ? `人称<b>「${esc(p.title)}」</b>。` : ''}${p.zi ? `字${esc(p.zi)}，` : ''}${p.hao ? `号${esc(p.hao)}。` : ''}${esc(p.bio)}</div></div>
      <div class="note"><div class="lbl">趣闻</div>${esc(p.fact)}</div>` : ''}
      <h3 style="font-family:var(--f-brush);font-weight:400;font-size:24px;margin:16px 0 8px">${esc(n)}的诗词</h3>
      <div class="cols2">${poems.map((x, k) => `<button class="li ${S.learned.poems[pkey(x)] ? 'done' : ''}" data-k="${k}"><span class="grow"><span class="lt">${esc(x.t)}</span><br><span class="ls" style="${KAI_STYLE};font-size:15px">${esc(x.lines[0])}，${esc(x.lines[1] || '')}</span></span></button>`).join('') || '<p class="muted">书阁里还没有收录。</p>'}</div>`;
    if (p) Voice.say(`我是${n}。` + (p.title ? `人们叫我${p.title}。` : ''));
    $$('[data-k]', m.body).forEach(b => b.onclick = () => Games.poemView(poems[+b.dataset.k], () => Games.poetCard(n, back), poems));
    if (!S.learned.figures['poet-' + n]) { S.learned.figures['poet-' + n] = 1; Reward.give(10, 2, true); }
  };
  function poOrder() {
    const back = () => Games.zoneMenu('poem');
    const m = UI.modal({ title: '诗句排排队', sub: '按顺序点出诗句', back });
    const rounds = 8; let i = 0, score = 0;
    const pool = regular();
    if (!pool.length) return empty(m.body);
    const used = new Set();
    const next = () => {
      if (i >= rounds) return finish({ id: 'po-order', title: '诗句排排队', score, total: rounds, back, sealName: '排句', again: poOrder });
      let p, k;
      for (let t = 0; t < 30; t++) { p = pick(pool); k = U.ri(0, p.lines.length - 1); if (!used.has(p.t + k)) break; }
      used.add(p.t + k);
      const line = [...p.lines[k]], tiles = shuffle(line.map((c, j) => ({ c, j })));
      let pos = 0, miss = 0;
      m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${i + 1} / ${rounds} 句</span><div class="qprog"><i style="width:${i / rounds * 100}%"></i></div><span>得分 ${score}</span></div>
        <div class="qprompt">《${esc(p.t)}》${esc(p.a)}</div>
        <div style="${KAI_STYLE};font-size:20px;color:var(--ink-soft)">${k > 0 ? esc(p.lines[k - 1]) + '，' : '（这是第一句）'}</div>
        <div class="slots">${line.map(() => '<span class="slot"></span>').join('')}</div>
        <div class="tiles">${tiles.map((t, j) => `<button class="tile" data-j="${j}">${esc(t.c)}</button>`).join('')}</div>
        <div class="muted" id="omsg"></div></div>`;
      const slots = $$('.slot', m.body);
      $$('.tile', m.body).forEach(b => b.onclick = () => {
        const t = tiles[+b.dataset.j];
        if (t.c === line[pos]) {
          slots[pos].textContent = t.c; b.disabled = true; pos++; Sfx.click();
          if (pos === line.length) {
            const good = miss <= 1; if (good) score++;
            Sfx.ok(); Reward.give(good ? 8 : 3, 1, true); Reward.learn('poems', pkey(p), 2);
            Voice.say(p.lines[k]);
            $('#omsg').innerHTML = good ? '<b>排对啦！</b>' : `完成，错了 ${miss} 次`;
            i++; setTimeout(next, 1300);
          }
        } else { miss++; Sfx.no(); b.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 }); }
      });
    };
    next();
  }
  function poFeihua() {
    const back = () => Games.zoneMenu('poem');
    const m = UI.modal({ title: '飞花令', sub: '找出所有含有「令字」的诗句', back });
    const keys = ['月', '花', '春', '风', '山', '水', '雨', '秋', '云', '江', '日', '天', '人', '柳', '雪', '鸟', '夜'];
    const allLines = GD.poems.flatMap(p => p.lines.map(l => ({ l, p })));
    const rounds = 5; let i = 0, score = 0;
    if (!allLines.length) return empty(m.body);
    const next = () => {
      if (i >= rounds) return finish({ id: 'po-feihua', title: '飞花令', score, total: rounds, back, sealName: '飞花', again: poFeihua });
      const key = pick(keys);
      const yes = sample(allLines.filter(x => x.l.includes(key)), U.ri(2, 4));
      const no = sample(allLines.filter(x => !x.l.includes(key)), 8 - yes.length);
      const cards = shuffle(yes.concat(no));
      m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${i + 1} / ${rounds} 令</span><div class="qprog"><i style="width:${i / rounds * 100}%"></i></div><span>得分 ${score}</span></div>
        <div class="qprompt">今日令字</div><div class="seal" style="width:84px;height:84px;font-size:52px">${esc(key)}</div>
        <div class="qprompt">选出<b>所有</b>含「${esc(key)}」的诗句（共 ${yes.length} 句）</div>
        <div class="opts">${cards.map((c, k) => `<button class="opt small" data-k="${k}">${esc(c.l)}</button>`).join('')}</div>
        <button class="btn red" id="fh-ok">就是这些！</button><div class="expl-wrap" style="width:100%"></div></div>`;
      const chosen = new Set();
      $$('.opt', m.body).forEach(b => b.onclick = () => { const k = +b.dataset.k; if (chosen.has(k)) { chosen.delete(k); b.style.borderColor = ''; b.style.background = ''; } else { chosen.add(k); b.style.borderColor = 'var(--azurite)'; b.style.background = '#E5F0F4'; } Sfx.click(); });
      $('#fh-ok').onclick = () => {
        let ok = true;
        $$('.opt', m.body).forEach((b, k) => { const has = cards[k].l.includes(key); b.disabled = true; b.style.background = ''; b.style.borderColor = ''; if (has) b.classList.add('ok'); if (chosen.has(k) !== has) { ok = false; if (chosen.has(k)) b.classList.add('no'); } });
        if (ok) { score++; Sfx.ok(); Reward.give(12, 3, true); } else Sfx.no();
        $('#fh-ok').remove();
        $('.expl-wrap', m.body).innerHTML = `<div class="explain" style="margin:0 auto">${yes.map(y => `${esc(y.l)} ——《${esc(y.p.t)}》${esc(y.p.a)}`).join('<br>')}</div><div style="text-align:center;margin-top:10px"><button class="btn" id="fh-n">${i + 1 >= rounds ? '看成绩' : '下一令 →'}</button></div>`;
        $('#fh-n').onclick = () => { i++; next(); };
      };
    };
    next();
  }

  /* ====================== 历史 ====================== */
  function hiTimeline() {
    const back = () => Games.zoneMenu('history');
    const m = UI.modal({ title: '朝代时间轴', sub: `已了解 ${Object.keys(S.learned.dyn).length} / ${GD.dynasties.length}`, back });
    if (!GD.dynasties.length) return empty(m.body);
    m.body.innerHTML = `<div class="rhyme" style="margin-bottom:12px"><div class="lbl">朝代歌</div>夏商与西周，东周分两段；春秋和战国，一统秦两汉；三分魏蜀吴，二晋前后延；南北朝并立，隋唐五代传；宋元明清后，皇朝至此完。 ${speakBtn('夏商与西周，东周分两段；春秋和战国，一统秦两汉；三分魏蜀吴，二晋前后延；南北朝并立，隋唐五代传；宋元明清后，皇朝至此完。', 1)}</div>
      <div class="list">${GD.dynasties.map(d => `<button class="li ${S.learned.dyn[d.n] ? 'done' : ''}" data-n="${esc(d.n)}"><span class="tl" style="background:${esc(d.color)};min-width:64px;text-align:center">${esc(d.n)}</span><span class="grow"><span class="ls" style="font-variant-numeric:tabular-nums">${U.yearStr(d.start)} — ${U.yearStr(d.end)} · 都城 ${esc(d.capital || '')}</span><br><span style="font-size:14px">${esc((d.events || []).slice(0, 2).join('；'))}</span></span></button>`).join('')}</div>`;
    bindSpeak(m.body);
    $$('[data-n]', m.body).forEach(b => b.onclick = () => { Sfx.click(); Games.dynastyCard(b.dataset.n, hiTimeline); });
  }
  Games.dynastyCard = (n, back) => {
    const i = GD.dynasties.findIndex(d => d.n === n), d = GD.dynasties[i];
    const m = UI.modal({ title: d ? (d.full || d.n) : n, sub: d ? `${U.yearStr(d.start)} — ${U.yearStr(d.end)}` : '', back });
    if (!d) return empty(m.body);
    const figs = GD.figures.filter(f => f.d === d.n);
    const box = (t, arr) => arr && arr.length ? `<div class="fbox"><h4>${t}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    m.body.innerHTML = `<div class="dyn-head" style="background:${esc(d.color)}"><div class="dyn-name">${esc(d.n)}</div><div><div class="dyn-years">${U.yearStr(d.start)} — ${U.yearStr(d.end)}（约 ${d.end - d.start} 年）</div><div class="dyn-years">都城：${esc(d.capital || '—')} · 建立者：${esc(d.founder || '—')}</div></div></div>
      <p style="line-height:1.8;font-size:15.5px;max-width:65ch">${esc(d.summary)} ${speakBtn(d.summary, 1)}</p>
      <div class="facts">${box('大事', d.events)}${box('人物', d.people)}${box('文化与发明', d.culture)}</div>
      ${d.fun ? `<div class="note" style="margin-top:12px;max-width:none"><div class="lbl">冷知识</div>${esc(d.fun)}</div>` : ''}
      ${figs.length ? `<h3 style="font-family:var(--f-brush);font-weight:400;font-size:22px;margin:14px 0 8px">这个时代的名人</h3><div class="row">${figs.map(f => `<button class="btn small ghost" data-f="${esc(f.n)}">${esc(f.n)}</button>`).join('')}</div>` : ''}
      <div class="row" style="justify-content:space-between;margin-top:14px">${i > 0 ? `<button class="btn small ghost" id="prev">‹ ${esc(GD.dynasties[i - 1].n)}</button>` : '<span></span>'}${i < GD.dynasties.length - 1 ? `<button class="btn small ghost" id="next">${esc(GD.dynasties[i + 1].n)} ›</button>` : ''}</div>`;
    bindSpeak(m.body);
    Voice.say(`${d.full || d.n}，${U.yearStr(d.start)}到${U.yearStr(d.end)}。`);
    if (Reward.learn('dyn', d.n, 8)) UI.toast({ big: d.n[0], t1: `了解了${d.full || d.n}`, t2: '+8 学识', ms: 1500 });
    $$('[data-f]', m.body).forEach(b => b.onclick = () => Games.figureCard(b.dataset.f, () => Games.dynastyCard(n, back)));
    if (i > 0) $('#prev').onclick = () => Games.dynastyCard(GD.dynasties[i - 1].n, back);
    if (i < GD.dynasties.length - 1) $('#next').onclick = () => Games.dynastyCard(GD.dynasties[i + 1].n, back);
  };
  Games.figureCard = (n, back) => {
    const f = GD.figures.find(x => x.n === n);
    const m = UI.modal({ title: n, sub: f ? `${f.d} · ${f.role}` : '', back });
    if (!f) return empty(m.body);
    m.body.innerHTML = `<div class="npc-say"><div class="npc-face">${esc(n[0])}</div><div class="bubble">${f.clues.map(c => esc(c)).join('<br>')}</div></div>
      <div class="note" style="max-width:none"><div class="lbl">生平</div>${esc(f.bio)} ${speakBtn(f.bio, 1)}</div>
      ${f.quote ? `<div class="rhyme" style="margin-top:12px"><div class="lbl">名言</div>${esc(f.quote)}</div>` : ''}
      <div class="row" style="margin-top:12px"><button class="btn small ghost" id="to-dyn">看看${esc(f.d)}</button></div>`;
    bindSpeak(m.body);
    Voice.say(f.clues.slice(-1)[0] || '');
    $('#to-dyn').onclick = () => Games.dynastyCard(f.d, () => Games.figureCard(n, back));
    if (Reward.learn('figures', n, 6)) UI.toast({ big: n[0], t1: `结识了${n}`, t2: '+6 学识', ms: 1500 });
  };
  function hiSort() {
    const back = () => Games.zoneMenu('history');
    const m = UI.modal({ title: '朝代排排队', sub: '从早到晚依次点', back });
    const rounds = 6; let i = 0, score = 0;
    if (GD.dynasties.length < 4) return empty(m.body);
    const next = () => {
      if (i >= rounds) return finish({ id: 'hi-sort', title: '朝代排排队', score, total: rounds, back, sealName: '排序', again: hiSort });
      const n = i < 2 ? 4 : 5;
      const set = sample(GD.dynasties, n), right = set.slice().sort((a, b) => a.start - b.start);
      let pos = 0, miss = 0;
      m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${i + 1} / ${rounds} 组</span><div class="qprog"><i style="width:${i / rounds * 100}%"></i></div><span>得分 ${score}</span></div>
        <div class="qprompt">按<b>时间先后</b>点一点（最早的先点）</div>
        <div class="slots">${right.map(() => '<span class="slot" style="min-width:70px;font-size:22px"></span>').join('')}</div>
        <div class="tiles">${set.map((d, k) => `<button class="tile wide" data-k="${k}" style="border-color:${esc(d.color)}">${esc(d.n)}</button>`).join('')}</div><div class="expl-wrap" style="width:100%"></div></div>`;
      const slots = $$('.slot', m.body);
      $$('.tile', m.body).forEach(b => b.onclick = () => {
        const d = set[+b.dataset.k];
        if (d === right[pos]) {
          slots[pos].textContent = d.n; slots[pos].style.color = d.color; b.disabled = true; pos++; Sfx.click();
          if (pos === right.length) {
            const good = miss === 0; if (good) score++;
            Sfx.ok(); Reward.give(good ? 10 : 3, 2, true);
            $('.expl-wrap', m.body).innerHTML = `<div class="explain" style="margin:0 auto">${right.map(x => `<b>${esc(x.n)}</b> ${U.yearStr(x.start)}`).join(' → ')}</div><div style="text-align:center;margin-top:10px"><button class="btn" id="hs-n">${i + 1 >= rounds ? '看成绩' : '下一组 →'}</button></div>`;
            $('#hs-n').onclick = () => { i++; next(); };
          }
        } else { miss++; Sfx.no(); b.animate([{ transform: 'translateX(-5px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 250 }); }
      });
    };
    next();
  }
  function hiGuess() {
    const back = () => Games.zoneMenu('history');
    const m = UI.modal({ title: '人物猜猜看', sub: '线索越少，得分越高', back });
    const rounds = 6; let i = 0, score = 0, pts = 0;
    if (GD.figures.length < 4) return empty(m.body);
    const list = sample(GD.figures, rounds);
    const next = () => {
      if (i >= rounds) return finish({ id: 'hi-guess', title: '人物猜猜看', score, total: rounds, back, sealName: '识英', again: hiGuess });
      const f = list[i]; let shown = 1;
      const opts = shuffle([f.n, ...sample(GD.figures.filter(x => x.n !== f.n), 3).map(x => x.n)]);
      const draw = () => {
        m.body.innerHTML = `<div class="qwrap"><div class="qtop"><span>第 ${i + 1} / ${rounds} 位</span><div class="qprog"><i style="width:${i / rounds * 100}%"></i></div><span>积分 ${pts}</span></div>
          <div class="qprompt">猜猜我是谁？（可得 ${5 - shown} 分）</div>
          <div class="list" style="width:min(560px,100%)">${f.clues.slice(0, shown).map((c, k) => `<div class="li" style="cursor:default"><span class="seal" style="width:28px;height:28px;font-size:14px">${k + 1}</span><span class="grow" style="font-size:16px">${esc(c)}</span></div>`).join('')}</div>
          ${shown < f.clues.length ? '<button class="btn small ghost" id="more">再给一条线索</button>' : ''}
          <div class="opts">${opts.map(o => `<button class="opt" data-o="${esc(o)}">${esc(o)}</button>`).join('')}</div><div class="expl-wrap" style="width:100%;display:flex;flex-direction:column;align-items:center;gap:10px"></div></div>`;
        Voice.say(f.clues[shown - 1]);
        if ($('#more')) $('#more').onclick = () => { shown++; draw(); };
        $$('.opt', m.body).forEach(b => b.onclick = () => {
          const ok = b.dataset.o === f.n;
          $$('.opt', m.body).forEach(bb => { bb.disabled = true; if (bb.dataset.o === f.n) bb.classList.add('ok'); });
          if ($('#more')) $('#more').remove();
          if (ok) { score++; pts += 5 - shown; Sfx.ok(); Reward.give(4 + (5 - shown) * 3, 2, true); Reward.learn('figures', f.n, 2); } else { b.classList.add('no'); Sfx.no(); }
          $('.expl-wrap', m.body).innerHTML = `<div class="explain"><b>${esc(f.n)}</b>（${esc(f.d)} · ${esc(f.role)}）：${esc(f.bio)}</div><button class="btn" id="hg-n">${i + 1 >= rounds ? '看成绩' : '下一位 →'}</button>`;
          $('#hg-n').onclick = () => { i++; next(); };
        });
      };
      draw();
    };
    next();
  }
  Games.relics = back => {
    const m = UI.modal({ title: '文物珍宝馆', sub: `${GD.relics.length} 件国宝`, back });
    if (!GD.relics.length) return empty(m.body);
    m.body.innerHTML = `<div class="cols2">${GD.relics.map((r, k) => `<button class="li" data-k="${k}"><span class="grow"><span class="lt">${esc(r.n)}</span><br><span class="ls">${esc(r.d)} · ${esc(r.type)}</span></span></button>`).join('')}</div>`;
    $$('[data-k]', m.body).forEach(b => b.onclick = () => Games.relicCard(GD.relics[+b.dataset.k].n, () => Games.relics(back)));
  };
  Games.relicCard = (n, back) => {
    const r = GD.relics.find(x => x.n === n) || GD.relics.find(x => x.n.includes(n));
    const m = UI.modal({ title: r ? r.n : n, sub: r ? `${r.d} · ${r.type}` : '', back });
    if (!r) return empty(m.body);
    m.body.innerHTML = `<div class="factcard"><div class="fc">${esc(r.d)} · ${esc(r.type)}</div><h3>${esc(r.n)}</h3><p>${esc(r.c)}</p><div>${speakBtn(r.n + '。' + r.c, 1)}</div></div>`;
    bindSpeak(m.body);
    if (!S.visited['relic-' + r.n]) { S.visited['relic-' + r.n] = 1; Reward.give(10, 3); }
  };

  /* ====================== 宝箱 · 知识卡 ====================== */
  Games.chest = () => {
    const unseen = GD.facts.map((f, i) => i).filter(i => !S.facts[i]);
    const idx = unseen.length ? pick(unseen) : U.ri(0, GD.facts.length - 1);
    const f = GD.facts[idx];
    Reward.give(20, 15, true);
    const m = UI.modal({ title: '打开宝箱！', sub: '获得 20 学识 · 15 铜钱' + (f && !S.facts[idx] ? ' · 新知识卡' : '') });
    if (f) S.facts[idx] = Date.now();
    Save.soon(); HUD.update();
    m.body.innerHTML = f ? `<div class="factcard"><div class="fc">知识卡 · ${esc(f.cat)}</div><h3>${esc(f.t)}</h3><p>${esc(f.c)}</p><div>${speakBtn(f.t + '。' + f.c, 1)}</div></div>
      <p class="muted" style="text-align:center">已收集知识卡 ${Object.keys(S.facts).length} / ${GD.facts.length} · 宝箱 ${Object.keys(S.chests).length} / ${HUD.chestTotal}</p>` : '<p>宝箱里是满满的铜钱！</p>';
    bindSpeak(m.body);
  };

  /* ====================== 图鉴 ====================== */
  Games.book = (tab = 'all') => {
    const m = UI.modal({ title: '我的图鉴', sub: `${Save.RANKS[Save.rank()].n} · 学识 ${S.xp}`, wide: true });
    const tabs = [['all', '总览'], ['seal', '印章'], ['hz', '汉字'], ['cy', '成语'], ['po', '诗词'], ['hi', '历史'], ['fact', '知识卡']];
    const count = o => Object.keys(o).filter(k => !k.startsWith('__') && !k.startsWith('poet-')).length;
    const bar = (label, n, t) => `<div style="display:grid;grid-template-columns:5em 1fr 5em;gap:10px;align-items:center"><span>${label}</span><div class="xpbar" style="background:var(--paper-2);height:10px"><i style="width:${t ? n / t * 100 : 0}%;background:var(--malachite)"></i></div><span style="font-variant-numeric:tabular-nums;text-align:right">${n} / ${t}</span></div>`;
    const ALL_SEALS = [['py-tone', '辨调'], ['py-balloon', '气球'], ['py-parts', '声韵'], ['hz-write', '笔墨'], ['hz-quiz', '识字'], ['hz-combo', '组字'], ['hz-picto', '象形'], ['cy-fill', '补阙'], ['cy-emoji', '猜谜'], ['cy-chain', '接龙'], ['cy-match', '释义'], ['po-next', '对句'], ['po-order', '排句'], ['po-author', '识人'], ['po-feihua', '飞花'], ['hi-sort', '排序'], ['hi-quiz', '博古'], ['hi-guess', '识英'], ['zy', '魁星']];
    const draw = t => {
      let h = `<div class="tabs">${tabs.map(([k, n]) => `<button class="tab ${k === t ? 'on' : ''}" data-t="${k}">${n}</button>`).join('')}</div>`;
      if (t === 'all') h += `<div style="display:flex;flex-direction:column;gap:10px;max-width:640px">
        ${bar('汉字', count(S.learned.hanzi), hz().length)}${bar('成语', count(S.learned.chengyu), GD.chengyu.length)}${bar('诗词', count(S.learned.poems), GD.poems.length)}
        ${bar('朝代', count(S.learned.dyn), GD.dynasties.length)}${bar('人物', count(S.learned.figures), GD.figures.length)}${bar('知识卡', Object.keys(S.facts).length, GD.facts.length)}
        ${bar('宝箱', Object.keys(S.chests).length, HUD.chestTotal)}${bar('印章', Object.keys(S.seals).length, ALL_SEALS.length)}
        <p class="muted">收集字灵 ${S.spirits} 个 · 答对 ${S.stats.correct} 题 · 闯关 ${S.stats.played} 次</p></div>`;
      if (t === 'seal') h += `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(84px,1fr));gap:14px;justify-items:center">${ALL_SEALS.map(([id, n]) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${UI.sealHTML(n, !S.seals[id]).replace('class="seal', 'style="width:60px;height:60px;font-size:22px;writing-mode:vertical-rl" class="seal')}<span class="muted" style="font-size:12px">${S.seals[id] ? '已获得' : '未获得'}</span></div>`).join('')}</div>`;
      if (t === 'hz') h += `<div class="chargrid">${hz().map(x => `<button class="cg ${S.learned.hanzi[x.c] ? 'done' : ''}" data-h="${esc(x.c)}">${esc(x.c)}<small>${esc(x.py)}</small></button>`).join('')}</div>`;
      if (t === 'cy') h += `<div class="cols2">${GD.chengyu.map(c => `<button class="li ${S.learned.chengyu[c.w] ? 'done' : ''}" data-w="${esc(c.w)}"><span class="lt">${esc(c.w)}</span><span class="ls grow">${esc(c.py)}</span></button>`).join('')}</div>`;
      if (t === 'po') h += `<div class="cols2">${GD.poems.map((p, k) => `<button class="li ${S.learned.poems[pkey(p)] ? 'done' : ''}" data-p="${k}"><span class="grow"><span class="lt">${esc(p.t)}</span> <span class="ls">${esc(p.a)}</span></span></button>`).join('')}</div>`;
      if (t === 'hi') h += `<div class="timeline">${GD.dynasties.map(d => `<button class="tl ${S.learned.dyn[d.n] ? '' : 'off'}" style="background:${esc(d.color)}" data-d="${esc(d.n)}">${esc(d.n)}</button>`).join('')}</div>
        <div class="chargrid" style="grid-template-columns:repeat(auto-fill,minmax(84px,1fr))">${GD.figures.map(f => `<button class="cg ${S.learned.figures[f.n] ? 'done' : ''}" data-f="${esc(f.n)}" style="font-size:17px;aspect-ratio:auto;padding:10px 4px">${esc(f.n)}<small>${esc(f.d)}</small></button>`).join('')}</div>`;
      if (t === 'fact') h += `<div class="cols2">${GD.facts.map((f, k) => S.facts[k] ? `<div class="factcard" style="margin:0"><div class="fc">${esc(f.cat)}</div><b>${esc(f.t)}</b><p style="font-size:14px">${esc(f.c)}</p></div>` : `<div class="factcard" style="margin:0;opacity:.45"><div class="fc">${esc(f.cat)}</div><b>？？？</b><p style="font-size:13px">打开宝箱获得</p></div>`).join('')}</div>`;
      m.body.innerHTML = h;
      const self = () => Games.book(t);
      $$('.tab', m.body).forEach(b => b.onclick = () => { Sfx.click(); draw(b.dataset.t); });
      $$('[data-h]', m.body).forEach(b => b.onclick = () => Games.hanziCard(b.dataset.h, self));
      $$('[data-w]', m.body).forEach(b => b.onclick = () => Games.chengyuCard(b.dataset.w, self));
      $$('[data-p]', m.body).forEach(b => b.onclick = () => Games.poemView(GD.poems[+b.dataset.p], self));
      $$('[data-d]', m.body).forEach(b => b.onclick = () => Games.dynastyCard(b.dataset.d, self));
      $$('[data-f]', m.body).forEach(b => b.onclick = () => Games.figureCard(b.dataset.f, self));
    };
    draw(tab);
  };

  /* ====================== 杂货铺 ====================== */
  const SHOP = [
    { id: 'robe-hong', slot: 'robe', v: 'hong', n: '红袍', d: '喜气洋洋', price: 120, sw: '#B8322A' },
    { id: 'robe-bai', slot: 'robe', v: 'bai', n: '白衫', d: '像李白一样潇洒', price: 100, sw: '#EDE7DA' },
    { id: 'robe-lv', slot: 'robe', v: 'lv', n: '青绿衫', d: '竹林里的颜色', price: 80, sw: '#3E8E6E' },
    { id: 'robe-zi', slot: 'robe', v: 'zi', n: '紫袍', d: '唐朝三品以上官员才能穿', price: 260, sw: '#7A4E9C', rank: 3 },
    { id: 'robe-huang', slot: 'robe', v: 'huang', n: '金缕衣', d: '金光闪闪', price: 480, sw: '#D9A43B', rank: 5 },
    { id: 'hat-straw', slot: 'hat', v: 'straw', n: '斗笠', d: '孤舟蓑笠翁', price: 60, sw: '#C9B06B' },
    { id: 'hat-flower', slot: 'hat', v: 'flower', n: '簪花', d: '头上插朵花', price: 60, sw: '#E86A8A' },
    { id: 'hat-scholar', slot: 'hat', v: 'scholar', n: '幞头', d: '唐宋读书人的帽子', price: 150, sw: '#1B1B1B', rank: 1 },
    { id: 'hat-zhuangyuan', slot: 'hat', v: 'zhuangyuan', n: '状元帽', d: '高中状元才能戴', price: 0, sw: '#1B1B1B', rank: 7 },
    { id: 'pet-rabbit', slot: 'pet', v: 'rabbit', n: '玉兔', d: '蹦蹦跳跳跟着你', price: 180, sw: '#F4F1EA', icon: '兔' },
    { id: 'pet-panda', slot: 'pet', v: 'panda', n: '熊猫', d: '国宝陪你学习', price: 260, sw: '#F4F1EA', icon: '熊' },
    { id: 'pet-crane', slot: 'pet', v: 'crane', n: '仙鹤', d: '在你头顶盘旋', price: 320, sw: '#FFFFFF', icon: '鹤', rank: 2 },
    { id: 'pet-qilin', slot: 'pet', v: 'qilin', n: '麒麟', d: '祥瑞神兽', price: 600, sw: '#D9A43B', icon: '麟', rank: 4 },
    { id: 'cloud', slot: 'cloud', v: true, n: '筋斗云', d: '跑得更快，还能在海上飞', price: 400, sw: '#E5F0F4', icon: '云', rank: 2 }
  ];
  Games.shop = () => {
    const m = UI.modal({ title: '杂货铺', sub: `你有 ${S.coins} 铜钱` });
    const r = Save.rank();
    m.body.innerHTML = `<div class="npc-say"><div class="npc-face">掌</div><div class="bubble">客官里边请！答题、开宝箱、收字灵都能赚铜钱。有些宝贝要到一定功名才卖哦。</div></div>
      <div class="shop">${SHOP.map(it => {
      const owned = S.owned[it.id] || (it.price === 0 && r >= (it.rank || 0));
      const locked = (it.rank || 0) > r, worn = it.slot === 'cloud' ? S.wear.cloud : S.wear[it.slot] === it.v;
      return `<div class="item"><div class="swatch" style="background:${it.sw};color:${/^#(1B|2)/i.test(it.sw) ? '#F3DFA8' : '#1B2226'};font-family:var(--f-brush)">${esc(it.icon || it.n[0])}</div>
          <div class="in">${esc(it.n)}</div><div class="muted" style="font-size:13px">${esc(it.d)}</div>
          ${owned ? `<button class="btn small ${worn ? 'ghost' : 'green'}" data-wear="${it.id}">${worn ? '卸下' : '穿戴'}</button>`
          : locked ? `<button class="btn small" disabled>需要「${Save.RANKS[it.rank].n}」</button>`
            : `<button class="btn small red" data-buy="${it.id}" ${S.coins < it.price ? 'disabled' : ''}>🪙 ${it.price}</button>`}</div>`;
    }).join('')}</div>`;
    $$('[data-buy]', m.body).forEach(b => b.onclick = () => {
      const it = SHOP.find(x => x.id === b.dataset.buy); if (S.coins < it.price) return;
      S.coins -= it.price; S.owned[it.id] = 1; Sfx.coin(); wear(it, true); UI.toast({ big: it.icon || it.n[0], t1: `买到了「${it.n}」`, ms: 1800 }); Games.shop();
    });
    $$('[data-wear]', m.body).forEach(b => b.onclick = () => { const it = SHOP.find(x => x.id === b.dataset.wear); S.owned[it.id] = 1; const worn = it.slot === 'cloud' ? S.wear.cloud : S.wear[it.slot] === it.v; wear(it, !worn); Sfx.click(); Games.shop(); });
  };
  function wear(it, on) {
    if (it.slot === 'cloud') S.wear.cloud = on; else S.wear[it.slot] = on ? it.v : null;
    World.applyWear(); HUD.update(); Save.soon();
  }

  /* ====================== 地图 / 设置 ====================== */
  Games.map = () => {
    const m = UI.modal({ title: '文曲岛全图', sub: '点地名，腾云驾雾直接前往' });
    const extra = [['peak', '鹳雀楼（山顶）'], ['islet', '蓬莱小岛']].filter(([id]) => S.visited[id]);
    m.body.innerHTML = `<div style="display:grid;grid-template-columns:minmax(0,1fr);gap:14px;justify-items:center">
      <canvas id="bigmap" width="600" height="600" style="width:min(460px,100%);aspect-ratio:1;border-radius:12px;border:2px solid var(--gold)"></canvas>
      <div class="row" style="justify-content:center">${World.zones.map(z => `<button class="btn small ${S.visited[z.id] ? '' : 'ghost'}" data-tp="${z.id}">${esc(z.name)}</button>`).join('')}${extra.map(([id, n]) => `<button class="btn small" data-tp="${id}">${esc(n)}</button>`).join('')}</div>
      <p class="muted" style="font-size:13px">黄点是字灵，棕色小方块是打开过的宝箱。还没去过的山顶和小岛，要自己走过去才能解锁传送。</p></div>`;
    World.drawMap($('#bigmap'), true);
    $$('[data-tp]', m.body).forEach(b => b.onclick = () => { UI.close(); World.teleport(b.dataset.tp); });
  };
  Games.settings = () => {
    const m = UI.modal({ title: '设置', sub: '声音与画面' });
    const st = S.settings;
    const row = (id, label, on) => `<label style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--paper-edge)"><span>${label}</span><input type="checkbox" id="${id}" ${on ? 'checked' : ''} style="width:22px;height:22px"></label>`;
    m.body.innerHTML = `<div style="max-width:480px">
      ${row('s-voice', '语音朗读' + (Voice.ok ? '' : '（此浏览器不支持）'), st.voice)}${row('s-sfx', '音效', st.sfx)}${row('s-music', '古筝背景音乐', st.music)}
      ${row('s-cycle', '昼夜变化', st.cycle !== false)}${row('s-shadow', '阴影（关掉会更流畅）', st.shadows !== false)}
      <label style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;gap:12px"><span>朗读速度</span><input type="range" id="s-rate" min="0.5" max="1.2" step="0.05" value="${st.rate}" style="flex:1;max-width:220px"></label>
      <div class="row" style="margin-top:10px"><button class="btn small ghost" id="s-test">试听</button></div>
      <div style="margin-top:24px;padding-top:14px;border-top:1px dashed var(--paper-edge)"><div class="lbl">存档</div><p class="muted" style="font-size:13px">进度保存在这台设备的浏览器里。</p>
        <div id="reset-zone"><button class="btn small ghost" id="s-reset">清空进度，重新开始</button></div></div></div>`;
    $('#s-voice').onchange = e => { st.voice = e.target.checked; Save.soon(); };
    $('#s-sfx').onchange = e => { st.sfx = e.target.checked; Save.soon(); };
    $('#s-music').onchange = e => { Music.set(e.target.checked); Save.soon(); };
    $('#s-cycle').onchange = e => { st.cycle = e.target.checked; Save.soon(); };
    $('#s-shadow').onchange = e => { st.shadows = e.target.checked; World.setShadows(e.target.checked); Save.soon(); };
    $('#s-rate').oninput = e => { st.rate = +e.target.value; Save.soon(); };
    $('#s-test').onclick = () => Voice.say('床前明月光，疑是地上霜。');
    $('#s-reset').onclick = () => {
      $('#reset-zone').innerHTML = `<p style="color:var(--cinnabar)">所有学识、铜钱、印章都会清空，确定吗？</p><div class="row"><button class="btn small red" id="s-yes">确定清空</button><button class="btn small ghost" id="s-no">算了</button></div>`;
      $('#s-yes').onclick = () => Save.reset();
      $('#s-no').onclick = () => Games.settings();
    };
  };
})();
