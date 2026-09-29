/* 文曲岛奇遇 — 启动 */
(function () {
  'use strict';
  const { $ } = U;
  const loading = $('#loading'), startBtn = $('#start');

  if (!window.THREE) { loading.textContent = '三维引擎加载失败，请检查网络后刷新。'; return; }

  async function boot() {
    try {
      await World.init($('#game'), msg => { loading.textContent = msg; });
    } catch (e) {
      console.error(e); loading.textContent = '画卷铺开失败：' + e.message; return;
    }
    World.pause(true);
    World.start();
    HUD.update();
    const returning = S.xp > 0;
    loading.textContent = returning ? `欢迎回来，${Save.RANKS[Save.rank()].n}！` : '准备好了！';
    startBtn.textContent = returning ? '继续探险' : '登岛探险';
    startBtn.disabled = false;
    startBtn.focus();
  }

  startBtn.addEventListener('click', () => {
    Sfx.unlock(); Music.start(); Sfx.chest();
    $('#title').hidden = true;
    ['#hud-top', '#minimap-wrap', '#actions', '#hint-keys'].forEach(s => { $(s).hidden = false; });
    World.pause(false);
    if (!S.visited.center) {
      setTimeout(() => UI.toast({ big: '墨', t1: '欢迎来到文曲岛！', t2: '先去广场中央拜见文曲星君，或者问问书童小墨', ms: 5000 }), 800);
      Voice.say('欢迎来到文曲岛！');
    }
    setTimeout(() => { const h = $('#hint-keys'); if (h) h.hidden = true; }, 15000);
  });

  $('#b-map').onclick = () => { Sfx.click(); Games.map(); };
  $('#b-book').onclick = () => { Sfx.click(); Games.book(); };
  $('#b-shop').onclick = () => { Sfx.click(); Games.shop(); };
  $('#b-set').onclick = () => { Sfx.click(); Games.settings(); };
  $('#minimap').onclick = () => { Sfx.click(); Games.map(); };
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') UI.close(); });
  addEventListener('beforeunload', () => Save.now());
  document.addEventListener('visibilitychange', () => { if (document.hidden) Save.now(); });

  boot();
})();
