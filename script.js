/* ============================================================
   Math Brain Booster Pro — Full Edition
   OpenTDB trivia · Newton symbolic math · local fallback
   ============================================================ */

console.log('[boot] script.js loaded');

// ============================================================
// 1. STORAGE
// ============================================================
const STORAGE = {
  level: 'mbb_level',
  streak: 'mbb_streak',
  history: 'mbb_history'
};
const getStored = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch { return fallback; }
};
const setStored = (key, val) => {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
};

// ============================================================
// 2. HELPERS
// ============================================================
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = arr => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
function fmtFrac(num, den) {
  const g = gcd(Math.abs(num), Math.abs(den));
  num /= g; den /= g;
  if (den === 1) return String(num);
  return `${num}/${den}`;
}

function buildOptions(correct, distractors) {
  const correctStr = String(correct);
  const seen = new Set([correctStr]);
  const unique = [];
  for (const d of distractors) {
    const s = String(d);
    if (!seen.has(s)) { seen.add(s); unique.push(s); }
    if (unique.length === 3) break;
  }
  const correctNum = parseFloat(correct);
  let guard = 0;
  while (unique.length < 3 && guard < 500) {
    guard++;
    let cand;
    if (!isNaN(correctNum) && correctNum === Math.floor(correctNum)) {
      cand = String(correctNum + randInt(1, 10) * (Math.random() < 0.5 ? 1 : -1));
    } else {
      cand = String(randInt(1, 100));
    }
    if (!seen.has(cand)) { seen.add(cand); unique.push(cand); }
  }
  while (unique.length < 3) {
    const fallback = 'opt_' + unique.length + '_' + Date.now();
    if (!seen.has(fallback)) { seen.add(fallback); unique.push(fallback); }
  }
  const options = shuffle([correctStr, ...unique]);
  return { options, correctIndex: options.indexOf(correctStr) };
}

function decodeText(str) {
  try { str = decodeURIComponent(str); } catch (e) {}
  const txt = document.createElement('textarea');
  txt.innerHTML = str;
  return txt.value;
}

// ============================================================
// 3. OPEN-TRIVIA-DB (math trivia from the internet)
// ============================================================
const OPENTDB = {
  base: 'https://opentdb.com/api.php',
  tokenUrl: 'https://opentdb.com/api_token.php?command=request',
  category: 19, // Science: Mathematics
  tokenKey: 'mbb_opentdb_token',
  cachePrefix: 'mbb_opentdb_cache_',
  cacheMs: 10 * 60 * 1000
};

function difficultyForLevel(level) {
  if (level <= 3) return 'easy';
  if (level <= 7) return 'medium';
  return 'hard';
}

async function getOpenTdbToken() {
  let token = getStored(OPENTDB.tokenKey, null);
  if (token) return token;
  try {
    const res = await fetch(OPENTDB.tokenUrl);
    const data = await res.json();
    if (data.response_code === 0 && data.token) {
      setStored(OPENTDB.tokenKey, data.token);
      return data.token;
    }
  } catch (e) {
    console.warn('[opentdb] token failed:', e.message);
  }
  return null;
}

async function fetchOpenTdbQuestions(level, count) {
  const difficulty = difficultyForLevel(level);
  const cacheKey = OPENTDB.cachePrefix + difficulty;

  const cached = getStored(cacheKey, null);
  if (cached && cached.timestamp && (Date.now() - cached.timestamp < OPENTDB.cacheMs)) {
    if (cached.questions && cached.questions.length >= Math.min(count, 5)) {
      console.log('[opentdb] using cache (' + cached.questions.length + ' available)');
      return cached.questions;
    }
  }

  const token = await getOpenTdbToken();
  const params = new URLSearchParams({
    amount: Math.min(count + 2, 15),
    category: OPENTDB.category,
    difficulty: difficulty,
    type: 'multiple',
    encode: 'url3986'
  });
  if (token) params.set('token', token);

  const url = OPENTDB.base + '?' + params.toString();
  console.log('[opentdb] fetching', url);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    if (data.response_code === 4) {
      // Token exhausted — clear it and retry without
      try { localStorage.removeItem(OPENTDB.tokenKey); } catch (e) {}
      console.warn('[opentdb] token exhausted, retrying without');
      params.delete('token');
      const retry = await fetch(OPENTDB.base + '?' + params.toString());
      const retryData = await retry.json();
      if (retryData.response_code !== 0) return null;
      return parseOpenTdb(retryData.results, cacheKey);
    }

    if (data.response_code !== 0 || !data.results || !data.results.length) {
      console.warn('[opentdb] response_code:', data.response_code);
      return null;
    }

    return parseOpenTdb(data.results, cacheKey);
  } catch (e) {
    console.warn('[opentdb] fetch failed:', e.message);
    return null;
  }
}

