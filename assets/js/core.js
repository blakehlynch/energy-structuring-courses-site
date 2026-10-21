/* Energy Structuring Courses — shared runtime (vanilla JS, works from file://) */
(function () {
  'use strict';
  var KEY = 'esc.progress.v1';
  var THEME_KEY = 'esc.theme';

  // ---------- storage (always wrapped: private windows and file:// can throw) ----------
  function readStore() {
    try {
      var raw = window.localStorage.getItem(KEY);
      var s = raw ? JSON.parse(raw) : {};
      s.done = s.done || {}; s.quiz = s.quiz || {}; s.cards = s.cards || {};
      return s;
    } catch (e) { return { done: {}, quiz: {}, cards: {} }; }
  }
  function writeStore(s) {
    try { window.localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch (e) { return false; }
  }
  function update(fn) { var s = readStore(); fn(s); writeStore(s); return s; }

  // ---------- theme ----------
  function applyTheme(t) {
    var root = document.documentElement;
    if (t === 'light' || t === 'dark') root.setAttribute('data-theme', t); else root.removeAttribute('data-theme');
    var btn = document.getElementById('theme-btn');
    if (btn) btn.textContent = t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'Auto';
    themeListeners.forEach(function (f) { try { f(); } catch (e) { } });
  }
  var themeListeners = [];
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch (e) { return 'auto'; } }
  function cycleTheme() {
    var order = ['auto', 'light', 'dark'];
    var next = order[(order.indexOf(getTheme()) + 1) % 3];
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { }
    applyTheme(next);
  }
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onMq = function () { if (getTheme() === 'auto') applyTheme('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
  }
  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // ---------- helpers ----------
  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    });
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function renderMath(root) {
    if (window.renderMathInElement) {
      window.renderMathInElement(root || document.body, {
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
  }
  function shuffle(a, rnd) { rnd = rnd || Math.random; for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmt(x, d) { if (x === null || x === undefined || isNaN(x)) return '–'; return Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }); }

  // ---------- page wiring ----------
  function initPage() {
    applyTheme(getTheme());
    var tb = document.getElementById('theme-btn'); if (tb) tb.addEventListener('click', cycleTheme);
    var mb = document.getElementById('menu-btn'); if (mb) mb.addEventListener('click', function () { document.body.classList.toggle('nav-open'); });
    var page = window.PAGE || {};
    var s = readStore();
    // sidebar completion ticks
    document.querySelectorAll('[data-done-key]').forEach(function (n) {
      if (s.done[n.getAttribute('data-done-key')]) n.textContent = '✓';
    });
    // mark complete button
    var cb = document.getElementById('complete-btn');
    if (cb && page.key) {
      var paint = function () {
        var done = !!readStore().done[page.key];
        cb.textContent = done ? '✓ Completed' : 'Mark module complete';
        cb.classList.toggle('done', done);
      };
      cb.addEventListener('click', function () {
        update(function (st) { if (st.done[page.key]) delete st.done[page.key]; else st.done[page.key] = Date.now(); });
        paint();
        var tick = document.querySelector('[data-done-key="' + page.key + '"]');
        if (tick) tick.textContent = readStore().done[page.key] ? '✓' : '';
      });
      paint();
    }
    if (page.key && page.title) update(function (st) { st.last = { key: page.key, title: page.title, href: page.href, ts: Date.now() }; });
    renderMath();
  }

  // ---------- quiz engine ----------
  // data: {questions:[{type:'mc'|'num', desk?:bool, q, options?, answer, tol?, unit?, explain, cite?}]}
  function quiz(root, data, key) {
    if (!root || !data) return;
    var qs = data.questions;
    var state = qs.map(function () { return { answered: false, correct: false }; });
    root.innerHTML = '';
    qs.forEach(function (q, i) {
      var box = el('div', { class: 'q', id: 'q' + (i + 1) });
      var head = el('div', { class: 'qhead' }, 'Question ' + (i + 1) + ' of ' + qs.length + (q.desk ? ' <span class="desk">Desk scenario</span>' : '') + (q.type === 'num' ? ' · numeric' : ''));
      box.appendChild(head);
      box.appendChild(el('div', { class: 'prompt' }, q.q));
      var fb = el('div', { class: 'feedback', hidden: '' });
      if (q.type === 'num') {
        var row = el('div', { class: 'num-row' });
        var inp = el('input', { type: 'number', step: 'any', class: 'num-in', 'aria-label': 'Answer for question ' + (i + 1) });
        var chk = el('button', { class: 'btn ghost', type: 'button' }, 'Check');
        row.appendChild(inp); if (q.unit) row.appendChild(el('span', { class: 'note-small' }, q.unit)); row.appendChild(chk);
        box.appendChild(row);
        chk.addEventListener('click', function () {
          var v = parseFloat(inp.value);
          if (isNaN(v)) { inp.focus(); return; }
          var tol = q.tol !== undefined ? q.tol : Math.max(0.01, Math.abs(q.answer) * 0.01);
          var ok = Math.abs(v - q.answer) <= tol;
          mark(i, ok, fb, (ok ? '' : 'Expected about ' + fmt(q.answer, q.dp !== undefined ? q.dp : 2) + (q.unit ? ' ' + q.unit : '') + '. ') + q.explain, q.cite);
          inp.disabled = true; chk.disabled = true;
        });
      } else {
        var name = 'quiz-' + key + '-' + i;
        var order = q.options.map(function (_, k) { return k; });
        if (!q.fixedOrder) shuffle(order);
        order.forEach(function (k) {
          var lab = el('label', { class: 'opt' });
          var r = el('input', { type: 'radio', name: name, value: String(k) });
          lab.appendChild(r); lab.appendChild(el('span', null, q.options[k]));
          box.appendChild(lab);
          r.addEventListener('change', function () {
            if (state[i].answered) return;
            var ok = k === q.answer;
            lab.classList.add(ok ? 'correct' : 'wrong');
            if (!ok) box.querySelectorAll('input').forEach(function (x) { if (+x.value === q.answer) x.parentNode.classList.add('correct'); });
            box.querySelectorAll('input').forEach(function (x) { x.disabled = true; });
            mark(i, ok, fb, q.explain, q.cite);
          });
        });
      }
      box.appendChild(fb);
      root.appendChild(box);
    });
    var bar = el('div', { class: 'scorebar' });
    var score = el('span', { 'aria-live': 'polite' });
    var best = el('span', { class: 'note-small' });
    var reset = el('button', { class: 'btn ghost', type: 'button' }, 'Reset quiz');
    reset.addEventListener('click', function () { quiz(root, data, key); renderMath(root); });
    bar.appendChild(score); bar.appendChild(best); bar.appendChild(reset);
    root.appendChild(bar);
    function paintScore() {
      var n = state.filter(function (x) { return x.answered; }).length;
      var c = state.filter(function (x) { return x.correct; }).length;
      score.innerHTML = '<strong>' + c + ' / ' + qs.length + '</strong> correct · ' + n + ' answered';
      var rec = readStore().quiz[key];
      best.textContent = rec ? 'Best ' + rec.best + '/' + qs.length + ' · last ' + rec.last + '/' + qs.length + ' · attempts ' + rec.attempts : 'No completed attempts yet';
    }
    function mark(i, ok, fb, explain, cite) {
      state[i].answered = true; state[i].correct = ok;
      fb.hidden = false;
      fb.innerHTML = '<span class="verdict ' + (ok ? 'ok">Correct.' : 'no">Not quite.') + '</span> ' + explain + (cite ? ' <span class="note-small">(' + cite + ')</span>' : '');
      renderMath(fb);
      if (state.every(function (x) { return x.answered; })) {
        var c = state.filter(function (x) { return x.correct; }).length;
        update(function (st) {
          var r = st.quiz[key] || { best: 0, attempts: 0 };
          r.last = c; r.best = Math.max(r.best || 0, c); r.attempts = (r.attempts || 0) + 1; r.total = qs.length; r.ts = Date.now();
          st.quiz[key] = r;
        });
      }
      paintScore();
    }
    paintScore();
  }

  // ---------- flashcards ----------
  // cards: [{term, def, cite}]
  function cards(root, deck, key) {
    if (!root || !deck || !deck.length) return;
    var known = (readStore().cards[key] || {});
    var order = shuffle(deck.map(function (_, i) { return i; }));
    var pos = 0, onlyUnknown = false;
    root.innerHTML = '';
    var count = el('div', { class: 'card-count', 'aria-live': 'polite' });
    var stage = el('div', { class: 'card-stage' });
    var card = el('div', { class: 'card', tabindex: '0', role: 'button', 'aria-label': 'Flashcard: press to flip' });
    var front = el('div', { class: 'face front' });
    var back = el('div', { class: 'face back' });
    card.appendChild(front); card.appendChild(back); stage.appendChild(card);
    var ctl = el('div', { class: 'card-ctl' });
    var bPrev = el('button', { class: 'btn ghost', type: 'button' }, '← Prev');
    var bFlip = el('button', { class: 'btn ghost', type: 'button' }, 'Flip');
    var bAgain = el('button', { class: 'btn ghost', type: 'button' }, 'Still learning');
    var bKnow = el('button', { class: 'btn', type: 'button' }, 'I know this');
    var bNext = el('button', { class: 'btn ghost', type: 'button' }, 'Next →');
    var bFilter = el('button', { class: 'btn ghost', type: 'button' }, 'Show only unknown');
    [bPrev, bFlip, bAgain, bKnow, bNext, bFilter].forEach(function (b) { ctl.appendChild(b); });
    root.appendChild(count); root.appendChild(stage); root.appendChild(ctl);
    function visible() { return order.filter(function (i) { return !onlyUnknown || !known[deck[i].term]; }); }
    function show() {
      var v = visible();
      card.classList.remove('flipped');
      var nk = deck.filter(function (c) { return known[c.term]; }).length;
      if (!v.length) { front.innerHTML = '<div class="term">All cards known</div><div class="hint">Turn off the filter to review again.</div>'; back.innerHTML = ''; count.textContent = nk + ' of ' + deck.length + ' known'; return; }
      pos = (pos + v.length) % v.length;
      var c = deck[v[pos]];
      front.innerHTML = '<div class="term">' + c.term + '</div><div class="hint">Click or press Space to flip</div>';
      back.innerHTML = '<div>' + c.def + '</div>' + (c.cite ? '<div class="hint">' + c.cite + '</div>' : '');
      count.textContent = 'Card ' + (pos + 1) + ' of ' + v.length + ' · ' + nk + ' of ' + deck.length + ' known' + (known[c.term] ? ' · marked known' : '');
      renderMath(card);
    }
    function save() { update(function (st) { st.cards[key] = known; }); }
    card.addEventListener('click', function () { card.classList.toggle('flipped'); });
    card.addEventListener('keydown', function (e) { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); card.classList.toggle('flipped'); } });
    bFlip.addEventListener('click', function () { card.classList.toggle('flipped'); });
    bPrev.addEventListener('click', function () { pos--; show(); });
    bNext.addEventListener('click', function () { pos++; show(); });
    bKnow.addEventListener('click', function () { var v = visible(); if (!v.length) return; known[deck[v[pos]].term] = true; save(); if (!onlyUnknown) pos++; show(); });
    bAgain.addEventListener('click', function () { var v = visible(); if (!v.length) return; delete known[deck[v[pos]].term]; save(); pos++; show(); });
    bFilter.addEventListener('click', function () { onlyUnknown = !onlyUnknown; bFilter.textContent = onlyUnknown ? 'Show all cards' : 'Show only unknown'; pos = 0; show(); });
    show();
  }

  // ---------- glossary ----------
  function glossary(root, items) {
    if (!root) return;
    var input = el('input', { class: 'gloss-search', type: 'search', placeholder: 'Filter terms…', 'aria-label': 'Filter glossary' });
    var dl = el('dl', { class: 'glossary' });
    root.appendChild(input); root.appendChild(dl);
    var sorted = items.slice().sort(function (a, b) { return a.term.toLowerCase() < b.term.toLowerCase() ? -1 : 1; });
    function paint() {
      var f = input.value.toLowerCase();
      dl.innerHTML = '';
      sorted.forEach(function (it) {
        if (f && (it.term + ' ' + it.def).toLowerCase().indexOf(f) < 0) return;
        dl.appendChild(el('dt', { id: 'g-' + it.term.toLowerCase().replace(/[^a-z0-9]+/g, '-') }, it.term));
        dl.appendChild(el('dd', null, it.def + '<div class="gmeta">' + (it.moduleTitle ? it.moduleTitle + ' · ' : '') + (it.cite || '') + '</div>'));
      });
      renderMath(dl);
    }
    input.addEventListener('input', paint);
    paint();
  }

  // ---------- dashboard ----------
  function dashboard(root, catalog, statsRoot, resumeRoot) {
    var s = readStore();
    var totalMods = 0, doneMods = 0, quizzes = 0, quizPct = [];
    root.innerHTML = '';
    catalog.courses.forEach(function (c) {
      var mods = c.modules || [];
      var d = mods.filter(function (m) { return s.done[c.id + '/' + m.id]; }).length;
      var qp = mods.map(function (m) { var r = s.quiz[c.id + '/' + m.id]; return r ? r.best / (r.total || 1) : null; }).filter(function (x) { return x !== null; });
      if (c.status === 'available') { totalMods += mods.length; doneMods += d; }
      quizzes += qp.length; quizPct = quizPct.concat(qp);
      var pct = mods.length ? Math.round(100 * d / mods.length) : 0;
      var card = el('article', { class: 'course-card' + (c.status === 'available' ? '' : ' planned') });
      card.innerHTML =
        '<div class="num">Course ' + c.num + ' · <span class="tag tier">' + c.tier + '</span></div>' +
        '<h3>' + (c.status === 'available' ? '<a href="' + c.href + '">' + c.title + '</a>' : c.title) + '</h3>' +
        '<p>' + c.blurb + '</p>' +
        (c.status === 'available'
          ? '<div class="progress" role="img" aria-label="' + pct + '% of modules complete"><span style="width:' + pct + '%"></span></div>' +
            '<div class="foot"><span>' + d + ' of ' + mods.length + ' modules complete' + (qp.length ? ' · avg best quiz ' + Math.round(100 * avg(qp)) + '%' : '') + '</span><a class="btn ghost" href="' + c.href + '">Open</a></div>'
          : '<div class="foot"><span>' + (c.modules ? c.modules.length + ' modules planned' : 'Planned') + '</span><span class="tag">Coming after pilot review</span></div>');
      root.appendChild(card);
    });
    if (statsRoot) {
      statsRoot.innerHTML =
        stat('Modules complete', doneMods + ' / ' + totalMods, 'across available courses') +
        stat('Quizzes taken', String(quizzes), 'modules with a finished attempt') +
        stat('Average best score', quizPct.length ? Math.round(100 * avg(quizPct)) + '%' : '–', 'best attempt per module') +
        stat('Flashcards known', String(Object.keys(s.cards).reduce(function (a, k) { return a + Object.keys(s.cards[k] || {}).length; }, 0)), 'all decks');
    }
    if (resumeRoot) {
      resumeRoot.innerHTML = s.last ? 'Continue where you left off: <a href="' + s.last.href + '">' + s.last.title + '</a>' : 'Start with the pilot course below.';
    }
    function stat(l, v, sub) { return '<div class="stat"><div class="label">' + l + '</div><div class="value">' + v + '</div><div class="sub">' + sub + '</div></div>'; }
    function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / a.length; }
  }

  // two-click confirm (no browser dialogs)
  function resetProgress(btn) {
    if (!btn.dataset.armed) {
      btn.dataset.armed = '1'; btn.textContent = 'Click again to erase all progress';
      setTimeout(function () { delete btn.dataset.armed; btn.textContent = 'Reset all progress'; }, 4000);
      return;
    }
    try { localStorage.removeItem(KEY); } catch (e) { }
    location.reload();
  }

  // ---------- widget helpers (used by courses/cN/mN.js) ----------
  // inputs('t-', ['wells', 'cut'], paint) -> { wells: #t-wells, cut: #t-cut }, each calling paint on 'input' (or the given events)
  function inputs(prefix, keys, onChange, events) {
    var m = {};
    keys.forEach(function (k) {
      m[k] = document.getElementById(prefix + k);
      (events || ['input']).forEach(function (e) { m[k].addEventListener(e, onChange); });
    });
    return m;
  }
  // out('t-wells', text) writes the slider readout <output id="t-wells-o">
  function out(id, text) { document.getElementById(id + '-o').textContent = text; }
  function stat(label, value, sub) { return '<div class="stat"><div class="label">' + label + '</div><div class="value">' + value + '</div><div class="sub">' + sub + '</div></div>'; }

  window.ESC = {
    read: readStore, update: update, quiz: quiz, cards: cards, glossary: glossary, dashboard: dashboard,
    renderMath: renderMath, cssVar: cssVar, onTheme: function (f) { themeListeners.push(f); }, fmt: fmt, el: el,
    resetProgress: resetProgress, inputs: inputs, out: out, stat: stat
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPage); else initPage();
})();
