import { RATE, BLOCKS, CAPACITY, todayISO, addDays, daysBetween, seedData, emptyData, deletePayment, deleteExpense, validateState, roomList, residentStatus, getSummary, addResident, recordPayment, checkoutResident, addExpense, roomOccupants, generateDocxReport } from './engine.mjs';

const STORAGE_KEY = 'makon.hostel.v2';
const $ = (selector) => document.querySelector(selector);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (value) => Math.round(value || 0).toLocaleString('ru-RU');
const compact = (value) => value >= 1000000 ? `${(value / 1000000).toLocaleString('ru-RU', {maximumFractionDigits: 1})} mln` : `${money(value / 1000)} ming`;
const monthNames = ['yanvar','fevral','mart','aprel','may','iyun','iyul','avgust','sentabr','oktabr','noyabr','dekabr'];
const monthShort = ['yan','fev','mar','apr','may','iyn','iyl','avg','sen','okt','noy','dek'];
const fmtDate = (value, year = false) => { if (!value) return '—'; const [y,m,d] = value.split('-').map(Number); return `${d} ${monthShort[m-1]}${year ? ` ${y}` : ''}`; };
const fullName = (r) => `${r.firstName} ${r.lastName}`;
const initials = (r) => escapeHTML(`${r.firstName[0] || ''}${r.lastName[0] || ''}`);
const roomName = (r) => `${r.block} blok · ${r.room}-xona`;
const names = {dashboard:'Boshqaruv',rooms:'Xonalar',residents:'Bolalar',vacancies:'Bo‘sh joylar',debtors:'Qarzdorlar',expenses:'Xarajatlar'};
const svgPaths = {
  plus:'M12 5v14m-7-7h14', arrow:'m7 17 10-10M7 7h10v10', right:'m9 5 7 7-7 7', left:'m15 5-7 7 7 7',
  wallet:'M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6m18 7h-5v4h5m-3-2h.01',
  clock:'M12 8v4l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  receipt:'M6 3h12v18l-3-2-3 2-3-2-3 2V3m3 5h6m-6 4h6m-6 4h3',
  chart:'M4 4v16h16M8 15l4-5 4 2 4-7', users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M13 3.13a4 4 0 0 1 0 7.75M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  bed:'M3 18v3m18-3v3M3 10V3m0 11h18v4H3v-4m0-4h4a3 3 0 0 1 3 3v1m0-6h8a3 3 0 0 1 3 3v3',
  search:'m21 21-5.2-5.2M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
  close:'m6 6 12 12M6 18 18 6', check:'m5 12 4 4L19 6', calendar:'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  phone:'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7 12.8 12.8 0 0 0 .7 2.8 2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5 12.8 12.8 0 0 0 2.8.7 2 2 0 0 1 1.8 2.1',
  building:'M4 22V4h12v18M8 8h4m-4 4h4m-4 4h4m4-7h4v13M2 22h20',
  logout:'M9 21H4V3h5m7 14 5-5-5-5m5 5H9', info:'M12 11v6m0-10h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  bolt:'m13 2-9 12h7l-1 8 10-12h-7l1-8', tax:'m3 10 9-7 9 7M4 10h16M5 10v9m7-9v9m7-9v9M3 21h18', box:'m12 3 9 5v9l-9 5-9-5V8l9-5m-9 5 9 5 9-5m-9 5v9',
  card:'M2 8h20M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2m2 12h4',
  lock:'M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2m-3 0V7a4 4 0 0 0-8 0v4',
  send:'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z'
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${svgPaths[name] || svgPaths.building}"/></svg>`;

let state;
let storageAvailable = true;
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  state = saved ? JSON.parse(saved) : (globalThis.__FORCE_SEED__ ? seedData() : emptyData());
  if (state.version !== 1 || !Array.isArray(state.residents) || !Array.isArray(state.payments) || !Array.isArray(state.expenses)) throw new Error('invalid');
  if (!state.settings) state.settings = { monthlyRate: RATE, pin: '1234' };
  if (!state.settings.monthlyRate) state.settings.monthlyRate = RATE;
  if (!state.settings.pin) state.settings.pin = '1234';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
} catch {
  state = globalThis.__FORCE_SEED__ ? seedData() : emptyData();
  if (!state.settings) state.settings = { monthlyRate: RATE, pin: '1234' };
  storageAvailable = false;
}
let page = Object.keys(names).includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
let selectedPeriod = 'last30';
let customFrom = addDays(todayISO(), -29), customTo = todayISO();
let blockFilter = 'all', statusFilter = 'all', categoryFilter = 'all', query = '';

const statusOf = (r) => residentStatus(state, r, todayISO());

function mutate(action, successMessage) {
  try {
    action(state);
    if (storageAvailable) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    closeModal();
    render();
    if (successMessage) toast(successMessage);
  } catch (error) {
    const errorField = $('#form-error');
    if (errorField) {
      errorField.hidden = false;
      errorField.textContent = error.message || 'Xatolik yuz berdi.';
    } else {
      toast(error.message || 'Xatolik yuz berdi.');
    }
  }
}

function updateSidebarTariff() {
  const el = $('#sidebar-tariff');
  if (el) el.innerHTML = `${money(state.settings?.monthlyRate || RATE)} <small>so‘m</small>`;
}

/* ==========================================================================
   PIN LOCK SCREEN LOGIC
   ========================================================================== */
let enteredPin = '';
const isTestEnv = typeof globalThis !== 'undefined' && (globalThis.__FORCE_SEED__ || globalThis.__TEST_MODE__ || (typeof window !== 'undefined' && !window.navigator?.userAgent));

function updatePinDots() {
  const dots = document.querySelectorAll('#pin-dots .pin-dot');
  dots.forEach((dot, idx) => {
    if (idx < enteredPin.length) dot.classList.add('filled');
    else dot.classList.remove('filled');
  });
}

function handlePinDigit(digit) {
  if (enteredPin.length >= 4) return;
  enteredPin += digit;
  updatePinDots();
  const pinError = $('#pin-error');
  if (pinError) pinError.textContent = '';

  if (enteredPin.length === 4) {
    const correctPin = state.settings?.pin || '1234';
    if (enteredPin === correctPin) {
      unlockApp();
    } else {
      const dotsContainer = $('#pin-dots');
      if (dotsContainer) dotsContainer.classList.add('error', 'shake');
      if (pinError) pinError.textContent = 'Parol noto‘g‘ri! Qayta urining.';
      setTimeout(() => {
        enteredPin = '';
        updatePinDots();
        if (dotsContainer) dotsContainer.classList.remove('error', 'shake');
      }, 500);
    }
  }
}

function handlePinDelete() {
  if (enteredPin.length > 0) {
    enteredPin = enteredPin.slice(0, -1);
    updatePinDots();
    const pinError = $('#pin-error');
    if (pinError) pinError.textContent = '';
  }
}

function unlockApp() {
  const screen = $('#pin-lock-screen');
  if (screen) screen.classList.add('unlocked');
  enteredPin = '';
  updatePinDots();
  const pinError = $('#pin-error');
  if (pinError) pinError.textContent = '';
}

function lockApp() {
  const screen = $('#pin-lock-screen');
  if (screen) screen.classList.remove('unlocked');
  enteredPin = '';
  updatePinDots();
  const pinError = $('#pin-error');
  if (pinError) pinError.textContent = '';
}

if (isTestEnv) {
  unlockApp();
}

/* ==========================================================================
   UZBEK CALENDAR MODAL
   ========================================================================== */
const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const UZ_WEEKDAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];
let activeDateInput = null;
let calYear = 2026, calMonth = 10, calSelected = todayISO();

function openUzbekDatePicker(targetInput) {
  activeDateInput = targetInput;
  const currentVal = targetInput.value || todayISO();
  const parts = currentVal.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0])) {
    calYear = parts[0];
    calMonth = parts[1] - 1;
    calSelected = currentVal;
  } else {
    const today = todayISO().split('-').map(Number);
    calYear = today[0];
    calMonth = today[1] - 1;
    calSelected = todayISO();
  }
  renderUzbekCalendar();
  const dialog = $('#uz-calendar-modal');
  if (dialog && typeof dialog.showModal === 'function') {
    dialog.showModal();
  }
}

function closeUzbekCalendar() {
  const dialog = $('#uz-calendar-modal');
  if (dialog && typeof dialog.close === 'function') {
    dialog.close();
  }
}

