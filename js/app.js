'use strict';

const STORAGE_KEY = 'rikugi2_state';
const HISTORY_KEY  = 'rikugi2_history';
const CATEGORIES   = ['すべて', '法規', '無線工学の基礎', '無線工学A', '無線工学B'];

let allQuestions = [];
let state = {
  category: 'すべて',
  mode: '4択',        // '2択' | '4択'
  count: 10,          // 10 | 20
  questions: [],      // filtered & shuffled ids
  current: 0,
  answers: {},        // { questionId: { selected, correct } }
  shownOptions: {},   // { questionId: number[] } — 2択時に表示する元のoption index
  screen: 'start',    // 'start' | 'quiz' | 'result' | 'stats'
};

// ── Session state persistence ─────────────────────────────
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

function clearState() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Question history persistence ──────────────────────────
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function recordHistory(questionId, correct) {
  const history = loadHistory();
  const h = history[questionId] || [];
  h.push(correct);
  if (h.length > 10) h.splice(0, h.length - 10);
  history[questionId] = h;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// ── Helpers ──────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getFilteredIds(category) {
  const qs = category === 'すべて' ? allQuestions : allQuestions.filter(q => q.category === category);
  return shuffle(qs.map(q => q.id));
}

function currentQuestion() {
  const id = state.questions[state.current];
  return allQuestions.find(q => q.id === id);
}

function answeredCount() {
  return Object.keys(state.answers).length;
}

function correctCount() {
  return Object.values(state.answers).filter(a => a.correct).length;
}

function questionHistoryHTML(qid) {
  const history = loadHistory();
  const h = history[qid] || [];
  if (h.length === 0) return '';
  const icons = h.map(c =>
    `<span class="hist-icon ${c ? 'ok' : 'ng'}">${c ? '○' : '×'}</span>`
  ).join('');
  return `<div class="question-history"><span class="hist-label">履歴</span>${icons}</div>`;
}

// ── Math rendering (KaTeX) ───────────────────────────────
function renderMath(el) {
  if (typeof renderMathInElement === 'function') {
    renderMathInElement(el, {
      delimiters: [
        { left: '$$', right: '$$', display: true  },
        { left: '$',  right: '$',  display: false },
      ],
      throwOnError: false,
    });
  }
}

// ── Render ───────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if      (state.screen === 'start')  renderStart(app);
  else if (state.screen === 'quiz')   renderQuiz(app);
  else if (state.screen === 'result') renderResult(app);
  else if (state.screen === 'stats')  renderStats(app);
}

