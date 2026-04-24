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
// NUMBER FORMAT UTILS
// ===========================

function formatKRW(n) {
  return '₩' + Math.round(n).toLocaleString('ko-KR');
}

function readKorean(n) {
  if (!n || n <= 0) return '';
  const uk = Math.floor(n / 100000000);
  const man = Math.floor((n % 100000000) / 10000);
  const rest = Math.round(n % 10000);
  let parts = [];
  if (uk > 0) parts.push(`${uk}억`);
  if (man > 0) parts.push(`${man}만`);
  if (rest > 0 && uk === 0) parts.push(`${rest.toLocaleString()}원`);
  else if (parts.length > 0) parts[parts.length - 1] += '원';
  return parts.join(' ') || `${n}원`;
}

// ===========================
// DEDUCTION CALC MODULE
// ===========================

// 2024년 국세청 간이세액표 근사 (월급여 구간, 부양가족 1~11인)
// [급여구간상한, [부양1, 부양2, ..., 부양11]]
const INCOME_TAX_TABLE = [
  [1060000,  [0,0,0,0,0,0,0,0,0,0,0]],
  [1500000,  [19520,0,0,0,0,0,0,0,0,0,0]],
  [1800000,  [35390,0,0,0,0,0,0,0,0,0,0]],
  [2100000,  [62600,14130,0,0,0,0,0,0,0,0,0]],
  [2400000,  [99620,50780,2480,0,0,0,0,0,0,0,0]],
  [2700000,  [143780,95350,47450,0,0,0,0,0,0,0,0]],
  [3000000,  [195720,147290,99390,51490,3590,0,0,0,0,0,0]],
  [3500000,  [280390,231960,184060,136160,88260,40360,0,0,0,0,0]],
  [4000000,  [386960,338530,290300,242400,194500,146600,98700,50800,2900,0,0]],
  [4500000,  [494630,446200,397970,350070,302170,254270,206370,158470,110570,62670,14770]],
  [5000000,  [616400,567970,519740,471840,423940,376040,328140,280240,232340,184440,136540]],
  [5500000,  [760800,712370,664140,616240,568340,520440,472540,424640,376740,328840,280940]],
  [6000000,  [926700,878270,830040,782140,734240,686340,638440,590540,542640,494740,446840]],
  [7000000,  [1250100,1201670,1153440,1105540,1057640,1009740,961840,913940,866040,818140,770240]],
  [8000000,  [1616400,1567970,1519740,1471840,1423940,1376040,1328140,1280240,1232340,1184440,1136540]],
  [9000000,  [2047400,1998970,1950740,1902840,1854940,1807040,1759140,1711240,1663340,1615440,1567540]],
  [10000000, [2530100,2481670,2433440,2385540,2337640,2289740,2241840,2193940,2146040,2098140,2050240]],
  [Infinity, [3013300,2964870,2916640,2868740,2820840,2772940,2725040,2677140,2629240,2581340,2533440]],
];

function getIncomeTax(monthly, dependents, children) {
  const dep = Math.min(Math.max(dependents, 1), 11);
  for (const [limit, taxes] of INCOME_TAX_TABLE) {
    if (monthly <= limit) {
      let tax = taxes[dep - 1] || 0;
      // 8세~20세 자녀 세액공제: 첫째 12,500, 둘째 12,500, 셋째+ 25,000
      if (children >= 1) tax -= 12500;
      if (children >= 2) tax -= 12500;
      if (children >= 3) tax -= 25000 * (children - 2);
      return Math.max(0, Math.round(tax));
    }
  }
  return 0;
}

