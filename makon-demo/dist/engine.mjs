export const RATE = 800000;
export const CAPACITY = 184;
export const BLOCKS = [{ id: 'A', rooms: 14 }, { id: 'B', rooms: 14 }, { id: 'C', rooms: 18 }];
const DAY = 86400000;

export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

function validDate(value, label = 'Sana') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label}ni to‘g‘ri kiriting.`);
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`${label}ni to‘g‘ri kiriting.`);
  return value;
}

function notFuture(value, label, today = todayISO()) {
  validDate(value, label);
  if (value > today) throw new Error(`${label} kelajakda bo‘lishi mumkin emas.`);
  return value;
}

export function addDays(iso, days) {
  validDate(iso);
  if (!Number.isSafeInteger(days)) throw new Error('Kunlar soni butun son bo‘lishi kerak.');
  return new Date(new Date(`${iso}T00:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
}

export function daysBetween(a, b) {
  validDate(a); validDate(b);
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / DAY);
}

function uid(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
}

function amountValue(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') throw new Error('Summani kiriting.');
  const amount = Number(value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Summa musbat, butun so‘mda bo‘lishi kerak.');
  if (amount > 1000000000) throw new Error('Summa 1 milliard so‘mdan oshmasligi kerak.');
  return amount;
}

function nameValue(value, label) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 80) throw new Error(`${label} 2–80 ta belgidan iborat bo‘lishi kerak.`);
  return name;
}

function requireResident(state, id) {
  const resident = state.residents.find(item => item.id === id);
  if (!resident) throw new Error('Bola topilmadi.');
  return resident;
}

export function roomList() {
  return BLOCKS.flatMap(block => Array.from({ length: block.rooms }, (_, index) => ({ id: `${block.id}-${index + 1}`, block: block.id, room: index + 1, capacity: 4 })));
}

export function roomOccupants(state, block, room) {
  return state.residents.filter(resident => resident.active && resident.block === block && resident.room === Number(room));
}

// An arrival starts a paid 30-day period. A new full charge accrues at each
// 30-day boundary. All prior payments offset all accrued charges, including
// partial payments; they never reset the original arrival-based billing clock.
export function residentStatus(state, resident, today = todayISO()) {
  validDate(today);
  const asOf = !resident.active && resident.leftAt && resident.leftAt < today ? resident.leftAt : today;
  const elapsed = daysBetween(resident.joined, asOf);
  const cycleNumber = elapsed < 0 ? 0 : Math.floor(elapsed / 30) + 1;
  const cycleStart = cycleNumber ? addDays(resident.joined, (cycleNumber - 1) * 30) : resident.joined;
  const totalCharged = cycleNumber * RATE;
  const totalPaid = state.payments.filter(payment => payment.residentId === resident.id && payment.date <= today).reduce((sum, payment) => sum + payment.amount, 0);
  const owed = Math.max(0, totalCharged - totalPaid);
  const paidThisCycle = cycleNumber ? Math.min(RATE, Math.max(0, totalPaid - (cycleNumber - 1) * RATE)) : 0;
  // Advance payments cover future periods. Do not remind an already paid period.
  const nextDue = resident.active ? addDays(resident.joined, Math.max(cycleNumber, Math.floor(totalPaid / RATE)) * 30) : null;
  const daysUntilDue = nextDue ? daysBetween(today, nextDue) : null;
  const status = owed > 0 ? 'debt' : resident.active && daysUntilDue >= 0 && daysUntilDue <= 5 ? 'soon' : 'paid';
  return { owed, totalCharged, totalPaid, cycleStart, nextDue, daysUntilDue, status, paidThisCycle, cycleNumber };
}

// Cash amounts use the selected inclusive range. Debt and occupancy remain a
// current snapshot, which prevents old date filters from hiding today's debt.
export function getSummary(state, from = `${todayISO().slice(0, 7)}-01`, to = todayISO(), today = todayISO()) {
  validDate(from); validDate(to); validDate(today);
  if (from > to) throw new Error('Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak.');
  const inRange = item => item.date >= from && item.date <= to && item.date <= today;
  const collected = state.payments.filter(inRange).reduce((sum, payment) => sum + payment.amount, 0);
  const expenses = state.expenses.filter(inRange).reduce((sum, expense) => sum + expense.amount, 0);
  let owed = 0, expected = 0, debtors = 0, dueSoon = 0;
  for (const resident of state.residents) {
    const status = residentStatus(state, resident, today);
    owed += status.owed;
    debtors += status.owed > 0 ? 1 : 0;
    dueSoon += status.status === 'soon' ? 1 : 0;
    const end = [to, today, !resident.active && resident.leftAt ? resident.leftAt : today].sort()[0];
    if (end < resident.joined) continue;
    const firstCycle = Math.max(0, Math.ceil(daysBetween(resident.joined, from) / 30));
    const lastCycle = Math.floor(daysBetween(resident.joined, end) / 30);
    expected += Math.max(0, lastCycle - firstCycle + 1) * RATE;
  }
  const occupied = state.residents.filter(resident => resident.active).length;
  return { collected, expenses, profit: collected - expenses, owed, expected, occupied, vacant: CAPACITY - occupied, debtors, dueSoon };
}