function renderUzbekCalendar() {
  const dialog = $('#uz-calendar-modal');
  if (!dialog) return;
  const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayISO();
  const maxDate = activeDateInput?.max || '';
  const minDate = activeDateInput?.min || '';

  let cellsHtml = '';
  for (let i = 0; i < firstDayIndex; i++) {
    cellsHtml += '<div class="uz-day-cell disabled"></div>';
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${calYear}-${String(calMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isSelected = iso === calSelected;
    const isToday = iso === today;
    const isDisabled = (maxDate && iso > maxDate) || (minDate && iso < minDate);
    cellsHtml += `<button type="button" class="uz-day-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" data-cal-date="${iso}" ${isDisabled ? 'disabled' : ''}>${day}</button>`;
  }

  dialog.innerHTML = `
    <div class="uz-calendar-header">
      <button type="button" class="uz-cal-nav" data-cal-nav="prev" title="Oldingi oy">‹</button>
      <h3>${UZ_MONTHS[calMonth]} ${calYear}</h3>
      <button type="button" class="uz-cal-nav" data-cal-nav="next" title="Keyingi oy">›</button>
    </div>
    <div class="uz-calendar-body">
      <div class="uz-weekdays-row">
        ${UZ_WEEKDAYS.map(w => `<span>${w}</span>`).join('')}
      </div>
      <div class="uz-days-grid">
        ${cellsHtml}
      </div>
    </div>
    <div class="uz-calendar-footer">
      <button type="button" class="btn ghost small" data-cal-action="cancel">Bekor qilish</button>
      <button type="button" class="btn secondary small" data-cal-action="today">Bugun</button>
      <button type="button" class="btn primary small" data-cal-action="confirm">Tanlash</button>
    </div>
  `;
}

function applySelectedDate(val) {
  if (activeDateInput) {
    activeDateInput.value = val;
    try {
      const Ev = (typeof window !== 'undefined' && window.Event) ? window.Event : Event;
      activeDateInput.dispatchEvent(new Ev('input', { bubbles: true }));
      activeDateInput.dispatchEvent(new Ev('change', { bubbles: true }));
    } catch {}
  }
  closeUzbekCalendar();
}

/* ==========================================================================
   TELEGRAM SHARING LOGIC (.json & .docx)
   ========================================================================== */
async function sendBackupToTelegram() {
  try {
    const dataStr = JSON.stringify(state, null, 2);
    const fileName = `makon-zaxira-${todayISO()}.json`;
    const blob = new Blob([dataStr], { type: 'application/json' });
    const file = new File([blob], fileName, { type: 'application/json' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Makon — Zaxira nusxasi',
          text: `Makon yotoqxona tizimi zaxira nusxasi (${todayISO()}).`
        });
        toast('Zaxira fayli yuborildi.');
        return;
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') return;
      }
    }

    // Fallback: download and prompt
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Zaxira fayli yuklandi. Telegram ochilmoqda...');
    setTimeout(() => {
      try { window.open('tg://msg', '_blank'); } catch {}
    }, 400);
  } catch {
    toast('Zaxira yuborishda xatolik yuz berdi.');
  }
}

async function sendReportToTelegram() {
  try {
    const docxBytes = generateDocxReport(state, todayISO());
    const fileName = `makon-hisobot-${todayISO()}.docx`;
    const blob = new Blob([docxBytes], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    const file = new File([blob], fileName, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: 'Makon — To‘liq hisobot',
          text: `Makon yotoqxona to‘liq hisoboti (${todayISO()}).`
        });
        toast('Hisobot fayli yuborildi.');
        return;
      } catch (shareErr) {
        if (shareErr.name === 'AbortError') return;
      }
    }

    // Fallback: download and prompt
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast('Hisobot (.docx) yuklandi. Telegram ochilmoqda...');
    setTimeout(() => {
      try { window.open('tg://msg', '_blank'); } catch {}
    }, 400);
  } catch (err) {
    toast('Hisobot yaratishda xatolik: ' + (err?.message || 'Xatolik'));
  }
}

function importBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const incoming = JSON.parse(e.target.result);
      validateState(incoming);
      if (!incoming.settings) incoming.settings = { monthlyRate: RATE, pin: '1234' };
      if (storageAvailable) localStorage.setItem(STORAGE_KEY, JSON.stringify(incoming));
      state = incoming;
      closeModal();
      go('dashboard');
      toast('Ma’lumotlar zaxiradan to‘liq tiklandi!');
    } catch (err) {
      alert('Zaxira fayli yaroqsiz: ' + (err?.message || 'Xatolik'));
    }
  };
  reader.readAsText(file);
}

function render() {
  const dates = dateRange();
  const s = getSummary(state, dates.from, dates.to, todayISO());
  updateSidebar(s);
  updateSidebarTariff();
  $('#breadcrumb').textContent = names[page];
  $('#top-date').textContent = fmtDate(todayISO(), true);
  document.querySelectorAll('.side-nav button, .mobile-nav button').forEach(b => {
    const match = b.dataset.nav === page;
    b.classList.toggle('active', match);
    if (match) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const views = {
    dashboard: renderDashboard,
    rooms: renderRooms,
    residents: renderResidents,
    vacancies: renderVacancies,
    debtors: renderDebtors,
    expenses: renderExpenses,
  };
  $('#app').innerHTML = (views[page] || renderDashboard)(s, dates);
}

function updateSidebar(s) {
  $('#nav-vacancies').textContent = s.vacant;
  $('#nav-debtors').textContent = s.debtors;
}

function dateRange() {
  const today = todayISO();
  if (selectedPeriod === 'today') return { from: today, to: today, label: 'Bugun' };
  if (selectedPeriod === 'thisMonth') return { from: `${today.slice(0, 7)}-01`, to: today, label: 'Shu oy' };
  if (selectedPeriod === 'last30') return { from: addDays(today, -29), to: today, label: 'So‘nggi 30 kun' };
  return { from: customFrom, to: customTo, label: `${fmtDate(customFrom, true)} — ${fmtDate(customTo, true)}` };
}

function go(target) {
  page = target;
  location.hash = `#${page}`;
  try { history.replaceState(null, '', `#${page}`); } catch {}
  window.scrollTo({ top: 0, behavior: 'smooth' });
  render();
}

function toast(message) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('visible');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('visible'), 2600);
}

const statusBadge = (r) => {
  const st = statusOf(r);
  if (!r.active) return '<span class="badge left">Ketgan</span>';
  if (st.status === 'debt') return '<span class="badge debt">Qarzdor</span>';
  if (st.status === 'soon') return `<span class="badge soon">${st.daysUntilDue === 0 ? 'Bugun to‘lov' : `${st.daysUntilDue} kun qoldi`}</span>`;
  return '<span class="badge paid">To‘langan</span>';
};

const empty = (title, message, iconName = 'bed') => `
  <div class="empty-state">
    <span class="empty-icon">${icon(iconName)}</span>
    <h3>${title}</h3>
    <p>${message}</p>
  </div>`;

const personRow = (r) => {
  const st = statusOf(r);
  return `
    <div class="person-row">
      <span class="avatar sage">${initials(r)}</span>
      <div class="person-info">
        <strong>${escapeHTML(fullName(r))}</strong>
        <span>${roomName(r)} · ${escapeHTML(r.phone)}</span>
      </div>
      <div class="person-amount">
        <strong class="${st.owed ? 'red-text' : 'green-text'}">${st.owed ? `${money(st.owed)} so‘m qarz` : 'To‘langan'}</strong>
        <small>${st.nextDue ? `Keyingi to‘lov: ${fmtDate(st.nextDue)}` : 'Chiqarilgan'}</small>
      </div>
      <button class="btn secondary small" data-action="pay" data-id="${r.id}">To‘lov</button>
    </div>`;
};

const statCard = (title, amount, sub, iconName, featured = false) => `
  <div class="stat-card ${featured ? 'featured' : ''}">
    <div class="stat-card-top">
      <span class="stat-title">${title}</span>
      <span class="stat-icon">${icon(iconName)}</span>
    </div>
    <div class="stat-amount stat-value">${money(amount)} <small>so‘m</small></div>
    <div class="stat-sub">${sub}</div>
  </div>`;