const DeductCalc = {
  compute(gross, dependents, children) {
    // 2026년 기준 요율
    // 국민연금: 9.5% 중 근로자 4.75% (상한 6,370,000원)
    const pensionBase = Math.min(gross, 6370000);
    const pension       = Math.round(pensionBase * 0.0475);
    // 건강보험: 7.19% 중 근로자 3.595% (원 단위 절사)
    const health        = Math.floor(gross * 0.03595);
    // 장기요양보험: 건보료 × (0.9448% / 7.19%) = 건보료 × 13.14% (원 단위 절사)
    const ltc           = Math.floor(health * 0.1314);
    // 고용보험: 0.9%
    const employment    = Math.round(gross * 0.009);
    const incomeTax     = getIncomeTax(gross, dependents, children);
    const localTax      = Math.round(incomeTax * 0.1);

    const totalDeduct = pension + health + ltc + employment + incomeTax + localTax;
    const net = gross - totalDeduct;

    return { pension, health, ltc, employment, incomeTax, localTax, totalDeduct, net };
  },
};

const DEDUCT_INFO = [
  {
    key: 'pension',
    name: '국민연금',
    rateStr: '4.75%',
    desc: '만 60세 이후 매달 연금으로 돌려받는 노후 보험. 2026년부터 총 요율이 9% → 9.5%로 인상되어 근로자·사업주 각각 4.75% 부담. 상한액 월 637만원 적용.',
    myRate: '4.75%',
    companyRate: '4.75%',
  },
  {
    key: 'health',
    name: '건강보험',
    rateStr: '3.595%',
    desc: '병원 갈 때 본인부담금을 낮춰주는 보험. 2026년 총 요율 7.09% → 7.19%로 인상. 근로자·사업주 각각 3.595% 부담. 원 단위 절사.',
    myRate: '3.595%',
    companyRate: '3.595%',
  },
  {
    key: 'ltc',
    name: '장기요양보험',
    rateStr: '건보료 × 13.14%',
    desc: '노인·장애인 등 장기요양이 필요한 사람을 위한 보험. 2026년 12.95% → 13.14%로 인상. 건강보험료에 요율을 곱해서 계산. 원 단위 절사.',
    myRate: '건보료 × 13.14%',
    companyRate: '건보료 × 13.14%',
  },
  {
    key: 'employment',
    name: '고용보험',
    rateStr: '0.9%',
    desc: '실직했을 때 실업급여를 받을 수 있게 해주는 보험. 2026년 동결. 본인 0.9%, 회사 1.15%+α(규모에 따라 추가). 육아휴직급여도 여기서 나옴.',
    myRate: '0.9%',
    companyRate: '1.15%~',
  },
  {
    key: 'incomeTax',
    name: '소득세',
    rateStr: '간이세액표 기준',
    desc: '국가에 내는 세금. 월급여와 부양가족 수에 따라 국세청 간이세액표로 계산. 연말정산에서 실제 납부세액과 비교해 환급 또는 추징됨.',
    myRate: '간이세액표',
    companyRate: '—',
  },
  {
    key: 'localTax',
    name: '지방소득세',
    rateStr: '소득세 × 10%',
    desc: '소득세의 10%를 지방자치단체에 납부하는 세금. 국세청이 아닌 시/군/구청에 귀속됨. 소득세와 함께 원천징수됨.',
    myRate: '소득세 × 10%',
    companyRate: '—',
  },
];

const DeductUI = {
  render(gross, result) {
    document.getElementById('ds-gross').textContent = formatKRW(gross);
    document.getElementById('ds-net').textContent = formatKRW(result.net);
    document.getElementById('ds-total-deduct').textContent = '-' + formatKRW(result.totalDeduct);
    document.getElementById('deduct-result-block').style.display = 'block';

    const container = document.getElementById('deduct-items');
    container.innerHTML = '';

    DEDUCT_INFO.forEach(info => {
      const amount = result[info.key];
      const item = document.createElement('div');
      item.className = 'deduct-item';
      item.innerHTML = `
        <div class="deduct-item-header">
          <div class="deduct-item-left">
            <div class="deduct-item-name">${info.name}</div>
            <div class="deduct-item-rate">${info.rateStr}</div>
          </div>
          <div class="deduct-item-right">
            <div class="deduct-item-amount">-${formatKRW(amount)}</div>
            <div class="deduct-item-chevron">▼</div>
          </div>
        </div>
        <div class="deduct-item-body">
          <div class="deduct-item-desc">${info.desc}</div>
          <div class="deduct-item-detail">
            <div class="deduct-detail-chip">내 부담 <span>${info.myRate}</span></div>
            <div class="deduct-detail-chip">회사 부담 <span>${info.companyRate}</span></div>
          </div>
        </div>
      `;
      item.querySelector('.deduct-item-header').addEventListener('click', () => {
        item.classList.toggle('open');
      });
      container.appendChild(item);
    });
  },
};