export function addResident(state, input, today = todayISO()) {
  const firstName = nameValue(input.firstName, 'Ism');
  const lastName = nameValue(input.lastName, 'Familiya');
  let phone = String(input.phone ?? '').replace(/[\s()+-]/g, '');
  if (/^\d{9}$/.test(phone)) phone = `998${phone}`;
  if (!/^998\d{9}$/.test(phone)) throw new Error('Telefon raqamini +998 90 123 45 67 ko‘rinishida kiriting.');
  const block = String(input.block ?? '');
  const room = Number(input.room);
  const blockInfo = BLOCKS.find(item => item.id === block);
  if (!blockInfo || !Number.isInteger(room) || room < 1 || room > blockInfo.rooms) throw new Error('Mavjud blok va xonani tanlang.');
  if (roomOccupants(state, block, room).length >= 4) throw new Error('Bu xonada bo‘sh joy qolmagan. Boshqa xonani tanlang.');
  const joined = notFuture(input.joined || today, 'Kelgan sana', today);
  const resident = { id: uid('r'), firstName, lastName, phone: `+${phone}`, block, room, joined, active: true, leftAt: null };
  state.residents.push(resident);
  return resident;
}

export function recordPayment(state, residentId, amount, method, date = todayISO()) {
  const resident = requireResident(state, residentId);
  amount = amountValue(amount);
  notFuture(date, 'To‘lov sanasi');
  if (date < resident.joined) throw new Error('To‘lov sanasi kelgan sanadan oldin bo‘lmasligi kerak.');
  if (!['cash', 'card'].includes(method)) throw new Error('Naqd yoki karta to‘lov usulini tanlang.');
  // A departed resident can only settle frozen debt, including when recording
  // a missed historical receipt. Never create non-refundable future credit.
  if (!resident.active && amount > residentStatus(state, resident).owed) throw new Error('Summa qolgan qarzdan oshmasligi kerak.');
  // Validate the credit cap chronologically. Later receipts may legitimately
  // pay later charges; subtracting them all at the historical payment date
  // would incorrectly reject valid backdated receipts. Check later receipts
  // too, so backdating cannot evade the one-period advance-payment limit.
  const checkpoints = new Set([date, ...state.payments.filter(payment => payment.residentId === residentId && payment.date > date).map(payment => payment.date)]);
  for (const checkpoint of checkpoints) {
    const status = residentStatus(state, resident, checkpoint);
    const wasActive = resident.active || resident.leftAt && checkpoint < resident.leftAt;
    const allowed = Math.max(0, status.totalCharged + (wasActive ? RATE : 0) - status.totalPaid);
    if (amount > allowed) throw new Error(resident.active ? 'Qarz va bir davr oldindan to‘lovdan ortiq summa kiritildi.' : 'Summa qolgan qarzdan oshmasligi kerak.');
  }
  const payment = { id: uid('p'), residentId, amount, date, method };
  state.payments.push(payment);
  return payment;
}

export function checkoutResident(state, id, date = todayISO()) {
  const resident = requireResident(state, id);
  if (!resident.active) throw new Error('Bu bola avval chiqarilgan.');
  notFuture(date, 'Ketgan sana');
  if (date < resident.joined) throw new Error('Ketgan sana kelgan sanadan oldin bo‘lmasligi kerak.');
  if (state.payments.some(payment => payment.residentId === id && payment.date > date)) throw new Error('Ketgan sana oxirgi to‘lovdan oldin bo‘lmasligi kerak.');
  resident.active = false;
  resident.leftAt = date;
  return resident;
}

export function addExpense(state, input) {
  const name = nameValue(input.name, 'Xarajat nomi');
  const amount = amountValue(input.amount);
  if (!['utilities', 'tax', 'other'].includes(input.category)) throw new Error('Xarajat turini tanlang.');
  const date = notFuture(input.date || todayISO(), 'Xarajat sanasi');
  const expense = { id: uid('e'), name, amount, category: input.category, date };
  state.expenses.push(expense);
  return expense;
}