function renderDashboard(s, { from, to }) {
  const pct = Math.round((s.occupied / CAPACITY) * 100);
  const debtList = state.residents.filter(r => r.active && statusOf(r).status === 'debt');
  const soonList = state.residents.filter(r => r.active && statusOf(r).status === 'soon');
  const periodPayments = state.payments.filter(p => p.date >= from && p.date <= to && p.date <= todayISO()).map(p => ({ ...p, type: 'payment' }));
  const periodExpenses = state.expenses.filter(e => e.date >= from && e.date <= to && e.date <= todayISO()).map(e => ({ ...e, type: 'expense' }));
  const activities = [...periodPayments, ...periodExpenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);

  return `
    <div class="page-heading">
      <div>
        <h1>Boshqaruv paneli</h1>
        <p>Yotoqxonaning barcha asosiy ko‘rsatkichlari bitta joyda</p>
      </div>
      <div class="heading-actions">
        <label class="period-select">
          ${icon('calendar')}
          <select id="period" aria-label="Hisobot davri">
            <option value="today" ${selectedPeriod === 'today' ? 'selected' : ''}>Bugun</option>
            <option value="last30" ${selectedPeriod === 'last30' ? 'selected' : ''}>So‘nggi 30 kun</option>
            <option value="thisMonth" ${selectedPeriod === 'thisMonth' ? 'selected' : ''}>Shu oy</option>
            <option value="custom" ${selectedPeriod === 'custom' ? 'selected' : ''}>Boshqa davr...</option>
          </select>
        </label>
        <button class="btn secondary" data-action="add-expense">${icon('plus')}Xarajat qo‘shish</button>
        <button class="btn primary" data-action="payment-picker">${icon('wallet')}To‘lov qabul qilish</button>
      </div>
    </div>
    <div class="stats-grid">
      ${statCard('Yig‘ilgan to‘lov', s.collected, `${fmtDate(from)} – ${fmtDate(to)} oralig‘ida`, 'wallet', true)}
      ${statCard('Qolgan qarz', s.owed, `<span class="red-text">${s.debtors} ta boladan</span> olinishi kerak`, 'clock')}
      ${statCard('Jami xarajat', s.expenses, 'Tanlangan davr uchun', 'receipt')}
      ${statCard('Sof foyda', s.profit, 'Tushum − xarajat', 'chart')}
    </div>
    <div class="dashboard-grid">
      <section class="card finance-card">
        <div class="card-header">
          <div><h2 class="card-title">Moliyaviy holat</h2><p class="card-subtitle">${fmtDate(from, true)} — ${fmtDate(to, true)}</p></div>
          <div class="legend"><span><i class="legend-dot green"></i>Tushum</span><span><i class="legend-dot pale"></i>Xarajat</span></div>
        </div>
        <div class="card-body">
          <div class="chart-total">${money(s.collected)} <small>so‘m</small><span>jami tushum</span></div>
          <div class="chart-container">${chartMarkup()}</div>
        </div>
      </section>
      <section class="card">
        <div class="card-header">
          <div><h2 class="card-title">Yotoqxona bandligi</h2><p class="card-subtitle">3 ta blok · 46 ta xona · 184 ta o‘rin</p></div>
          <span class="stat-icon">${icon('building')}</span>
        </div>
        <div class="card-body occupancy-body">
          <div class="occupancy-total">
            <div class="occupancy-ring" style="--fill:${pct}%"><div class="occupancy-center"><strong>${pct}%</strong><span>band</span></div></div>
            <div class="occupancy-key">
              <div><i class="legend-dot green"></i><span>Band o‘rinlar</span><strong>${s.occupied}</strong></div>
              <div><i class="legend-dot pale"></i><span>Bo‘sh o‘rinlar</span><strong>${s.vacant}</strong></div>
              <button class="section-link" data-nav="vacancies">Bo‘sh joylarni ko‘rish ${icon('right')}</button>
            </div>
          </div>
          ${BLOCKS.map(b => {
            const count = state.residents.filter(r => r.active && r.block === b.id).length;
            return `
              <div class="occupancy-block">
                <div class="block-row"><span><b>${b.id}</b> blok</span><span><strong>${count}</strong> / ${b.rooms * 4} o‘rin</span></div>
                <div class="progress-track"><div class="progress-fill" style="width:${(count / (b.rooms * 4)) * 100}%"></div></div>
              </div>`;
          }).join('')}
        </div>
      </section>
    </div>
    <div class="dashboard-grid payments-grid">
      <section class="card">
        <div class="card-header">
          <div><h2 class="card-title">To‘lov kutilmoqda <span class="count-pill">${s.debtors + s.dueSoon}</span></h2><p class="card-subtitle">Qarzdorlar va to‘loviga 5 kun qolgan bolalar</p></div>
          <button class="section-link" data-nav="debtors">Barchasi ${icon('right')}</button>
        </div>
        <div class="payment-list">
          ${[...debtList.slice(0, 3), ...soonList.slice(0, 2)].map(r => personRow(r)).join('') || empty('To‘lovlar joyida', 'Hozircha qarzdorlar va yaqin to‘lovlar yo‘q.', 'check')}
        </div>
        ${s.dueSoon ? `<button class="upcoming-note" data-action="notifications">${icon('clock')}<span><strong>${s.dueSoon} ta bolaning</strong> navbatdagi to‘lovi yaqinlashmoqda</span>${icon('right')}</button>` : ''}
      </section>
      <section class="card">
        <div class="card-header">
          <div><h2 class="card-title">So‘nggi amaliyotlar</h2><p class="card-subtitle">Tanlangan davrdagi kirim va chiqimlar</p></div>
          <span class="stat-icon">${icon('receipt')}</span>
        </div>
        <div class="activity-list">
          ${activities.map(p => {
            const r = state.residents.find(r => r.id === p.residentId);
            const cancelBtn = p.type === 'payment'
              ? `<button type="button" class="btn ghost small" data-action="delete-payment-confirm" data-id="${p.id}" data-resident-id="${p.residentId}" style="padding:3px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;margin-left:8px;" title="To‘lovni bekor qilish">${icon('close')} Bekor qilish</button>`
              : `<button type="button" class="btn ghost small" data-action="delete-expense-confirm" data-id="${p.id}" style="padding:3px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;margin-left:8px;" title="Xarajatni bekor qilish">${icon('close')} Bekor qilish</button>`;
            return `
              <div class="activity-item">
                <div class="activity-icon ${p.type === 'payment' ? 'income' : 'outgoing'}">${icon(p.type === 'payment' ? 'wallet' : 'receipt')}</div>
                <div class="activity-details">
                  <strong>${escapeHTML(p.type === 'payment' ? (r ? fullName(r) : 'To‘lov') : p.name)}</strong>
                  <span>${p.type === 'payment' ? 'To‘lov qabul qilindi' : categoryName(p.category)} · ${fmtDate(p.date)}</span>
                </div>
                <div style="display:flex;align-items:center;">
                  <div class="activity-amount ${p.type === 'payment' ? 'green-text' : ''}">${p.type === 'payment' ? '+' : '−'}${money(p.amount)}<small>so‘m</small></div>
                  ${cancelBtn}
                </div>
              </div>`;
          }).join('') || empty('Amaliyotlar yo‘q', 'Bu davrda to‘lov yoki xarajat kiritilmagan.', 'receipt')}
        </div>
        <div class="list-footer">${icon('info')} Barcha summalar O‘zbekiston so‘mida ko‘rsatilgan</div>
      </section>
    </div>`;
}

function chartMarkup() {
  const { from, to } = dateRange(), totalDays = daysBetween(from, to) + 1;
  const count = Math.min(7, totalDays), buckets = [];
  for (let i = 0; i < count; i++) {
    const start = addDays(from, Math.floor(totalDays * i / count)), end = addDays(from, Math.floor(totalDays * (i + 1) / count) - 1);
    const income = state.payments.filter(p => p.date >= start && p.date <= end).reduce((sum, p) => sum + p.amount, 0);
    const expense = state.expenses.filter(p => p.date >= start && p.date <= end).reduce((sum, p) => sum + p.amount, 0);
    buckets.push({ start, end, income, expense });
  }
  const max = Math.max(1, ...buckets.flatMap(b => [b.income, b.expense]));
  return `<div class="chart-axis"><span>${compact(max)}</span><span>${compact(max / 2)}</span><span>0</span></div><div class="bar-chart" role="img" aria-label="Tanlangan davrdagi tushum va xarajatlar diagrammasi">${buckets.map(b => `<div class="chart-column"><div class="chart-bars" tabindex="0" aria-label="${fmtDate(b.start)} – ${fmtDate(b.end)}: tushum ${money(b.income)}, xarajat ${money(b.expense)} so‘m" title="${fmtDate(b.start)} – ${fmtDate(b.end)}&#10;Tushum: ${money(b.income)} so‘m&#10;Xarajat: ${money(b.expense)} so‘m"><div class="bar income" style="height:${Math.max(b.income ? 3 : 0, (b.income / max) * 100)}%"></div><div class="bar expense" style="height:${Math.max(b.expense ? 3 : 0, (b.expense / max) * 100)}%"></div></div><span class="chart-label">${fmtDate(b.start)}</span></div>`).join('')}</div>`;
}