// ===========================
// NUMBER FORMAT UTILS — end
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
    if (saved.salary) {
      const n = parseInt(String(saved.salary).replace(/,/g, ''), 10);
      if (!isNaN(n)) {
        document.getElementById('salary').value = n.toLocaleString('ko-KR');
        const reading = document.getElementById('setup-salary-reading');
        if (reading) reading.textContent = readKorean(n);
      }
    }
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
  const salary = parseFloat(document.getElementById('salary').value.replace(/,/g, ''));

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

  // setup salary 포맷 + 한글 읽기
  const setupSalaryInput = document.getElementById('salary');
  const setupSalaryReading = document.getElementById('setup-salary-reading');

  setupSalaryInput.addEventListener('input', () => {
    const raw = setupSalaryInput.value.replace(/,/g, '');
    if (!/^\d*$/.test(raw)) {
      setupSalaryInput.value = setupSalaryInput.value.replace(/[^\d,]/g, '');
      return;
    }
    const num = parseInt(raw, 10);
    if (raw && !isNaN(num)) {
      setupSalaryInput.value = num.toLocaleString('ko-KR');
      setupSalaryReading.textContent = readKorean(num);
    } else {
      setupSalaryReading.textContent = '';
    }
  });

  // 탭 전환
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  // 급여 입력 — 쉼표 포맷 + 한글 읽기
  const deductSalaryInput = document.getElementById('deduct-salary');
  const salaryReading = document.getElementById('salary-reading');

  function updateDeductCalc() {
    const raw = deductSalaryInput.value.replace(/,/g, '');
    const num = parseInt(raw, 10);

    // 쉼표 포맷
    if (raw && !isNaN(num)) {
      deductSalaryInput.value = num.toLocaleString('ko-KR');
      salaryReading.textContent = readKorean(num);
    } else {
      salaryReading.textContent = '';
    }

    const dependents = parseInt(document.getElementById('deduct-dependents').value, 10) || 1;
    const children = parseInt(document.getElementById('deduct-children').value, 10) || 0;

    if (num > 0) {
      const result = DeductCalc.compute(num, dependents, children);
      DeductUI.render(num, result);
    } else {
      document.getElementById('deduct-result-block').style.display = 'none';
    }
  }

  deductSalaryInput.addEventListener('input', (e) => {
    // 커서 위치 보정
    const raw = e.target.value.replace(/,/g, '');
    if (!/^\d*$/.test(raw)) {
      e.target.value = e.target.value.replace(/[^\d,]/g, '');
    }
    updateDeductCalc();
  });

  document.getElementById('deduct-dependents').addEventListener('input', updateDeductCalc);
  document.getElementById('deduct-children').addEventListener('input', updateDeductCalc);

  // 기존 월급값 자동 채우기
  const saved = Storage.load();
  if (saved && saved.salary) {
    const n = parseInt(saved.salary, 10);
    if (n > 0) {
      deductSalaryInput.value = n.toLocaleString('ko-KR');
      salaryReading.textContent = readKorean(n);
    }
  }

  // 환율
  document.getElementById('currency-select').addEventListener('change', (e) => {
    state.currency = e.target.value;
    const s = Storage.load() || {};
    Storage.save({ ...s, currency: state.currency });
  });

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
  if (saved) {
    UI.fillSetupForm(saved);
    if (saved.currency) state.currency = saved.currency;
  }
});
