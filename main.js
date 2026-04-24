/* ===========================
   QUITCLOCK — main.js
   =========================== */

// ===========================
// THEME MODULE
// ===========================

const Theme = {
  KEY: 'quitclock_theme',

  get() {
    return localStorage.getItem(this.KEY) || 'dark';
  },

  set(theme) {
    localStorage.setItem(this.KEY, theme);
    document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : '');
    const icon = theme === 'light' ? '☀️' : '🌙';
    document.querySelectorAll('.btn-theme').forEach(btn => btn.textContent = icon);
  },

  toggle() {
    this.set(this.get() === 'dark' ? 'light' : 'dark');
  },

  init() {
    this.set(this.get());
  },
};

// ===========================
// STATE
// ===========================

const state = {
  ticker: null,
  startTs: null,
  perSecond: 0,
  retireDate: null,
  joinDate: null,
  rates: {},
  currency: '',
};

// ===========================
// STORAGE MODULE
// ===========================

const Storage = {
  KEY: 'quitclock_settings',

  save(data) {
    try { localStorage.setItem(this.KEY, JSON.stringify(data)); }
    catch (e) { console.warn('localStorage 저장 실패:', e); }
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },

  clear() { localStorage.removeItem(this.KEY); },
};

// ===========================
// CALC MODULE
// ===========================

const Calc = {
  perSecond(monthlySalary) {
    return monthlySalary / (22 * 8 * 3600);
  },

  earned(startTs, perSecond) {
    return Math.max(0, (Date.now() - startTs) / 1000) * perSecond;
  },

  retireDate(birthDate, retireAge = 60) {
    const d = new Date(birthDate);
    d.setFullYear(d.getFullYear() + retireAge);
    return d;
  },

  timeLeft(retireDate) {
    const msLeft = retireDate - Date.now();
    if (msLeft <= 0) return null;
    const totalSec = Math.floor(msLeft / 1000);
    const totalMins = Math.floor(totalSec / 60);
    const totalHours = Math.floor(totalMins / 60);
    const totalDays = Math.floor(totalHours / 24);
    const now = new Date();
    let years = retireDate.getFullYear() - now.getFullYear();
    let months = retireDate.getMonth() - now.getMonth();
    let days = retireDate.getDate() - now.getDate();
    if (days < 0) { months--; days += 30; }
    if (months < 0) { years--; months += 12; }
    return { years, months, days, totalDays, totalHours, totalMins, totalSec };
  },

  careerProgress(joinDate, retireDate) {
    return Math.min(100, Math.max(0, (Date.now() - joinDate) / (retireDate - joinDate) * 100));
  },

  convertKRW(amountKRW, targetCurrency, rates) {
    if (!rates || !rates[targetCurrency]) return null;
    // exchangerate-api KRW 기준: 1 KRW = rates[targetCurrency] 외화
    return amountKRW * rates[targetCurrency];
  },
};

// ===========================
// CURRENCY MODULE
// ===========================

const CURRENCY_LABELS = {
  USD: '미국 달러 (USD)',
  JPY: '일본 엔 (JPY)',
  EUR: '유로 (EUR)',
  GBP: '영국 파운드 (GBP)',
  CNY: '중국 위안 (CNY)',
  HKD: '홍콩 달러 (HKD)',
  AUD: '호주 달러 (AUD)',
  CAD: '캐나다 달러 (CAD)',
  CHF: '스위스 프랑 (CHF)',
  SGD: '싱가포르 달러 (SGD)',
  THB: '태국 바트 (THB)',
  VND: '베트남 동 (VND)',
  INR: '인도 루피 (INR)',
  MXN: '멕시코 페소 (MXN)',
  BRL: '브라질 헤알 (BRL)',
};

const CURRENCY_SYMBOLS = {
  USD: '$', JPY: '¥', EUR: '€', GBP: '£', CNY: '¥',
  HKD: 'HK$', AUD: 'A$', CAD: 'C$', CHF: 'Fr',
  SGD: 'S$', THB: '฿', VND: '₫', INR: '₹', MXN: '$', BRL: 'R$',
};

const Currency = {
  API_KEY: '35db5c8159e93f83895a1004',

  async fetchRates() {
    try {
      const res = await fetch(`https://v6.exchangerate-api.com/v6/${this.API_KEY}/latest/KRW`);
      if (!res.ok) throw new Error('오류');
      const data = await res.json();
      if (data.result !== 'success') throw new Error('실패');
      // rates는 KRW 기준 상대값 → 1 KRW = x 외화
      return { rates: data.conversion_rates, date: data.time_last_update_utc.slice(0, 16) };
    } catch (e) {
      console.warn('환율 불러오기 실패:', e);
      return null;
    }
  },

  populateSelect(rates) {
    const sel = document.getElementById('currency-select');
    sel.innerHTML = '<option value="">통화 선택</option>';
    Object.keys(CURRENCY_LABELS).forEach(code => {
      if (!rates[code]) return;
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = CURRENCY_LABELS[code];
      sel.appendChild(opt);
    });
    if (state.currency && rates[state.currency]) sel.value = state.currency;
  },

  format(amount, currency) {
    const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
    if (currency === 'JPY' || currency === 'VND') {
      return `${sym}${Math.floor(amount).toLocaleString()}`;
    }
    return `${sym}${amount.toFixed(2)}`;
  },
};

// ===========================
// UI MODULE
// ===========================