function renderStart(app) {
  const saved = loadState();
  const hasSaved = saved && saved.screen === 'quiz' && saved.questions && saved.questions.length > 0;

  app.innerHTML = `
    <div class="header">
      <h1>二陸技 一問一答</h1>
      <button class="btn btn-secondary" id="btn-stats-top" style="width:auto;padding:6px 14px;font-size:13px">学習状況</button>
    </div>
    <div class="card start-screen">
      <h2>二陸技 練習問題</h2>
      <p>第二級陸上無線技術士の試験対策。<br>回答は自動保存されます。</p>
      ${hasSaved ? `
        <div class="resume-card">
          <h3>前回の続きから再開できます</h3>
          <p>${saved.mode || '4択'} ・ ${saved.count || 10}問 ・ ${saved.category} ・ ${Object.keys(saved.answers).length}/${saved.questions.length}問 回答済み</p>
          <div class="btn-row">
            <button class="btn btn-primary" id="btn-resume">続きから</button>
            <button class="btn btn-secondary" id="btn-new">最初から</button>
          </div>
        </div>
      ` : ''}
      <div>
        <p style="margin-bottom:10px;font-weight:600;font-size:14px;">モードを選ぶ</p>
        <div class="filter-wrap" id="start-modes"></div>
      </div>
      <div>
        <p style="margin-bottom:10px;font-weight:600;font-size:14px;">問題数を選ぶ</p>
        <div class="filter-wrap" id="start-counts"></div>
      </div>
      <div>
        <p style="margin-bottom:10px;font-weight:600;font-size:14px;">カテゴリを選んでスタート</p>
        <div class="filter-wrap" id="start-filters"></div>
      </div>
      <button class="btn btn-primary" id="btn-start">スタート</button>
    </div>
  `;

  document.getElementById('btn-stats-top').addEventListener('click', () => {
    state.screen = 'stats';
    render();
  });

  const modeWrap = document.getElementById('start-modes');
  ['2択', '4択'].forEach(m => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (state.mode === m ? ' active' : '');
    btn.textContent = m;
    btn.addEventListener('click', () => {
      state.mode = m;
      modeWrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    modeWrap.appendChild(btn);
  });

  const countWrap = document.getElementById('start-counts');
  [10, 20].forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (state.count === n ? ' active' : '');
    btn.textContent = `${n}問`;
    btn.addEventListener('click', () => {
      state.count = n;
      countWrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    countWrap.appendChild(btn);
  });

  const filterWrap = document.getElementById('start-filters');
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (state.category === cat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      state.category = cat;
      filterWrap.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    filterWrap.appendChild(btn);
  });

  document.getElementById('btn-start').addEventListener('click', startNew);

  if (hasSaved) {
    document.getElementById('btn-resume').addEventListener('click', () => {
      Object.assign(state, saved);
      render();
    });
    document.getElementById('btn-new').addEventListener('click', () => {
      clearState();
      startNew();
    });
  }

  renderMath(app);
}

function startNew() {
  state.questions   = getFilteredIds(state.category).slice(0, state.count);
  state.current     = 0;
  state.answers     = {};
  state.shownOptions = {};
  state.screen      = 'quiz';
  saveState();
  render();
}

function getShownOptions(q) {
  if (state.mode === '4択') return [0, 1, 2, 3];
  if (state.shownOptions[q.id]) return state.shownOptions[q.id];
  const wrongs = q.options.map((_, i) => i).filter(i => i !== q.answer);
  const wrong = wrongs[Math.floor(Math.random() * wrongs.length)];
  const indices = shuffle([q.answer, wrong]);
  state.shownOptions[q.id] = indices;
  saveState();
  return indices;
}

