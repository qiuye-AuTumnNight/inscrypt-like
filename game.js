/*!
 * 林间牌局 —— 肉鸽卡牌对战
 * 玩法参考《邪恶铭刻》的核心循环：血祭召唤 / 骨头代币 / 天平定胜负 / 敌方预排。
 * 纯原生 JS + DOM，无 Canvas、无依赖，可直接部署到 GitHub Pages。
 */
(() => {
  'use strict';

  /* ==================== 常量 ==================== */
  const SCALE_MAX = 5;          // 天平偏离几格算赢
  const LANES = 4;
  const HAND_MAX = 8;
  const MAX_CANDLES = 2;
  const STORE = { endless: 'cardgame.endless', stage: 'cardgame.stage', save: 'cardgame.save' };

  const SIGILS = {
    airborne: { icon: '🪶', name: '空袭', desc: '攻击时无视对面的生物，直击天平' },
    quills: { icon: '🌵', name: '尖刺', desc: '被攻击时对攻击者造成 1 点伤害' },
    double: { icon: '⚔️', name: '双击', desc: '同时攻击左右相邻的格子' },
    poison: { icon: '☠️', name: '剧毒', desc: '造成伤害即消灭对方' },
    draw: { icon: '📜', name: '亡语', desc: '死亡时抽一张牌' },
    grow: { icon: '🌱', name: '生长', desc: '每次攻击后 +1 攻击' },
    stone: { icon: '🪨', name: '石肤', desc: '每次受到的伤害减 1（至少 1）' },
  };

  // blood = 血祭费用（献祭自己生物的数量）；bones = 骨头费用；sacValue = 被献祭时提供的血
  const DEFS = {
    squirrel: { name: '松鼠', emoji: '🐿️', tribe: 'beast', blood: 0, atk: 0, hp: 1, sigils: [] },
    goat: { name: '黑山羊', emoji: '🐐', tribe: 'beast', blood: 0, atk: 0, hp: 1, sigils: [], sacValue: 3 },
    wolfcub: { name: '狼崽', emoji: '🐺', tribe: 'beast', blood: 1, atk: 1, hp: 2, sigils: [] },
    toad: { name: '蟾蜍', emoji: '🐸', tribe: 'reptile', blood: 1, atk: 1, hp: 3, sigils: [] },
    viper: { name: '王蛇', emoji: '🐍', tribe: 'reptile', blood: 1, atk: 1, hp: 1, sigils: ['grow'] },
    wolf: { name: '灰狼', emoji: '🐺', tribe: 'beast', blood: 2, atk: 3, hp: 2, sigils: [] },
    adder: { name: '蝰蛇', emoji: '🐍', tribe: 'reptile', blood: 2, atk: 1, hp: 1, sigils: ['poison'] },
    elk: { name: '麋鹿', emoji: '🦌', tribe: 'beast', blood: 2, atk: 2, hp: 4, sigils: ['quills'] },
    mantis: { name: '螳螂', emoji: '🦗', tribe: 'insect', blood: 2, atk: 1, hp: 1, sigils: ['double'] },
    raven: { name: '渡鸦', emoji: '🐦‍⬛', tribe: 'avian', blood: 2, atk: 2, hp: 3, sigils: ['airborne'] },
    spider: { name: '毒蛛', emoji: '🕷️', tribe: 'insect', blood: 2, atk: 1, hp: 4, sigils: ['poison'] },
    grizzly: { name: '灰熊', emoji: '🐻', tribe: 'beast', blood: 3, atk: 4, hp: 6, sigils: [] },
    hawk: { name: '苍鹰', emoji: '🦅', tribe: 'avian', blood: 3, atk: 3, hp: 3, sigils: ['airborne'] },
    skeleton: { name: '骷髅', emoji: '💀', tribe: 'undead', bones: 1, atk: 1, hp: 1, sigils: [] },
    bonedog: { name: '骨犬', emoji: '🐕', tribe: 'undead', bones: 3, atk: 2, hp: 3, sigils: [] },
    scarab: { name: '圣甲虫', emoji: '🪲', tribe: 'insect', bones: 3, atk: 1, hp: 5, sigils: ['grow'] },
    gargoyle: { name: '石像鬼', emoji: '🗿', tribe: 'undead', bones: 4, atk: 1, hp: 5, sigils: ['stone'] },
    banshee: { name: '女妖', emoji: '👻', tribe: 'undead', bones: 4, atk: 2, hp: 2, sigils: ['airborne'] },
    lich: { name: '巫妖', emoji: '🧙', tribe: 'undead', bones: 6, atk: 3, hp: 4, sigils: ['draw'] },
  };

  const STARTER = ['wolfcub', 'wolfcub', 'toad', 'viper', 'wolf', 'adder', 'elk', 'skeleton'];

  const COMMON_POOL = ['wolfcub', 'toad', 'viper', 'wolf', 'adder', 'elk', 'mantis', 'raven', 'skeleton', 'bonedog', 'goat', 'spider'];
  const RARE_POOL = ['grizzly', 'hawk', 'gargoyle', 'banshee', 'lich', 'scarab'];

  const ENEMIES = [
    { name: '林间狼群', emoji: '🐺', pool: ['wolfcub', 'wolfcub', 'wolf'], pattern: 'block' },
    { name: '荒废墓园', emoji: '💀', pool: ['skeleton', 'skeleton', 'bonedog'], pattern: 'wide' },
    { name: '瘴气毒沼', emoji: '🐍', pool: ['adder', 'toad', 'adder'], pattern: 'block' },
    { name: '断崖鸦群', emoji: '🦅', pool: ['raven', 'raven', 'hawk'], pattern: 'wide' },
    { name: '地下虫巢', emoji: '🕷️', pool: ['mantis', 'spider', 'scarab'], pattern: 'block' },
    { name: '空心林地', emoji: '👻', pool: ['banshee', 'gargoyle', 'skeleton'], pattern: 'wide' },
  ];

  const BOSSES = [
    { name: '守林人', emoji: '🪓', pool: ['wolf', 'wolf', 'grizzly', 'wolf'], pattern: 'block', bonus: { atk: 1, hp: 2 } },
    { name: '沼泽之主', emoji: '🐊', pool: ['spider', 'adder', 'grizzly', 'adder'], pattern: 'block', bonus: { atk: 1, hp: 3 } },
    { name: '白骨君王', emoji: '☠️', pool: ['bonedog', 'banshee', 'lich', 'gargoyle'], pattern: 'wide', bonus: { atk: 2, hp: 3 } },
  ];

  const NODES = {
    battle: { icon: '⚔️', name: '遭遇战', desc: '一场普通战斗，胜利后三选一加牌' },
    elite: { icon: '💀', name: '精英', desc: '强敌，奖励是稀有牌' },
    card: { icon: '🎁', name: '拾遗', desc: '不用战斗，直接三选一加牌' },
    upgrade: { icon: '🔥', name: '淬炼', desc: '给一张牌 +1 攻击 或 +1 生命 或 加一个印记' },
    remove: { icon: '✂️', name: '遗忘', desc: '从牌组里移除一张牌' },
    rest: { icon: '🕯️', name: '篝火', desc: '恢复一根蜡烛' },
  };

  const CHAPTER_STEPS = [4, 5, 5];

  /* ==================== 状态 ==================== */
  let run = null;
  let battle = null;

  /* ==================== DOM ==================== */
  const app = document.getElementById('app');
  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ovTitle');
  const ovText = document.getElementById('ovText');
  const ovActions = document.getElementById('ovActions');
  const picker = document.getElementById('picker');

  const el = (id) => document.getElementById(id);

  /* ==================== 小工具 ==================== */
  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function rand(n) {
    return Math.floor(Math.random() * n);
  }

  function pick(arr) {
    return arr[rand(arr.length)];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = rand(i + 1);
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function readStore(key, fb) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fb : v;
    } catch (e) {
      return fb;
    }
  }

  function writeStore(key, val) {
    try {
      localStorage.setItem(key, String(val));
    } catch (e) { /* 隐私模式忽略 */ }
  }

  /* ==================== 卡牌工厂 ==================== */
  function mkCard(key, bonus) {
    const d = DEFS[key];
    const c = {
      key: key,
      name: d.name,
      emoji: d.emoji,
      tribe: d.tribe,
      atk: d.atk + ((bonus && bonus.atk) || 0),
      hp: d.hp + ((bonus && bonus.hp) || 0),
      sigils: (d.sigils || []).slice(),
      blood: d.blood || 0,
      bones: d.bones || 0,
      sacValue: d.sacValue || 1,
    };
    c.maxHp = c.hp;
    return c;
  }

  function cloneCard(c) {
    const n = Object.assign({}, c);
    n.sigils = c.sigils.slice();
    return n;
  }

  function costOf(c) {
    if (c.bones > 0) return { type: 'bone', n: c.bones };
    if (c.blood > 0) return { type: 'blood', n: c.blood };
    return { type: 'free', n: 0 };
  }

  function describe(c) {
    const bits = [];
    const cost = costOf(c);
    if (cost.type === 'blood') bits.push('血祭 ' + cost.n);
    else if (cost.type === 'bone') bits.push('骨头 ' + cost.n);
    else bits.push('免费');
    bits.push(c.atk + ' 攻 / ' + c.hp + ' 血');
    (c.sigils || []).forEach((s) => bits.push(SIGILS[s] ? SIGILS[s].icon + SIGILS[s].name : s));
    return bits.join(' · ');
  }

  /* ==================== 卡牌 DOM ==================== */
  function cardEl(c, extraClass, opts) {
    const o = opts || {};
    const d = document.createElement('div');
    d.className = 'card card--' + c.tribe + (extraClass ? ' ' + extraClass : '');
    if (c._anim) {
      d.classList.add('card--' + c._anim);
      c._anim = null;
    }
    if (c._dying) d.classList.add('card--dead');

    const cost = costOf(c);
    let costHtml = '';
    if (cost.type === 'blood') costHtml = '<span class="card__cost card__cost--blood">🩸' + cost.n + '</span>';
    else if (cost.type === 'bone') costHtml = '<span class="card__cost card__cost--bone">🦴' + cost.n + '</span>';

    const sig = (c.sigils || []).map((s) => '<i title="' + (SIGILS[s] ? SIGILS[s].name : s) + '">' + (SIGILS[s] ? SIGILS[s].icon : '') + '</i>').join('');

    d.innerHTML = costHtml
      + '<span class="card__emoji">' + c.emoji + '</span>'
      + '<span class="card__name">' + c.name + '</span>'
      + '<span class="card__sigils">' + sig + '</span>'
      + '<span class="card__atk">' + c.atk + '</span>'
      + '<span class="card__hp' + (c.hp < c.maxHp ? ' is-hurt' : '') + '">' + Math.max(0, c.hp) + '</span>';

    if (o.title) d.title = o.title;
    return d;
  }

  /* ==================== 屏幕 ==================== */
  function showScreen(name) {
    app.dataset.screen = name;
  }

  /* ==================== 遮罩 ==================== */
  function showOverlay(opt) {
    ovTitle.textContent = opt.title || '';
    ovTitle.classList.toggle('is-bad', !!opt.bad);
    ovText.innerHTML = opt.text || '';
    ovActions.innerHTML = '';
    picker.innerHTML = '';
    picker.className = 'picker';
    picker.hidden = !opt.items;
    (opt.buttons || []).forEach((b) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn' + (b.ghost ? ' btn--ghost' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', b.onClick);
      ovActions.appendChild(btn);
    });
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function toast(msg) {
    const hint = el('battleHint');
    if (hint) hint.textContent = msg;
  }

  /* ==================== 运行初始化 ==================== */
  function newRun(mode) {
    run = {
      mode: mode,
      floor: 1,
      chapter: 1,
      step: 0,          // 当前章节内第几步（从 0 开始）
      candles: MAX_CANDLES,
      deck: STARTER.map((k) => mkCard(k)),
      choices: [],
    };
    buildChoices();
    saveRun();
    renderMap();
    showScreen('map');
  }

  function bossForFloor() {
    if (run.mode === 'endless') return BOSSES[(Math.ceil(run.floor / 5) - 1) % BOSSES.length];
    return BOSSES[Math.min(run.chapter - 1, BOSSES.length - 1)];
  }

  function isBossFloor() {
    if (run.mode === 'endless') return run.floor % 5 === 0;
    return run.step >= CHAPTER_STEPS[Math.min(run.chapter - 1, CHAPTER_STEPS.length - 1)] - 1;
  }

  function levelFor() {
    // 关卡模式的强度增长比无限模式温和
    if (run.mode === 'endless') return run.floor;
    return 1 + (run.floor - 1) * 0.4;
  }

  // 敌人的强度主要来自「战场压力」而不是堆数值，否则玩家会被大墙堵死
  function bonusFor(level) {
    return {
      atk: Math.min(4, Math.floor((level - 1) / 3)),
      hp: Math.min(8, Math.floor((level - 1) * 0.4)),
    };
  }

  function buildChoices() {
    if (isBossFloor()) {
      run.choices = ['boss'];
      return;
    }
    const table = ['battle', 'battle', 'battle', 'card', 'card', 'elite', 'upgrade', 'remove', 'rest'];
    const out = [];
    let guard = 0;
    while (out.length < 3 && guard++ < 60) {
      const t = pick(table);
      if (out.indexOf(t) < 0) out.push(t);
    }
    while (out.length < 3) out.push('battle');
    run.choices = out;
  }

  function saveRun() {
    if (!run) return;
    writeStore(STORE.save, JSON.stringify({
      mode: run.mode, floor: run.floor, chapter: run.chapter, step: run.step,
      candles: run.candles, deck: run.deck, choices: run.choices,
    }));
  }

  function loadRun() {
    try {
      const raw = readStore(STORE.save, null);
      if (!raw) return false;
      const r = JSON.parse(raw);
      if (!r || !r.deck || !r.deck.length) return false;
      run = r;
      if (!run.choices || !run.choices.length) buildChoices();
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearRun() {
    try { localStorage.removeItem(STORE.save); } catch (e) { /* 忽略 */ }
  }

  /* ==================== 地图 ==================== */
  function renderCandles() {
    const cs = el('candles');
    cs.innerHTML = '';
    for (let i = 0; i < MAX_CANDLES; i++) {
      const s = document.createElement('i');
      s.textContent = '🕯️';
      if (i < run.candles) s.className = 'on';
      cs.appendChild(s);
    }
  }

  function renderMap() {
    el('mapModeLabel').textContent = run.mode === 'endless' ? '无限' : '关卡';
    el('mapFloor').textContent = '第 ' + run.floor + ' 层';
    renderCandles();

    const boss = isBossFloor();
    el('mapTitle').textContent = boss
      ? (run.mode === 'stage' && run.chapter === 3 ? '最终决战' : 'Boss 挡住了去路')
      : '选择前路';

    const wrap = el('mapChoices');
    wrap.innerHTML = '';
    run.choices.forEach((type) => {
      const info = type === 'boss'
        ? { icon: bossForFloor().emoji, name: 'Boss · ' + bossForFloor().name, desc: '击败它继续前进' }
        : NODES[type];
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'node' + (type === 'boss' ? ' node--boss' : '');
      b.innerHTML = '<span class="node__icon">' + info.icon + '</span>'
        + '<span class="node__body"><span class="node__name">' + info.name + '</span>'
        + '<span class="node__desc">' + info.desc + '</span></span>';
      b.addEventListener('click', () => enterNode(type));
      wrap.appendChild(b);
    });

    const counts = {};
    run.deck.forEach((c) => { counts[c.name] = (counts[c.name] || 0) + 1; });
    el('mapDeckInfo').innerHTML = '牌组 <b>' + run.deck.length + '</b> 张　'
      + Object.keys(counts).map((k) => k + '×' + counts[k]).join('、');
    showScreen('map');
  }

  function enterNode(type) {
    saveRun();
    if (type === 'card') return rewardCards(COMMON_POOL, '拾遗', () => advanceFloor());
    if (type === 'upgrade') return doUpgrade(() => advanceFloor());
    if (type === 'remove') return doRemove(() => advanceFloor());
    if (type === 'rest') {
      run.candles = Math.min(MAX_CANDLES, run.candles + 1);
      renderMap();
      return showOverlay({
        title: '篝火',
        text: '你在火边歇了一会儿。<br>蜡烛恢复到 <b>' + run.candles + '</b> 根。',
        buttons: [{ label: '继续前进', onClick: () => { hideOverlay(); advanceFloor(); } }],
      });
    }
    // 战斗
    const isBoss = type === 'boss';
    const isElite = type === 'elite';
    const level = levelFor() + (isElite ? 1.5 : 0) + (isBoss ? 1.5 : 0);
    const base = isBoss ? bossForFloor() : pick(ENEMIES);
    const bonus = bonusFor(level);
    if (base.bonus) {
      bonus.atk += base.bonus.atk;
      bonus.hp += base.bonus.hp;
    }
    startBattle({
      name: base.name,
      emoji: base.emoji,
      pool: base.pool,
      pattern: base.pattern,
      bonus: bonus,
      isBoss: isBoss,
      isElite: isElite,
      kind: type,
    });
  }

  function advanceFloor() {
    run.floor += 1;
    if (run.mode === 'stage') {
      run.step += 1;
      const steps = CHAPTER_STEPS[Math.min(run.chapter - 1, CHAPTER_STEPS.length - 1)];
      if (run.step >= steps) {
        if (run.chapter >= CHAPTER_STEPS.length) return runVictory();
        run.chapter += 1;
        run.step = 0;
      }
    }
    buildChoices();
    saveRun();
    renderMap();
    hideOverlay();
  }

  /* ==================== 奖励 / 强化 / 移除 ==================== */
  function cardPickEl(c, desc) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'pick';
    const holder = document.createElement('div');
    holder.className = 'pick__card';
    holder.appendChild(cardEl(c, 'card--board'));
    b.appendChild(holder);
    const body = document.createElement('div');
    body.className = 'pick__body';
    body.innerHTML = '<span class="pick__name">' + c.name + '</span><span class="pick__desc">' + (desc || describe(c)) + '</span>';
    b.appendChild(body);
    return b;
  }

  function rewardCards(pool, title, done) {
    const opts = [];
    const used = {};
    let guard = 0;
    while (opts.length < 3 && guard++ < 60) {
      const k = pick(pool);
      if (used[k]) continue;
      used[k] = true;
      opts.push(mkCard(k));
    }
    showOverlay({
      title: title,
      text: '选择一张加入牌组',
      items: true,
      buttons: [{ label: '跳过', ghost: true, onClick: () => { hideOverlay(); done(); } }],
    });
    opts.forEach((c) => {
      const b = cardPickEl(c);
      b.addEventListener('click', () => {
        run.deck.push(c);
        hideOverlay();
        renderMap();
        done();
      });
      picker.appendChild(b);
    });
  }

  function doUpgrade(done) {
    if (!run.deck.length) { done(); return; }
    showOverlay({ title: '淬炼', text: '选择要强化的牌', items: true, buttons: [{ label: '返回', ghost: true, onClick: () => { hideOverlay(); renderMap(); } }] });
    run.deck.forEach((c, i) => {
      const b = cardPickEl(c);
      b.addEventListener('click', () => chooseUpgrade(i, done));
      picker.appendChild(b);
    });
  }

  function chooseUpgrade(index, done) {
    const c = run.deck[index];
    const sigilKeys = Object.keys(SIGILS).filter((s) => c.sigils.indexOf(s) < 0);
    const items = [
      { label: '攻击 +1', run: () => { c.atk += 1; } },
      { label: '生命 +1', run: () => { c.hp += 1; c.maxHp += 1; } },
    ];
    if (sigilKeys.length) {
      const s = pick(sigilKeys);
      items.push({ label: '获得印记 ' + SIGILS[s].icon + SIGILS[s].name, run: () => { c.sigils.push(s); } });
    }
    showOverlay({ title: '淬炼 · ' + c.name, text: '选择一项强化', items: true, buttons: [{ label: '取消', ghost: true, onClick: () => { hideOverlay(); doUpgrade(done); } }] });
    items.forEach((it) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'pick';
      b.innerHTML = '<span class="pick__body"><span class="pick__name">' + it.label + '</span>'
        + '<span class="pick__desc">当前：' + describe(c) + '</span></span>';
      b.addEventListener('click', () => {
        it.run();
        hideOverlay();
        saveRun();
        renderMap();
        done();
      });
      picker.appendChild(b);
    });
  }

  function doRemove(done) {
    if (run.deck.length <= 3) {
      showOverlay({
        title: '遗忘',
        text: '牌组已经够精简了。',
        buttons: [{ label: '继续前进', onClick: () => { hideOverlay(); done(); } }],
      });
      return;
    }
    showOverlay({ title: '遗忘', text: '选择要移除的牌', items: true, buttons: [{ label: '返回', ghost: true, onClick: () => { hideOverlay(); renderMap(); } }] });
    run.deck.forEach((c, i) => {
      const b = cardPickEl(c);
      b.addEventListener('click', () => {
        run.deck.splice(i, 1);
        hideOverlay();
        saveRun();
        renderMap();
        done();
      });
      picker.appendChild(b);
    });
  }

  /* ==================== 战斗 ==================== */
  function startBattle(foe) {
    const queue = [];
    const bag = shuffle(foe.pool);
    for (let i = 0; i < 8; i++) queue.push(mkCard(bag[i % bag.length], foe.bonus));

    battle = {
      foe: foe,
      scale: 0,
      player: [null, null, null, null],
      enemy: [null, null, null, null],
      hand: [],
      deck: shuffle(run.deck.map(cloneCard)),
      bones: 0,
      queue: queue,
      turn: 0,
      phase: 'idle',      // idle | draw | main | sacrifice | placing | resolving
      selected: -1,
      sacNeed: 0,
      sacGot: 0,
      busy: false,
      over: false,
    };
    showScreen('battle');
    renderBattle();          // 先渲染，否则开战弹窗背后是一块没初始化的空板
    showOverlay({
      title: foe.emoji + ' ' + foe.name,
      text: (foe.isBoss ? '<b>Boss 战</b><br>' : '') + '把天平推向自己这边 <b>' + SCALE_MAX + '</b> 格即可获胜。<br>先手由你开始。',
      buttons: [{ label: '开战', onClick: () => { hideOverlay(); startTurn(); } }],
    });
  }

  function refillQueue() {
    const bag = shuffle(battle.foe.pool);
    for (let i = 0; i < 4; i++) battle.queue.push(mkCard(bag[i % bag.length], battle.foe.bonus));
  }

  function startTurn() {
    if (battle.over) return;
    battle.turn += 1;
    battle.phase = 'draw';
    battle.selected = -1;
    renderBattle();
  }

  function drawFromDeck() {
    if (!battle.deck.length) return null;
    return battle.deck.pop();
  }

  function doDraw(useSquirrel) {
    if (battle.phase !== 'draw') return;
    if (battle.hand.length >= HAND_MAX) {
      toast('手牌已满');
      return;
    }
    const c = useSquirrel ? mkCard('squirrel') : drawFromDeck();
    if (!c) {
      toast('抽牌堆空了，只能拿松鼠');
      return;
    }
    battle.hand.push(c);
    battle.phase = 'main';
    toast(useSquirrel ? '从松鼠堆拿了一张' : '抽了一张牌');
    renderBattle();
  }

  function selectHand(i) {
    if (battle.busy || battle.over) return;
    if (battle.phase !== 'main' && battle.phase !== 'sacrifice' && battle.phase !== 'placing') return;
    const c = battle.hand[i];
    if (!c) return;

    if (battle.selected === i) {  // 再点一次取消
      battle.selected = -1;
      battle.phase = 'main';
      battle.sacNeed = 0;
      battle.sacGot = 0;
      renderBattle();
      return;
    }

    const cost = costOf(c);
    if (cost.type === 'bone' && battle.bones < cost.n) {
      toast('骨头不够（需要 ' + cost.n + '）');
      return;
    }
    if (cost.type === 'blood' && cost.n > 0) {
      battle.phase = 'sacrifice';
      battle.selected = i;
      battle.sacNeed = cost.n;
      battle.sacGot = 0;
      toast('献祭 ' + cost.n + ' 个自己的生物（点场上的牌）');
    } else {
      battle.phase = 'placing';
      battle.selected = i;
      battle.sacNeed = 0;
      battle.sacGot = 0;
      toast('点一个空格放下它');
    }
    renderBattle();
  }

  function doSacrifice(lane) {
    if (battle.phase !== 'sacrifice' || battle.busy) return;
    const c = battle.player[lane];
    if (!c) return;
    battle.sacGot += c.sacValue;
    battle.player[lane] = null;
    battle.bones += 1;
    if (c.sigils.indexOf('draw') >= 0) {
      const d = drawFromDeck();
      if (d && battle.hand.length < HAND_MAX) battle.hand.push(d);
    }
    if (battle.sacGot >= battle.sacNeed) {
      battle.phase = 'placing';
      toast('血已足够，点一个空格召唤');
    } else {
      toast('还差 ' + (battle.sacNeed - battle.sacGot) + ' 个祭品');
    }
    renderBattle();
  }

  function doPlace(lane) {
    if (battle.phase !== 'placing' || battle.busy) return;
    if (battle.player[lane]) {
      toast('这格已经有牌了');
      return;
    }
    const c = battle.hand.splice(battle.selected, 1)[0];
    if (!c) return;
    const cost = costOf(c);
    if (cost.type === 'bone') battle.bones -= cost.n;
    battle.player[lane] = c;
    battle.selected = -1;
    battle.phase = 'main';
    battle.sacNeed = 0;
    battle.sacGot = 0;
    toast(c.name + ' 已上场');
    renderBattle();
  }

  function addScale(n) {
    // 夹在 ±SCALE_MAX：到达 5 就已经赢了，显示成 -8 只会让人困惑
    battle.scale = clamp(battle.scale + n, -SCALE_MAX, SCALE_MAX);
  }

  function hitCard(target, dmg, source) {
    let d = dmg;
    if (target.sigils.indexOf('stone') >= 0) d = Math.max(1, d - 1);
    target.hp -= d;
    target._anim = 'hit';
    if (target.sigils.indexOf('quills') >= 0 && source) {
      let back = 1;
      if (source.sigils.indexOf('stone') >= 0) back = Math.max(1, back - 1);
      source.hp -= back;
      source._anim = 'hit';
    }
    if (source && source.sigils.indexOf('poison') >= 0) target.hp = 0;
  }

  async function attackWith(lane, side) {
    const mine = side === 'player' ? battle.player : battle.enemy;
    const theirs = side === 'player' ? battle.enemy : battle.player;
    const c = mine[lane];
    if (!c || c.hp <= 0) return;

    c._anim = 'attack';
    renderBattle();
    await sleep(180);

    const lanes = c.sigils.indexOf('double') >= 0 ? [lane - 1, lane, lane + 1] : [lane];
    for (const t of lanes) {
      if (t < 0 || t >= LANES) continue;
      if (c.sigils.indexOf('airborne') >= 0) {
        addScale(side === 'player' ? c.atk : -c.atk);
        continue;
      }
      const blocker = theirs[t];
      if (blocker && blocker.hp > 0) {
        hitCard(blocker, c.atk, c);
      } else {
        addScale(side === 'player' ? c.atk : -c.atk);
      }
    }
    if (c.sigils.indexOf('grow') >= 0) c.atk += 1;
  }

  async function killCard(side, lane) {
    const arr = side === 'player' ? battle.player : battle.enemy;
    const c = arr[lane];
    if (!c) return;
    c._dying = true;
    renderBattle();
    await sleep(190);
    arr[lane] = null;
    if (side === 'player') {
      battle.bones += 1;
      if (c.sigils.indexOf('draw') >= 0) {
        const d = drawFromDeck();
        if (d && battle.hand.length < HAND_MAX) battle.hand.push(d);
      }
    }
    renderBattle();
  }

  async function resolveDeaths() {
    for (let i = 0; i < LANES; i++) {
      const p = battle.player[i];
      if (p && p.hp <= 0) await killCard('player', i);
      const e = battle.enemy[i];
      if (e && e.hp <= 0) await killCard('enemy', i);
    }
  }

  function chooseLane() {
    const open = [];
    for (let i = 0; i < LANES; i++) if (!battle.enemy[i]) open.push(i);
    if (!open.length) return -1;
    if (battle.foe.pattern === 'block') {
      // 只把「有攻击力的」玩家生物当成威胁；0 攻击的松鼠不该吸走敌人的挡位
      let best = -1;
      let bestAtk = 0;
      for (const i of open) {
        const p = battle.player[i];
        if (p && p.hp > 0 && p.atk > bestAtk) { bestAtk = p.atk; best = i; }
      }
      if (best >= 0) return best;
    }
    const facingEmpty = open.filter((i) => !battle.player[i] || battle.player[i].hp <= 0);
    const pool = facingEmpty.length ? facingEmpty : open;
    return pool[rand(pool.length)];
  }

  async function endTurn() {
    if (!battle || battle.busy || battle.over) return;
    if (battle.phase !== 'main') return;
    battle.busy = true;
    battle.phase = 'resolving';
    battle.selected = -1;
    battle.sacNeed = 0;
    battle.sacGot = 0;
    renderBattle();
    toast('你的生物发起攻击');
    await sleep(200);

    for (let i = 0; i < LANES; i++) {
      if (battle.player[i] && battle.player[i].hp > 0) {
        await attackWith(i, 'player');
        renderBattle();
        await sleep(120);
      }
    }
    await resolveDeaths();
    if (battle.scale >= SCALE_MAX) return finishBattle(true);
    if (battle.scale <= -SCALE_MAX) return finishBattle(false);

    toast('敌方回合');
    await sleep(220);
    for (let i = 0; i < LANES; i++) {
      if (battle.enemy[i] && battle.enemy[i].hp > 0) {
        await attackWith(i, 'enemy');
        renderBattle();
        await sleep(120);
      }
    }
    await resolveDeaths();
    if (battle.scale >= SCALE_MAX) return finishBattle(true);
    if (battle.scale <= -SCALE_MAX) return finishBattle(false);

    await sleep(180);
    const lane = chooseLane();
    if (lane >= 0 && battle.queue.length) {
      battle.enemy[lane] = battle.queue.shift();
      if (battle.queue.length < 4) refillQueue();
      renderBattle();
      await sleep(320);
    }

    battle.busy = false;
    startTurn();
  }

  function finishBattle(won) {
    battle.busy = false;
    battle.over = true;
    battle.phase = 'over';
    renderBattle();

    if (won) {
      const kind = battle.foe.kind;
      const pool = (kind === 'elite' || kind === 'boss') ? RARE_POOL : COMMON_POOL;
      showOverlay({
        title: '天平倾斜 · 胜利',
        text: '你击败了 <b>' + battle.foe.name + '</b>。<br>从战利品中挑一张牌。',
        items: true,
        buttons: [{ label: '不要战利品', ghost: true, onClick: () => { hideOverlay(); advanceFloor(); } }],
      });
      const opts = [];
      const used = {};
      let guard = 0;
      while (opts.length < 3 && guard++ < 60) {
        const k = pick(pool);
        if (used[k]) continue;
        used[k] = true;
        opts.push(mkCard(k));
      }
      opts.forEach((c) => {
        const b = cardPickEl(c);
        b.addEventListener('click', () => {
          run.deck.push(c);
          hideOverlay();
          advanceFloor();
        });
        picker.appendChild(b);
      });
      return;
    }

    run.candles -= 1;
    renderCandles();          // 地图上的蜡烛要立刻跟上，否则重打时显示的数字是旧的
    saveRun();
    if (run.candles <= 0) return runDefeat();
    showOverlay({
      title: '天平倾覆',
      bad: true,
      text: '你败给了 <b>' + battle.foe.name + '</b>。<br>一根蜡烛熄灭了，还剩 <b>' + run.candles + '</b> 根。<br>这一层要重新打。',
      buttons: [
        { label: '再来一次', onClick: () => { hideOverlay(); enterNode(battle.foe.kind); } },
        { label: '放弃这局', ghost: true, onClick: () => { hideOverlay(); runDefeat(); } },
      ],
    });
  }

  /* ==================== 结算 ==================== */
  function runVictory() {
    const best = Number(readStore(STORE.stage, 0)) || 0;
    if (run.floor > best) writeStore(STORE.stage, run.floor);
    clearRun();
    showScreen('map');
    showOverlay({
      title: '三章已终',
      text: '你走完了全部三章，把 <b>' + BOSSES[BOSSES.length - 1].name + '</b> 也推下了天平。<br>'
        + '抵达层数 <b>' + run.floor + '</b>　最终牌组 <b>' + run.deck.length + '</b> 张',
      buttons: [
        { label: '挑战无限模式', onClick: () => { hideOverlay(); newRun('endless'); } },
        { label: '回到标题', ghost: true, onClick: () => { hideOverlay(); renderTitle(); } },
      ],
    });
    run = null;
    renderTitle();
  }

  function runDefeat() {
    const reached = run ? run.floor : 1;
    if (run && run.mode === 'endless') {
      const best = Number(readStore(STORE.endless, 0)) || 0;
      if (reached > best) writeStore(STORE.endless, reached);
    } else {
      const best = Number(readStore(STORE.stage, 0)) || 0;
      if (reached > best) writeStore(STORE.stage, reached);
    }
    clearRun();
    const mode = run ? run.mode : 'stage';
    const deckLen = run ? run.deck.length : 0;
    showOverlay({
      title: '蜡烛燃尽',
      bad: true,
      text: '最后一根蜡烛熄灭了，林间的牌局到此为止。<br>'
        + '抵达层数 <b>' + reached + '</b>　最终牌组 <b>' + deckLen + '</b> 张',
      buttons: [
        { label: '再来一局', onClick: () => { hideOverlay(); newRun(mode); } },
        { label: '回到标题', ghost: true, onClick: () => { hideOverlay(); renderTitle(); } },
      ],
    });
    run = null;
    renderTitle();
  }

  /* ==================== 战斗渲染 ==================== */
  function renderBattle() {
    if (!battle) return;
    const b = battle;

    el('foeName').textContent = b.foe.emoji + ' ' + b.foe.name;
    el('battleFloor').textContent = '第 ' + run.floor + ' 层';

    // 预排队列
    const q = el('queue');
    q.innerHTML = '';
    for (let i = 0; i < LANES; i++) {
      const c = b.queue[i];
      const s = document.createElement('div');
      s.className = 'queue__slot' + (i === 0 ? ' queue__slot--next' : i < 3 ? ' queue__slot--soon' : '');
      s.textContent = c ? c.emoji : '·';
      if (c) s.title = c.name + '（' + describe(c) + '）';
      q.appendChild(s);
    }

    // 棋盘
    [['enemy', el('enemyRow')], ['player', el('playerRow')]].forEach(([side, row]) => {
      row.innerHTML = '';
      for (let i = 0; i < LANES; i++) {
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.side = side;
        slot.dataset.lane = String(i);
        const c = b[side][i];
        if (c) {
          slot.appendChild(cardEl(c, 'card--board'));
        } else if (side === 'player' && b.phase === 'placing') {
          slot.classList.add('is-target');
        }
        slot.addEventListener('click', () => onSlotClick(side, i));
        row.appendChild(slot);
      }
    });
    // 需要献祭时，把自己场上所有生物标红
    if (b.phase === 'sacrifice') {
      [...el('playerRow').children].forEach((slot) => {
        if (slot.querySelector('.card')) slot.classList.add('is-sacrifice');
      });
    }

    // 天平
    const pct = clamp(b.scale / SCALE_MAX, -1, 1) * 50;
    const fill = el('scaleFill');
    fill.style.left = (pct >= 0 ? 50 : 50 + pct) + '%';
    fill.style.width = Math.abs(pct) + '%';
    fill.classList.toggle('is-bad', b.scale < 0);
    el('scaleMark').style.left = (50 + pct) + '%';
    el('scaleLabel').textContent = '天平 · ' + (b.scale > 0 ? '+' : '') + b.scale + ' / ±' + SCALE_MAX;

    // 资源
    el('bones').textContent = String(b.bones);
    el('deckCount').textContent = String(b.deck.length);
    el('handCount').textContent = String(b.hand.length);

    // 手牌
    const hand = el('hand');
    hand.innerHTML = '';
    if (!b.hand.length) {
      const e = document.createElement('div');
      e.className = 'hand__empty';
      e.textContent = '手上没有牌';
      hand.appendChild(e);
    }
    b.hand.forEach((c, i) => {
      const cost = costOf(c);
      const poor = (cost.type === 'bone' && b.bones < cost.n)
        || (cost.type === 'blood' && countPlayerCreatures() < cost.n);
      const node = cardEl(c, 'card--hand' + (b.selected === i ? ' is-selected' : '') + (poor ? ' is-poor' : ''));
      node.addEventListener('click', () => selectHand(i));
      hand.appendChild(node);
    });

    // 抽牌提示
    el('drawprompt').hidden = b.phase !== 'draw';

    // 结束回合
    const endBtn = el('btnEndTurn');
    endBtn.disabled = b.phase !== 'main' || b.busy;
    endBtn.textContent = b.phase === 'draw' ? '先抽一张牌' : b.phase === 'resolving' ? '结算中…' : '结束回合';
  }

  function countPlayerCreatures() {
    let n = 0;
    for (let i = 0; i < LANES; i++) if (battle.player[i]) n += battle.player[i].sacValue;
    return n;
  }

  function onSlotClick(side, lane) {
    if (battle.busy || battle.over) return;
    if (side === 'player') {
      if (battle.phase === 'sacrifice') return doSacrifice(lane);
      if (battle.phase === 'placing') return doPlace(lane);
    }
    const c = battle[side][lane];
    if (c) {
      const owner = side === 'player' ? '你的' : '敌方的';
      showOverlay({
        title: c.emoji + ' ' + c.name,
        text: owner + '生物<br>' + describe(c) + '<br><br>'
          + (c.sigils.length ? c.sigils.map((s) => SIGILS[s].icon + ' ' + SIGILS[s].name + '：' + SIGILS[s].desc).join('<br>') : '没有印记'),
        buttons: [{ label: '关闭', ghost: true, onClick: hideOverlay }],
      });
    }
  }

  /* ==================== 标题 ==================== */
  function renderTitle() {
    const endless = Number(readStore(STORE.endless, 0)) || 0;
    const stage = Number(readStore(STORE.stage, 0)) || 0;
    el('titleRecord').innerHTML = '无限模式最深 <b>' + endless + '</b> 层　·　关卡模式最远 <b>' + stage + '</b> 层';
    const has = !!readStore(STORE.save, null);
    el('btnContinue').hidden = !has;
    showScreen('title');
  }

  /* ==================== 图鉴 ==================== */
  function showSigilHelp() {
    const list = Object.keys(SIGILS).map((k) => SIGILS[k].icon + ' <b>' + SIGILS[k].name + '</b>：' + SIGILS[k].desc).join('<br>');
    showOverlay({
      title: '印记一览',
      text: list + '<br><br>🩸 <b>血祭</b>：献祭自己场上的生物来支付费用，被献祭的生物会化为 🦴 骨头。<br>'
        + '🦴 <b>骨头</b>：自己的生物死亡时获得 1 根，用来召唤亡灵牌。',
      buttons: [{ label: '知道了', onClick: hideOverlay }],
    });
  }

  function showDeck() {
    const deck = run ? run.deck : (battle ? battle.deck : []);
    showOverlay({
      title: '牌组 · ' + deck.length + ' 张',
      text: deck.length ? '当前构筑（点任意牌关闭）' : '牌组是空的',
      items: true,
      buttons: [{ label: '关闭', ghost: true, onClick: hideOverlay }],
    });
    picker.className = 'picker decklist';
    deck.forEach((c) => {
      const node = cardEl(c, 'card--board');
      node.style.position = 'relative';
      node.style.width = '62px';
      node.style.height = '80px';
      node.style.flex = 'none';
      node.title = describe(c);
      node.addEventListener('click', hideOverlay);
      picker.appendChild(node);
    });
  }

  /* ==================== 事件绑定 ==================== */
  function bind() {
    document.querySelectorAll('.mode').forEach((b) => {
      b.addEventListener('click', () => newRun(b.dataset.mode));
    });
    el('btnContinue').addEventListener('click', () => {
      if (loadRun()) {
        renderMap();
        showScreen('map');
      }
    });
    el('btnDrawDeck').addEventListener('click', () => doDraw(false));
    el('btnDrawSquirrel').addEventListener('click', () => doDraw(true));
    el('btnEndTurn').addEventListener('click', endTurn);
    el('btnDeck').addEventListener('click', showDeck);
    el('btnHome').addEventListener('click', () => { window.location.href = 'https://qiuye-autumnnight.github.io/'; });
    el('btnHome2').addEventListener('click', () => { window.location.href = 'https://qiuye-autumnnight.github.io/'; });

    // 长按标题查看印记说明
    el('btnHelp').addEventListener('click', showSigilHelp);

    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        if (!overlay.hidden) {
          const first = ovActions.querySelector('.btn');
          if (first) { e.preventDefault(); first.click(); }
        } else if (app.dataset.screen === 'battle' && battle && battle.phase === 'main') {
          e.preventDefault();
          endTurn();
        }
      }
      if (e.key === 'd' || e.key === 'D') {
        if (!overlay.hidden) return;
        if (battle && battle.phase === 'draw') { e.preventDefault(); doDraw(false); }
      }
      if (e.key === 's' || e.key === 'S') {
        if (!overlay.hidden) return;
        if (battle && battle.phase === 'draw') { e.preventDefault(); doDraw(true); }
      }
    });
  }

  /* ==================== 启动 ==================== */
  function init() {
    bind();
    renderTitle();

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(() => { /* 可选 */ });
      });
    }
  }

  init();
})();