const UI = {
  $(id) { return document.getElementById(id); },

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this.$(id).classList.add('active');
  },

  setEarned(amount, perSec) {
    this.$('earned-amount').textContent = '₩' + Math.floor(amount).toLocaleString('ko-KR');
    this.$('earned-sub').textContent = `초당 ${perSec.toFixed(2)}원`;
  },

  setProgress(pct, joinDate, retireDate) {
    const fmt = d => d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
    this.$('prog-fill').style.width = pct.toFixed(2) + '%';
    this.$('prog-pct').textContent = pct.toFixed(1) + '%';
    this.$('prog-join').textContent = fmt(joinDate);
    this.$('prog-retire').textContent = fmt(retireDate);
  },

  setRetire(t) {
    if (!t) {
      this.$('ret-ym').textContent = '정년 도달';
      ['ret-days','ret-hours','ret-mins','ret-secs'].forEach(id => this.$(id).textContent = '—');
      return;
    }
    this.$('ret-ym').textContent = `${t.years}년 ${t.months}개월 ${t.days}일`;
    this.$('ret-days').textContent = t.totalDays.toLocaleString();
    this.$('ret-hours').textContent = t.totalHours.toLocaleString();
    this.$('ret-mins').textContent = t.totalMins.toLocaleString();
    this.$('ret-secs').textContent = t.totalSec.toLocaleString();
  },

  setCurrency(earned) {
    const el = this.$('currency-result');
    if (!state.currency || !state.rates[state.currency]) { el.textContent = '—'; return; }
    const converted = Calc.convertKRW(earned, state.currency, state.rates);
    el.textContent = converted !== null ? Currency.format(converted, state.currency) : '—';
  },

  setComment(earned, timeLeft) {
    if (!timeLeft) { this.$('comment-block').textContent = '수고했어. 이제 진짜 자유다.'; return; }
    const pool = [
      `지금 이 순간에도 ${timeLeft.totalSec.toLocaleString()}초가 흘러가는 중`,
      `정년까지 ${timeLeft.totalMins.toLocaleString()}분 남았어. 아직 멀었다`,
      `오늘 여기서 번 돈 ₩${Math.floor(earned).toLocaleString()} — 이게 맞나 싶지?`,
      `${timeLeft.years}년 ${timeLeft.months}개월 후에 자유`,
      `커피 한 잔 마시는 사이에도 시계는 돌아가고 있음`,
      `${timeLeft.totalDays.toLocaleString()}일 뒤면 다 끝나`,
    ];
    this.$('comment-block').textContent = pool[Math.floor(Date.now() / 12000) % pool.length];
  },

  fillSetupForm(saved) {
    if (saved.birth) document.getElementById('birth').value = saved.birth;
    if (saved.join) document.getElementById('join').value = saved.join;
    if (saved.startTime) document.getElementById('start-time').value = saved.startTime;
    if (saved.salary) document.getElementById('salary').value = saved.salary;
  },
};

// ===========================
// TICKER
// ===========================

function tick() {
  const earned = Calc.earned(state.startTs, state.perSecond);
  const timeLeft = Calc.timeLeft(state.retireDate);
  const progress = Calc.careerProgress(state.joinDate, state.retireDate);

  UI.setEarned(earned, state.perSecond);
  UI.setRetire(timeLeft);
  UI.setProgress(progress, state.joinDate, state.retireDate);
  UI.setCurrency(earned);
  UI.setComment(earned, timeLeft);

  if (!timeLeft) clearInterval(state.ticker);
}

// ===========================
// EVENTS
// ===========================

function startDashboard(e) {
  e.preventDefault();

  const birth = document.getElementById('birth').value;
  const join = document.getElementById('join').value;
  const startTime = document.getElementById('start-time').value;
  const salary = parseFloat(document.getElementById('salary').value);

  if (!birth || !join || !startTime || !salary || salary <= 0) {
    alert('모든 항목을 입력해줘');
    return;
  }

  Storage.save({ birth, join, startTime, salary, currency: state.currency });

  const birthDate = new Date(birth);
  const joinDate = new Date(join);
  const retireDate = Calc.retireDate(birthDate, 60);

  const [sh, sm] = startTime.split(':').map(Number);
  const now = new Date();
  let startTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), sh, sm, 0, 0).getTime();
  if (startTs > Date.now()) startTs = Date.now();

  state.startTs = startTs;
  state.perSecond = Calc.perSecond(salary);
  state.retireDate = retireDate;
  state.joinDate = joinDate;

  UI.setProgress(0, joinDate, retireDate);
  UI.showScreen('dashboard-screen');

  tick();
  if (state.ticker) clearInterval(state.ticker);
  state.ticker = setInterval(tick, 1000);
}

function resetDashboard() {
  clearInterval(state.ticker);
  state.ticker = null;
  Storage.clear();
  UI.showScreen('setup-screen');
}

// ===========================
// INIT
// ===========================

document.addEventListener('DOMContentLoaded', async () => {
  Theme.init();

  document.getElementById('setup-form').addEventListener('submit', startDashboard);
  document.getElementById('reset-btn').addEventListener('click', resetDashboard);
  document.querySelectorAll('.btn-theme').forEach(btn => btn.addEventListener('click', () => Theme.toggle()));

  document.getElementById('currency-select').addEventListener('change', (e) => {
    state.currency = e.target.value;
    const saved = Storage.load() || {};
    Storage.save({ ...saved, currency: state.currency });
  });

  // 환율 불러오기
  const rateData = await Currency.fetchRates();
  if (rateData) {
    state.rates = rateData.rates;
    Currency.populateSelect(rateData.rates);
    const badge = document.getElementById('rate-date');
    if (badge) badge.textContent = `${rateData.date} 기준`;
  } else {
    const badge = document.getElementById('rate-date');
    if (badge) badge.textContent = '환율 불러오기 실패';
  }

  // 저장된 설정 복원
  const saved = Storage.load();
  if (saved) {
    UI.fillSetupForm(saved);
    if (saved.currency) state.currency = saved.currency;
  }
});