function renderQuiz(app) {
  const q = currentQuestion();
  if (!q) { renderResult(app); return; }

  const answered = state.answers[q.id];
  const total    = state.questions.length;
  const pct      = Math.round((state.current / total) * 100);

  const optLabels    = ['A', 'B', 'C', 'D'];
  const displayIndices = getShownOptions(q);
  const correctLabel   = optLabels[displayIndices.indexOf(q.answer)];

  app.innerHTML = `
    <div class="header">
      <h1>二陸技 一問一答</h1>
      <div class="header-right">
        <span style="font-size:12px;font-weight:700;color:var(--primary);background:#eff6ff;padding:3px 8px;border-radius:999px">${state.mode}</span>
        <span style="font-size:13px;color:var(--text-muted)">${answeredCount()}/${total}</span>
        <button class="btn btn-secondary" id="btn-finish" style="width:auto;padding:6px 14px;font-size:13px">終了</button>
      </div>
    </div>

    <div class="progress-wrap">
      <div class="progress-label">
        <span>${state.current + 1} / ${total}問</span>
        <span>${pct}%</span>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    </div>

    <div class="nav-dots" id="nav-dots"></div>

    <div class="card" id="question-card">
      <div class="badge-history-row">
        <span class="badge ${q.category}">${q.category}</span>
        ${questionHistoryHTML(q.id)}
      </div>
      <p class="question-text">${q.question}</p>
      <div class="options" id="options"></div>
      ${answered ? `
        <div class="result-badge ${answered.correct ? 'ok' : 'ng'}">
          ${answered.correct ? '✓ 正解！' : `✗ 不正解（正解：${correctLabel}）`}
        </div>
        <div class="explanation show"><strong>解説</strong>${q.explanation}</div>
      ` : ''}
    </div>

    ${answered ? `
      <button class="btn btn-primary" id="btn-next">
        ${state.current + 1 < total ? '次の問題 →' : '結果を見る'}
      </button>
    ` : ''}
  `;

  const dots = document.getElementById('nav-dots');
  state.questions.slice(0, Math.min(total, 30)).forEach((qid, idx) => {
    const ans = state.answers[qid];
    const dot = document.createElement('button');
    dot.className = 'dot' +
      (ans ? (ans.correct ? ' answered-correct' : ' answered-wrong') : '') +
      (idx === state.current ? ' current' : '');
    dot.textContent = idx + 1;
    dot.addEventListener('click', () => { state.current = idx; saveState(); render(); });
    dots.appendChild(dot);
  });

  const optWrap = document.getElementById('options');
  displayIndices.forEach((origIdx, pos) => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    if (answered) {
      if (origIdx === q.answer)          btn.classList.add('correct');
      else if (origIdx === answered.selected) btn.classList.add('wrong');
      btn.disabled = true;
    }
    btn.innerHTML = `<span class="opt-label">${optLabels[pos]}</span><span>${q.options[origIdx]}</span>`;
    btn.addEventListener('click', () => answerQuestion(q, origIdx));
    optWrap.appendChild(btn);
  });

  document.getElementById('btn-finish').addEventListener('click', () => {
    state.screen = 'result'; saveState(); render();
  });

  const btnNext = document.getElementById('btn-next');
  if (btnNext) {
    btnNext.addEventListener('click', () => {
      if (state.current + 1 < state.questions.length) {
        state.current++;
      } else {
        state.screen = 'result';
      }
      saveState();
      render();
    });
  }

  renderMath(app);
}

function answerQuestion(q, selected) {
  if (state.answers[q.id]) return;
  const correct = selected === q.answer;
  state.answers[q.id] = { selected, correct };
  recordHistory(q.id, correct);
  saveState();
  render();
}

function renderResult(app) {
  const total    = state.questions.length;
  const answered = answeredCount();
  const correct  = correctCount();
  const pct      = answered > 0 ? Math.round((correct / answered) * 100) : 0;

  const mistakes = state.questions
    .map(id => allQuestions.find(q => q.id === id))
    .filter(q => state.answers[q.id] && !state.answers[q.id].correct);

  app.innerHTML = `
    <div class="header">
      <h1>二陸技 一問一答</h1>
    </div>
    <div class="card result-screen">
      <div class="score-circle">
        <span class="score-num">${pct}%</span>
        <span class="score-label">正解率</span>
      </div>
      <p class="score-detail">${answered}問回答・${correct}問正解・${mistakes.length}問不正解</p>
      ${mistakes.length > 0 ? `
        <div class="mistake-list">
          <h3>間違えた問題</h3>
          ${mistakes.map(q => `
            <div class="mistake-item">
              <span class="badge ${q.category}" style="margin-bottom:4px">${q.category}</span><br>
              ${q.question}
            </div>
          `).join('')}
        </div>
      ` : `<p style="color:var(--success);font-weight:700;margin-bottom:20px">全問正解！素晴らしい！</p>`}
      <div class="btn-row">
        <button class="btn btn-primary" id="btn-retry-wrong" ${mistakes.length === 0 ? 'disabled style="opacity:.4"' : ''}>
          間違いのみ再挑戦
        </button>
        <button class="btn btn-secondary" id="btn-back-start">最初に戻る</button>
      </div>
    </div>
  `;

  document.getElementById('btn-back-start').addEventListener('click', () => {
    clearState();
    state = { category: 'すべて', mode: state.mode, count: state.count, questions: [], current: 0, answers: {}, shownOptions: {}, screen: 'start' };
    render();
  });

  document.getElementById('btn-retry-wrong').addEventListener('click', () => {
    if (mistakes.length === 0) return;
    state.questions    = shuffle(mistakes.map(q => q.id));
    state.current      = 0;
    state.answers      = {};
    state.shownOptions = {};
    state.screen       = 'quiz';
    saveState();
    render();
  });

  renderMath(app);
}