function parseOpenTdb(results, cacheKey) {
  const questions = results.map(r => {
    const question = decodeText(r.question);
    const correct = decodeText(r.correct_answer);
    const wrong = r.incorrect_answers.map(a => decodeText(a));
    const options = shuffle([correct, ...wrong]);
    return {
      question,
      answer: correct,
      options,
      correctIndex: options.indexOf(correct),
      source: 'opentdb'
    };
  });
  try {
    setStored(cacheKey, { timestamp: Date.now(), questions });
  } catch (e) {}
  console.log('[opentdb] got', questions.length, 'questions');
  return questions;
}

// ============================================================
// 4. NEWTON API (symbolic math — derivatives, integrals, etc.)
// ============================================================
const NEWTON_BASE = 'https://newton.vercel.app/api/v2';

function randomPolynomial() {
  const a = randInt(1, 5);
  const b = randInt(1, 5);
  const c = randInt(1, 5);
  return a + 'x^2 + ' + b + 'x + ' + c;
}

async function newtonSolve(operation, expression) {
  const url = NEWTON_BASE + '/' + operation + '/' + encodeURIComponent(expression);
  console.log('[newton] GET', url);
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data && data.result) return data.result;
    return null;
  } catch (e) {
    console.warn('[newton] failed:', e.message);
    return null;
  }
}

async function symbolicQuestion(level) {
  const ops = ['derive', 'integrate', 'simplify', 'factor'];
  const op = ops[randInt(0, ops.length - 1)];
  let expression, questionText;

  if (op === 'factor') {
    const r1 = randInt(1, 6);
    const r2 = randInt(1, 6);
    expression = 'x^2 + ' + (r1 + r2) + 'x + ' + (r1 * r2);
    questionText = 'Factor: ' + expression + ' = ?';
  } else if (op === 'simplify') {
    const a = randInt(2, 6);
    const b = randInt(1, 9);
    expression = a + '(' + b + 'x + ' + a + ')';
    questionText = 'Simplify: ' + expression + ' = ?';
  } else {
    expression = randomPolynomial();
    questionText = (op === 'derive' ? 'd/dx (' : '∫ (') + expression + (op === 'derive' ? ')' : ') dx') + ' = ?';
  }

  const result = await newtonSolve(op, expression);
  if (!result) return null;

  const distractors = [];
  distractors.push(result.replace(/(\d+)/, m => String(parseInt(m, 10) + 1)));
  distractors.push(result.replace(/(\d+)/, m => String(Math.max(0, parseInt(m, 10) - 1))));
  distractors.push(result + (op === 'integrate' ? ' + C' : ''));

  const built = buildOptions(result, distractors);
  return {
    question: questionText,
    answer: result,
    options: built.options,
    correctIndex: built.correctIndex,
    source: 'newton'
  };
}

// ============================================================
// 5. LOCAL GENERATORS (offline fallback — always works)
// ============================================================

