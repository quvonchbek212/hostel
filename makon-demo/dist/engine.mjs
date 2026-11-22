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
  const currentRate = state?.settings?.monthlyRate || resident.monthlyRate || RATE;
  const asOf = !resident.active && resident.leftAt && resident.leftAt < today ? resident.leftAt : today;
  const elapsed = daysBetween(resident.joined, asOf);
  const cycleNumber = elapsed < 0 ? 0 : Math.floor(elapsed / 30) + 1;
  const cycleStart = cycleNumber ? addDays(resident.joined, (cycleNumber - 1) * 30) : resident.joined;
  const totalCharged = cycleNumber * currentRate;
  const totalPaid = state.payments.filter(payment => payment.residentId === resident.id && payment.date <= today).reduce((sum, payment) => sum + payment.amount, 0);
  const owed = Math.max(0, totalCharged - totalPaid);
  const paidThisCycle = cycleNumber ? Math.min(currentRate, Math.max(0, totalPaid - (cycleNumber - 1) * currentRate)) : 0;
  // Advance payments cover future periods. Do not remind an already paid period.
  const nextDue = resident.active ? addDays(resident.joined, Math.max(cycleNumber, Math.floor(totalPaid / currentRate)) * 30) : null;
  const daysUntilDue = nextDue ? daysBetween(today, nextDue) : null;
  const status = owed > 0 ? 'debt' : resident.active && daysUntilDue >= 0 && daysUntilDue <= 5 ? 'soon' : 'paid';
  return { owed, totalCharged, totalPaid, cycleStart, nextDue, daysUntilDue, status, paidThisCycle, cycleNumber };
}

// Cash amounts use the selected inclusive range. Debt and occupancy remain a
// current snapshot, which prevents old date filters from hiding today's debt.
export function getSummary(state, from = `${todayISO().slice(0, 7)}-01`, to = todayISO(), today = todayISO()) {
  validDate(from); validDate(to); validDate(today);
  if (from > to) throw new Error('Boshlanish sanasi tugash sanasidan keyin bo‘lmasligi kerak.');
  const currentRate = state?.settings?.monthlyRate || RATE;
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
    expected += Math.max(0, lastCycle - firstCycle + 1) * currentRate;
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
  const currentRate = state?.settings?.monthlyRate || resident.monthlyRate || RATE;
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
    const allowed = Math.max(0, status.totalCharged + (wasActive ? currentRate : 0) - status.totalPaid);
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
  const state = { version: 1, residents: [], payments: [], expenses: [], settings: { monthlyRate: 800000, pin: '1234' } };
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
  return { version: 1, residents: [], payments: [], expenses: [], settings: { monthlyRate: 800000, pin: '1234' } };
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

// Pure JS ZIP Builder for standard uncompressed (.zip / .docx) packages
export function createZip(files) {
  const fileRecords = [];
  let offset = 0;
  const parts = [];
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    crcTable[n] = c >>> 0;
  }
  function calcCrc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ crcTable[(crc ^ buf[i]) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
  }
  const encoder = new TextEncoder();
  for (const f of files) {
    const data = typeof f.content === 'string' ? encoder.encode(f.content) : f.content;
    const nameBytes = encoder.encode(f.name);
    const crc = calcCrc32(data);
    const size = data.length;
    const header = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, size, true);
    view.setUint32(22, size, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(nameBytes, 30);
    fileRecords.push({ nameBytes, crc, size, offset });
    parts.push(header, data);
    offset += header.length + size;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const r of fileRecords) {
    const cd = new Uint8Array(46 + r.nameBytes.length);
    const view = new DataView(cd.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0, true);
    view.setUint32(16, r.crc, true);
    view.setUint32(20, r.size, true);
    view.setUint32(24, r.size, true);
    view.setUint16(28, r.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, r.offset, true);
    cd.set(r.nameBytes, 46);
    parts.push(cd);
    cdSize += cd.length;
  }
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, fileRecords.length, true);
  view.setUint16(10, fileRecords.length, true);
  view.setUint32(12, cdSize, true);
  view.setUint32(16, cdStart, true);
  view.setUint16(20, 0, true);
  parts.push(eocd);
  const totalLen = parts.reduce((acc, p) => acc + p.length, 0);
  const result = new Uint8Array(totalLen);
  let pos = 0;
  for (const p of parts) {
    result.set(p, pos);
    pos += p.length;
  }
  return result;
}

