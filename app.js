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
    { id: 'neutral', name: '🤍 Neutral', bg: '#f6f4f1', text: '#2b2926', dots: ['#c08a7e', '#b9a25a', '#7fa077', '#7895ad'] },
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
  let state = load();
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
    };
  }

  function isValidState(s) {
    return s && typeof s === 'object' && Array.isArray(s.items) && s.log && typeof s.log === 'object';
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (isValidState(s)) return s;
      }
    } catch (e) { /* fall through to seed */ }
    const s = seed();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
    return s;
  }

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
  }

  function renderHeader(due) {
    const d = parseKey(today);
    $('dateLabel').textContent = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
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

    // Tapping a finished item un-ticks one step
    if (before >= item.target) {
      setCount(item, before - 1);
      save();
      render();
      showToast(`${item.emoji} ${item.name}: back on the list`);
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

  // ---------- Sheets ----------
  let openSheetEl = null;
  function openSheet(el) {
    if (openSheetEl) hideSheet();
    openSheetEl = el;
    el.classList.add('show');
    $('backdrop').classList.add('show');
    history.pushState({ sheet: true }, '');
  }
  function hideSheet() {
    if (!openSheetEl) return;
    openSheetEl.classList.remove('show');
    $('backdrop').classList.remove('show');
    openSheetEl = null;
    if (document.activeElement) document.activeElement.blur();
  }
  function closeSheet() {
    if (!openSheetEl) return;
    hideSheet();
    if (history.state && history.state.sheet) history.back();
  }
  window.addEventListener('popstate', () => {
    if (openSheetEl) hideSheet();
    else if ($('celebrate').classList.contains('show')) $('celebrate').classList.remove('show');
  });
  $('backdrop').addEventListener('click', closeSheet);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });

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
    try {
      const s = JSON.parse(await file.text());
      if (!isValidState(s)) throw new Error('bad file');
      if (!confirm('Replace everything on this phone with this backup?')) return;
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