// ── Stats screen ──────────────────────────────────────────
function renderStats(app) {
  const history = loadHistory();

  function categoryStats(cat) {
    const qs = cat === 'すべて' ? allQuestions : allQuestions.filter(q => q.category === cat);
    let attempted = 0, totalTries = 0, totalCorrect = 0;
    qs.forEach(q => {
      const h = history[q.id] || [];
      if (h.length > 0) {
        attempted++;
        totalTries   += h.length;
        totalCorrect += h.filter(Boolean).length;
      }
    });
    const rate = totalTries > 0 ? Math.round(totalCorrect / totalTries * 100) : null;
    return { qs, attempted, totalTries, totalCorrect, rate };
  }

  function rateClass(rate) {
    if (rate === null) return 'none';
    if (rate >= 70) return 'high';
    if (rate >= 40) return 'mid';
    return 'low';
  }

  app.innerHTML = `
    <div class="header">
      <h1>学習状況</h1>
      <button class="btn btn-secondary" id="btn-stats-back" style="width:auto;padding:6px 14px;font-size:13px">← 戻る</button>
    </div>
    <div id="stats-body"></div>
  `;

  document.getElementById('btn-stats-back').addEventListener('click', () => {
    state.screen = 'start';
    render();
  });

  const body = document.getElementById('stats-body');

  CATEGORIES.forEach(cat => {
    const { qs, attempted, totalTries, rate } = categoryStats(cat);
    const rc = rateClass(rate);
    const rateLabel = rate !== null ? `${rate}%` : '--';

    const card = document.createElement('div');
    card.className = 'stats-card';

    // dot grid for individual categories
    let dotGrid = '';
    if (cat !== 'すべて') {
      const dotItems = qs.map(q => {
        const h = history[q.id] || [];
        if (h.length === 0) return `<div class="sq-dot unattempted" title="${q.question.slice(0,20)}…"></div>`;
        const r = h.filter(Boolean).length / h.length;
        const cls = r >= 0.7 ? 'good' : r >= 0.4 ? 'mid' : 'bad';
        return `<div class="sq-dot ${cls}" title="${q.question.slice(0,20)}…"></div>`;
      }).join('');
      dotGrid = `
        <div class="sq-grid">${dotItems}</div>
        <div class="sq-legend">
          <span class="sq-dot good sm"></span>正解率70%以上
          <span class="sq-dot mid sm"></span>40〜69%
          <span class="sq-dot bad sm"></span>40%未満
          <span class="sq-dot unattempted sm"></span>未挑戦
        </div>
      `;
    }

    card.innerHTML = `
      <div class="stats-card-top">
        <span class="badge ${cat === 'すべて' ? 'all' : cat}">${cat}</span>
        <span class="stats-pct ${rc}">${rateLabel}</span>
      </div>
      <div class="stats-bar-wrap">
        <div class="stats-bar-fill ${rc}" style="width:${rate ?? 0}%"></div>
      </div>
      <div class="stats-detail">
        ${attempted}問 / ${qs.length}問 解答済み
        ${totalTries > 0 ? `・計${totalTries}回回答` : ''}
      </div>
      ${dotGrid}
    `;
    body.appendChild(card);
  });

  renderMath(app);
}

// ── Toast ─────────────────────────────────────────────────
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

// ── Auto-save on tab hide ─────────────────────────────────
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state.screen === 'quiz') {
    saveState();
    showToast('自動保存しました');
  }
});

// ── Boot ─────────────────────────────────────────────────
async function init() {
  const res = await fetch('data/questions.json');
  allQuestions = await res.json();

  const saved = loadState();
  if (saved) {
    Object.assign(state, saved);
    if (state.screen === 'start') state.screen = 'start';
  }

  render();
}

init();