function escapeXml(unsafe) {
  return String(unsafe ?? '').replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function wText(text, { bold = false, size = 20, color = '000000', font = 'Calibri' } = {}) {
  return `<w:r><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/><w:sz w:val="${size}"/><w:color w:val="${color}"/>${bold ? '<w:b/>' : ''}</w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function wPara(runs, { align = 'left', spaceBefore = 60, spaceAfter = 60 } = {}) {
  const runsXml = Array.isArray(runs) ? runs.join('') : runs;
  return `<w:p><w:pPr><w:jc w:val="${align}"/><w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/></w:pPr>${runsXml}</w:p>`;
}

function wCell(content, { bold = false, bg = '', align = 'left', color = '000000', size = 18 } = {}) {
  const p = wPara(typeof content === 'string' ? wText(content, { bold, color, size }) : content, { align, spaceBefore: 30, spaceAfter: 30 });
  const shd = bg ? `<w:shd w:val="clear" w:color="auto" w:fill="${bg}"/>` : '';
  return `<w:tc><w:tcPr>${shd}<w:tcMar><w:top w:w="80" w:type="dxa"/><w:bottom w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar></w:tcPr>${p}</w:tc>`;
}

function wRow(cells, isHeader = false) {
  return `<w:tr>${isHeader ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${cells.join('')}</w:tr>`;
}

function wTable(rows) {
  const borders = `<w:tblBorders>
    <w:top w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:left w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:bottom w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:right w:val="single" w:sz="4" w:space="0" w:color="D1D5DB"/>
    <w:insideH w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
    <w:insideV w:val="single" w:sz="4" w:space="0" w:color="E5E7EB"/>
  </w:tblBorders>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/>${borders}</w:tblPr>${rows.join('')}</w:tbl>`;
}

function fmtMoney(amount) {
  return Number(amount || 0).toLocaleString('uz-UZ').replace(/,/g, ' ');
}

// Generates an OpenXML .docx Microsoft Word document buffer with all hostel details
export function generateDocxReport(state, today = todayISO()) {
  const summary = getSummary(state, `${today.slice(0, 7)}-01`, today, today);
  const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalPaid - totalExpenses;
  const occupiedCount = state.residents.filter(r => r.active).length;

  const body = [];

  // Title
  body.push(wPara(wText('«MAKON» YOTOQXONA BOSHQARUVI — TO‘LIQ HISOBOT', { bold: true, size: 28, color: '1E3A8A' }), { align: 'center', spaceBefore: 120, spaceAfter: 60 }));
  body.push(wPara(wText(`Hisobot sanasi: ${today} yil | Jami bolalar: ${state.residents.length} nafar`, { size: 18, color: '6B7280' }), { align: 'center', spaceBefore: 0, spaceAfter: 180 }));

  // Section 1: Financial & Hostel Summary
  body.push(wPara(wText('1. MOLIYAVIY VA XO‘JALIK XULOSASI', { bold: true, size: 22, color: '1E40AF' }), { spaceBefore: 140, spaceAfter: 60 }));
  const summaryRows = [
    wRow([wCell('Ko‘rsatkich nomi', { bold: true, bg: '2563EB', color: 'FFFFFF' }), wCell('Qiymat', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'right' })], true),
    wRow([wCell('Jami yig‘ilgan to‘lovlar'), wCell(`${fmtMoney(totalPaid)} so‘m`, { bold: true, align: 'right', color: '16A34A' })]),
    wRow([wCell('Jami xarajatlar'), wCell(`${fmtMoney(totalExpenses)} so‘m`, { bold: true, align: 'right', color: 'DC2626' })]),
    wRow([wCell('Sof foyda (Tushum − Xarajat)', { bold: true, bg: 'F3F4F6' }), wCell(`${fmtMoney(netProfit)} so‘m`, { bold: true, align: 'right', bg: 'F3F4F6', color: netProfit >= 0 ? '16A34A' : 'DC2626' })]),
    wRow([wCell('Kutilayotgan qarzlar miqdori'), wCell(`${fmtMoney(summary.owed)} so‘m (${summary.debtors} ta qarzdor bola)`, { bold: true, align: 'right', color: summary.owed > 0 ? 'B91C1C' : '4B5563' })]),
    wRow([wCell('Band o‘rinlar'), wCell(`${occupiedCount} ta o‘rin`, { align: 'right' })]),
    wRow([wCell('Bo‘sh o‘rinlar'), wCell(`${CAPACITY - occupiedCount} ta o‘rin (jami 184)`, { align: 'right' })])
  ];
  body.push(wTable(summaryRows));

  // Section 2: Residents List
  body.push(wPara(wText(`2. BOLALAR RO‘YXATI (${state.residents.length} nafar)`, { bold: true, size: 22, color: '1E40AF' }), { spaceBefore: 180, spaceAfter: 60 }));
  const residentRows = [
    wRow([
      wCell('T/r', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('F.I.Sh', { bold: true, bg: '2563EB', color: 'FFFFFF', size: 16 }),
      wCell('Xona', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Telefon', { bold: true, bg: '2563EB', color: 'FFFFFF', size: 16 }),
      wCell('Kelgan sana', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Holati', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('To‘langan', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'right', size: 16 }),
      wCell('Qarz', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'right', size: 16 })
    ], true)
  ];

  if (!state.residents.length) {
    residentRows.push(wRow([wCell('Hozircha bolalar kiritilmagan.', { align: 'center', color: '6B7280' })]));
  } else {
    state.residents.forEach((r, idx) => {
      const st = residentStatus(state, r, today);
      const bg = idx % 2 === 1 ? 'F9FAFB' : '';
      residentRows.push(wRow([
        wCell(String(idx + 1), { align: 'center', bg, size: 16 }),
        wCell(`${r.lastName} ${r.firstName}`, { bold: true, bg, size: 16 }),
        wCell(`${r.block}-${r.room}`, { align: 'center', bg, size: 16 }),
        wCell(r.phone || '', { bg, size: 16 }),
        wCell(r.joined || '', { align: 'center', bg, size: 16 }),
        wCell(r.active ? 'Faol' : 'Ketgan', { align: 'center', bg, size: 16, color: r.active ? '16A34A' : '6B7280' }),
        wCell(`${fmtMoney(st.totalPaid)} so‘m`, { align: 'right', bg, size: 16 }),
        wCell(`${fmtMoney(st.owed)} so‘m`, { align: 'right', bg, size: 16, bold: st.owed > 0, color: st.owed > 0 ? 'DC2626' : '000000' })
      ]));
    });
  }
  body.push(wTable(residentRows));

  // Section 3: Payments History
  body.push(wPara(wText(`3. TO‘LOVLAR TARIXI (${state.payments.length} ta amaliyot)`, { bold: true, size: 22, color: '1E40AF' }), { spaceBefore: 180, spaceAfter: 60 }));
  const paymentRows = [
    wRow([
      wCell('T/r', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Sana', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Bola ismi', { bold: true, bg: '2563EB', color: 'FFFFFF', size: 16 }),
      wCell('Summa', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'right', size: 16 }),
      wCell('To‘lov turi', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 })
    ], true)
  ];

  if (!state.payments.length) {
    paymentRows.push(wRow([wCell('Hozircha to‘lovlar yo‘q.', { align: 'center', color: '6B7280' })]));
  } else {
    // Show newest first
    const sortedPayments = [...state.payments].sort((a, b) => b.date.localeCompare(a.date));
    sortedPayments.forEach((p, idx) => {
      const resident = state.residents.find(r => r.id === p.residentId);
      const name = resident ? `${resident.lastName} ${resident.firstName}` : 'Noma’lum';
      const bg = idx % 2 === 1 ? 'F9FAFB' : '';
      paymentRows.push(wRow([
        wCell(String(idx + 1), { align: 'center', bg, size: 16 }),
        wCell(p.date, { align: 'center', bg, size: 16 }),
        wCell(name, { bold: true, bg, size: 16 }),
        wCell(`+${fmtMoney(p.amount)} so‘m`, { align: 'right', bg, size: 16, bold: true, color: '16A34A' }),
        wCell(p.method === 'card' ? 'Karta' : 'Naqd pul', { align: 'center', bg, size: 16 })
      ]));
    });
  }
  body.push(wTable(paymentRows));

  // Section 4: Expenses History
  body.push(wPara(wText(`4. XARAJATLAR RO‘YXATI (${state.expenses.length} ta)`, { bold: true, size: 22, color: '1E40AF' }), { spaceBefore: 180, spaceAfter: 60 }));
  const catNames = { utilities: 'Kommunal', tax: 'Soliq', other: 'Xo‘jalik / Boshqa' };
  const expenseRows = [
    wRow([
      wCell('T/r', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Sana', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Xarajat nomi', { bold: true, bg: '2563EB', color: 'FFFFFF', size: 16 }),
      wCell('Kategoriya', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'center', size: 16 }),
      wCell('Summa', { bold: true, bg: '2563EB', color: 'FFFFFF', align: 'right', size: 16 })
    ], true)
  ];

  if (!state.expenses.length) {
    expenseRows.push(wRow([wCell('Hozircha xarajatlar yo‘q.', { align: 'center', color: '6B7280' })]));
  } else {
    const sortedExpenses = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date));
    sortedExpenses.forEach((e, idx) => {
      const bg = idx % 2 === 1 ? 'F9FAFB' : '';
      expenseRows.push(wRow([
        wCell(String(idx + 1), { align: 'center', bg, size: 16 }),
        wCell(e.date, { align: 'center', bg, size: 16 }),
        wCell(e.name, { bold: true, bg, size: 16 }),
        wCell(catNames[e.category] || e.category, { align: 'center', bg, size: 16 }),
        wCell(`−${fmtMoney(e.amount)} so‘m`, { align: 'right', bg, size: 16, bold: true, color: 'DC2626' })
      ]));
    });
  }
  body.push(wTable(expenseRows));

  const docXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${body.join('')}
    <w:sectPr/>
  </w:body>
</w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  return createZip([
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: rels },
    { name: 'word/document.xml', content: docXml }
  ]);
}