function arithMult(level) {
  let a, b;
  if (level <= 3) { a = randInt(11, 25); b = randInt(11, 25); }
  else if (level <= 6) { a = randInt(25, 99); b = randInt(11, 30); }
  else { a = randInt(50, 999); b = randInt(20, 99); }
  const ans = a * b;
  const o = buildOptions(String(ans), [
    String(ans + randInt(1, 20)),
    String(ans - randInt(1, 20)),
    String(a * (b + randInt(1, 5)))
  ]);
  return { question: a + ' × ' + b + ' = ?', answer: String(ans), options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function arithDivision(level) {
  const ans = randInt(2, level <= 5 ? 12 : 30);
  const b = randInt(2, level <= 5 ? 12 : 30);
  const a = ans * b;
  const o = buildOptions(String(ans), [String(ans + 1), String(ans - 1), String(ans + 2), String(a - ans)]);
  return { question: a + ' ÷ ' + b + ' = ?', answer: String(ans), options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function percentOf(level) {
  const pct = level <= 4 ? randInt(1, 9) * 10 : randInt(5, 95);
  const base = level <= 4 ? randInt(1, 9) * 100 : randInt(50, 900);
  const ans = Math.round((pct / 100) * base * 100) / 100;
  const ansStr = Number.isInteger(ans) ? String(ans) : ans.toFixed(2);
  const o = buildOptions(ansStr, [
    String(Math.round(ans * 2 * 100) / 100),
    String(Math.round(ans / 2 * 100) / 100),
    String(Math.round((pct / 100) * (base + 100) * 100) / 100)
  ]);
  return { question: pct + '% of ' + base + ' = ?', answer: ansStr, options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function squaresRoots(level) {
  if (level <= 3) {
    const n = randInt(2, 15);
    const sq = n * n;
    const o = buildOptions(String(n), [String(n + 1), String(n - 1), String(n + 2), String(sq)]);
    return { question: '√' + sq + ' = ?', answer: String(n), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else if (level <= 6) {
    const n = randInt(4, 20);
    const sq = n * n;
    const o = buildOptions(String(sq), [String(sq + n), String(sq - n), String((n + 1) * (n + 1)), String((n - 1) * (n - 1))]);
    return { question: n + '² = ?', answer: String(sq), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else {
    const base = randInt(2, 3);
    const exp = randInt(3, 5);
    const ans = Math.pow(base, exp);
    const o = buildOptions(String(ans), [String(base * exp), String(Math.pow(base, exp - 1)), String(Math.pow(base, exp + 1))]);
    return { question: base + '^' + exp + ' = ?', answer: String(ans), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  }
}

function algebraLinear(level) {
  if (level <= 4) {
    const a = randInt(2, 9);
    const x = randInt(1, 12);
    const b = randInt(1, 20);
    const c = a * x + b;
    const o = buildOptions(String(x), [String(x + 1), String(x - 1), String(x + 2), String(c)]);
    return { question: a + 'x + ' + b + ' = ' + c + ', find x', answer: String(x), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else if (level <= 7) {
    const x = randInt(2, 15);
    const a = randInt(3, 9);
    const c = randInt(1, a - 1);
    const b = randInt(-10, 20);
    const d = (a - c) * x + b;
    const o = buildOptions(String(x), [String(x + 1), String(x - 1), String(x + 2), String(a - c)]);
    const bStr = b >= 0 ? '+ ' + b : '- ' + Math.abs(b);
    const dStr = d >= 0 ? '+ ' + d : '- ' + Math.abs(d);
    return { question: a + 'x ' + bStr + ' = ' + c + 'x ' + dStr + ', find x', answer: String(x), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else {
    const a = randInt(2, 8);
    const b = randInt(1, 10);
    const x = randInt(1, 15);
    const c = a * (x + b);
    const o = buildOptions(String(x), [String(x + 1), String(x - 1), String(x + 3), String(c - b)]);
    return { question: a + '(x + ' + b + ') = ' + c + ', find x', answer: String(x), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  }
}

function fractions(level) {
  const den1 = randInt(2, level <= 5 ? 8 : 12);
  const den2 = randInt(2, level <= 5 ? 8 : 12);
  const num1 = randInt(1, den1 - 1);
  const num2 = randInt(1, den2 - 1);

  if (level <= 5) {
    const num = num1 * den2 + num2 * den1;
    const den = den1 * den2;
    const ans = fmtFrac(num, den);
    const o = buildOptions(ans, [fmtFrac(num + 1, den), fmtFrac(num1 + num2, den1 + den2), fmtFrac(num - 1, den)]);
    return { question: num1 + '/' + den1 + ' + ' + num2 + '/' + den2 + ' = ?', answer: ans, options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else {
    const num = num1 * num2;
    const den = den1 * den2;
    const ans = fmtFrac(num, den);
    const o = buildOptions(ans, [fmtFrac(num + 1, den), fmtFrac(num1 + num2, den1 + den2), fmtFrac(num, den + 1)]);
    return { question: num1 + '/' + den1 + ' × ' + num2 + '/' + den2 + ' = ?', answer: ans, options: o.options, correctIndex: o.correctIndex, source: 'local' };
  }
}

function sequences(level) {
  const start = randInt(1, 20);
  const kind = level <= 5 ? 'arith' : (Math.random() < 0.5 ? 'geom' : 'square');

  if (kind === 'arith') {
    const step = randInt(2, 9);
    const seq = [start, start + step, start + 2 * step, start + 3 * step];
    const next = start + 4 * step;
    const o = buildOptions(String(next), [String(next + step), String(next - 1), String(next + 2)]);
    return { question: seq.join(', ') + ', ?', answer: String(next), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else if (kind === 'geom') {
    const ratio = randInt(2, 3);
    const seq = [start, start * ratio, start * ratio ** 2, start * ratio ** 3];
    const next = start * ratio ** 4;
    const o = buildOptions(String(next), [String(next + ratio), String(next - 1), String(next / ratio)]);
    return { question: seq.join(', ') + ', ?', answer: String(next), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  } else {
    const a = randInt(2, 8);
    const seq = [a, a + 1, a + 2, a + 3].map(x => x * x);
    const next = (a + 4) * (a + 4);
    const o = buildOptions(String(next), [String(next - 1), String(next + 1), String((a + 5) * (a + 5))]);
    return { question: seq.join(', ') + ', ?', answer: String(next), options: o.options, correctIndex: o.correctIndex, source: 'local' };
  }
}

const TRIG_VALUES = {
  'sin 0°': '0', 'sin 30°': '1/2', 'sin 45°': '√2/2', 'sin 60°': '√3/2', 'sin 90°': '1',
  'cos 0°': '1', 'cos 30°': '√3/2', 'cos 45°': '√2/2', 'cos 60°': '1/2', 'cos 90°': '0',
  'tan 0°': '0', 'tan 30°': '√3/3', 'tan 45°': '1', 'tan 60°': '√3'
};
function trigBasics() {
  const keys = Object.keys(TRIG_VALUES);
  const key = keys[randInt(0, keys.length - 1)];
  const ans = TRIG_VALUES[key];
  const others = [...new Set(keys.filter(k => TRIG_VALUES[k] !== ans).map(k => TRIG_VALUES[k]))];
  const o = buildOptions(ans, others.slice(0, 3));
  return { question: key + ' = ?', answer: ans, options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function logarithms() {
  const base = randInt(2, 5);
  const exp = randInt(2, 4);
  const val = Math.pow(base, exp);
  const ans = String(exp);
  const o = buildOptions(ans, [String(exp + 1), String(exp - 1), String(base), String(val)]);
  return { question: 'log_' + base + '(' + val + ') = ?', answer: ans, options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function quadratics() {
  const r1 = randInt(1, 8);
  let r2 = randInt(1, 8);
  let guard = 0;
  while (r2 === r1 && guard < 20) { r2 = randInt(1, 8); guard++; }
  if (r2 === r1) r2 = (r1 % 8) + 1;
  const b = -(r1 + r2);
  const c = r1 * r2;
  const bStr = b >= 0 ? '+ ' + b : '- ' + Math.abs(b);
  const cStr = c >= 0 ? '+ ' + c : '- ' + Math.abs(c);
  const question = 'x² ' + bStr + 'x ' + cStr + ' = 0. Sum of roots?';
  const ans = String(r1 + r2);
  const o = buildOptions(ans, [String(r1 * r2), String(-(r1 + r2)), String(Math.abs(r1 - r2)), String(r1 + r2 + 1)]);
  return { question, answer: ans, options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function factorials() {
  const n = randInt(3, 6);
  let val = 1;
  for (let i = 2; i <= n; i++) val *= i;
  const o = buildOptions(String(val), [String(val / n), String(val * n), String(val + n), String(val - n)]);
  return { question: n + '! = ?', answer: String(val), options: o.options, correctIndex: o.correctIndex, source: 'local' };
}

function generateLocalQuestion(level) {
  const pool = [arithMult, arithDivision, squaresRoots];
  if (level >= 2) pool.push(percentOf);
  if (level >= 4) pool.push(algebraLinear, fractions, sequences);
  if (level >= 7) pool.push(trigBasics, logarithms, quadratics);
  if (level >= 9) pool.push(factorials);
  const gen = pool[randInt(0, pool.length - 1)];
  return gen(level);
}

// ============================================================
// 6. QUESTION PREPARATION (mix sources intelligently)
// ============================================================
async function prepareQuestions(level) {
  const count = 10;
  const useNewton = level >= 8;
  const newtonTarget = useNewton ? 3 : 0;

  // 1. Try OpenTDB
  const opentdb = await fetchOpenTdbQuestions(level, count);
  const questions = [];

  if (opentdb && opentdb.length > 0) {
    const takeFromApi = Math.min(opentdb.length, count - newtonTarget);
    for (let i = 0; i < takeFromApi; i++) questions.push(opentdb[i]);
  }

  // 2. Parallel-fetch Newton questions at level 8+
  if (useNewton && questions.length < count) {
    const remaining = count - questions.length;
    const want = Math.min(newtonTarget, remaining);
    const promises = [];
    for (let i = 0; i < want; i++) promises.push(symbolicQuestion(level));
    const results = await Promise.all(promises);
    for (const r of results) {
      if (r && questions.length < count) questions.push(r);
    }
  }

  // 3. Fill remaining with local generators
  while (questions.length < count) {
    questions.push(generateLocalQuestion(level));
  }

  // Log sources for debugging
  const sources = questions.map(q => q.source || 'local');
  console.log('[prepare] sources:', sources);

  return questions.slice(0, count);
}

// ============================================================
// 7. GAME STATE
// ============================================================
const state = {
  level: 1, score: 0, streak: 0, bestStreak: 0,
  questionNum: 0, totalQuestions: 10, correctCount: 0,
  current: null, answered: false,
  timerId: null, timePerQuestion: 15, timeLeft: 15,
  playing: false, dailyMode: false,
  questions: []
};

// ============================================================
// 8. SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ============================================================
// 9. GAME FLOW
// ============================================================
async function startGame(daily) {
  console.log('[game] startGame, daily=' + !!daily);
  state.playing = true;
  state.dailyMode = !!daily;
  state.score = 0;
  state.streak = 0;
  state.bestStreak = 0;
  state.questionNum = 0;
  state.correctCount = 0;
  state.timePerQuestion = daily ? 20 : 15;

  if (daily) {
    const d = new Date();
    const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
    state.level = 5 + (seed % 4);
  } else {
    state.level = getStored(STORAGE.level, 1);
  }

  // Show spinner
  const spinner = document.getElementById('loading-spinner');
  const qEl = document.getElementById('question');
  spinner.style.display = 'flex';
  qEl.textContent = '';
  document.getElementById('options').innerHTML = '';
  document.getElementById('feedback').textContent = '';
  showScreen('screen-game');

  // Fetch questions
  try {
    state.questions = await prepareQuestions(state.level);
  } catch (e) {
    console.error('[game] prepareQuestions failed:', e);
    state.questions = [];
    for (let i = 0; i < state.totalQuestions; i++) state.questions.push(generateLocalQuestion(state.level));
  }

  spinner.style.display = 'none';
  nextQuestion();
}

function nextQuestion() {
  if (state.questionNum >= state.totalQuestions) { endGame(); return; }

  state.current = state.questions[state.questionNum];
  state.questionNum++;
  state.answered = false;
  state.timeLeft = state.timePerQuestion;

  document.getElementById('hud-level').textContent = state.level;
  document.getElementById('hud-score').textContent = state.score;
  document.getElementById('hud-q').textContent = state.questionNum + '/' + state.totalQuestions;
  document.getElementById('question').textContent = state.current.question;
  document.getElementById('feedback').textContent = '';

  const wrap = document.getElementById('options');
  wrap.innerHTML = '';
  state.current.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.type = 'button';
    btn.textContent = opt;
    btn.dataset.index = i;
    btn.addEventListener('click', () => handleAnswer(i, btn));
    wrap.appendChild(btn);
  });

  startTimer();
}

function startTimer() {
  clearInterval(state.timerId);
  const fill = document.getElementById('timer-fill');
  fill.style.width = '100%';
  const total = state.timeLeft;
  const startTime = Date.now();

  state.timerId = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    state.timeLeft = Math.max(0, total - elapsed);
    fill.style.width = ((state.timeLeft / total) * 100) + '%';
    if (state.timeLeft <= 0) {
      clearInterval(state.timerId);
      if (!state.answered) timeUp();
    }
  }, 100);
}

function timeUp() {
  state.answered = true;
  state.streak = 0;
  document.querySelectorAll('.option').forEach(b => b.classList.add('disabled'));
  const cb = document.querySelector('.option[data-index="' + state.current.correctIndex + '"]');
  if (cb) cb.classList.add('correct');
  document.getElementById('feedback').textContent = '⏱ Time up!';
  setTimeout(nextQuestion, 1500);
}

function handleAnswer(index, btn) {
  if (state.answered || !state.playing) return;
  state.answered = true;
  clearInterval(state.timerId);

  const isCorrect = index === state.current.correctIndex;
  document.querySelectorAll('.option').forEach(b => b.classList.add('disabled'));

  if (isCorrect) {
    btn.classList.add('correct');
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    const basePoints = state.level * 5;
    const speedBonus = Math.round((state.timeLeft / state.timePerQuestion) * state.level * 2);
    state.score += basePoints + speedBonus;
    state.correctCount++;
    document.getElementById('feedback').textContent = 'Correct! +' + (basePoints + speedBonus) + ' pts';
  } else {
    btn.classList.add('wrong');
    const cb = document.querySelector('.option[data-index="' + state.current.correctIndex + '"]');
    if (cb) cb.classList.add('correct');
    state.streak = 0;
    document.getElementById('feedback').textContent = 'Not quite.';
  }

  document.getElementById('hud-score').textContent = state.score;
  setTimeout(nextQuestion, 1200);
}

function endGame() {
  state.playing = false;
  clearInterval(state.timerId);

  const accuracy = state.correctCount / state.totalQuestions;
  let newLevel = state.level;
  if (accuracy >= 0.8) newLevel = Math.min(10, state.level + 1);
  else if (accuracy <= 0.4) newLevel = Math.max(1, state.level - 1);

  if (!state.dailyMode) setStored(STORAGE.level, newLevel);

  const oldBest = getStored(STORAGE.streak, 0);
  if (state.bestStreak > oldBest) setStored(STORAGE.streak, state.bestStreak);

  const history = getStored(STORAGE.history, []);
  history.unshift({
    date: new Date().toISOString(),
    score: state.score, level: state.level,
    correct: state.correctCount, total: state.totalQuestions,
    daily: state.dailyMode
  });
  setStored(STORAGE.history, history.slice(0, 30));

  document.getElementById('res-correct').textContent = state.correctCount;
  document.getElementById('res-total').textContent = state.totalQuestions;
  document.getElementById('res-score').textContent = state.score;
  document.getElementById('res-level').textContent = newLevel;

  const title =
    state.correctCount === state.totalQuestions ? '🏆 Perfect run!' :
    accuracy >= 0.8 ? '🌟 Great job!' :
    accuracy >= 0.5 ? '👍 Solid effort' : '💪 Keep practising';
  document.getElementById('results-title').textContent = title;

  showScreen('screen-results');
  refreshHome();
}

// ============================================================
// 10. HOME & STATS
// ============================================================
function refreshHome() {
  document.getElementById('home-level').textContent = getStored(STORAGE.level, 1);
  document.getElementById('home-streak').textContent = getStored(STORAGE.streak, 0);
}

function renderStats() {
  const list = document.getElementById('stats-list');
  const history = getStored(STORAGE.history, []);
  if (history.length === 0) {
    list.innerHTML = '<p class="empty">No games played yet. Give it a go!</p>';
    return;
  }
  list.innerHTML = history.map(h => {
    const date = new Date(h.date).toLocaleDateString();
    const tag = h.daily ? ' · Daily' : '';
    return '<div class="stat-row">' +
      '<div><b>' + h.score + '</b> pts</div>' +
      '<div>' + h.correct + '/' + h.total + ' correct · Lv ' + h.level + tag + '</div>' +
      '<div class="stat-date">' + date + '</div>' +
      '</div>';
  }).join('');
}

// ============================================================
// 11. WIRING
// ============================================================
console.log('[boot] wiring event listeners');
document.getElementById('btn-play').addEventListener('click', () => startGame(false));
document.getElementById('btn-daily').addEventListener('click', () => startGame(true));
document.getElementById('btn-stats').addEventListener('click', () => { renderStats(); showScreen('screen-stats'); });
document.getElementById('btn-again').addEventListener('click', () => startGame(state.dailyMode));
document.getElementById('btn-home').addEventListener('click', () => { refreshHome(); showScreen('screen-home'); });
document.getElementById('btn-back-home').addEventListener('click', () => { refreshHome(); showScreen('screen-home'); });

console.log('[boot] refreshing home');
refreshHome();
console.log('[boot] ready');

// Service worker
if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js')
      .then(() => console.log('[sw] registered'))
      .catch(err => console.warn('[sw] not registered:', err.message));
  });
} else {
  console.log('[sw] skipped (file:// or unsupported)');
}