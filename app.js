// © 2026 Carol Morris. All rights reserved.
(() => {
  'use strict';

  // ---------- Constants ----------
  const STORE_KEY = 'daily-habits-v1';
  const RESET_HOUR = 4; // the day rolls over at 4 AM
  const COLORS = ['pink', 'peach', 'yellow', 'mint', 'sky', 'lavender', 'coral', 'teal'];
  const WEEK = [
    { d: 1, l: 'M', n: 'Mon' }, { d: 2, l: 'T', n: 'Tue' }, { d: 3, l: 'W', n: 'Wed' },
    { d: 4, l: 'T', n: 'Thu' }, { d: 5, l: 'F', n: 'Fri' }, { d: 6, l: 'S', n: 'Sat' },
    { d: 0, l: 'S', n: 'Sun' },
  ];
  const THEMES = [
    { id: 'pastel', name: '🌸 Pastel', bg: '#fdf6f0', text: '#3d3550', dots: ['#ff8fab', '#ffb26b', '#4fcf8d', '#9b7bff'] },
    { id: 'bold', name: '🌈 Bold', bg: '#fff8e7', text: '#1f1a2e', dots: ['#ff3d7f', '#ffc400', '#1e88ff', '#00b86f'] },
    { id: 'neon', name: '🌙 Neon', bg: '#0d0b1a', text: '#f2efff', dots: ['#ff4fd8', '#4dd9ff', '#3dffa2', '#f9f871'] },
    { id: 'neutral', name: '🖤 Neutral', bg: '#f4f4f4', text: '#111111', dots: ['#111111', '#555555', '#999999', '#d4d4d4'] },
  ];
  const EMOJIS = [
    '✨', '🪥', '🛏️', '📝', '💊', '💪', '☀️', '🐶', '🦮', '🧘‍♀️', '🏋️‍♀️', '🏃‍♀️',
    '🚶‍♀️', '💧', '🥗', '🍎', '🥤', '☕', '📚', '📖', '🧠', '🎧', '🎨', '🎸',
    '🧹', '🧺', '🍽️', '🛒', '📦', '📞', '💻', '📧', '💸', '🗓️', '🌱', '🪴',
    '🚿', '🧴', '💅', '😴', '🌙', '🙏', '❤️', '🫶', '⭐', '🎯', '🔥', '🌈',
  ];
  const CHEERS = ['✨', '🎉', '⭐', '💖', '🌟', '🥳', '💫'];
  const CLEARED_LINES = [
    'Every single thing. You legend.',
    'Look at that empty list. That was all you.',
    'Brain: fed. Habits: done. Go enjoy your day.',
    'Nothing left. Time to do absolutely nothing, guilt-free.',
    'Another day of showing up for yourself.',
  ];

  // ---------- Date helpers (all keys are local YYYY-MM-DD, shifted by the reset hour) ----------
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const dayKeyNow = () => fmt(new Date(Date.now() - RESET_HOUR * 3600 * 1000));
  const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return fmt(d); };
  const weekdayOf = (k) => parseKey(k).getDay();

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (id) => document.getElementById(id);

  // ---------- State ----------
  let today = dayKeyNow();
  let state; // loaded once the checking helpers below are defined
  let doneOpen = false;

  function seed() {
    const mk = (name, emoji, color, extra = {}) => ({
      id: uid(), name, emoji, color, repeat: 'daily', days: [], target: 1, time: '', created: today, ...extra,
    });
    return {
      version: 1,
      theme: 'pastel',
      items: [
        mk('Make bed', '🛏️', 'lavender'),
        mk('Brush teeth', '🪥', 'sky', { target: 2 }),
        mk('Morning Pages', '📝', 'peach'),
        mk('Take creatine', '💪', 'coral'),
        mk('Vitamin D', '💊', 'yellow'),
        mk('Give Herb his vitamins', '🐶', 'mint'),
        mk('Morning Herb walk', '🦮', 'teal', { time: '08:15' }),
        mk('10 min morning sun', '☀️', 'yellow'),
        mk('10 min Pilates', '🧘‍♀️', 'pink'),
        mk('Gym workout', '🏋️‍♀️', 'lavender', { repeat: 'days', days: [1, 3, 0] }),
      ],
      log: {},
      snap: {},
    };
  }

  // Checks saved data and backup files field by field and rebuilds a clean copy.
  // Anything unexpected is dropped or reset, so a broken or tampered file can't
  // inject content or freeze the app. Returns null if the data isn't usable at all.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
  const ID_RE = /^[a-z0-9]{1,40}$/i;
  const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
  const clampInt = (n, lo, hi) => (Number.isInteger(n) && n >= lo && n <= hi ? n : null);

  function cleanItem(i) {
    if (!isObj(i) || typeof i.id !== 'string' || !ID_RE.test(i.id)) return null;
    if (typeof i.name !== 'string' || !i.name.trim()) return null;
    const repeat = ['daily', 'days', 'once'].includes(i.repeat) ? i.repeat : 'daily';
    const days = Array.isArray(i.days) ? [...new Set(i.days.filter((d) => clampInt(d, 0, 6) !== null))] : [];
    const item = {
      id: i.id,
      name: i.name.trim().slice(0, 60),
      emoji: typeof i.emoji === 'string' && i.emoji.length <= 16 && i.emoji.trim() ? i.emoji : '✨',
      color: COLORS.includes(i.color) ? i.color : 'pink',
      repeat: repeat === 'days' && !days.length ? 'daily' : repeat,
      days: repeat === 'days' ? days : [],
      target: repeat === 'once' ? 1 : (clampInt(i.target, 1, 12) || 1),
      time: typeof i.time === 'string' && TIME_RE.test(i.time) ? i.time : '',
      created: typeof i.created === 'string' && DATE_RE.test(i.created) ? i.created : today,
    };
    if (repeat === 'once') item.doneOn = typeof i.doneOn === 'string' && DATE_RE.test(i.doneOn) ? i.doneOn : null;
    return item;
  }

  function cleanDayMap(m) {
    const out = {};
    if (!isObj(m)) return out;
    Object.keys(m).slice(0, 5000).forEach((k) => {
      if (!DATE_RE.test(k) || !isObj(m[k])) return;
      const day = {};
      Object.keys(m[k]).slice(0, 300).forEach((id) => {
        const n = clampInt(m[k][id], 0, 12);
        if (ID_RE.test(id) && n !== null) day[id] = n;
      });
      out[k] = day;
    });
    return out;
  }

  function sanitizeState(s) {
    if (!isObj(s) || !Array.isArray(s.items)) return null;
    const seen = new Set();
    const items = [];
    s.items.slice(0, 300).forEach((raw) => {
      const it = cleanItem(raw);
      if (it && !seen.has(it.id)) { seen.add(it.id); items.push(it); }
    });
    return {
      version: 1,
      theme: THEMES.some((t) => t.id === s.theme) ? s.theme : 'pastel',
      items,
      log: cleanDayMap(s.log),
      snap: cleanDayMap(s.snap),
    };
  }

  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = sanitizeState(JSON.parse(raw));
        if (s) return s;
      }
    } catch (e) { /* fall through to seed */ }
    // Never silently lose data: keep an unreadable copy aside before starting fresh.
    if (raw) { try { localStorage.setItem(STORE_KEY + '-unreadable', raw); } catch (e) { /* ignore */ } }
    const s = seed();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return s;
  }

  state = load();

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) { showToast('⚠️ Could not save. Is storage full?'); }
  }

  const find = (id) => state.items.find((i) => i.id === id);
  const countOn = (item, key) => (state.log[key] && state.log[key][item.id]) || 0;
  const count = (item) => countOn(item, today);

  function setCount(item, n) {
    if (!state.log[today]) state.log[today] = {};
    if (n <= 0) delete state.log[today][item.id];
    else state.log[today][item.id] = n;
    if (item.repeat === 'once') item.doneOn = n >= item.target ? today : null;
  }

  function isDue(item, key) {
    if (item.repeat === 'days') return (item.days || []).includes(weekdayOf(key));
    return true; // daily habits, and one-off tasks that stay until they're done
  }

  // One-off tasks finished on an earlier day are cleared away at the 4 AM reset.
  // Unfinished ones carry over until you do them.
  function cleanup() {
    state.items = state.items.filter((i) => !(i.repeat === 'once' && i.doneOn && i.doneOn !== today));
  }

  function streak(item) {
    if (item.repeat === 'once') return 0;
    let s = 0;
    let key = today;
    if (isDue(item, key) && countOn(item, key) >= item.target) s++;
    key = addDays(key, -1);
    for (let i = 0; i < 1000 && key >= (item.created || key); i++) {
      if (isDue(item, key)) {
        if (countOn(item, key) >= item.target) s++;
        else break;
      }
      key = addDays(key, -1);
    }
    return s;
  }

  // ---------- Rendering ----------
  const listEl = $('list');

  function fmtTime(t) {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}${m ? ':' + pad(m) : ''} ${h < 12 ? 'AM' : 'PM'}`;
  }

  function daysLabel(days) {
    return WEEK.filter((w) => days.includes(w.d)).map((w) => w.n).join(' · ');
  }

  function cardHTML(item) {
    const c = count(item);
    const done = c >= item.target;
    const multi = item.target > 1;
    const meta = [];
    if (item.time) meta.push(`<span class="pill">⏰ ${fmtTime(item.time)}</span>`);
    if (multi) {
      meta.push(`<span class="dots">${Array.from({ length: item.target }, (_, i) => `<span class="dot${i < c ? ' on' : ''}"></span>`).join('')}</span>`);
    }
    if (item.repeat === 'days') meta.push(`<span class="pill">📅 ${daysLabel(item.days)}</span>`);
    if (item.repeat === 'once' && item.created && item.created < today && !done) meta.push('<span class="pill">↪️ from before</span>');
    const st = streak(item);
    if (st >= 2) meta.push(`<span class="pill">🔥 ${st}</span>`);

    let check;
    if (done) check = '<div class="check on">✓</div>';
    else if (multi) check = `<div class="check multi" style="--p:${Math.round((c / item.target) * 100)}">${c}/${item.target}</div>`;
    else check = '<div class="check"></div>';

    return `
      <div class="card c-${esc(item.color)}${done ? ' is-done' : ''}" data-id="${esc(item.id)}">
        <div class="card-bg">🗑️ Delete</div>
        <div class="card-body">
          <div class="card-emoji">${esc(item.emoji || '✨')}</div>
          <div class="card-text">
            <div class="card-name">${esc(item.name)}</div>
            ${meta.length ? `<div class="card-meta">${meta.join('')}</div>` : ''}
          </div>
          ${check}
        </div>
      </div>`;
  }

  function dueItems() { return state.items.filter((i) => isDue(i, today)); }

  function render() {
    const due = dueItems();
    const active = due.filter((i) => count(i) < i.target);
    const done = due.filter((i) => count(i) >= i.target);
    const habits = active.filter((i) => i.repeat !== 'once');
    const tasks = active.filter((i) => i.repeat === 'once');

    let html = '';
    if (!state.items.length) {
      html = `<div class="empty"><div class="empty-emoji">🌱</div><h2>A fresh start</h2><p>Tap + to add your first habit or task.</p></div>`;
    } else if (!due.length) {
      html = `<div class="empty"><div class="empty-emoji">🌤️</div><h2>Nothing planned today</h2><p>Enjoy it, or tap + to add something.</p></div>`;
    } else {
      if (!active.length) {
        html += `<div class="empty"><div class="empty-emoji">🏆</div><h2>All done for today!</h2><p>Your list is empty. That's the whole point.</p></div>`;
      }
      if (habits.length) html += `<div class="section-title">Habits</div>` + habits.map(cardHTML).join('');
      if (tasks.length) html += `<div class="section-title">Today only</div>` + tasks.map(cardHTML).join('');
      if (done.length) {
        html += `<button type="button" class="done-toggle${doneOpen ? ' open' : ''}" id="doneToggle" aria-expanded="${doneOpen}">
          <span class="chev">▸</span> Done (${done.length}) ${done.length === due.length ? '🏆' : '🎉'}</button>`;
        if (doneOpen) html += done.map(cardHTML).join('');
      }
    }
    listEl.innerHTML = html;
    renderHeader(due);
    recordSnapshot(due);
  }

  // Records what was on today's list (item id -> times needed), so the history
  // page knows which days each task was due, even after a task is edited or deleted.
  function recordSnapshot(due) {
    const snap = {};
    due.forEach((i) => { snap[i.id] = i.target; });
    if (JSON.stringify(snap) !== JSON.stringify(state.snap[today] || {})) {
      state.snap[today] = snap;
      save();
    }
  }

  // Shows "Wednesday 4 November" when it fits on one line, otherwise "Wed 4 Nov".
  function fitDate(d) {
    const el = $('dateLabel');
    const long = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    const short = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    el.textContent = long;
    const fits = el.scrollWidth <= el.clientWidth + 1;
    el.textContent = fits ? long : short;
    el.setAttribute('aria-label', long);
  }

  function renderHeader(due) {
    const d = parseKey(today);
    fitDate(d);
    const h = new Date().getHours();
    $('greeting').textContent = h < RESET_HOUR ? 'Still today 🌙' : h < 12 ? 'Good morning ☀️' : h < 18 ? 'Good afternoon 🌤️' : 'Good evening 🌙';

    const totalUnits = due.reduce((a, i) => a + i.target, 0);
    const doneUnits = due.reduce((a, i) => a + Math.min(count(i), i.target), 0);
    const doneItems = due.filter((i) => count(i) >= i.target).length;
    const pct = totalUnits ? Math.round((doneUnits / totalUnits) * 100) : 0;
    $('progressFill').style.width = pct + '%';
    $('progressBar').setAttribute('aria-valuenow', String(pct));
    $('progressLabel').textContent = due.length
      ? (doneItems === due.length ? `All ${due.length} done 🏆` : `${doneItems} of ${due.length} done · ${pct}%`)
      : '';
  }

  // ---------- Ticking ----------
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* ignore */ } }

  function tick(id) {
    const item = find(id);
    if (!item) return;
    const before = count(item);
    const prevDoneOn = item.doneOn || null;
    const cardEl = listEl.querySelector(`.card[data-id="${CSS.escape(id)}"]`);

    // Tapping a finished item puts it back on the list from zero
    if (before >= item.target) {
      setCount(item, 0);
      save();
      render();
      showToast(`${item.emoji} ${item.name}: back on the list`, () => {
        setCount(item, before);
        if (item.repeat === 'once') item.doneOn = prevDoneOn;
        save();
        render();
      });
      return;
    }

    const wasAllDone = dueItems().every((i) => count(i) >= i.target);
    const next = before + 1;
    setCount(item, next);
    save();

    const finished = next >= item.target;
    vibrate(finished ? [18, 40, 28] : 14);
    if (cardEl) burst(cardEl.querySelector('.check') || cardEl, item.emoji, finished ? 16 : 7);

    const undo = () => {
      setCount(item, before);
      if (item.repeat === 'once') item.doneOn = prevDoneOn;
      save();
      render();
    };
    showToast(finished ? `${item.emoji} ${item.name} done!` : `${item.emoji} ${item.name} ${next}/${item.target}`, undo);

    const allDoneNow = dueItems().every((i) => count(i) >= i.target);
    if (finished && cardEl) {
      cardEl.classList.add('completing');
      const check = cardEl.querySelector('.check');
      if (check) { check.className = 'check on pop'; check.textContent = '✓'; }
      setTimeout(() => {
        render();
        if (allDoneNow && !wasAllDone) celebrate();
      }, 560);
    } else {
      render();
      const fresh = listEl.querySelector(`.card[data-id="${CSS.escape(id)}"] .check`);
      if (fresh) fresh.classList.add('pop');
      if (allDoneNow && !wasAllDone) celebrate();
    }
  }

  // ---------- Effects ----------
  const fx = $('fx');
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function burst(el, emoji, n) {
    if (reduceMotion()) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'spark';
      s.textContent = i % 3 === 0 ? emoji : CHEERS[Math.floor(Math.random() * CHEERS.length)];
      const ang = Math.random() * Math.PI * 2;
      const dist = 50 + Math.random() * 90;
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist - 30 + 'px');
      s.style.setProperty('--r', (Math.random() * 360 - 180) + 'deg');
      s.style.setProperty('--dur', (0.7 + Math.random() * 0.5) + 's');
      s.style.fontSize = (16 + Math.random() * 14) + 'px';
      fx.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  function rain(n) {
    if (reduceMotion()) return;
    const pool = ['🎉', '✨', '⭐', '💖', '🌈', '🥳', '🌟', '💫', '🎊'];
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'rain';
      s.textContent = pool[Math.floor(Math.random() * pool.length)];
      s.style.left = Math.random() * 100 + 'vw';
      s.style.setProperty('--dx', (Math.random() * 120 - 60) + 'px');
      s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      s.style.setProperty('--dur', (2 + Math.random() * 1.8) + 's');
      s.style.animationDelay = (Math.random() * 0.9) + 's';
      s.style.fontSize = (20 + Math.random() * 18) + 'px';
      fx.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }

  function celebrate() {
    $('celebrateText').textContent = CLEARED_LINES[Math.floor(Math.random() * CLEARED_LINES.length)];
    $('celebrate').classList.add('show');
    vibrate([30, 60, 30, 60, 60]);
    rain(60);
  }
  $('celebrateClose').addEventListener('click', () => $('celebrate').classList.remove('show'));
  $('celebrate').addEventListener('click', (e) => { if (e.target.id === 'celebrate') $('celebrate').classList.remove('show'); });

  // ---------- Toast ----------
  let toastTimer = null;
  let toastUndo = null;
  function showToast(text, undo) {
    $('toastText').textContent = text;
    toastUndo = undo || null;
    $('toastUndo').hidden = !undo;
    $('toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $('toast').classList.remove('show'); toastUndo = null; }, 4000);
  }
  $('toastUndo').addEventListener('click', () => {
    if (toastUndo) toastUndo();
    toastUndo = null;
    $('toast').classList.remove('show');
  });

  // ---------- Delete ----------
  function removeItem(id) {
    const idx = state.items.findIndex((i) => i.id === id);
    if (idx < 0) return;
    const [item] = state.items.splice(idx, 1);
    save();
    render();
    // History in state.log is kept, so undo restores everything.
    showToast(`${item.emoji} ${item.name} deleted`, () => {
      state.items.splice(Math.min(idx, state.items.length), 0, item);
      save();
      render();
    });
  }

  // ---------- Gestures: tap = tick, hold = edit, swipe left = delete ----------
  let g = null;
  const LONG_MS = 520;
  const SWIPE_DELETE = 110;

  listEl.addEventListener('contextmenu', (e) => { if (e.target.closest('.card')) e.preventDefault(); });

  listEl.addEventListener('pointerdown', (e) => {
    const card = e.target.closest('.card');
    if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const id = card.dataset.id;
    g = {
      card, id, x0: e.clientX, y0: e.clientY, dx: 0, mode: null, pid: e.pointerId,
      timer: setTimeout(() => {
        if (g && !g.mode) { g.mode = 'long'; vibrate(20); openEdit(id); }
      }, LONG_MS),
    };
  });

  listEl.addEventListener('pointermove', (e) => {
    if (!g || e.pointerId !== g.pid) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.mode) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        g.mode = 'swipe';
        clearTimeout(g.timer);
        g.card.classList.add('dragging', 'swiping');
        try { g.card.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      } else if (Math.abs(dy) > 10) {
        g.mode = 'scroll';
        clearTimeout(g.timer);
      }
    }
    if (g.mode === 'swipe') {
      g.dx = Math.min(0, dx);
      g.card.querySelector('.card-body').style.transform = `translateX(${g.dx}px)`;
    }
  });

  function endGesture(e, cancelled) {
    if (!g || (e && e.pointerId !== g.pid)) return;
    clearTimeout(g.timer);
    const { card, id, mode, dx } = g;
    g = null;
    const body = card.querySelector('.card-body');
    card.classList.remove('dragging');
    if (mode === 'swipe') {
      if (!cancelled && dx < -SWIPE_DELETE) {
        body.style.transform = 'translateX(-110%)';
        vibrate(25);
        setTimeout(() => removeItem(id), 200);
      } else {
        body.style.transform = '';
        setTimeout(() => card.classList.remove('swiping'), 260);
      }
    } else if (!mode && !cancelled) {
      tick(id);
    }
  }
  listEl.addEventListener('pointerup', (e) => endGesture(e, false));
  listEl.addEventListener('pointercancel', (e) => endGesture(e, true));

  listEl.addEventListener('click', (e) => {
    if (e.target.closest('#doneToggle')) { doneOpen = !doneOpen; render(); }
  });

  // ---------- Overlays (sheets and the history page) ----------
  // Each overlay adds a browser history entry, so the phone's Back button closes it.
  const overlays = [];
  function pushOverlay(hide) {
    overlays.push(hide);
    history.pushState({ overlay: overlays.length }, '');
  }
  function closeOverlay() { if (overlays.length) history.back(); }
  window.addEventListener('popstate', () => {
    const hide = overlays.pop();
    if (hide) hide();
    else if ($('celebrate').classList.contains('show')) $('celebrate').classList.remove('show');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOverlay(); });

  let sheetOpen = false;
  function openSheet(el) {
    if (sheetOpen) return;
    sheetOpen = true;
    el.classList.add('show');
    $('backdrop').classList.add('show');
    pushOverlay(() => {
      el.classList.remove('show');
      $('backdrop').classList.remove('show');
      sheetOpen = false;
      if (document.activeElement) document.activeElement.blur();
    });
  }
  const closeSheet = closeOverlay;
  $('backdrop').addEventListener('click', closeOverlay);

  // ---------- Add / edit ----------
  let draft = null;
  let editingId = null;

  function openEdit(id) {
    const item = id ? find(id) : null;
    editingId = item ? item.id : null;
    draft = item
      ? { ...item, days: [...(item.days || [])] }
      : { name: '', emoji: '✨', color: COLORS[Math.floor(Math.random() * COLORS.length)], repeat: 'daily', days: [], target: 1, time: '' };
    $('editTitle').textContent = item ? 'Edit' : 'New task';
    $('nameInput').value = draft.name;
    $('timeInput').value = draft.time || '';
    $('emojiCustom').value = '';
    $('emojiPanel').hidden = true;
    $('editExtra').hidden = !item;
    syncEdit();
    openSheet($('editSheet'));
    if (!item) setTimeout(() => $('nameInput').focus(), 320);
  }

  function syncEdit() {
    $('emojiBtn').textContent = draft.emoji;
    $('colorSwatches').innerHTML = COLORS.map((c) =>
      `<button type="button" class="swatch c-${c}${draft.color === c ? ' sel' : ''}" data-c="${c}" aria-label="${c}" aria-pressed="${draft.color === c}"></button>`).join('');
    $('repeatSeg').querySelectorAll('button').forEach((b) => {
      const on = b.dataset.v === draft.repeat;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', String(on));
    });
    $('dayChips').hidden = draft.repeat !== 'days';
    $('dayChips').innerHTML = WEEK.map((w) =>
      `<button type="button" class="day-chip${draft.days.includes(w.d) ? ' sel' : ''}" data-d="${w.d}" aria-label="${w.n}" aria-pressed="${draft.days.includes(w.d)}">${w.l}</button>`).join('');
    $('timesField').hidden = draft.repeat === 'once';
    $('timesVal').textContent = draft.target;
  }

  function buildEmojiGrid() {
    $('emojiGrid').innerHTML = EMOJIS.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('');
  }
  buildEmojiGrid();

  $('emojiBtn').addEventListener('click', () => { $('emojiPanel').hidden = !$('emojiPanel').hidden; });
  $('emojiGrid').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-e]');
    if (!b) return;
    draft.emoji = b.dataset.e;
    $('emojiPanel').hidden = true;
    syncEdit();
  });
  $('emojiCustom').addEventListener('input', () => {
    const v = $('emojiCustom').value.trim();
    if (!v) return;
    let first = v;
    if (window.Intl && Intl.Segmenter) {
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)[Symbol.iterator]().next();
      if (!seg.done) first = seg.value.segment;
    } else {
      first = Array.from(v)[0];
    }
    draft.emoji = first;
    syncEdit();
  });
  $('colorSwatches').addEventListener('click', (e) => {
    const b = e.target.closest('[data-c]');
    if (b) { draft.color = b.dataset.c; syncEdit(); }
  });
  $('repeatSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    draft.repeat = b.dataset.v;
    if (draft.repeat === 'days' && !draft.days.length) draft.days = [weekdayOf(today)];
    syncEdit();
  });
  $('dayChips').addEventListener('click', (e) => {
    const b = e.target.closest('[data-d]');
    if (!b) return;
    const d = Number(b.dataset.d);
    draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
    syncEdit();
  });
  $('timesMinus').addEventListener('click', () => { draft.target = Math.max(1, draft.target - 1); syncEdit(); });
  $('timesPlus').addEventListener('click', () => { draft.target = Math.min(12, draft.target + 1); syncEdit(); });
  $('timeClear').addEventListener('click', () => { $('timeInput').value = ''; });
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveEdit(); } });

  function saveEdit() {
    const name = $('nameInput').value.trim();
    if (!name) {
      const inp = $('nameInput');
      inp.classList.remove('shake');
      void inp.offsetWidth;
      inp.classList.add('shake');
      inp.focus();
      return;
    }
    if (draft.repeat === 'days' && !draft.days.length) {
      showToast('Pick at least one day 📅');
      return;
    }
    if (draft.repeat === 'days' && draft.days.length === 7) { draft.repeat = 'daily'; draft.days = []; }
    if (draft.repeat !== 'days') draft.days = [];
    if (draft.repeat === 'once') draft.target = 1;

    const fields = {
      name, emoji: draft.emoji, color: draft.color, repeat: draft.repeat,
      days: draft.days, target: draft.target, time: $('timeInput').value || '',
    };

    if (editingId) {
      const item = find(editingId);
      if (item) {
        const wasOnce = item.repeat === 'once';
        Object.assign(item, fields);
        if (item.repeat === 'once' && !wasOnce) { item.created = today; item.doneOn = count(item) >= 1 ? today : null; }
        if (item.repeat !== 'once') delete item.doneOn;
        // Clamp today's count if the target was lowered
        if (count(item) > item.target) setCount(item, item.target);
      }
      showToast(`${fields.emoji} Saved`);
    } else {
      state.items.push({ id: uid(), created: today, doneOn: null, ...fields });
      showToast(`${fields.emoji} ${name} added`);
    }
    save();
    closeSheet();
    render();
  }
  $('saveBtn').addEventListener('click', saveEdit);

  function move(delta) {
    const idx = state.items.findIndex((i) => i.id === editingId);
    const to = idx + delta;
    if (idx < 0 || to < 0 || to >= state.items.length) return;
    const [it] = state.items.splice(idx, 1);
    state.items.splice(to, 0, it);
    save();
    render();
    showToast(delta < 0 ? '⬆️ Moved up' : '⬇️ Moved down');
  }
  $('moveUpBtn').addEventListener('click', () => move(-1));
  $('moveDownBtn').addEventListener('click', () => move(1));
  $('deleteBtn').addEventListener('click', () => {
    const id = editingId;
    closeSheet();
    removeItem(id);
  });

  $('addBtn').addEventListener('click', () => openEdit(null));

  // ---------- Settings: theme and backup ----------
  function applyTheme() {
    const t = THEMES.find((x) => x.id === state.theme) || THEMES[0];
    document.documentElement.dataset.theme = t.id;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.bg);
  }

  function renderThemes() {
    $('themeGrid').innerHTML = THEMES.map((t) => `
      <button type="button" class="theme-opt${state.theme === t.id ? ' sel' : ''}" data-t="${t.id}"
        style="--tbg:${t.bg};--ttext:${t.text}" aria-pressed="${state.theme === t.id}">
        <div class="theme-name">${t.name}</div>
        <div class="theme-dots">${t.dots.map((d) => `<span style="background:${d}"></span>`).join('')}</div>
      </button>`).join('');
  }
  $('themeGrid').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (!b) return;
    state.theme = b.dataset.t;
    save();
    applyTheme();
    renderThemes();
  });
  $('settingsBtn').addEventListener('click', () => { renderThemes(); openSheet($('settingsSheet')); });

  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-habits-backup-${today}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showToast('💾 Backup saved to Downloads');
  });
  $('importBtn').addEventListener('click', () => $('importFile').click());
  $('importFile').addEventListener('change', async () => {
    const file = $('importFile').files[0];
    $('importFile').value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('⚠️ That file is too big to be a backup'); return; }
    try {
      const s = sanitizeState(JSON.parse(await file.text()));
      if (!s) throw new Error('bad file');
      if (!confirm(`Replace everything on this phone with this backup (${s.items.length} tasks)?`)) return;
      state = s;
      cleanup();
      save();
      applyTheme();
      renderThemes();
      render();
      showToast('📂 Backup restored');
    } catch (e) {
      showToast('⚠️ That file is not a backup from this app');
    }
  });

  // ---------- History page ----------
  let histRange = 30;
  let histSel = 'all'; // 'all' or an item id
  let histOpen = false;

  const shortDate = (k) => parseKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const longDate = (k) => parseKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const habitsOnly = () => state.items.filter((i) => i.repeat !== 'once');

  // Value for one day, from 0 to 1, or a reason there's no value
  function dayPoint(key, sel) {
    const snap = state.snap[key];
    const log = state.log[key] || {};
    if (!snap) return { key, v: null, why: 'none' };
    if (sel === 'all') {
      const ids = Object.keys(snap);
      if (!ids.length) return { key, v: null, why: 'empty' };
      const done = ids.filter((id) => (log[id] || 0) >= snap[id]).length;
      return { key, v: done / ids.length, done, total: ids.length };
    }
    if (!(sel in snap)) return { key, v: null, why: 'rest' };
    const target = snap[sel];
    const c = Math.min(log[sel] || 0, target);
    return { key, v: c / target, done: c, total: target };
  }

  function rangeKeys(n) {
    const keys = [];
    for (let i = n - 1; i >= 0; i--) keys.push(addDays(today, -i));
    return keys;
  }

  function bestStreak(id) {
    const keys = Object.keys(state.snap).sort();
    let run = 0;
    let best = 0;
    keys.forEach((k) => {
      const p = dayPoint(k, id);
      if (p.v === null) return; // not due that day, so the streak carries on
      if (p.v >= 1) { run++; best = Math.max(best, run); }
      else if (k !== today) run = 0;
    });
    return best;
  }

  function openHistory() {
    histOpen = true;
    $('historyPage').classList.add('show');
    document.body.classList.add('no-scroll');
    renderHistory();
    pushOverlay(() => {
      histOpen = false;
      $('historyPage').classList.remove('show');
      document.body.classList.remove('no-scroll');
    });
  }
  $('historyBtn').addEventListener('click', openHistory);
  $('historyBack').addEventListener('click', closeOverlay);

  function renderHistory() {
    if (!histOpen) return;
    if (histSel !== 'all' && !find(histSel)) histSel = 'all';
    const habits = habitsOnly();

    $('rangeSeg').querySelectorAll('button').forEach((b) => {
      const on = Number(b.dataset.r) === histRange;
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', String(on));
    });

    $('habitChips').innerHTML = [`<button type="button" class="chip${histSel === 'all' ? ' sel' : ''}" data-h="all">⭐ Everything</button>`]
      .concat(habits.map((h) => `<button type="button" class="chip${histSel === h.id ? ' sel' : ''}" data-h="${esc(h.id)}">${esc(h.emoji)} ${esc(h.name)}</button>`))
      .join('');

    const keys = rangeKeys(histRange);
    const points = keys.map((k) => dayPoint(k, histSel));
    const valued = points.filter((p) => p.v !== null);
    const avg = valued.length ? Math.round((valued.reduce((a, p) => a + p.v, 0) / valued.length) * 100) : null;

    let tiles;
    if (histSel === 'all') {
      const perfect = valued.filter((p) => p.v >= 1).length;
      tiles = [
        ['Average day', avg === null ? '–' : avg + '%'],
        ['Perfect days', String(perfect)],
        ['Days tracked', String(valued.length)],
      ];
      $('chartTitle').textContent = 'Share of your list done each day';
    } else {
      const item = find(histSel);
      const fullDays = valued.filter((p) => p.v >= 1).length;
      tiles = [
        ['Done', `${fullDays} of ${valued.length} days`],
        ['Streak now', `🔥 ${streak(item)}`],
        ['Best streak', `🏆 ${bestStreak(item.id)}`],
      ];
      $('chartTitle').textContent = item.target > 1
        ? `${item.emoji} ${item.name}: share of ${item.target} times done each day`
        : `${item.emoji} ${item.name}: done each day`;
    }
    $('historyStats').innerHTML = tiles.map(([l, v]) => `<div class="stat"><div class="stat-label">${l}</div><div class="stat-value">${v}</div></div>`).join('');

    drawChart(points);

    // Per-habit rows: completion rate over the selected range
    $('habitRows').innerHTML = habits.length ? habits.map((h) => {
      const ps = keys.map((k) => dayPoint(k, h.id)).filter((p) => p.v !== null);
      const rate = ps.length ? Math.round((ps.filter((p) => p.v >= 1).length / ps.length) * 100) : null;
      const st = streak(h);
      return `
        <button type="button" class="hrow c-${esc(h.color)}${histSel === h.id ? ' sel' : ''}" data-h="${esc(h.id)}">
          <span class="hrow-emoji">${esc(h.emoji)}</span>
          <span class="hrow-main">
            <span class="hrow-name">${esc(h.name)}</span>
            <span class="hrow-bar"><span style="width:${rate || 0}%"></span></span>
          </span>
          <span class="hrow-stats">
            <span class="hrow-rate">${rate === null ? '–' : rate + '%'}</span>
            ${st >= 1 ? `<span class="hrow-streak">🔥 ${st}</span>` : ''}
          </span>
        </button>`;
    }).join('') : '<p class="hint">Add a daily habit to see its history here.</p>';
  }

  function drawChart(points) {
    const wrap = $('chartWrap');
    const W = Math.max(280, wrap.clientWidth || 320);
    const H = 210;
    const padL = 40, padR = 6, padT = 12, padB = 28;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const base = padT + plotH;
    const n = points.length;
    const slot = plotW / n;
    const gap = slot > 6 ? 2 : 1;
    const bw = Math.max(1, Math.min(24, slot - gap));
    const y = (v) => base - v * plotH;
    const any = points.some((p) => p.v !== null);

    let svg = '';
    [0, 0.5, 1].forEach((t) => {
      svg += `<line x1="${padL}" x2="${W - padR}" y1="${y(t)}" y2="${y(t)}" class="grid"/>`;
      svg += `<text x="${padL - 8}" y="${y(t) + 4}" text-anchor="end" class="axis">${t * 100}%</text>`;
    });

    points.forEach((p, i) => {
      const x = padL + i * slot + (slot - bw) / 2;
      if (p.v === null) {
        if (p.why === 'rest') svg += `<circle cx="${x + bw / 2}" cy="${base - 4}" r="${Math.min(2.5, bw / 2)}" class="rest"/>`;
        return;
      }
      const h = Math.max(p.v > 0 ? 3 : 0, p.v * plotH);
      if (h <= 0) { svg += `<rect x="${x}" y="${base - 3}" width="${bw}" height="3" rx="1" class="zero"/>`; return; }
      const top = base - h;
      const r = Math.min(4, bw / 2, h);
      svg += `<path class="bar${p.v >= 1 ? ' full' : ''}" data-i="${i}" d="M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z"/>`;
    });

    // x labels: first, middle, today
    const lab = (i, txt, anchor) => `<text x="${padL + i * slot + slot / 2}" y="${H - 8}" text-anchor="${anchor}" class="axis">${txt}</text>`;
    svg += lab(0, shortDate(points[0].key), 'start');
    if (n > 10) svg += lab(Math.floor((n - 1) / 2), shortDate(points[Math.floor((n - 1) / 2)].key), 'middle');
    svg += lab(n - 1, 'Today', 'end');

    // Hit targets: the whole column, bigger than the bar
    points.forEach((p, i) => {
      svg += `<rect class="hit" data-i="${i}" x="${padL + i * slot}" y="${padT}" width="${slot}" height="${plotH}"/>`;
    });

    const valued = points.filter((p) => p.v !== null);
    const summary = valued.length
      ? `Bar chart of ${valued.length} tracked days. Latest: ${Math.round(valued[valued.length - 1].v * 100)}%.`
      : 'No history yet.';
    wrap.innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${summary}">${svg}</svg>` +
      (any ? '' : '<div class="chart-empty">Your history starts today 🌱<br>Come back in a few days to see it grow.</div>');
    wrap._points = points;
    $('chartTip').classList.remove('show');
  }

  function showTip(i) {
    const wrap = $('chartWrap');
    const points = wrap._points;
    if (!points || !points[i]) return;
    const p = points[i];
    let text;
    if (p.v === null) text = p.why === 'rest' ? 'Rest day: not scheduled' : 'No data';
    else if (histSel === 'all') text = `${p.done} of ${p.total} done · ${Math.round(p.v * 100)}%`;
    else if (p.total > 1) text = `${p.done} of ${p.total} times`;
    else text = p.v >= 1 ? 'Done ✓' : 'Not done';
    const tip = $('chartTip');
    tip.innerHTML = `<strong>${longDate(p.key)}${p.key === today ? ' (today)' : ''}</strong><br>${text}`;
    const hit = wrap.querySelector(`.hit[data-i="${i}"]`);
    const card = tip.parentElement.getBoundingClientRect();
    const hr = hit.getBoundingClientRect();
    tip.classList.add('show');
    const tw = tip.offsetWidth;
    let left = hr.left - card.left + hr.width / 2 - tw / 2;
    left = Math.max(8, Math.min(card.width - tw - 8, left));
    tip.style.left = left + 'px';
    wrap.querySelectorAll('.bar').forEach((b) => b.classList.toggle('dim', b.dataset.i !== String(i)));
  }
  function hideTip() {
    $('chartTip').classList.remove('show');
    $('chartWrap').querySelectorAll('.bar.dim').forEach((b) => b.classList.remove('dim'));
  }

  $('chartWrap').addEventListener('pointerdown', (e) => {
    const hit = e.target.closest('.hit');
    if (hit) showTip(Number(hit.dataset.i));
  });
  $('chartWrap').addEventListener('pointermove', (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const hit = el && el.closest && el.closest('.hit');
    if (hit) showTip(Number(hit.dataset.i));
  });
  $('chartWrap').addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideTip(); });

  $('rangeSeg').addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]');
    if (b) { histRange = Number(b.dataset.r); renderHistory(); }
  });
  const pickHabit = (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    histSel = b.dataset.h === histSel && b.dataset.h !== 'all' ? 'all' : b.dataset.h;
    renderHistory();
    if (b.closest('#habitRows')) $('historyPage').scrollTo({ top: 0, behavior: 'smooth' });
  };
  $('habitChips').addEventListener('click', pickHabit);
  $('habitRows').addEventListener('click', pickHabit);
  window.addEventListener('resize', () => {
    fitDate(parseKey(today));
    if (histOpen) renderHistory();
  });
  // Re-check once the font has loaded, because it changes the text width
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitDate(parseKey(today)));

  // ---------- Day rollover ----------
  function checkDay() {
    const k = dayKeyNow();
    if (k !== today) {
      today = k;
      doneOpen = false;
      cleanup();
      save();
      render();
    } else {
      renderHeader(dueItems()); // keeps the greeting fresh without disturbing the list
    }
  }
  setInterval(checkDay, 30 * 1000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });

  // ---------- Start ----------
  cleanup();
  save();
  applyTheme();
  render();

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