function renderRooms() {
  const rooms = roomList().filter(r => blockFilter === 'all' || r.block === blockFilter);
  return `
    <div class="page-heading">
      <div><h1>Xonalar va o‘rinlar</h1><p>3 ta blok bo‘yicha xonalar holati va bandligi</p></div>
      <div class="pill-filter">
        ${['all', 'A', 'B', 'C'].map(b => `<button class="${blockFilter === b ? 'active' : ''}" data-block="${b}">${b === 'all' ? 'Barcha bloklar' : `${b} blok`}</button>`).join('')}
      </div>
    </div>
    <div class="room-grid">
      ${rooms.map(room => {
        const occ = roomOccupants(state, room.block, room.room);
        const free = 4 - occ.length;
        return `
          <div class="room-card ${free === 0 ? 'full' : free === 4 ? 'empty' : 'partial'}" data-action="room" data-block-id="${room.block}" data-room="${room.room}">
            <div class="room-header">
              <div><span class="room-block-label">${room.block} blok</span><h3 class="room-title">${room.room}-xona</h3></div>
              <span class="room-pill ${free === 0 ? 'red' : 'green'}">${free === 0 ? 'To‘liq band' : `${free} ta bo‘sh`}</span>
            </div>
            <div class="bed-dots">${[0, 1, 2, 3].map(i => `<span class="bed-dot ${i < occ.length ? 'occupied' : 'vacant'}"></span>`).join('')}</div>
            <div class="room-occupants">${occ.map(r => `<span>${escapeHTML(fullName(r))}</span>`).join('') || '<span class="muted">Hozircha hech kim yo‘q</span>'}</div>
          </div>`;
      }).join('')}
    </div>`;
}

