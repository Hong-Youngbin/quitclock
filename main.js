/* ===========================
   QUITCLOCK — main.js
   =========================== */

// ===========================
// STATE
// ===========================

const state = {
  ticker: null,
  startTs: null,
  perSecond: 0,
  retireDate: null,
  joinDate: null,
};

// ===========================
// CALC MODULE
// ===========================

const Calc = {
  /** 초당 급여 (월급 기준, 월 22일 8시간 근무 가정) */
  perSecond(monthlySalary) {
    const WORK_DAYS = 22;
    const WORK_HOURS = 8;
    return monthlySalary / (WORK_DAYS * WORK_HOURS * 3600);
  },

  /** 지금까지 번 금액 */
  earned(startTs, perSecond) {
    const elapsed = Math.max(0, (Date.now() - startTs) / 1000);
    return elapsed * perSecond;
  },

  /** 정년 날짜 계산 (만 retireAge세 생일) */
  retireDate(birthDate, retireAge = 60) {
    const d = new Date(birthDate);
    d.setFullYear(d.getFullYear() + retireAge);
    return d;
  },

  /** 남은 시간 분해 */
  timeLeft(retireDate) {
    const msLeft = retireDate - Date.now();
    if (msLeft <= 0) return null;

    const totalSec = Math.floor(msLeft / 1000);
    const totalMins = Math.floor(totalSec / 60);
    const totalHours = Math.floor(totalMins / 60);
    const totalDays = Math.floor(totalHours / 24);

    // 년/월 계산
    const now = new Date();
    let years = retireDate.getFullYear() - now.getFullYear();
    let months = retireDate.getMonth() - now.getMonth();
    if (months < 0) { years--; months += 12; }

    return {
      years,
      months,
      totalDays,
      totalHours,
      totalMins,
      totalSec,
      secs: totalSec % 60,
      mins: totalMins % 60,
      hours: totalHours % 24,
    };
  },

  /** 직장생활 진행률 (0~100) */
  careerProgress(joinDate, retireDate) {
    const total = retireDate - joinDate;
    const elapsed = Date.now() - joinDate;
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  },
};

// ===========================
// UI MODULE
// ===========================

const UI = {
  $ : (id) => document.getElementById(id),

  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    this.$(id).classList.add('active');
  },

  setEarned(amount, perSec) {
    this.$('earned-amount').textContent = '₩' + Math.floor(amount).toLocaleString('ko-KR');
    this.$('earned-sub').textContent = `초당 ${perSec.toFixed(2)}원`;
  },

  setProgress(pct, joinDate, retireDate) {
    const fmt = (d) => d.toLocaleDateString('ko-KR', { year: '2-digit', month: 'short', day: 'numeric' });
    this.$('prog-fill').style.width = pct.toFixed(2) + '%';
    this.$('prog-pct').textContent = pct.toFixed(1) + '%';
    this.$('prog-join').textContent = fmt(joinDate);
    this.$('prog-retire').textContent = fmt(retireDate);
  },

  setRetire(t) {
    if (!t) {
      this.$('ret-ym').textContent = '정년 도달';
      this.$('ret-days').textContent = '—';
      this.$('ret-hours').textContent = '—';
      this.$('ret-mins').textContent = '—';
      this.$('ret-secs').textContent = '—';
      return;
    }
    this.$('ret-ym').textContent = `${t.years}년 ${t.months}개월`;
    this.$('ret-days').textContent = t.totalDays.toLocaleString() + '일';
    this.$('ret-hours').textContent = t.totalHours.toLocaleString();
    this.$('ret-mins').textContent = t.totalMins.toLocaleString();
    this.$('ret-secs').textContent = t.totalSec.toLocaleString();
  },

  setComment(earned, timeLeft) {
    if (!timeLeft) {
      this.$('comment-block').textContent = '수고했어. 이제 진짜 자유다.';
      return;
    }
    const pool = [
      `지금 이 순간에도 ${timeLeft.totalSec.toLocaleString()}초가 흘러가는 중`,
      `정년까지 ${timeLeft.totalMins.toLocaleString()}분 남았어. 아직 멀었다`,
      `오늘 여기서 번 돈 ₩${Math.floor(earned).toLocaleString()} — 이게 맞나 싶지?`,
      `${timeLeft.years}년 ${timeLeft.months}개월 후에 자유`,
      `커피 한 잔 마시는 사이에도 시계는 돌아가고 있음`,
      `${timeLeft.totalDays.toLocaleString()}일 뒤면 다 끝나`,
    ];
    const idx = Math.floor(Date.now() / 12000) % pool.length;
    this.$('comment-block').textContent = pool[idx];
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
  UI.showScreen('setup-screen');
}

// ===========================
// INIT
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('setup-form').addEventListener('submit', startDashboard);
  document.getElementById('reset-btn').addEventListener('click', resetDashboard);
});