export function seedData(today = todayISO()) {
  validDate(today);
  const state = { version: 1, residents: [], payments: [], expenses: [] };
  const firstNames = ['Azizbek', 'Javohir', 'Muhammadali', 'Sardor', 'Diyorbek', 'Bekzod', 'Shahzod', 'Asadbek', 'Abdulaziz', 'Islom', 'Temur', 'Jasurbek', 'Oybek', 'Shoxrux', 'Bobur', 'Akmal', 'Murod', 'Sanjar', 'Alisher', 'Farrux', 'Davron', 'Ulug‘bek', 'Rustam', 'Kamron', 'Abbos', 'Miraziz', 'Jamshid', 'Bilol', 'Ibrohim', 'Nodir', 'Sherzod'];
  const lastNames = ['Karimov', 'Abdullayev', 'Rahimov', 'Tursunov', 'Ismoilov', 'Yusupov', 'Qodirov', 'Ergashev', 'Aliyev', 'Usmonov', 'Rasulov', 'Saidov', 'Nazarov', 'Mahmudov', 'Sobirov', 'Olimov', 'Jo‘rayev', 'Hamidov', 'Akbarov', 'Nabiyev', 'To‘xtayev', 'Sodiqov', 'Salimov'];
  let index = 0;
  roomList().forEach((room, roomIndex) => {
    // 20 rooms with 3 residents, 21 full rooms, then 2/2/2/1/0 = 151.
    const occupied = roomIndex < 20 ? 3 : roomIndex < 41 ? 4 : [2, 2, 2, 1, 0][roomIndex - 41];
    for (let bed = 0; bed < occupied; bed++) {
      const i = index++;
      const elapsed = 60 + (i * 7) % 90;
      const resident = { id: `r-demo-${String(i + 1).padStart(3, '0')}`, firstName: firstNames[i % firstNames.length], lastName: lastNames[(i * 3 + Math.floor(i / firstNames.length)) % lastNames.length], phone: `+99890000${String(i + 1).padStart(4, '0')}`, block: room.block, room: room.room, joined: addDays(today, -elapsed), active: true, leftAt: null };
      state.residents.push(resident);
      const cycles = Math.floor(elapsed / 30) + 1;
      for (let cycle = 0; cycle < cycles; cycle++) {
        const last = cycle === cycles - 1;
        const isDebtor = i % 9 === 0;
        let amount = RATE;
        if (isDebtor && last) amount = i % 18 === 0 ? 0 : 500000;
        if (isDebtor && i % 36 === 0 && cycle === cycles - 2) amount = 400000;
        if (!amount) continue;
        const date = addDays(resident.joined, cycle * 30);
        state.payments.push({ id: `p-demo-${i}-${cycle}`, residentId: resident.id, amount, date, method: (i + cycle) % 3 === 0 ? 'card' : 'cash' });
      }
    }
  });
  const currentMonth = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  for (let offset = 4; offset >= 0; offset--) {
    const month = new Date(Date.UTC(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - offset, 1)).toISOString().slice(0, 7);
    const rows = [
      ['Elektr energiyasi', 1850000 + offset * 75000, 'utilities', '02'],
      ['Soliq to‘lovi', 1200000, 'tax', '03'],
      ['Tozalik va xo‘jalik mollari', 650000 + offset * 30000, 'other', '07'],
      ['Suv va kanalizatsiya', 480000 + offset * 15000, 'utilities', '12'],
      ['Internet', 350000, 'utilities', '15'],
      ['Joriy ta’mirlash', 850000 + offset * 80000, 'other', '21']
    ];
    for (const [name, amount, category, day] of rows) {
      const date = `${month}-${day}`;
      if (date <= today) state.expenses.push({ id: `e-demo-${month}-${day}`, name, amount, category, date });
    }
  }
  return state;
}

export function emptyData() {
  return { version: 1, residents: [], payments: [], expenses: [] };
}

export function deletePayment(state, paymentId) {
  const index = state.payments.findIndex(p => p.id === paymentId);
  if (index === -1) throw new Error('To‘lov topilmadi.');
  return state.payments.splice(index, 1)[0];
}

export function deleteExpense(state, expenseId) {
  const index = state.expenses.findIndex(e => e.id === expenseId);
  if (index === -1) throw new Error('Xarajat topilmadi.');
  return state.expenses.splice(index, 1)[0];
}

export function validateState(data) {
  if (!data || typeof data !== 'object') throw new Error('Ma’lumotlar formati noto‘g‘ri.');
  if (data.version !== 1) throw new Error('Ma’lumotlar versiyasi mos kelmadi.');
  if (!Array.isArray(data.residents) || !Array.isArray(data.payments) || !Array.isArray(data.expenses)) {
    throw new Error('Ma’lumotlar tuzilishi yaroqsiz.');
  }
  return true;
}