function renderResidents() {
  const list = state.residents.filter(r => {
    const st = statusOf(r);
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' && r.active) || (statusFilter === 'debt' && r.active && st.owed > 0) || (statusFilter === 'inactive' && !r.active);
    const matchesBlock = blockFilter === 'all' || r.block === blockFilter;
    const matchesQuery = !query || fullName(r).toLowerCase().includes(query.toLowerCase()) || r.phone.includes(query);
    return matchesStatus && matchesBlock && matchesQuery;
  });

  return `
    <div class="page-heading">
      <div><h1>Bolalar ro‘yxati <span class="count-pill">${list.length}</span></h1><p>Yotoqxonada yashovchi va ilgari yashagan barcha bolalar</p></div>
      <button class="btn primary" data-action="add-resident">${icon('plus')}Yangi bola qo‘shish</button>
    </div>
    <div class="filter-bar">
      <label class="search-field">${icon('search')}<input type="search" id="resident-query" placeholder="Ism, familiya yoki telefon..." value="${escapeHTML(query)}" aria-label="Bolalarni qidirish"></label>
      <div class="filter-controls">
        <select id="status-filter" aria-label="Holat bo‘yicha saralash">
          <option value="all" ${statusFilter === 'all' ? 'selected' : ''}>Barcha holatlar</option>
          <option value="active" ${statusFilter === 'active' ? 'selected' : ''}>Hozir yashayotganlar</option>
          <option value="debt" ${statusFilter === 'debt' ? 'selected' : ''}>Qarzdorlar</option>
          <option value="inactive" ${statusFilter === 'inactive' ? 'selected' : ''}>Chiqib ketganlar</option>
        </select>
        <select id="block-filter" aria-label="Blok bo‘yicha saralash">
          <option value="all" ${blockFilter === 'all' ? 'selected' : ''}>Barcha bloklar</option>
          <option value="A" ${blockFilter === 'A' ? 'selected' : ''}>A blok</option>
          <option value="B" ${blockFilter === 'B' ? 'selected' : ''}>B blok</option>
          <option value="C" ${blockFilter === 'C' ? 'selected' : ''}>C blok</option>
        </select>
      </div>
    </div>
    <div class="table-card">
      <table class="data-table">
        <thead><tr><th>Bola</th><th>Xona</th><th>Telefon</th><th>Kelgan sana</th><th>Keyingi to‘lov</th><th>Qarz</th><th>Holat</th><th></th></tr></thead>
        <tbody>
          ${list.map(r => {
            const st = statusOf(r);
            return `
              <tr data-action="profile" data-id="${r.id}">
                <td><div class="cell-person"><span class="avatar sage">${initials(r)}</span><strong>${escapeHTML(fullName(r))}</strong></div></td>
                <td><span class="room-chip">${roomName(r)}</span></td>
                <td><a href="tel:${escapeHTML(r.phone.replace(/\s/g, ''))}" class="phone-link">${escapeHTML(r.phone)}</a></td>
                <td>${fmtDate(r.joined)}</td>
                <td>${fmtDate(r.active ? st.nextDue : r.leftAt)}</td>
                <td><strong class="${st.owed ? 'red-text' : 'muted'}">${st.owed ? `${money(st.owed)} so‘m` : '—'}</strong></td>
                <td>${statusBadge(r)}</td>
                <td><button class="row-link" data-action="profile" data-id="${r.id}">${icon('right')}</button></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${!list.length ? empty('Bolalar topilmadi', 'Filtr bo‘yicha hech qanday ma’lumot chiqmadi.', 'users') : ''}
    </div>`;
}

function renderVacancies() {
  const rooms = roomList().map(r => ({ ...r, occupants: roomOccupants(state, r.block, r.room) })).filter(r => r.occupants.length < 4 && (blockFilter === 'all' || r.block === blockFilter));
  const totalFree = rooms.reduce((sum, r) => sum + (4 - r.occupants.length), 0);
  return `
    <div class="page-heading">
      <div><h1>Bo‘sh joylar <span class="count-pill">${totalFree} ta o‘rin</span></h1><p>Yangi bolalarni joylashtirish mumkin bo‘lgan xonalar</p></div>
      <div class="pill-filter">
        ${['all', 'A', 'B', 'C'].map(b => `<button class="${blockFilter === b ? 'active' : ''}" data-block="${b}">${b === 'all' ? 'Barcha bloklar' : `${b} blok`}</button>`).join('')}
      </div>
    </div>
    <div class="room-grid">
      ${rooms.map(room => {
        const free = 4 - room.occupants.length;
        return `
          <div class="room-card partial" data-action="room" data-block-id="${room.block}" data-room="${room.room}">
            <div class="room-header">
              <div><span class="room-block-label">${room.block} blok</span><h3 class="room-title">${room.room}-xona</h3></div>
              <span class="room-pill green">${free} ta bo‘sh joy</span>
            </div>
            <div class="bed-dots">${[0, 1, 2, 3].map(i => `<span class="bed-dot ${i < room.occupants.length ? 'occupied' : 'vacant'}"></span>`).join('')}</div>
            <div class="room-occupants">${room.occupants.map(r => `<span>${escapeHTML(fullName(r))}</span>`).join('') || '<span class="muted">Hozircha bo‘sh xona</span>'}</div>
            <button class="btn secondary small full-width" data-action="add-resident" data-block-id="${room.block}" data-room="${room.room}">${icon('plus')}Shu xonaga bola qo‘shish</button>
          </div>`;
      }).join('')}
    </div>
    ${!rooms.length ? empty('Bo‘sh joylar qolmadi', 'Barcha bloklardagi xonalar to‘liq band.', 'check') : ''}`;
}

function renderDebtors() {
  const debtors = state.residents.filter(r => statusOf(r).owed > 0);
  const totalDebt = debtors.reduce((sum, r) => sum + statusOf(r).owed, 0);
  return `
    <div class="page-heading">
      <div><h1>Qarzdorlar ro‘yxati <span class="count-pill">${debtors.length} ta bola</span></h1><p>Jami undirilishi kerak bo‘lgan qarz: <strong class="red-text">${money(totalDebt)} so‘m</strong></p></div>
      <button class="btn primary" data-action="payment-picker">${icon('wallet')}To‘lov qabul qilish</button>
    </div>
    <div class="table-card">
      <table class="data-table">
        <thead><tr><th>Bola</th><th>Xona</th><th>Telefon</th><th>Oxirgi to‘lov</th><th>Qarz summasi</th><th></th></tr></thead>
        <tbody>
          ${debtors.map(r => {
            const st = statusOf(r);
            return `
              <tr>
                <td><div class="cell-person"><span class="avatar sage">${initials(r)}</span><div><strong>${escapeHTML(fullName(r))}</strong>${!r.active ? '<small class="muted"> (ketgan)</small>' : ''}</div></div></td>
                <td><span class="room-chip">${roomName(r)}</span></td>
                <td><a href="tel:${escapeHTML(r.phone.replace(/\s/g, ''))}" class="phone-link">${escapeHTML(r.phone)}</a></td>
                <td>${fmtDate(st.cycleStart)}</td>
                <td><strong class="red-text">${money(st.owed)} so‘m</strong></td>
                <td><button class="btn secondary small" data-action="pay" data-id="${r.id}">${icon('wallet')}Qarzni yopish</button></td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${!debtors.length ? empty('Qarzdorlar yo‘q', 'Barcha to‘lovlar o‘z vaqtida amalga oshirilgan.', 'check') : ''}
    </div>`;
}

function renderExpenses() {
  const filtered = state.expenses.filter(e => categoryFilter === 'all' || e.category === categoryFilter).sort((a, b) => b.date.localeCompare(a.date));
  const total = filtered.reduce((sum, e) => sum + e.amount, 0);
  return `
    <div class="page-heading">
      <div><h1>Xarajatlar daftari</h1><p>Yotoqxona ehtiyojlari uchun sarflangan mablag‘lar: <strong>${money(total)} so‘m</strong></p></div>
      <button class="btn primary" data-action="add-expense">${icon('plus')}Yangi xarajat</button>
    </div>
    <div class="pill-filter">
      ${[['all', 'Barchasi'], ['utilities', 'Kommunal'], ['tax', 'Soliq'], ['other', 'Boshqa']].map(([k, label]) => `<button class="${categoryFilter === k ? 'active' : ''}" data-category="${k}">${label}</button>`).join('')}
    </div>
    <div class="table-card">
      <table class="data-table">
        <thead><tr><th>Xarajat nomi</th><th>Turi</th><th>Sana</th><th>Summasi</th><th></th></tr></thead>
        <tbody>
          ${filtered.map(e => `
            <tr>
              <td><strong>${escapeHTML(e.name)}</strong></td>
              <td><span class="tag ${e.category}">${categoryName(e.category)}</span></td>
              <td>${fmtDate(e.date)}</td>
              <td><strong class="red-text">−${money(e.amount)} so‘m</strong></td>
              <td style="text-align:right;"><button type="button" class="btn ghost small" data-action="delete-expense-confirm" data-id="${e.id}" style="padding:4px 8px;font-size:11px;color:#dc2626;border-color:#fecaca;" title="Xarajatni bekor qilish">${icon('close')} Bekor qilish</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
      ${!filtered.length ? empty('Xarajatlar yo‘q', 'Bu toifada hali xarajat kiritilmagan.', 'receipt') : ''}
    </div>`;
}

const categoryName = (c) => ({ utilities: 'Kommunal xizmat', tax: 'Soliq to‘lovi', other: 'Boshqa xarajat' }[c] || 'Xarajat');

const cancelButton = '<button type="button" class="btn ghost" data-action="close-modal">Bekor qilish</button>';

function openModal(title, bodyHTML, footerHTML = '', formId = '') {
  const modal = $('#modal');
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" data-action="close-modal" aria-label="Yopish">${icon('close')}</button>
      </div>
      ${formId ? `<form id="${formId}">` : ''}
      <div class="modal-body">${bodyHTML}<div id="form-error" class="alert danger" hidden></div></div>
      ${footerHTML ? `<div class="modal-footer">${footerHTML}</div>` : ''}
      ${formId ? '</form>' : ''}
    </div>`;
  modal.showModal();
  document.body.classList.add('modal-open');
}

function closeModal() {
  const modal = $('#modal');
  if (modal.open) modal.close();
  document.body.classList.remove('modal-open');
}

function showRoom(block, roomNumber) {
  const room = Number(roomNumber);
  const occupants = roomOccupants(state, block, room);
  const free = 4 - occupants.length;
  openModal(`${block} blok · ${room}-xona`, `
    <div class="room-modal-summary">
      <div><strong>${occupants.length} ta yashovchi</strong><span>${free} ta bo‘sh joy mavjud</span></div>
      ${free > 0 ? `<button class="btn primary small" data-action="add-resident" data-block-id="${block}" data-room="${room}">${icon('plus')}Bola qo‘shish</button>` : ''}
    </div>
    <div class="resident-slot-list">
      ${occupants.map((r, i) => `
        <div class="resident-slot">
          <span class="slot-number">${i + 1}</span>
          <span class="avatar sage">${initials(r)}</span>
          <div class="slot-info">
            <button class="slot-person" data-action="profile" data-id="${r.id}">${escapeHTML(fullName(r))}</button>
            <span class="person-meta">${fmtDate(r.joined)} da kelgan</span>
          </div>
          ${statusBadge(r)}
          <a href="tel:${escapeHTML(r.phone.replace(/\s/g, ''))}" class="phone-link">${escapeHTML(r.phone)}</a>
        </div>`).join('')}
      ${Array.from({ length: free }, (_, i) => `
        <button class="free-slot" data-action="add-resident" data-block-id="${block}" data-room="${room}">
          <span>${occupants.length + i + 1}</span>
          <span>Bo‘sh joy · Bola joylashtirish uchun bosing</span>
        </button>`).join('')}
    </div>`);
}

function showProfile(id) {
  const r = state.residents.find(r => r.id === id);
  if (!r) return;
  const s = statusOf(r);
  const payments = state.payments.filter(p => p.residentId === r.id).sort((a, b) => b.date.localeCompare(a.date));
  const currentRate = state.settings?.monthlyRate || RATE;
  openModal('Bola ma’lumotlari', `
    <div class="person-profile">
      <span class="avatar sage">${initials(r)}</span>
      <div><h3>${escapeHTML(fullName(r))}</h3><p>${roomName(r)}</p></div>
      ${statusBadge(r)}
    </div>
    <div class="detail-list">
      <div class="detail-item"><span>Telefon raqami</span><a href="tel:${escapeHTML(r.phone.replace(/\s/g, ''))}">${escapeHTML(r.phone)}</a></div>
      <div class="detail-item"><span>Kelgan sana</span><strong>${fmtDate(r.joined, true)}</strong></div>
      <div class="detail-item"><span>${r.active ? 'Keyingi to‘lov' : 'Ketgan sana'}</span><strong>${fmtDate(r.active ? s.nextDue : r.leftAt, true)}</strong></div>
      <div class="detail-item"><span>30 kunlik to‘lov</span><strong>${money(currentRate)} so‘m</strong></div>
      <div class="detail-item"><span>Jami to‘langan</span><strong class="green-text">${money(s.totalPaid)} so‘m</strong></div>
    </div>
    <div class="payment-summary ${s.owed ? 'has-debt' : ''}">
      <span>Qolgan qarz</span><strong>${money(s.owed)} <small>so‘m</small></strong>
    </div>
    <h3 class="small-heading">To‘lov tarixi <span class="count-pill">${payments.length}</span></h3>
    <div class="payment-history">
      ${payments.map(p => `
        <div class="detail-item" style="display:flex;justify-content:space-between;align-items:center;">
          <div><span>${fmtDate(p.date, true)} <small>${p.method === 'card' ? 'Karta orqali' : 'Naqd pul'}</small></span></div>
          <div style="display:flex;align-items:center;gap:10px;">
            <strong class="green-text">+${money(p.amount)} so‘m</strong>
            <button type="button" class="btn ghost small" data-action="delete-payment-confirm" data-id="${p.id}" data-resident-id="${r.id}" style="padding:4px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;" title="To‘lovni bekor qilish">${icon('close')} Bekor qilish</button>
          </div>
        </div>`).join('') || '<p class="muted">Hali to‘lov qilinmagan.</p>'}
    </div>`, `
    ${r.active ? `<button class="btn danger" data-action="checkout" data-id="${r.id}">${icon('logout')}Ketgan deb belgilash</button>` : '<span class="muted">Bola yotoqxonadan ketgan</span>'}
    ${r.active || s.owed ? `<button class="btn primary" data-action="pay" data-id="${r.id}">${icon('wallet')}${s.owed ? 'Qarzni yopish' : 'To‘lov qilish'}</button>` : ''}`);
}

function showAddResident(block = 'A', room = '') {
  const availableRooms = roomList().filter(r => roomOccupants(state, r.block, r.room).length < 4);
  if (!availableRooms.length) { toast('Barcha o‘rinlar band.'); return; }
  const preferred = availableRooms.find(r => r.block === block && r.room === Number(room)) || availableRooms.find(r => r.block === block) || availableRooms[0];
  const currentRate = state.settings?.monthlyRate || RATE;
  openModal('Yangi bola qo‘shish', `
    <p class="modal-description">Bola ma’lumotlarini kiriting va bo‘sh o‘rinni tanlang.</p>
    <div class="form-grid">
      <label class="field"><span>Ismi</span><input name="firstName" placeholder="Masalan, Azizbek" required maxlength="50" autocomplete="given-name"></label>
      <label class="field"><span>Familiyasi</span><input name="lastName" placeholder="Masalan, Karimov" required maxlength="50" autocomplete="family-name"></label>
      <label class="field full"><span>Telefon raqami</span><input name="phone" type="tel" value="+998 " placeholder="+998 90 123 45 67" required autocomplete="tel" maxlength="22"></label>
      <label class="field full"><span>Xona va blok</span>
        <select name="roomChoice">${availableRooms.map(r => `<option value="${r.block}-${r.room}" ${r.id === preferred.id ? 'selected' : ''}>${r.block} blok · ${r.room}-xona — ${4 - roomOccupants(state, r.block, r.room).length} ta bo‘sh joy</option>`).join('')}</select>
      </label>
      <label class="field"><span>Kelgan sana</span><input type="text" readonly inputmode="none" name="joined" value="${todayISO()}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label>
      <label class="field"><span>Hozir bergan puli (so‘m)</span><input type="number" name="initialPayment" inputmode="numeric" value="0" min="0" step="1000" required></label>
      <label class="field full"><span>To‘lov usuli</span><select name="method"><option value="cash">Naqd pul</option><option value="card">Karta orqali</option></select></label>
    </div>
    <div class="hint">${icon('info')} To‘lov kelgan kundan hisoblanadi: har 30 kun uchun ${money(currentRate)} so‘m. To‘lanmagan summa qarz bo‘lib qoladi.</div>
  `, `${cancelButton}<button type="submit" class="btn primary">${icon('plus')}Bolani saqlash</button>`, 'resident-form');
}

function showPaymentPicker(term = '') {
  openModal('To‘lovni kim uchun qabul qilamiz?', `
    <label class="search-field modal-search">${icon('search')}<input id="payment-search" type="search" placeholder="Ism, familiya yoki telefon..." value="${escapeHTML(term)}" aria-label="To‘lov uchun bolani qidirish" autofocus></label>
    <div id="payment-results" class="search-results"></div>
    <p class="hint">Bolani tanlang va kiritilayotgan to‘lov summasini yozing.</p>`);
  updateSearchResults(term, 'pay');
}

function residentMatches(r, term) {
  const digits = term.replace(/\D/g, '');
  const isPhone = digits.length > 0 && !/[^\d\s()+-]/.test(term);
  return !term || `${fullName(r)} ${r.lastName} ${r.phone} ${r.block}-${r.room}`.toLowerCase().includes(term) || (isPhone && r.phone.replace(/\D/g, '').includes(digits));
}

function updateSearchResults(term, action) {
  const target = action === 'pay' ? $('#payment-results') : $('#global-results');
  if (!target) return;
  const t = term.trim().toLowerCase();
  const list = state.residents.filter(r => residentMatches(r, t)).slice(0, 8);
  target.innerHTML = list.map(r => {
    const s = statusOf(r);
    return `
      <div class="search-result" data-action="${action}" data-id="${r.id}">
        <span class="avatar sage">${initials(r)}</span>
        <div><strong>${escapeHTML(fullName(r))}</strong><small>${roomName(r)} · ${escapeHTML(r.phone)}</small></div>
        <strong class="${s.owed ? 'red-text' : 'green-text'}">${s.owed ? `${money(s.owed)} so‘m qarz` : 'Qarzi yo‘q'}</strong>
        ${icon('right')}
      </div>`;
  }).join('') || '<div class="muted" style="padding:16px 0;">Mos keluvchi bola topilmadi.</div>';
}

function showPay(id) {
  const r = state.residents.find(r => r.id === id);
  if (!r) return;
  const s = statusOf(r);
  const currentRate = state.settings?.monthlyRate || RATE;
  const available = Math.max(0, s.totalCharged + (r.active ? currentRate : 0) - s.totalPaid);
  const due = s.owed || currentRate;
  openModal('To‘lov qabul qilish', `
    <input type="hidden" name="residentId" value="${r.id}">
    <div class="person-profile">
      <span class="avatar sage">${initials(r)}</span>
      <div><h3>${escapeHTML(fullName(r))}</h3><p>${roomName(r)} · Kelgan: ${fmtDate(r.joined, true)}</p></div>
      ${statusBadge(r)}
    </div>
    <label class="field full">
      <span>To‘lov summasi</span>
      <div class="currency-input"><input id="payment-amount" name="amount" type="number" value="${due}" min="1" max="${available}" step="1" inputmode="numeric" required><span>so‘m</span></div>
    </label>
    <div class="quick-amounts">
      ${[...new Set([200000, 400000, due])].filter(a => a <= available).map(a => `<button type="button" data-amount="${a}">${money(a)}${a === due ? ' · To‘liq' : ''}</button>`).join('')}
    </div>
    <div id="payment-preview" class="hint"></div>
    <div class="form-grid">
      <label class="field"><span>To‘lov usuli</span><select name="method"><option value="cash">Naqd pul</option><option value="card">Karta orqali</option></select></label>
      <label class="field"><span>To‘lov sanasi</span><input name="date" type="text" readonly inputmode="none" value="${todayISO()}" min="${r.joined}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label>
    </div>
  `, `${cancelButton}<button type="submit" class="btn primary">${icon('check')}To‘lovni saqlash</button>`, 'payment-form');
  updatePaymentPreview();
}

function updatePaymentPreview() {
  const form = $('#payment-form');
  if (!form) return;
  const r = state.residents.find(r => r.id === form.elements.residentId.value);
  const owed = statusOf(r).owed;
  const value = Number(form.elements.amount.value);
  $('#payment-preview').innerHTML = icon('info') + (value < owed ? `Qisman to‘lov. Qoladigan qarz: <strong>${money(owed - value)} so‘m.</strong>` : owed && value === owed ? 'To‘lovdan so‘ng qarz to‘liq yopiladi.' : `<span>${owed ? 'Qarz yopiladi. Ortiqcha summa' : 'Bu summa'} keyingi davr uchun avans bo‘lib saqlanadi.</span>`);
}

function showCheckout(id) {
  const r = state.residents.find(r => r.id === id);
  if (!r) return;
  const owed = statusOf(r).owed;
  openModal('Bola yotoqxonadan ketdimi?', `
    <input type="hidden" name="residentId" value="${r.id}">
    <div class="person-profile"><span class="avatar sage">${initials(r)}</span><div><h3>${escapeHTML(fullName(r))}</h3><p>${roomName(r)}</p></div></div>
    <p>Bolaning o‘rni bo‘shaydi va yangi to‘lovlar hisoblanmaydi. To‘lov tarixi saqlanadi.</p>
    ${owed ? `<div class="alert warning">${icon('info')}<span><strong>${money(owed)} so‘m qarz mavjud.</strong> Qarz o‘chirilmaydi, uni “Qarzdorlar” bo‘limidan keyin ham yopish mumkin.</span></div>` : ''}
    <p class="muted">Ketgan sana: ${fmtDate(todayISO(), true)}</p>
  `, `${cancelButton}<button type="submit" class="btn danger">Ketgan deb belgilash</button>`, 'checkout-form');
}

function showAddExpense() {
  openModal('Xarajat qo‘shish', `
    <p class="modal-description">Xarajat saqlangach, moliyaviy hisobotga qo‘shiladi.</p>
    <div class="form-grid">
      <label class="field full"><span>Xarajat nomi</span><input name="name" placeholder="Masalan, elektr energiyasi" required maxlength="100"></label>
      <label class="field full"><span>Summa (so‘m)</span><input name="amount" type="number" min="1" step="1" inputmode="numeric" placeholder="0" required></label>
      <label class="field"><span>Xarajat turi</span><select name="category"><option value="utilities">Kommunal xizmatlar</option><option value="tax">Soliq</option><option value="other">Boshqa xarajatlar</option></select></label>
      <label class="field"><span>Sana</span><input name="date" type="text" readonly inputmode="none" max="${todayISO()}" value="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label>
    </div>
  `, `${cancelButton}<button type="submit" class="btn primary">${icon('check')}Xarajatni saqlash</button>`, 'expense-form');
}

function showNotifications() {
  const soon = state.residents.filter(r => r.active && statusOf(r).status === 'soon').sort((a, b) => statusOf(a).daysUntilDue - statusOf(b).daysUntilDue);
  openModal('Yaqinlashayotgan to‘lovlar', `
    <p class="modal-description">30 kunlik davrning 25-kunidan boshlab eslatma chiqadi. ${soon.length} ta bolaning to‘lovi yaqin.</p>
    <div class="notification-list">${soon.map(r => personRow(r)).join('') || empty('Yaqin to‘lovlar yo‘q', 'To‘lovga 5 kun qolganda bolalar shu yerda ko‘rinadi.', 'check')}</div>
  `);
}

function showCustomDates() {
  openModal('Hisobot davrini tanlash', `
    <div class="form-grid">
      <label class="field"><span>Boshlanish sanasi</span><input name="from" type="text" readonly inputmode="none" value="${customFrom}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label>
      <label class="field"><span>Tugash sanasi</span><input name="to" type="text" readonly inputmode="none" value="${customTo}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label>
    </div>
    <p class="hint">Tushum, xarajat va foyda shu davr uchun hisoblanadi. Qolgan qarz va bandlik bugungi holatni ko‘rsatadi.</p>
  `, `${cancelButton}<button type="submit" class="btn primary">Qo‘llash</button>`, 'period-form');
}

function showDemoInfo() {
  const currentRate = state.settings?.monthlyRate || RATE;
  const currentPin = state.settings?.pin || '1234';
  openModal('Tizim va Zaxira (Sozlamalar)', `
    <div class="demo-brand">${icon('building')}<h3>Makon <span class="badge paid">Offline</span></h3></div>
    <p>Telefonda internetsiz ishlaydigan mustaqil yotoqxona boshqaruvi tizimi.</p>
    <div class="detail-list">
      <div class="detail-item"><span>Yotoqxona o‘rinlari</span><strong>184 ta (A: 14, B: 14, C: 18 xona)</strong></div>
      <div class="detail-item"><span>Standart oylik to‘lov</span><strong>${money(currentRate)} so‘m / 30 kun</strong></div>
      <div class="detail-item"><span>Kirish paroli</span><strong>${escapeHTML(currentPin)}</strong></div>
      <div class="detail-item"><span>Ma’lumotlar xavfsizligi</span><strong>Qurilmaning ichki xotirasida</strong></div>
    </div>

    <!-- Oylik to'lov sozlamasi -->
    <div style="margin-top:14px;padding:12px;border:1px solid #dbe9fc;border-radius:10px;background:#f8fbff;">
      <h4 style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px;">Standart oylik to‘lov miqdori</h4>
      <p style="font-size:10px;color:#475569;margin-bottom:8px;">Har bir bola uchun standart 30 kunlik to‘lov summasi.</p>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="number" id="settings-monthly-rate" value="${currentRate}" min="10000" step="10000" style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:600;">
        <button type="button" class="btn primary small" data-action="save-rate" style="white-space:nowrap;padding:8px 14px;">Saqlash</button>
      </div>
    </div>

    <!-- Telegramga yuborish va zaxira -->
    <div style="margin-top:14px;padding:14px;background:#edf5ff;border:1px solid #dbe9fc;border-radius:10px;">
      <h4 style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:6px;">Telegramga yuborish va zaxira</h4>
      <p style="font-size:10px;color:#3b82f6;line-height:1.5;margin-bottom:12px;">Ma’lumotlaringiz xavfsiz saqlanishi va hisobotlarni Word (.docx) shaklida ko‘rish uchun Telegramga yuboring.</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="btn primary" data-action="telegram-backup" style="min-height:40px;font-size:11px;display:flex;align-items:center;justify-content:center;gap:8px;">${icon('send')} Telegramga zaxirani yuborish (.json)</button>
        <button type="button" class="btn primary" data-action="telegram-report" style="min-height:40px;font-size:11px;display:flex;align-items:center;justify-content:center;gap:8px;background:#1d4ed8;">${icon('receipt')} Telegramga hisobot yuborish (.docx)</button>
        <label class="btn secondary" style="min-height:36px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">${icon('card')} Zaxiradan tiklash (.json)<input type="file" id="import-backup-input" accept=".json" style="display:none;"></label>
      </div>
    </div>

    <!-- Kirish paroli sozlamasi -->
    <div style="margin-top:14px;padding:12px;border:1px solid #dbe9fc;border-radius:10px;background:#f8fbff;">
      <h4 style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px;">Ilovaga kirish paroli</h4>
      <p style="font-size:10px;color:#475569;margin-bottom:8px;">Ilova ochilganda so‘raladigan 4 xonali PIN kod (Standart: 1234).</p>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="settings-pin" value="${escapeHTML(currentPin)}" maxlength="4" style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:600;letter-spacing:4px;text-align:center;">
        <button type="button" class="btn primary small" data-action="save-pin" style="white-space:nowrap;padding:8px 14px;">Saqlash</button>
      </div>
    </div>

    <!-- Ma'lumotlarni tozalash -->
    <div style="margin-top:14px;padding:12px;border:1px solid #e1e9f4;border-radius:10px;background:#f8fbff;">
      <h4 style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;">Baza holatini boshqarish</h4>
      <button type="button" class="btn ghost small" data-action="clear-confirm" style="color:#b91c1c;border-color:#fecaca;">Ma’lumotlarni tozalash</button>
    </div>
  `, `<button class="btn primary" data-action="close-modal">Yopish</button>`);
}

document.addEventListener('click', (event) => {
  // Calendar modal interaction
  const calDateBtn = event.target.closest('[data-cal-date]');
  if (calDateBtn) {
    calSelected = calDateBtn.dataset.calDate;
    document.querySelectorAll('#uz-calendar-modal .uz-day-cell').forEach(c => c.classList.remove('selected'));
    calDateBtn.classList.add('selected');
    return;
  }
  const calNav = event.target.closest('[data-cal-nav]');
  if (calNav) {
    if (calNav.dataset.calNav === 'prev') {
      calMonth--;
      if (calMonth < 0) { calMonth = 11; calYear--; }
    } else {
      calMonth++;
      if (calMonth > 11) { calMonth = 0; calYear++; }
    }
    renderUzbekCalendar();
    return;
  }
  const calAction = event.target.closest('[data-cal-action]');
  if (calAction) {
    const act = calAction.dataset.calAction;
    if (act === 'cancel') closeUzbekCalendar();
    else if (act === 'today') applySelectedDate(todayISO());
    else if (act === 'confirm') applySelectedDate(calSelected);
    return;
  }

  // Intercept date inputs
  const dateInput = event.target.closest('input[type="date"], [data-uz-date]');
  if (dateInput) {
    event.preventDefault();
    try { dateInput.blur(); } catch {}
    openUzbekDatePicker(dateInput);
    return;
  }

  // PIN keypad interaction
  const pinBtn = event.target.closest('[data-pin]');
  if (pinBtn) {
    const val = pinBtn.dataset.pin;
    if (val === 'delete') handlePinDelete();
    else if (/^\d$/.test(val)) handlePinDigit(val);
    return;
  }

  const target = event.target.closest('button, [data-action]');
  if (!target) return;
  if (target.dataset.nav) { go(target.dataset.nav); return; }
  if (target.dataset.block) { blockFilter = target.dataset.block; render(); return; }
  if (target.dataset.category) { categoryFilter = target.dataset.category; render(); return; }
  if (target.dataset.amount) { $('#payment-amount').value = target.dataset.amount; updatePaymentPreview(); return; }

  const { action, id } = target.dataset;
  const handlers = {
    'close-modal': closeModal,
    'room': () => showRoom(target.dataset.blockId, target.dataset.room),
    'profile': () => showProfile(id),
    'add-resident': () => showAddResident(target.dataset.blockId || 'A', target.dataset.room || ''),
    'payment-picker': () => showPaymentPicker(),
    'pay': () => showPay(id),
    'checkout': () => showCheckout(id),
    'add-expense': showAddExpense,
    'notifications': showNotifications,
    'demo-info': showDemoInfo,
    'settings-info': showDemoInfo,
    'telegram-backup': sendBackupToTelegram,
    'telegram-report': sendReportToTelegram,
    'lock-app': lockApp,
    'save-rate': () => {
      const input = $('#settings-monthly-rate');
      const val = Number(input?.value);
      if (!Number.isSafeInteger(val) || val <= 0) {
        toast('Oylik to‘lov summasini to‘g‘ri kiriting.');
        return;
      }
      mutate(next => {
        if (!next.settings) next.settings = {};
        next.settings.monthlyRate = val;
      }, `Standart oylik to‘lov saqlandi: ${money(val)} so‘m.`);
      updateSidebarTariff();
      showDemoInfo();
    },
    'save-pin': () => {
      const input = $('#settings-pin');
      const val = String(input?.value || '').trim();
      if (!/^\d{4}$/.test(val)) {
        toast('Parol 4 ta raqamdan iborat bo‘lishi kerak.');
        return;
      }
      mutate(next => {
        if (!next.settings) next.settings = {};
        next.settings.pin = val;
      }, `Yangi parol saqlandi: ${val}`);
      showDemoInfo();
    },
    'delete-payment-confirm': () => {
      const p = state.payments.find(p => p.id === id);
      if (!p) return;
      const r = state.residents.find(r => r.id === p.residentId);
      openModal('To‘lovni bekor qilish', `
        <p>Rostdan ham <strong>${escapeHTML(r ? fullName(r) : 'Bola')}</strong> uchun kiritilgan <strong>${money(p.amount)} so‘m</strong> to‘lovni bekor qilmoqchimisiz?</p>
        <p class="hint">To‘lov bekor qilinadi va bolaning qarzdorlik hisob-kitobi qayta tiklanadi.</p>
      `, `${cancelButton}<button class="btn danger" data-action="delete-payment" data-id="${p.id}" data-resident-id="${p.residentId}">Ha, to‘lovni bekor qilish</button>`);
    },
    'delete-payment': () => {
      const residentId = target.dataset.residentId;
      mutate(next => deletePayment(next, id), 'To‘lov muvaffaqiyatli bekor qilindi.');
      if (residentId && state.residents.some(r => r.id === residentId)) showProfile(residentId);
    },
    'delete-expense-confirm': () => {
      const e = state.expenses.find(e => e.id === id);
      if (!e) return;
      openModal('Xarajatni bekor qilish', `
        <p>Rostdan ham <strong>${escapeHTML(e.name)}</strong> (<strong>${money(e.amount)} so‘m</strong>) xarajatini bekor qilmoqchimisiz?</p>
        <p class="hint">Ushbu summa xarajatlar ro‘yxatidan va moliyaviy hisobotdan chiqarib tashlanadi.</p>
      `, `${cancelButton}<button class="btn danger" data-action="delete-expense" data-id="${e.id}">Ha, xarajatni bekor qilish</button>`);
    },
    'delete-expense': () => {
      mutate(next => deleteExpense(next, id), 'Xarajat muvaffaqiyatli bekor qilindi.');
    },
    'global-search': () => {
      openModal('Bolani qidirish', `
        <label class="search-field modal-search">${icon('search')}<input id="global-search" type="search" placeholder="Ism, familiya yoki telefon..." aria-label="Bolani qidirish" autofocus></label>
        <div id="global-results" class="search-results"></div>`);
      updateSearchResults('', 'profile');
    },
    'clear-confirm': () => openModal('Ma’lumotlarni tozalash', `
      <p>Barcha bolalar, to‘lovlar va xarajatlar o‘chirilib, <strong>toza bo‘sh baza</strong> yaratiladi.</p>
      <p>Xonalar va o‘rinlar saqlanadi.</p>
      <p><strong>Eslatma:</strong> Agar kerakli ma’lumotlaringiz bo‘lsa, oldin "Telegramga zaxirani yuborish" orqali nusxa oling.</p>
    `, `${cancelButton}<button class="btn danger" data-action="clear-database">Ha, ma’lumotlarni tozalash</button>`),
    'clear-database': () => {
      try {
        const next = emptyData();
        next.settings = { ...state.settings };
        if (storageAvailable) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        state = next;
        closeModal();
        go('dashboard');
        toast('Baza tozalandi.');
      } catch {
        toast('Xatolik yuz berdi.');
      }
    },
    'reset-confirm': () => openModal('Demoni qayta boshlash', `
      <p>Shu brauzerda kiritilgan bolalar, to‘lovlar va xarajatlar o‘chib, namunaviy ma’lumotlar qayta tiklanadi.</p>
      <p><strong>Bu amalni ortga qaytarib bo‘lmaydi.</strong></p>
    `, `${cancelButton}<button class="btn danger" data-action="reset-demo">Ha, qayta boshlash</button>`),
    'reset-demo': () => {
      try {
        const next = seedData();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        state = next;
        storageAvailable = true;
        closeModal();
        go('dashboard');
        toast('Demo qayta boshlandi.');
      } catch {
        toast('Brauzerda saqlash imkoni yo‘q.');
      }
    }
  };
  if (handlers[action]) handlers[action]();
});

document.addEventListener('keydown', (event) => {
  const screen = $('#pin-lock-screen');
  if (screen && !screen.classList.contains('unlocked')) {
    if (/^\d$/.test(event.key)) {
      handlePinDigit(event.key);
    } else if (event.key === 'Backspace') {
      handlePinDelete();
    }
  }
});

document.addEventListener('change', (event) => {
  if (event.target.id === 'import-backup-input' && event.target.files?.[0]) {
    importBackup(event.target.files[0]);
    return;
  }
  if (event.target.id === 'period') {
    if (event.target.value === 'custom') {
      showCustomDates();
      event.target.value = selectedPeriod;
    } else {
      selectedPeriod = event.target.value;
      render();
    }
  }
  if (event.target.id === 'block-filter') { blockFilter = event.target.value; render(); }
  if (event.target.id === 'status-filter') { statusFilter = event.target.value; render(); }
});

document.addEventListener('input', (event) => {
  if (event.target.id === 'resident-query') {
    const pos = event.target.selectionStart;
    query = event.target.value;
    render();
    const input = $('#resident-query');
    input.focus();
    try { input.setSelectionRange(pos, pos); } catch {}
  }
  if (event.target.id === 'payment-search') updateSearchResults(event.target.value, 'pay');
  if (event.target.id === 'global-search') updateSearchResults(event.target.value, 'profile');
  if (event.target.id === 'payment-amount') updatePaymentPreview();
});

document.addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target, data = Object.fromEntries(new FormData(form));
  try {
    if (form.id === 'resident-form') {
      const [block, room] = data.roomChoice.split('-'), initial = Number(data.initialPayment);
      if (!Number.isSafeInteger(initial) || initial < 0) throw new Error('Boshlang‘ich to‘lovni to‘g‘ri kiriting.');
      mutate(next => {
        const r = addResident(next, { firstName: data.firstName, lastName: data.lastName, phone: data.phone, block, room: Number(room), joined: data.joined }, todayISO());
        if (initial > 0) recordPayment(next, r.id, initial, data.method, todayISO());
      }, 'Yangi bola qo‘shildi.');
    }
    if (form.id === 'payment-form') mutate(next => recordPayment(next, data.residentId, Number(data.amount), data.method, data.date), 'To‘lov saqlandi. Hisob-kitob yangilandi.');
    if (form.id === 'checkout-form') mutate(next => checkoutResident(next, data.residentId, todayISO()), 'Bola ketgan deb belgilandi. O‘rin bo‘shadi.');
    if (form.id === 'expense-form') mutate(next => addExpense(next, { ...data, amount: Number(data.amount) }), 'Xarajat saqlandi.');
    if (form.id === 'period-form') {
      if (data.from > data.to) throw new Error('Boshlanish sanasi tugash sanasidan keyin bo‘lmasin.');
      if (data.to > todayISO()) throw new Error('Kelajakdagi sanani tanlamang.');
      customFrom = data.from;
      customTo = data.to;
      selectedPeriod = 'custom';
      closeModal();
      render();
    }
  } catch (error) {
    const field = $('#form-error');
    if (field) { field.hidden = false; field.textContent = error.message || 'Saqlashda xatolik yuz berdi.'; }
  }
});

$('#modal').addEventListener('click', event => {
  if (event.target === $('#modal')) {
    const box = $('#modal').getBoundingClientRect();
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeModal();
  }
});
$('#modal').addEventListener('close', () => document.body.classList.remove('modal-open'));

const uzCalModal = $('#uz-calendar-modal');
if (uzCalModal) {
  uzCalModal.addEventListener('click', event => {
    if (event.target === uzCalModal) {
      const box = uzCalModal.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeUzbekCalendar();
    }
  });
}

window.addEventListener('hashchange', () => {
  const next = location.hash.slice(1);
  if (names[next]) go(next);
});

window.addEventListener('storage', event => {
  if (event.key === STORAGE_KEY && event.newValue) {
    try {
      const incoming = JSON.parse(event.newValue);
      if (incoming.version === 1 && Array.isArray(incoming.residents) && Array.isArray(incoming.payments) && Array.isArray(incoming.expenses)) {
        state = incoming;
        closeModal();
        render();
        toast('Ma’lumotlar boshqa oynadan yangilandi.');
      }
    } catch {}
  }
});

render();
if (!storageAvailable) setTimeout(() => toast('Saqlash o‘chiq: ma’lumotlar faqat shu seansda qoladi.'), 800);
