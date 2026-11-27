import { RATE, BLOCKS, CAPACITY, todayISO, addDays, daysBetween, seedData, emptyData, deletePayment, deleteExpense, validateState, roomList, residentStatus, getSummary, addResident, recordPayment, checkoutResident, addExpense, roomOccupants, generateDocxReport, generateDebtorsPdf, generateReportPdf } from './engine.mjs';

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
let query = '', blockFilter = 'all', statusFilter = 'all', categoryFilter = 'all';
let toastTimer;

function dateRange() {
  const today = todayISO(), [year,month] = today.split('-').map(Number);
  if (selectedPeriod === 'month') return {from:`${year}-${String(month).padStart(2,'0')}-01`,to:today};
  if (selectedPeriod === 'previous') {
    const end = addDays(`${year}-${String(month).padStart(2,'0')}-01`, -1);
    return {from:`${end.slice(0,7)}-01`,to:end};
  }
  if (selectedPeriod === 'year') return {from:`${year}-01-01`,to:today};
  if (selectedPeriod === 'custom') return {from:customFrom,to:customTo};
  return {from:addDays(today,-29),to:today};
}
let statusCache = new Map();
let statusDate = todayISO();
const statusOf = (resident) => {
  if (!statusCache.has(resident.id)) statusCache.set(resident.id, residentStatus(state, resident, statusDate));
  return statusCache.get(resident.id);
};
function statusBadge(r) {
  const s = statusOf(r);
  if (s.owed > 0) return `<span class="badge debt"><span></span>Qarzdor</span>`;
  if (!r.active) return '<span class="badge neutral">Ketgan</span>';
  if (s.status === 'soon') return `<span class="badge soon">${s.daysUntilDue} kun qoldi</span>`;
  return '<span class="badge paid"><span></span>To‘langan</span>';
}
function periodControl() {
  const opts = [['last30','Oxirgi 30 kun'],['month','Shu oy'],['previous','O‘tgan oy'],['year','Shu yil'],['custom','Sana tanlash']];
  return `<label class="period-select">${icon('calendar')}<select id="period" aria-label="Hisobot davri">${opts.map(([value,text])=>`<option value="${value}" ${selectedPeriod===value?'selected':''}>${text}</option>`).join('')}</select></label>`;
}
function heading(title, subtitle, actions='') {
  return `<div class="page-heading"><div><div class="eyebrow">MAKON · YOTOQXONA</div><h1>${title}</h1><p>${subtitle}</p></div><div class="heading-actions">${actions}</div></div>`;
}
const addButton = (action, label) => `<button class="btn primary" data-action="${action}">${icon('plus')}<span>${label}</span></button>`;
const empty = (title, description, name='search') => `<div class="empty-state">${icon(name)}<h3>${title}</h3><p>${description}</p></div>`;
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').innerHTML = `${icon('check')}<span>${escapeHTML(message)}</span>`;
  $('#toast').classList.add('visible');
  toastTimer = setTimeout(()=>$('#toast').classList.remove('visible'),3500);
}
function mutate(fn, success) {
  const next = structuredClone(state);
  const result = fn(next);
  if (storageAvailable) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  state = next;
  closeModal();
  render();
  toast(success);
  return result;
}
function go(next) {
  page = next;
  query = ''; blockFilter = 'all'; statusFilter = 'all'; categoryFilter = 'all';
  history.replaceState(null,'',`#${page}`);
  closeModal();
  render();
  window.scrollTo({top:0,behavior:'smooth'});
}
function render() {
  statusDate = todayISO();
  statusCache.clear();
  const summary = getSummary(state,dateRange().from,dateRange().to,todayISO());
  document.querySelectorAll('[data-nav]').forEach(el=>{el.classList.toggle('active',el.dataset.nav===page);if(el.dataset.nav===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('#breadcrumb').textContent = names[page];
  if ($('#nav-debtors')) $('#nav-debtors').textContent = summary.debtors;
  if ($('#nav-vacancies')) $('#nav-vacancies').textContent = summary.vacant;
  if ($('#sidebar-tariff')) $('#sidebar-tariff').innerHTML = `${money(state.settings?.monthlyRate || RATE)} <small>so‘m</small>`;
  if ($('#top-date')) { const [y,m,d]=todayISO().split('-').map(Number); $('#top-date').textContent=`${d} ${monthNames[m-1]}, ${y}`; }
  document.title = `${names[page]} · Makon`;
  const views = {dashboard:renderDashboard,rooms:()=>renderRooms(false),vacancies:()=>renderRooms(true),residents:()=>renderResidents(false),debtors:()=>renderResidents(true),expenses:renderExpenses};
  $('#app').innerHTML = views[page](summary);
}
function statCard(label,value,foot,name,featured=false) {
  return `<div class="stat-card ${featured?'featured':''}"><div class="stat-label">${label}<span class="stat-icon">${icon(name)}</span></div><div class="stat-value">${money(value)} <small>so‘m</small></div><div class="stat-foot">${featured?'<span class="trend">'+icon('arrow')+'</span>':''}${foot}</div></div>`;
}
function chartMarkup() {
  const {from,to}=dateRange(), totalDays=daysBetween(from,to)+1;
  const count=Math.min(7,totalDays), buckets=[];
  for(let i=0;i<count;i++) {
    const start=addDays(from,Math.floor(totalDays*i/count)), end=addDays(from,Math.floor(totalDays*(i+1)/count)-1);
    const income=state.payments.filter(p=>p.date>=start&&p.date<=end).reduce((sum,p)=>sum+p.amount,0);
    const expense=state.expenses.filter(p=>p.date>=start&&p.date<=end).reduce((sum,p)=>sum+p.amount,0);
    buckets.push({start,end,income,expense});
  }
  const max=Math.max(1,...buckets.flatMap(b=>[b.income,b.expense]));
  return `<div class="chart-axis"><span>${compact(max)}</span><span>${compact(max/2)}</span><span>0</span></div><div class="bar-chart" role="img" aria-label="Tanlangan davrdagi tushum va xarajatlar diagrammasi">${buckets.map(b=>`<div class="chart-column"><div class="chart-bars" tabindex="0" aria-label="${fmtDate(b.start)} – ${fmtDate(b.end)}: tushum ${money(b.income)}, xarajat ${money(b.expense)} so‘m" title="${fmtDate(b.start)} – ${fmtDate(b.end)}&#10;Tushum: ${money(b.income)} so‘m&#10;Xarajat: ${money(b.expense)} so‘m"><div class="bar income" style="height:${Math.max(b.income?3:0,b.income/max*100)}%"></div><div class="bar expense" style="height:${Math.max(b.expense?3:0,b.expense/max*100)}%"></div></div><span class="chart-label">${fmtDate(b.start)}</span></div>`).join('')}</div>`;
}
function personRow(r, action='pay') {
  const s=statusOf(r);
  return `<div class="person-row"><button class="avatar ${s.owed?'amber':'sage'}" data-action="profile" data-id="${r.id}" aria-label="${escapeHTML(fullName(r))} ma’lumotlari">${initials(r)}</button><button class="person-info" data-action="profile" data-id="${r.id}"><span class="person-name">${escapeHTML(fullName(r))}</span><span class="person-meta">${roomName(r)}${!r.active?' · Ketgan':''}</span></button><div class="person-amount"><strong>${money(s.owed || (state.settings?.monthlyRate || RATE))} <small>so‘m</small></strong><span class="${s.owed?'red-text':'muted'}">${s.owed?'Qolgan qarz':`${s.daysUntilDue} kundan so‘ng`}</span></div><button class="btn ${s.owed?'secondary':'ghost'} small" data-action="${action}" data-id="${r.id}" aria-label="${escapeHTML(fullName(r))} uchun to‘lov">To‘lov ${icon('right')}</button></div>`;
}
function renderDashboard(s) {
  const {from,to}=dateRange();
  const debtList=state.residents.filter(r=>statusOf(r).owed>0).sort((a,b)=>statusOf(b).owed-statusOf(a).owed);
  const soonList=state.residents.filter(r=>r.active&&statusOf(r).status==='soon').sort((a,b)=>statusOf(a).daysUntilDue-statusOf(b).daysUntilDue);
  const activities=state.payments.filter(p=>p.date>=from&&p.date<=to).map(p=>({...p,type:'payment'})).concat(state.expenses.filter(e=>e.date>=from&&e.date<=to).map(e=>({...e,type:'expense'}))).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,5);
  const pct=Math.round(s.occupied/CAPACITY*100);
  return heading('Hammasi nazorat ostida.', 'Yotoqxonangizdagi bugungi holat va moliyaviy natijalar.',`${periodControl()}${addButton('payment-picker','To‘lov qabul qilish')}`)+
  `<div class="stats-grid">${statCard('Yig‘ilgan to‘lov',s.collected,`${fmtDate(from)} – ${fmtDate(to)} oralig‘ida`,'wallet',true)}${statCard('Qolgan qarz',s.owed,`<span class="red-text">${s.debtors} ta boladan</span> olinishi kerak`,'clock')}${statCard('Jami xarajat',s.expenses,'Tanlangan davr uchun','receipt')}${statCard('Sof foyda',s.profit,'Tushum − xarajat','chart')}</div>
  <div class="dashboard-grid"><section class="card finance-card"><div class="card-header"><div><h2 class="card-title">Moliyaviy holat</h2><p class="card-subtitle">${fmtDate(from,true)} — ${fmtDate(to,true)}</p></div><div class="legend"><span><i class="legend-dot green"></i>Tushum</span><span><i class="legend-dot pale"></i>Xarajat</span></div></div><div class="card-body"><div class="chart-total">${money(s.collected)} <small>so‘m</small><span>jami tushum</span></div><div class="chart-container">${chartMarkup()}</div></div></section>
  <section class="card"><div class="card-header"><div><h2 class="card-title">Yotoqxona bandligi</h2><p class="card-subtitle">3 ta blok · 46 ta xona · 184 ta o‘rin</p></div><span class="stat-icon">${icon('building')}</span></div><div class="card-body occupancy-body"><div class="occupancy-total"><div class="occupancy-ring" style="--fill:${pct}%"><div class="occupancy-center"><strong>${pct}%</strong><span>band</span></div></div><div class="occupancy-key"><div><i class="legend-dot green"></i><span>Band o‘rinlar</span><strong>${s.occupied}</strong></div><div><i class="legend-dot pale"></i><span>Bo‘sh o‘rinlar</span><strong>${s.vacant}</strong></div><button class="section-link" data-nav="vacancies">Bo‘sh joylarni ko‘rish ${icon('right')}</button></div></div>${BLOCKS.map(b=>{const count=state.residents.filter(r=>r.active&&r.block===b.id).length;return `<div class="occupancy-block"><div class="block-row"><span><b>${b.id}</b> blok</span><span><strong>${count}</strong> / ${b.rooms*4} o‘rin</span></div><div class="progress-track"><div class="progress-fill" style="width:${count/(b.rooms*4)*100}%"></div></div></div>`;}).join('')}</div></section></div>
  <div class="dashboard-grid payments-grid"><section class="card"><div class="card-header"><div><h2 class="card-title">To‘lov kutilmoqda <span class="count-pill">${s.debtors+s.dueSoon}</span></h2><p class="card-subtitle">Qarzdorlar va to‘loviga 5 kun qolgan bolalar</p></div><button class="section-link" data-nav="debtors">Barchasi ${icon('right')}</button></div><div class="payment-list">${[...debtList.slice(0,3),...soonList.slice(0,2)].map(r=>personRow(r)).join('')||empty('To‘lovlar joyida','Hozircha qarzdorlar va yaqin to‘lovlar yo‘q.','check')}</div>${s.dueSoon?`<button class="upcoming-note" data-action="notifications">${icon('clock')}<span><strong>${s.dueSoon} ta bolaning</strong> navbatdagi to‘lovi yaqinlashmoqda</span>${icon('right')}</button>`:''}</section>
  <section class="card"><div class="card-header"><div><h2 class="card-title">So‘nggi amaliyotlar</h2><p class="card-subtitle">Tanlangan davrdagi kirim va chiqimlar</p></div><span class="stat-icon">${icon('receipt')}</span></div><div class="activity-list">${activities.map(p=>{const r=state.residents.find(r=>r.id===p.residentId);const cancelBtn=p.type==='payment'?`<button type="button" class="btn ghost small" data-action="delete-payment-confirm" data-id="${p.id}" data-resident-id="${p.residentId}" style="padding:3px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;margin-left:8px;" title="To‘lovni bekor qilish">${icon('close')} Bekor qilish</button>`:`<button type="button" class="btn ghost small" data-action="delete-expense-confirm" data-id="${p.id}" style="padding:3px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;margin-left:8px;" title="Xarajatni bekor qilish">${icon('close')} Bekor qilish</button>`;return `<div class="activity-item"><div class="activity-icon ${p.type==='payment'?'income':'outgoing'}">${icon(p.type==='payment'?'wallet':'receipt')}</div><div class="activity-details"><strong>${escapeHTML(p.type==='payment'?(r?fullName(r):'To‘lov'):p.name)}</strong><span>${p.type==='payment'?'To‘lov qabul qilindi':categoryName(p.category)} · ${fmtDate(p.date)}</span></div><div style="display:flex;align-items:center;"><div class="activity-amount ${p.type==='payment'?'green-text':''}">${p.type==='payment'?'+':'−'}${money(p.amount)}<small>so‘m</small></div>${cancelBtn}</div></div>`;}).join('')||empty('Amaliyotlar yo‘q','Bu davrda to‘lov yoki xarajat kiritilmagan.','receipt')}</div><div class="list-footer">${icon('info')} Barcha summalar O‘zbekiston so‘mida</div></section></div>
  <div class="settings-note">${icon('info')} Barcha hisob-kitoblar telefoningiz xotirasida xavfsiz saqlanadi. <button data-action="demo-info">Sozlamalar va Zaxira</button></div>`;
}
function blockTabs() {
  return `<div class="segmented" role="group" aria-label="Blokni tanlash">${[['all','Barcha bloklar'],...BLOCKS.map(b=>[b.id,`${b.id} blok`])].map(([v,l])=>`<button data-block="${v}" class="${blockFilter===v?'active':''}" aria-pressed="${blockFilter===v}">${l}</button>`).join('')}</div>`;
}
function renderRooms(vacancies) {
  const all=roomList();
  const selected=all.filter(r=>(blockFilter==='all'||r.block===blockFilter)&&(!vacancies||roomOccupants(state,r.block,r.room).length<4));
  const occupied=state.residents.filter(r=>r.active).length;
  const totalEmptyRooms=all.filter(r=>roomOccupants(state,r.block,r.room).length===0).length;
  return heading(vacancies?'Yangi bolalar uchun joy bor.':'Har bir xona, bir joyda.',vacancies?'Bo‘sh o‘rinni tanlang va yangi bolani joylashtiring.':'Bloklar, xonalar va ularda yashayotgan bolalar.',addButton('add-resident','Bola qo‘shish'))+
  `<div class="summary-strip"><div class="summary-item">${icon('building')}<div><span>Jami xonalar</span><strong>46 <small>ta</small></strong></div></div><div class="summary-item">${icon('users')}<div><span>Band o‘rinlar</span><strong>${occupied} <small>ta</small></strong></div></div><div class="summary-item">${icon('bed')}<div><span>Bo‘sh o‘rinlar</span><strong class="green-text">${CAPACITY-occupied} <small>ta</small></strong></div></div><div class="summary-item">${icon('building')}<div><span>To‘liq bo‘sh xona</span><strong>${totalEmptyRooms} <small>ta</small></strong></div></div></div><div class="toolbar">${blockTabs()}<span class="muted">${selected.length} ta xona</span></div><div class="room-grid">${selected.map(r=>{const people=roomOccupants(state,r.block,r.room),hasDebt=people.some(p=>statusOf(p).owed>0);return `<button class="room-card ${people.length<4?'has-vacancy':''}" data-action="room" data-block-id="${r.block}" data-room="${r.room}" aria-label="${r.block} blok ${r.room}-xona, ${4-people.length} ta bo‘sh o‘rin"><div class="room-card-top"><span class="room-number">${r.room.toString().padStart(2,'0')} <small>xona</small></span><span class="badge neutral">${r.block} blok</span></div><div class="room-beds">${Array.from({length:4},(_,i)=>`<span class="room-bed ${people[i]?'occupied':''}" title="${people[i]?escapeHTML(fullName(people[i])):'Bo‘sh o‘rin'}">${icon('bed')}</span>`).join('')}</div><div class="room-card-bottom"><span class="${people.length<4?'green-text':'muted'}">${people.length===4?'To‘liq band':`${4-people.length} ta bo‘sh joy`}</span><span>${hasDebt?'<i class="debt-dot" title="Qarzdor bor"></i>':''}${people.length}/4 ${icon('right')}</span></div></button>`;}).join('')||empty('Bo‘sh joy yo‘q','Bu blokdagi barcha o‘rinlar band.','bed')}</div><div class="settings-note">${icon('info')} Har bir blokda xona raqamlari 1 dan boshlanadi. Har bir xonada 4 ta o‘rin.</div>`;
}
function matchResident(r) {
  const term=query.trim().toLowerCase();
  return residentMatches(r,term);
}
function residentMatches(r,term) {
  const digits=term.replace(/\D/g,'');
  const isPhone=digits.length>0&&!/[^\d\s()+-]/.test(term);
  return !term||`${fullName(r)} ${r.lastName} ${r.phone} ${r.block}-${r.room}`.toLowerCase().includes(term)||(isPhone&&r.phone.replace(/\D/g,'').includes(digits));
}
function renderResidents(debtors) {
  const base=state.residents.filter(r=>debtors?statusOf(r).owed>0:statusFilter==='inactive'?!r.active:r.active);
  const people=base.filter(r=>(blockFilter==='all'||r.block===blockFilter)&&matchResident(r)&&(debtors||['all','inactive'].includes(statusFilter)||statusOf(r).status===statusFilter)).sort((a,b)=>debtors?statusOf(b).owed-statusOf(a).owed:fullName(a).localeCompare(fullName(b)));
  const sumOwed=state.residents.reduce((a,r)=>a+statusOf(r).owed,0), countOwed=state.residents.filter(r=>statusOf(r).owed>0).length;
  return heading(debtors?'Qarzlar ham nazoratda.':'Bolalar ro‘yxati',debtors?'Qarzdor bolalarni toping, to‘lovni kiriting va qarzni yoping.':`${state.residents.filter(r=>r.active).length} ta bola · Barcha ma’lumotlar bir joyda`,debtors?`<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn secondary" data-action="telegram-debtors" style="display:flex;align-items:center;gap:6px;">${icon('debt')}<span>Qarzdorlar (PDF)</span></button>${addButton('payment-picker','To‘lov qabul qilish')}</div>`:addButton('add-resident','Bola qo‘shish'))+
  (debtors?`<div class="debt-overview"><div><span>Jami olinishi kerak</span><strong>${money(sumOwed)} <small>so‘m</small></strong></div><div class="debt-overview-count">${icon('users')}<strong>${countOwed}</strong><span>ta qarzdor bola</span></div><div class="debt-overview-note">${icon('info')}Qisman to‘lovdan qolgan summa<br>qarz sifatida saqlanadi.</div></div>`:'')+
  `<section class="card"><div class="toolbar table-toolbar"><label class="search-field">${icon('search')}<input id="resident-query" type="search" placeholder="Ism, familiya yoki telefon..." value="${escapeHTML(query)}" aria-label="Bolani qidirish"></label><div class="filter-group"><select id="block-filter" class="filter-select" aria-label="Blok bo‘yicha saralash"><option value="all">Barcha bloklar</option>${BLOCKS.map(b=>`<option value="${b.id}" ${blockFilter===b.id?'selected':''}>${b.id} blok</option>`).join('')}</select>${debtors?'':`<select id="status-filter" class="filter-select" aria-label="To‘lov holati"><option value="all">Barcha holatlar</option>${[['paid','To‘langan'],['debt','Qarzdor'],['soon','To‘lovi yaqin'],['inactive','Ketgan bolalar']].map(([v,t])=>`<option value="${v}" ${statusFilter===v?'selected':''}>${t}</option>`).join('')}</select>`}</div></div><div class="table-wrap"><table class="data-table"><thead><tr><th class="hide-mobile">№</th><th>Ism, familiya</th><th class="hide-mobile">Telefon raqami</th><th class="hide-mobile">Xonasi</th><th>${debtors?'Qolgan qarz':'Holati'}</th><th class="hide-mobile">${debtors?'To‘lov muddati':'Keyingi to‘lov'}</th><th class="hide-mobile">Kelgan sana</th><th><span class="sr-only">Amallar</span></th></tr></thead><tbody>${people.map((r,i)=>{const s=statusOf(r);return `<tr><td class="hide-mobile muted">${String(i+1).padStart(2,'0')}</td><td><button class="table-person" data-action="profile" data-id="${r.id}"><span class="avatar ${s.owed?'amber':'sage'}">${initials(r)}</span><span><strong>${escapeHTML(fullName(r))}</strong><small>${roomName(r)}${!r.active?' · Ketgan':''}</small></span></button></td><td class="hide-mobile"><a class="phone-link" href="tel:${escapeHTML(r.phone.replace(/\s/g,''))}">${escapeHTML(r.phone)}</a></td><td class="hide-mobile"><span class="room-tag">${r.block}-${String(r.room).padStart(2,'0')}</span></td><td>${debtors?`<strong class="red-text">${money(s.owed)}</strong><small class="cell-sub">so‘m</small>`:statusBadge(r)}</td><td class="hide-mobile">${fmtDate(s.owed?s.cycleStart:s.nextDue)}${s.status==='soon'?'<small class="cell-sub amber-text">To‘lov yaqin</small>':''}</td><td class="hide-mobile muted">${fmtDate(r.joined,true)}</td><td><button class="btn ${debtors?'secondary':'ghost'} small table-action" data-action="${debtors?'pay':'profile'}" data-id="${r.id}" aria-label="${escapeHTML(fullName(r))}: ${debtors?'qarzni yopish':'ma’lumotlar'}"><span class="hide-mobile">${debtors?'Qarzni yopish':'Batafsil'}</span>${icon('right')}</button></td></tr>`;}).join('')}</tbody></table>${!people.length?empty('Bola topilmadi','Qidiruv yoki filtrni o‘zgartirib ko‘ring.'):''}</div><div class="list-footer"><span>${people.length} ta bola ko‘rsatilmoqda</span>${debtors?'<span>Qarzlar bugungi holat bo‘yicha</span>':`<span>Har 30 kunda · ${money(state.settings?.monthlyRate || RATE)} so‘m</span>`}</div></section>`;
}
function categoryName(category) {return {utilities:'Kommunal xizmatlar',tax:'Soliq',other:'Boshqa xarajatlar'}[category]||'Boshqa xarajatlar';}
function renderExpenses() {
  const {from,to}=dateRange();
  const periodExpenses=state.expenses.filter(e=>e.date>=from&&e.date<=to);
  const expenses=periodExpenses.filter(e=>categoryFilter==='all'||e.category===categoryFilter).sort((a,b)=>b.date.localeCompare(a.date));
  const total=periodExpenses.reduce((sum,e)=>sum+e.amount,0);
  return heading('Xarajatlar aniq hisobda.', 'Kommunal xizmatlar, soliq va kundalik xarajatlarni kuzating.',`${periodControl()}${addButton('add-expense','Xarajat qo‘shish')}`)+
  `<div class="expense-grid">${[['all','Jami xarajat','receipt'],['utilities','Kommunal xizmatlar','bolt'],['tax','Soliq','tax'],['other','Boshqa xarajatlar','box']].map(([c,n,i])=>`<button class="expense-card ${categoryFilter===c?'selected':''}" data-category="${c}"><span class="category-icon">${icon(i)}</span><span>${n}</span><strong>${money(c==='all'?total:periodExpenses.filter(e=>e.category===c).reduce((s,e)=>s+e.amount,0))} <small>so‘m</small></strong></button>`).join('')}</div><section class="card"><div class="card-header"><div><h2 class="card-title">${categoryFilter==='all'?'Barcha xarajatlar':categoryName(categoryFilter)}</h2><p class="card-subtitle">${fmtDate(from,true)} — ${fmtDate(to,true)}</p></div><span class="count-pill">${expenses.length} ta</span></div><div class="table-wrap"><table class="data-table"><thead><tr><th>Xarajat nomi</th><th class="hide-mobile">Turi</th><th>Sana</th><th class="align-right">Summa</th><th class="align-right">Amal</th></tr></thead><tbody>${expenses.map(e=>`<tr><td><div class="table-person"><span class="category-icon">${icon({utilities:'bolt',tax:'tax',other:'box'}[e.category])}</span><span><strong>${escapeHTML(e.name)}</strong><small>${categoryName(e.category)}</small></span></div></td><td class="hide-mobile"><span class="badge neutral">${categoryName(e.category)}</span></td><td class="muted">${fmtDate(e.date)}</td><td class="align-right"><strong>${money(e.amount)}</strong><small class="cell-sub">so‘m</small></td><td class="align-right"><button type="button" class="btn ghost small" data-action="delete-expense-confirm" data-id="${e.id}" style="padding:4px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;" title="Xarajatni bekor qilish">${icon('close')} Bekor qilish</button></td></tr>`).join('')}</tbody></table>${!expenses.length?empty('Xarajatlar kiritilmagan','Yangi xarajat qo‘shing yoki boshqa davrni tanlang.','receipt'):''}</div><div class="list-footer"><span>${expenses.length} ta xarajat</span><strong>Jami: ${money(expenses.reduce((s,e)=>s+e.amount,0))} so‘m</strong></div></section>`;
}

function openModal(title,body,footer='',formId='') {
  const modal=$('#modal');
  if(modal.open)modal.close();
  modal.innerHTML=`<div class="modal-header"><h2 id="modal-title" class="modal-title">${title}</h2><button class="close-btn" data-action="close-modal" aria-label="Yopish">${icon('close')}</button></div>${formId?`<form id="${formId}">`:''}<div class="modal-body">${body}<p class="form-error" id="form-error" role="alert" hidden></p></div>${footer?`<div class="modal-footer">${footer}</div>`:''}${formId?'</form>':''}`;
  modal.setAttribute('aria-labelledby','modal-title');
  modal.showModal();
  document.body.classList.add('modal-open');
}
function closeModal() {const modal=$('#modal');if(modal.open)modal.close();document.body.classList.remove('modal-open');}
const cancelButton='<button type="button" class="btn secondary" data-action="close-modal">Bekor qilish</button>';

function showRoom(block,room) {
  const people=roomOccupants(state,block,Number(room));
  openModal(`${block} blok · ${room}-xona`, `<div class="room-detail-heading"><span class="badge ${people.length<4?'paid':'neutral'}">${4-people.length} ta bo‘sh o‘rin</span><span class="muted">${people.length}/4 o‘rin band</span></div><div class="room-detail-grid">${Array.from({length:4},(_,i)=>{const r=people[i];return r?`<div class="resident-slot"><span class="slot-number">${i+1}-o‘rin</span><button data-action="profile" data-id="${r.id}" class="slot-person"><span class="avatar sage">${initials(r)}</span><strong>${escapeHTML(fullName(r))}</strong></button><a href="tel:${escapeHTML(r.phone.replace(/\s/g,''))}" class="phone-link">${escapeHTML(r.phone)}</a>${statusBadge(r)}<span class="person-meta">Kelgan: ${fmtDate(r.joined,true)}</span><button class="btn secondary small" data-action="pay" data-id="${r.id}">${icon('wallet')}To‘lov qilish</button></div>`:`<button class="free-slot" data-action="add-resident" data-block-id="${block}" data-room="${room}"><span class="slot-number">${i+1}-o‘rin</span>${icon('plus')}<strong>Bola qo‘shish</strong><span>Bo‘sh o‘rin</span></button>`;}).join('')}</div>`);
}
function showProfile(id) {
  const r=state.residents.find(r=>r.id===id);if(!r)return;
  const s=statusOf(r), payments=state.payments.filter(p=>p.residentId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const currentRate=state.settings?.monthlyRate || RATE;
  openModal('Bola ma’lumotlari',`<div class="person-profile"><span class="avatar sage">${initials(r)}</span><div><h3>${escapeHTML(fullName(r))}</h3><p>${roomName(r)}</p></div>${statusBadge(r)}</div><div class="detail-list"><div class="detail-item"><span>Telefon raqami</span><a href="tel:${escapeHTML(r.phone.replace(/\s/g,''))}">${escapeHTML(r.phone)}</a></div><div class="detail-item"><span>Kelgan sana</span><strong>${fmtDate(r.joined,true)}</strong></div><div class="detail-item"><span>${r.active?'Keyingi to‘lov':'Ketgan sana'}</span><strong>${fmtDate(r.active?s.nextDue:r.leftAt,true)}</strong></div><div class="detail-item"><span>30 kunlik to‘lov</span><strong>${money(currentRate)} so‘m</strong></div><div class="detail-item"><span>Jami to‘langan</span><strong class="green-text">${money(s.totalPaid)} so‘m</strong></div></div><div class="payment-summary ${s.owed?'has-debt':''}"><span>Qolgan qarz</span><strong>${money(s.owed)} <small>so‘m</small></strong></div><h3 class="small-heading">To‘lov tarixi <span class="count-pill">${payments.length}</span></h3><div class="payment-history">${payments.map(p=>`<div class="detail-item" style="display:flex;justify-content:space-between;align-items:center;"><div><span>${fmtDate(p.date,true)} <small>${p.method==='card'?'Karta orqali':'Naqd pul'}</small></span></div><div style="display:flex;align-items:center;gap:10px;"><strong class="green-text">+${money(p.amount)} so‘m</strong><button type="button" class="btn ghost small" data-action="delete-payment-confirm" data-id="${p.id}" data-resident-id="${r.id}" style="padding:4px 8px;font-size:10px;color:#dc2626;border-color:#fecaca;" title="To‘lovni bekor qilish">${icon('close')} Bekor qilish</button></div></div>`).join('')||'<p class="muted">Hali to‘lov qilinmagan.</p>'}</div>`, `${r.active?`<button class="btn danger" data-action="checkout" data-id="${r.id}">${icon('logout')}Ketgan deb belgilash</button>`:'<span class="muted">Bola yotoqxonadan ketgan</span>'}${r.active||s.owed?`<button class="btn primary" data-action="pay" data-id="${r.id}">${icon('wallet')}${s.owed?'Qarzni yopish':'To‘lov qilish'}</button>`:''}`);
}
function showAddResident(block='A',room='') {
  const availableRooms=roomList().filter(r=>roomOccupants(state,r.block,r.room).length<4);
  if(!availableRooms.length){toast('Barcha o‘rinlar band.');return;}
  const preferred=availableRooms.find(r=>r.block===block&&r.room===Number(room))||availableRooms.find(r=>r.block===block)||availableRooms[0];
  const currentRate=state.settings?.monthlyRate || RATE;
  openModal('Yangi bola qo‘shish', `<p class="modal-description">Bola ma’lumotlarini kiriting va bo‘sh o‘rinni tanlang.</p><div class="form-grid"><label class="field"><span>Ismi</span><input name="firstName" placeholder="Masalan, Azizbek" required maxlength="50" autocomplete="given-name"></label><label class="field"><span>Familiyasi</span><input name="lastName" placeholder="Masalan, Karimov" required maxlength="50" autocomplete="family-name"></label><label class="field full"><span>Telefon raqami</span><input name="phone" type="tel" value="+998 " placeholder="+998 90 123 45 67" required autocomplete="tel" maxlength="22"></label><label class="field full"><span>Xona va blok</span><select name="roomChoice">${availableRooms.map(r=>`<option value="${r.block}-${r.room}" ${r.id===preferred.id?'selected':''}>${r.block} blok · ${r.room}-xona — ${4-roomOccupants(state,r.block,r.room).length} ta bo‘sh joy</option>`).join('')}</select></label><label class="field"><span>Kelgan sana</span><input type="text" readonly inputmode="none" name="joined" value="${todayISO()}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label><label class="field"><span>Hozir bergan puli (so‘m)</span><input type="number" name="initialPayment" inputmode="numeric" value="0" min="0" step="1000" required></label><label class="field full"><span>To‘lov usuli</span><select name="method"><option value="cash">Naqd pul</option><option value="card">Karta orqali</option></select></label></div><div class="hint">${icon('info')} To‘lov kelgan kundan hisoblanadi: har 30 kun uchun ${money(currentRate)} so‘m. To‘lanmagan summa qarz bo‘lib qoladi.</div>`,`${cancelButton}<button type="submit" class="btn primary">${icon('plus')}Bolani saqlash</button>`,'resident-form');
}
function showPaymentPicker(term='') {
  openModal('To‘lovni kim uchun qabul qilamiz?',`<label class="search-field modal-search">${icon('search')}<input id="payment-search" type="search" placeholder="Ism, familiya yoki telefon..." value="${escapeHTML(term)}" aria-label="To‘lov uchun bolani qidirish" autofocus></label><div id="payment-results" class="search-results"></div><p class="hint">Bolani tanlang. To‘liq yoki qisman to‘lov qabul qilish mumkin.</p>`);
  updateSearchResults(term,'pay');
}
function updateSearchResults(term,action) {
  const normalized=term.toLowerCase().trim();
  const candidates=state.residents.filter(r=>(r.active||statusOf(r).owed>0)&&residentMatches(r,normalized)).sort((a,b)=>statusOf(b).owed-statusOf(a).owed).slice(0,12);
  const target=action==='pay'?$('#payment-results'):$('#global-results');
  target.innerHTML=candidates.map(r=>`<button class="search-result" data-action="${action}" data-id="${r.id}"><span class="avatar sage">${initials(r)}</span><span class="person-info"><span class="person-name">${escapeHTML(fullName(r))}</span><span class="person-meta">${roomName(r)} · ${escapeHTML(r.phone)}</span></span>${statusBadge(r)}${icon('right')}</button>`).join('')||empty('Bola topilmadi','Ism yoki telefon raqamini tekshirib ko‘ring.');
}
function showPay(id) {
  const r=state.residents.find(r=>r.id===id);if(!r)return;
  const currentRate=state.settings?.monthlyRate || RATE;
  const s=statusOf(r), available=r.active?Math.max(0,s.totalCharged+currentRate-s.totalPaid):s.owed, due=s.owed||Math.min(currentRate,available);
  if(available===0){openModal('To‘lovlar to‘liq qoplangan',`<div class="alert success">${icon('check')}<span><strong>${escapeHTML(fullName(r))}</strong>ning joriy va keyingi davr to‘lovi qoplangan.</span></div><div class="detail-item"><span>Navbatdagi to‘lov</span><strong>${fmtDate(s.nextDue,true)}</strong></div>`,`<button class="btn primary" data-action="close-modal">Tushunarli</button>`);return;}
  openModal('To‘lov qabul qilish',`<input type="hidden" name="residentId" value="${r.id}"><div class="person-profile compact-profile"><span class="avatar sage">${initials(r)}</span><div><h3>${escapeHTML(fullName(r))}</h3><p>${roomName(r)}</p></div></div><div class="payment-summary ${s.owed?'has-debt':''}"><span>${s.owed?'Qolgan qarz':'Keyingi 30 kun uchun'}</span><strong>${money(due)} <small>so‘m</small></strong></div><label class="field full money-input"><span>Qabul qilingan summa</span><div><input type="number" name="amount" id="payment-amount" value="${due}" min="1" max="${available}" step="1" inputmode="numeric" required><span>so‘m</span></div></label><div class="quick-amounts">${[...new Set([200000,400000,due])].filter(a=>a<=available).map(a=>`<button type="button" data-amount="${a}">${money(a)}${a===due?' · To‘liq':''}</button>`).join('')}</div><div id="payment-preview" class="hint"></div><div class="form-grid"><label class="field"><span>To‘lov usuli</span><select name="method"><option value="cash">Naqd pul</option><option value="card">Karta orqali</option></select></label><label class="field"><span>To‘lov sanasi</span><input name="date" type="text" readonly inputmode="none" value="${todayISO()}" min="${r.joined}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label></div>`,`${cancelButton}<button type="submit" class="btn primary">${icon('check')}To‘lovni saqlash</button>`,'payment-form');
  updatePaymentPreview();
}
function updatePaymentPreview() {
  const form=$('#payment-form');if(!form)return;
  const r=state.residents.find(r=>r.id===form.elements.residentId.value), owed=statusOf(r).owed, value=Number(form.elements.amount.value);
  $('#payment-preview').innerHTML=icon('info')+(value<owed?`Qisman to‘lov. Qoladigan qarz: <strong>${money(owed-value)} so‘m.</strong>`:owed&&value===owed?'To‘lovdan so‘ng qarz to‘liq yopiladi.':`<span>${owed?'Qarz yopiladi. Ortiqcha summa':'Bu summa'} keyingi davr uchun avans bo‘lib saqlanadi.</span>`);
}
function showCheckout(id) {
  const r=state.residents.find(r=>r.id===id);if(!r)return;
  const owed=statusOf(r).owed;
  openModal('Bola yotoqxonadan ketdimi?',`<input type="hidden" name="residentId" value="${r.id}"><div class="person-profile"><span class="avatar sage">${initials(r)}</span><div><h3>${escapeHTML(fullName(r))}</h3><p>${roomName(r)}</p></div></div><p>Bolaning o‘rni bo‘shaydi va yangi to‘lovlar hisoblanmaydi. To‘lov tarixi saqlanadi.</p>${owed?`<div class="alert warning">${icon('info')}<span><strong>${money(owed)} so‘m qarz mavjud.</strong> Qarz o‘chirilmaydi, uni “Qarzdorlar” bo‘limidan keyin ham yopish mumkin.</span></div>`:''}<p class="muted">Ketgan sana: ${fmtDate(todayISO(),true)}</p>`,`${cancelButton}<button type="submit" class="btn danger">Ketgan deb belgilash</button>`,'checkout-form');
}
function showAddExpense() {
  openModal('Xarajat qo‘shish',`<p class="modal-description">Xarajat saqlangach, moliyaviy hisobotga qo‘shiladi.</p><div class="form-grid"><label class="field full"><span>Xarajat nomi</span><input name="name" placeholder="Masalan, elektr energiyasi" required maxlength="100"></label><label class="field full"><span>Summa (so‘m)</span><input name="amount" type="number" min="1" step="1" inputmode="numeric" placeholder="0" required></label><label class="field"><span>Xarajat turi</span><select name="category"><option value="utilities">Kommunal xizmatlar</option><option value="tax">Soliq</option><option value="other">Boshqa xarajatlar</option></select></label><label class="field"><span>Sana</span><input name="date" type="text" readonly inputmode="none" max="${todayISO()}" value="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label></div>`,`${cancelButton}<button type="submit" class="btn primary">${icon('check')}Xarajatni saqlash</button>`,'expense-form');
}
function showNotifications() {
  const soon=state.residents.filter(r=>r.active&&statusOf(r).status==='soon').sort((a,b)=>statusOf(a).daysUntilDue-statusOf(b).daysUntilDue);
  openModal('Yaqinlashayotgan to‘lovlar',`<p class="modal-description">30 kunlik davrning 25-kunidan boshlab eslatma chiqadi. ${soon.length} ta bolaning to‘lovi yaqin.</p><div class="notification-list">${soon.map(r=>personRow(r)).join('')||empty('Yaqin to‘lovlar yo‘q','To‘lovga 5 kun qolganda bolalar shu yerda ko‘rinadi.','check')}</div>`);
}
function showCustomDates() {
  openModal('Hisobot davrini tanlash',`<div class="form-grid"><label class="field"><span>Boshlanish sanasi</span><input name="from" type="text" readonly inputmode="none" value="${customFrom}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label><label class="field"><span>Tugash sanasi</span><input name="to" type="text" readonly inputmode="none" value="${customTo}" max="${todayISO()}" required data-uz-date="true" style="cursor:pointer;background:#fff;"></label></div><p class="hint">Tushum, xarajat va foyda shu davr uchun hisoblanadi. Qolgan qarz va bandlik bugungi holatni ko‘rsatadi.</p>`,`${cancelButton}<button type="submit" class="btn primary">Qo‘llash</button>`,'period-form');
}

/* ==========================================================================
   TELEGRAM SHARING & BACKUP
   ========================================================================== */
function uint8ToBase64(uint8) {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(uint8[i]);
  return btoa(binary);
}

function buildTelegramSummaryText() {
  const s = getSummary(state, `${todayISO().slice(0, 7)}-01`, todayISO(), todayISO());
  const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalPaid - totalExpenses;
  const occupied = state.residents.filter(r => r.active).length;

  return `🏢 MAKON — YOTOQXONA HISOBOTI\n📅 Sana: ${todayISO()}\n━━━━━━━━━━━━━━━━━━\n💰 Jami tushum: ${money(totalPaid)} so‘m\n💸 Jami xarajat: ${money(totalExpenses)} so‘m\n📈 Sof foyda: ${money(netProfit)} so‘m\n⚠️ Qolgan qarz: ${money(s.owed)} so‘m (${s.debtors} ta bola)\n🛏️ Bandlik: ${occupied} / 184 o‘rin\n━━━━━━━━━━━━━━━━━━`;
}

async function sendBackupToTelegram() {
  const jsonStr = JSON.stringify(state, null, 2);
  const fileName = `makon-zaxira-${todayISO()}.json`;

  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const Share = window.Capacitor?.Plugins?.Share;
  if (Filesystem && Share) {
    try {
      const encoder = new TextEncoder();
      const base64 = uint8ToBase64(encoder.encode(jsonStr));
      const writeRes = await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
      await Share.share({
        title: 'Makon — Zaxira nusxasi',
        text: `Makon yotoqxona zaxira nusxasi (${todayISO()})`,
        url: writeRes.uri,
        files: [writeRes.uri],
        dialogTitle: 'Telegram orqali yuboring'
      });
      toast('Telegramga yuborildi.');
      return;
    } catch (e) {
      if (e?.message?.includes('canceled') || e?.name === 'AbortError') return;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const file = new File([blob], fileName, { type: 'application/json' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Makon — Zaxira nusxasi',
          text: `Makon yotoqxona zaxira nusxasi (${todayISO()})`,
          files: [file]
        });
        toast('Telegramga yuborildi.');
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }

  const summaryText = buildTelegramSummaryText() + `\n\n(Ilova zaxira nusxasi)`;
  window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(summaryText)}`, '_blank');
  toast('Telegram ochilmoqda...');
}

async function sendDebtorsToTelegram() {
  const pdfBytes = generateDebtorsPdf(state, todayISO());
  const fileName = `makon-qarzdorlar-${todayISO()}.pdf`;
  const debtors = state.residents
    .map(r => ({ resident: r, status: residentStatus(state, r, todayISO()) }))
    .filter(item => item.status.owed > 0);
  const totalDebt = debtors.reduce((sum, d) => sum + d.status.owed, 0);
  const summaryText = `⚠️ MAKON — QARZDORLAR RO‘YXATI\n📅 Sana: ${todayISO()}\n━━━━━━━━━━━━━━━━━━\n👥 Qarzdorlar soni: ${debtors.length} nafar bola\n💸 Jami qarz summasi: ${money(totalDebt)} so‘m\n━━━━━━━━━━━━━━━━━━\n(To‘liq jadval ilova qilingan PDF faylda)`;

  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const Share = window.Capacitor?.Plugins?.Share;
  if (Filesystem && Share) {
    try {
      const base64 = uint8ToBase64(pdfBytes);
      const writeRes = await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
      await Share.share({
        title: 'Makon — Qarzdorlar ro‘yxati (.pdf)',
        text: summaryText,
        url: writeRes.uri,
        files: [writeRes.uri],
        dialogTitle: 'Telegram orqali qarzdorlar ro‘yxatini yuboring'
      });
      toast('Qarzdorlar ro‘yxati yuborildi.');
      return;
    } catch (e) {
      if (e?.message?.includes('canceled') || e?.name === 'AbortError') return;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Makon — Qarzdorlar ro‘yxati',
          text: summaryText,
          files: [file]
        });
        toast('Qarzdorlar ro‘yxati yuborildi.');
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }

  try {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
  window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(summaryText)}`, '_blank');
  toast('Telegram ochilmoqda...');
}

async function sendReportToTelegram() {
  const pdfBytes = generateReportPdf(state, todayISO());
  const fileName = `makon-hisobot-${todayISO()}.pdf`;
  const summaryText = buildTelegramSummaryText() + `\n\n(To‘liq hisobot ilova qilingan PDF faylda)`;

  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const Share = window.Capacitor?.Plugins?.Share;
  if (Filesystem && Share) {
    try {
      const base64 = uint8ToBase64(pdfBytes);
      const writeRes = await Filesystem.writeFile({ path: fileName, data: base64, directory: 'CACHE' });
      await Share.share({
        title: 'Makon — Hisobot (.pdf)',
        text: summaryText,
        url: writeRes.uri,
        files: [writeRes.uri],
        dialogTitle: 'Telegram orqali hisobotni yuboring'
      });
      toast('Hisobot yuborildi.');
      return;
    } catch (e) {
      if (e?.message?.includes('canceled') || e?.name === 'AbortError') return;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
    try {
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], fileName, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Makon — Hisobot',
          text: summaryText,
          files: [file]
        });
        toast('Hisobot yuborildi.');
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
  }

  try {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
  window.open(`https://t.me/share/url?url=&text=${encodeURIComponent(summaryText)}`, '_blank');
  toast('Telegram ochilmoqda...');
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

function showDemoInfo() {
  const currentRate = state.settings?.monthlyRate || RATE;
  const currentPin = state.settings?.pin || '1234';
  openModal('Tizim va Zaxira (Sozlamalar)', `
    <div class="demo-brand">${icon('building')}<h3>Makon <span class="badge paid">Offline</span></h3></div>
    <p>Telefonda internetsiz ishlaydigan mustaqil yotoqxona boshqaruvi tizimi.</p>
    <div class="detail-list">
      <div class="detail-item"><span>Yotoqxona o‘rinlari</span><strong>184 ta (A: 14, B: 14, C: 18 xona)</strong></div>
      <div class="detail-item"><span>Oylik to‘lov</span><strong>${money(currentRate)} so‘m / 30 kun</strong></div>
      <div class="detail-item"><span>Kirish paroli</span><strong>${escapeHTML(currentPin)}</strong></div>
      <div class="detail-item"><span>Ma’lumotlar xavfsizligi</span><strong>Qurilmaning ichki xotirasida</strong></div>
    </div>

    <div style="margin-top:14px;padding:12px;border:1px solid #dbe9fc;border-radius:10px;background:#f8fbff;">
      <h4 style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:4px;">Standart oylik to‘lov miqdori</h4>
      <p style="font-size:10px;color:#475569;margin-bottom:8px;">Har bir bola uchun standart 30 kunlik to‘lov summasi.</p>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="number" id="settings-monthly-rate" value="${currentRate}" min="10000" step="10000" style="flex:1;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-weight:600;">
        <button type="button" class="btn primary small" data-action="save-rate" style="white-space:nowrap;padding:8px 14px;">Saqlash</button>
      </div>
    </div>

    <div style="margin-top:14px;padding:14px;background:#edf5ff;border:1px solid #dbe9fc;border-radius:10px;">
      <h4 style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:6px;">Telegramga yuborish va hisobotlar</h4>
      <p style="font-size:10px;color:#3b82f6;line-height:1.5;margin-bottom:12px;">Ma’lumotlaringiz xavfsiz saqlanishi va hisobotlarni chiroyli PDF shaklida ko‘rish uchun Telegramga yuboring.</p>
      <div style="display:flex;flex-direction:column;gap:8px;">
        <button type="button" class="btn primary" data-action="telegram-debtors" style="min-height:38px;font-size:11px;display:flex;align-items:center;justify-content:center;gap:8px;background:#dc2626;">${icon('debt')} Qarzdorlar ro‘yxatini yuborish (.pdf)</button>
        <button type="button" class="btn primary" data-action="telegram-report" style="min-height:38px;font-size:11px;display:flex;align-items:center;justify-content:center;gap:8px;background:#1d4ed8;">${icon('receipt')} Telegramga hisobot yuborish (.pdf)</button>
        <button type="button" class="btn primary" data-action="telegram-backup" style="min-height:38px;font-size:11px;display:flex;align-items:center;justify-content:center;gap:8px;background:#059669;">${icon('send')} Telegramga zaxirani yuborish (.json)</button>
        <label class="btn secondary" style="min-height:36px;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;">${icon('card')} Zaxiradan tiklash (.json)<input type="file" id="import-backup-input" accept=".json" style="display:none;"></label>
      </div>
    </div>

    <div style="margin-top:14px;padding:12px;border:1px solid #e1e9f4;border-radius:10px;background:#f8fbff;">
      <h4 style="font-size:11px;font-weight:700;color:#475569;margin-bottom:6px;">Baza holatini boshqarish</h4>
      <button type="button" class="btn ghost small" data-action="clear-confirm" style="color:#b91c1c;border-color:#fecaca;">Ma’lumotlarni tozalash</button>
    </div>
  `, `<button class="btn primary" data-action="close-modal">Yopish</button>`);
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

if (isTestEnv) unlockApp();

/* ==========================================================================
   UZBEK CALENDAR MODAL
   ========================================================================== */
const UZ_MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const UZ_WEEKDAYS = ['Du', 'Se', 'Cho', 'Pa', 'Ju', 'Sha', 'Ya'];
let activeDateInput = null, calYear = 2026, calMonth = 10, calSelected = todayISO();

function openUzbekDatePicker(targetInput) {
  activeDateInput = targetInput;
  const currentVal = targetInput.value || todayISO();
  const parts = currentVal.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0])) {
    calYear = parts[0];
    calMonth = parts[1] - 1;
    calSelected = currentVal;
  } else {
    const t = todayISO().split('-').map(Number);
    calYear = t[0];
    calMonth = t[1] - 1;
    calSelected = todayISO();
  }
  renderUzbekCalendar();
  const dialog = $('#uz-calendar-modal');
  if (dialog && typeof dialog.showModal === 'function') dialog.showModal();
}

function closeUzbekCalendar() {
  const dialog = $('#uz-calendar-modal');
  if (dialog && typeof dialog.close === 'function') dialog.close();
}

function renderUzbekCalendar() {
  const dialog = $('#uz-calendar-modal');
  if (!dialog) return;
  const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = todayISO(), maxDate = activeDateInput?.max || '', minDate = activeDateInput?.min || '';

  let cellsHtml = '';
  for (let i = 0; i < firstDayIndex; i++) cellsHtml += '<div class="uz-day-cell disabled"></div>';
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
      <div class="uz-weekdays-row">${UZ_WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
      <div class="uz-days-grid">${cellsHtml}</div>
    </div>
    <div class="uz-calendar-footer">
      <button type="button" class="btn secondary small" data-cal-action="cancel">Bekor qilish</button>
      <button type="button" class="btn secondary small" data-cal-action="today">Bugun</button>
      <button type="button" class="btn primary small" data-cal-action="confirm">Tanlash</button>
    </div>`;
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
   EVENT LISTENERS
   ========================================================================== */
document.addEventListener('click',(event)=>{
  // Calendar interactions
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

  const target=event.target.closest('button, [data-action]');if(!target)return;
  if(target.dataset.nav){go(target.dataset.nav);return;}
  if(target.dataset.block){blockFilter=target.dataset.block;render();return;}
  if(target.dataset.category){categoryFilter=target.dataset.category;render();return;}
  if(target.dataset.amount){$('#payment-amount').value=target.dataset.amount;updatePaymentPreview();return;}
  const {action,id}=target.dataset;
  const handlers={
    'close-modal':closeModal,
    'room':()=>showRoom(target.dataset.blockId,target.dataset.room),
    'profile':()=>showProfile(id),
    'add-resident':()=>showAddResident(target.dataset.blockId||'A',target.dataset.room||''),
    'payment-picker':()=>showPaymentPicker(),
    'pay':()=>showPay(id),
    'checkout':()=>showCheckout(id),
    'add-expense':showAddExpense,
    'notifications':showNotifications,
    'demo-info':showDemoInfo,
    'settings-info':showDemoInfo,
    'telegram-debtors':sendDebtorsToTelegram,
    'telegram-backup':sendBackupToTelegram,
    'telegram-report':sendReportToTelegram,
    'lock-app':lockApp,
    'save-rate':()=>{
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
      if ($('#sidebar-tariff')) $('#sidebar-tariff').innerHTML = `${money(val)} <small>so‘m</small>`;
      showDemoInfo();
    },
    'delete-payment-confirm':()=>{
      const p=state.payments.find(p=>p.id===id);if(!p)return;
      const r=state.residents.find(r=>r.id===p.residentId);
      openModal('To‘lovni bekor qilish',`<p>Rostdan ham <strong>${escapeHTML(r?fullName(r):'Bola')}</strong> uchun kiritilgan <strong>${money(p.amount)} so‘m</strong> to‘lovni bekor qilmoqchimisiz?</p><p class="hint">To‘lov bekor qilinadi va bolaning qarzdorlik hisob-kitobi qayta tiklanadi.</p>`,`${cancelButton}<button class="btn danger" data-action="delete-payment" data-id="${p.id}" data-resident-id="${p.residentId}">Ha, to‘lovni bekor qilish</button>`);
    },
    'delete-payment':()=>{
      const residentId=target.dataset.residentId;
      mutate(next=>deletePayment(next,id),'To‘lov muvaffaqiyatli bekor qilindi.');
      if(residentId&&state.residents.some(r=>r.id===residentId))showProfile(residentId);
    },
    'delete-expense-confirm':()=>{
      const e=state.expenses.find(e=>e.id===id);if(!e)return;
      openModal('Xarajatni bekor qilish',`<p>Rostdan ham <strong>${escapeHTML(e.name)}</strong> (<strong>${money(e.amount)} so‘m</strong>) xarajatini bekor qilmoqchimisiz?</p><p class="hint">Ushbu summa xarajatlar ro‘yxatidan va moliyaviy hisobotdan chiqarib tashlanadi.</p>`,`${cancelButton}<button class="btn danger" data-action="delete-expense" data-id="${e.id}">Ha, xarajatni bekor qilish</button>`);
    },
    'delete-expense':()=>{
      mutate(next=>deleteExpense(next,id),'Xarajat muvaffaqiyatli bekor qilindi.');
    },
    'global-search':()=>{openModal('Bolani qidirish',`<label class="search-field modal-search">${icon('search')}<input id="global-search" type="search" placeholder="Ism, familiya yoki telefon..." aria-label="Bolani qidirish" autofocus></label><div id="global-results" class="search-results"></div>`);updateSearchResults('','profile');},
    'clear-confirm':()=>openModal('Ma’lumotlarni tozalash',`<p>Barcha bolalar, to‘lovlar va xarajatlar o‘chirilib, <strong>toza bo‘sh baza</strong> yaratiladi.</p><p>Xonalar va o‘rinlar saqlanadi.</p><p><strong>Eslatma:</strong> Agar kerakli ma’lumotlaringiz bo‘lsa, oldin "Telegramga zaxirani yuborish" orqali nusxa oling.</p>`,`${cancelButton}<button class="btn danger" data-action="clear-database">Ha, ma’lumotlarni tozalash</button>`),
    'clear-database':()=>{
      try{
        const next=emptyData();
        next.settings={...state.settings};
        if(storageAvailable)localStorage.setItem(STORAGE_KEY,JSON.stringify(next));
        state=next;
        closeModal();
        go('dashboard');
        toast('Baza tozalandi.');
      }catch{toast('Xatolik yuz berdi.');}
    },
    'reset-confirm':()=>openModal('Demoni qayta boshlash',`<p>Shu brauzerda kiritilgan bolalar, to‘lovlar va xarajatlar o‘chib, namunaviy ma’lumotlar qayta tiklanadi.</p><p><strong>Bu amalni ortga qaytarib bo‘lmaydi.</strong></p>`,`${cancelButton}<button class="btn danger" data-action="reset-demo">Ha, qayta boshlash</button>`),
    'reset-demo':()=>{try{const next=seedData();localStorage.setItem(STORAGE_KEY,JSON.stringify(next));state=next;storageAvailable=true;closeModal();go('dashboard');toast('Demo qayta boshlandi.');}catch{toast('Brauzerda saqlash imkoni yo‘q.');}}
  };
  if(handlers[action])handlers[action]();
});

document.addEventListener('keydown',(event)=>{
  const screen = $('#pin-lock-screen');
  if (screen && !screen.classList.contains('unlocked')) {
    if (/^\d$/.test(event.key)) {
      handlePinDigit(event.key);
    } else if (event.key === 'Backspace') {
      handlePinDelete();
    }
  }
});

document.addEventListener('change',(event)=>{
  if(event.target.id==='import-backup-input'&&event.target.files?.[0]){
    importBackup(event.target.files[0]);
    return;
  }
  if(event.target.id==='period'){
    if(event.target.value==='custom'){showCustomDates();event.target.value=selectedPeriod;}
    else {selectedPeriod=event.target.value;render();}
  }
  if(event.target.id==='block-filter'){blockFilter=event.target.value;render();}
  if(event.target.id==='status-filter'){statusFilter=event.target.value;render();}
});
document.addEventListener('input',(event)=>{
  if(event.target.id==='resident-query'){
    const pos=event.target.selectionStart;query=event.target.value;render();const input=$('#resident-query');input.focus();try{input.setSelectionRange(pos,pos);}catch{}
  }
  if(event.target.id==='payment-search')updateSearchResults(event.target.value,'pay');
  if(event.target.id==='global-search')updateSearchResults(event.target.value,'profile');
  if(event.target.id==='payment-amount')updatePaymentPreview();
});
document.addEventListener('submit',(event)=>{
  event.preventDefault();const form=event.target,data=Object.fromEntries(new FormData(form));
  try {
    if(form.id==='resident-form'){
      const [block,room]=data.roomChoice.split('-'),initial=Number(data.initialPayment);
      if(!Number.isSafeInteger(initial)||initial<0)throw new Error('Boshlang‘ich to‘lovni to‘g‘ri kiriting.');
      mutate(next=>{const r=addResident(next,{firstName:data.firstName,lastName:data.lastName,phone:data.phone,block,room:Number(room),joined:data.joined},todayISO());if(initial>0)recordPayment(next,r.id,initial,data.method,todayISO());},'Yangi bola qo‘shildi.');
    }
    if(form.id==='payment-form')mutate(next=>recordPayment(next,data.residentId,Number(data.amount),data.method,data.date),'To‘lov saqlandi. Hisob-kitob yangilandi.');
    if(form.id==='checkout-form')mutate(next=>checkoutResident(next,data.residentId,todayISO()),'Bola ketgan deb belgilandi. O‘rin bo‘shadi.');
    if(form.id==='expense-form')mutate(next=>addExpense(next,{...data,amount:Number(data.amount)}),'Xarajat saqlandi.');
    if(form.id==='period-form'){
      if(data.from>data.to)throw new Error('Boshlanish sanasi tugash sanasidan keyin bo‘lmasin.');
      if(data.to>todayISO())throw new Error('Kelajakdagi sanani tanlamang.');
      customFrom=data.from;customTo=data.to;selectedPeriod='custom';closeModal();render();
    }
  }catch(error){const field=$('#form-error');if(field){field.hidden=false;field.textContent=error.message||'Saqlashda xatolik yuz berdi.';}}
});
$('#modal').addEventListener('click',event=>{if(event.target===$('#modal')){const box=$('#modal').getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeModal();}});
$('#modal').addEventListener('close',()=>document.body.classList.remove('modal-open'));

const uzCalModal = $('#uz-calendar-modal');
if (uzCalModal) {
  uzCalModal.addEventListener('click', event => {
    if (event.target === uzCalModal) {
      const box = uzCalModal.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeUzbekCalendar();
    }
  });
}

window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(names[next])go(next);});
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY&&event.newValue){try{const incoming=JSON.parse(event.newValue);if(incoming.version===1&&Array.isArray(incoming.residents)&&Array.isArray(incoming.payments)&&Array.isArray(incoming.expenses)){state=incoming;closeModal();render();toast('Ma’lumotlar boshqa oynadan yangilandi.');}}catch{}}});
render();
if(!storageAvailable)setTimeout(()=>toast('Saqlash o‘chiq: ma’lumotlar faqat shu seansda qoladi.'),800);
