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

// ==========================================================================
// PURE JS PDF BUILDER & GENERATORS (PDF 1.4)
// ==========================================================================

export function latinize(str) {
  if (!str && str !== 0) return '';
  const cyrToLat = {
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'Yo','Ж':'J','З':'Z','И':'I','Й':'Y','К':'K',
    'Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'X','Ц':'Ts',
    'Ч':'Ch','Ш':'Sh','Ъ':"'",'Ь':'','Э':'E','Ю':'Yu','Я':'Ya','Ў':"O'",'Қ':'Q','Ғ':"G'",'Ҳ':'H',
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'j','з':'z','и':'i','й':'y','к':'k',
    'л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'x','ц':'ts',
    'ч':'ch','ш':'sh','ъ':"'",'ь':'','э':'e','ю':'yu','я':'ya','ў':"o'",'қ':'q','ғ':"g'",'ҳ':'h'
  };
  return String(str)
    .replace(/[А-Яа-яЁёЎўҚқҒғҲҳ]/g, c => cyrToLat[c] || c)
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-');
}

export class PdfBuilder {
  constructor() {
    this.width = 595.28;
    this.height = 841.89;
    this.pages = [];
    this.currentPage = null;
    this.addPage();
  }

  addPage() {
    this.currentPage = { ops: [] };
    this.pages.push(this.currentPage);
    return this.currentPage;
  }

  toPdfY(y) {
    return this.height - y;
  }

  rect(x, y, w, h, fill = null, stroke = null, lineWidth = 1) {
    const yBottom = this.toPdfY(y + h);
    let s = 'q\n';
    if (lineWidth) s += `${lineWidth.toFixed(2)} w\n`;
    if (fill) s += `${fill[0].toFixed(3)} ${fill[1].toFixed(3)} ${fill[2].toFixed(3)} rg\n`;
    if (stroke) s += `${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG\n`;
    s += `${x.toFixed(2)} ${yBottom.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re\n`;
    if (fill && stroke) s += 'B\n';
    else if (fill) s += 'f\n';
    else if (stroke) s += 'S\n';
    s += 'Q\n';
    this.currentPage.ops.push(s);
  }

  line(x1, y1, x2, y2, stroke = [0, 0, 0], lineWidth = 1) {
    const py1 = this.toPdfY(y1);
    const py2 = this.toPdfY(y2);
    let s = `q\n${lineWidth.toFixed(2)} w\n${stroke[0].toFixed(3)} ${stroke[1].toFixed(3)} ${stroke[2].toFixed(3)} RG\n`;
    s += `${x1.toFixed(2)} ${py1.toFixed(2)} m ${x2.toFixed(2)} ${py2.toFixed(2)} l S\nQ\n`;
    this.currentPage.ops.push(s);
  }

  text(str, x, y, options = {}) {
    if (str === null || str === undefined || str === '') return;
    const raw = latinize(String(str));
    const font = options.font === 'bold' ? '/F2' : (options.font === 'oblique' ? '/F3' : '/F1');
    const size = options.size || 10;
    const color = options.color || [0.1, 0.15, 0.2];
    const align = options.align || 'left';

    const charW = (options.font === 'bold' ? 0.56 : 0.52) * size;
    const textWidth = raw.length * charW;
    let drawX = x;
    if (align === 'right') drawX = x - textWidth;
    else if (align === 'center') drawX = x - (textWidth / 2);

    const pdfY = this.toPdfY(y + size * 0.78);
    const escaped = raw.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const op = `BT\n${font} ${size.toFixed(2)} Tf\n${color[0].toFixed(3)} ${color[1].toFixed(3)} ${color[2].toFixed(3)} rg\n1 0 0 1 ${drawX.toFixed(2)} ${pdfY.toFixed(2)} Tm\n(${escaped}) Tj\nET\n`;
    this.currentPage.ops.push(op);
  }

  build(footerTitle = 'Makon - Yotoqxona boshqaruvi tizimi') {
    const totalPages = this.pages.length;
    for (let i = 0; i < totalPages; i++) {
      this.currentPage = this.pages[i];
      this.line(40, 804, 555, 804, [0.85, 0.88, 0.92], 0.5);
      this.text(footerTitle, 40, 810, { font: 'regular', size: 7.5, color: [0.5, 0.55, 0.6] });
      this.text(`Sahifa ${i + 1} / ${totalPages}`, 555, 810, { font: 'regular', size: 7.5, color: [0.5, 0.55, 0.6], align: 'right' });
    }

    const encoder = new TextEncoder();
    const chunks = [];
    let offset = 0;
    const xrefOffsets = [];

    function append(str) {
      const b = encoder.encode(str);
      chunks.push(b);
      offset += b.length;
    }

    append('%PDF-1.4\n%âãÏÓ\n');
    xrefOffsets[1] = offset;
    append('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    const pageObjStart = 7;
    const kids = [];
    for (let i = 0; i < totalPages; i++) {
      kids.push(`${pageObjStart + i * 2} 0 R`);
    }
    xrefOffsets[2] = offset;
    append(`2 0 obj\n<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${totalPages} >>\nendobj\n`);

    xrefOffsets[3] = offset;
    append('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n');
    xrefOffsets[4] = offset;
    append('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n');
    xrefOffsets[5] = offset;
    append('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>\nendobj\n');
    xrefOffsets[6] = offset;
    append('6 0 obj\n[/PDF /Text /ImageB /ImageC /ImageI]\nendobj\n');

    for (let i = 0; i < totalPages; i++) {
      const pageObjNum = pageObjStart + i * 2;
      const contentObjNum = pageObjNum + 1;
      const contentStr = this.pages[i].ops.join('');
      const contentBytes = encoder.encode(contentStr);

      xrefOffsets[pageObjNum] = offset;
      append(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width.toFixed(2)} ${this.height.toFixed(2)}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> /ProcSet 6 0 R >> >>\nendobj\n`);

      xrefOffsets[contentObjNum] = offset;
      append(`${contentObjNum} 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
      chunks.push(contentBytes);
      offset += contentBytes.length;
      append('\nendstream\nendobj\n');
    }

    const startXref = offset;
    const totalObjs = pageObjStart + totalPages * 2;
    append(`xref\n0 ${totalObjs}\n0000000000 65535 f \n`);
    for (let i = 1; i < totalObjs; i++) {
      const pos = String(xrefOffsets[i]).padStart(10, '0');
      append(`${pos} 00000 n \n`);
    }

    append(`trailer\n<< /Size ${totalObjs} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`);

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const result = new Uint8Array(totalLen);
    let cur = 0;
    for (const c of chunks) {
      result.set(c, cur);
      cur += c.length;
    }
    return result;
  }
}

export function generateDebtorsPdf(state, today = todayISO()) {
  const currentRate = state?.settings?.monthlyRate || RATE;
  const debtors = state.residents
    .map(r => ({ resident: r, status: residentStatus(state, r, today) }))
    .filter(item => item.status.owed > 0)
    .sort((a, b) => b.status.owed - a.status.owed);

  const totalDebt = debtors.reduce((sum, d) => sum + d.status.owed, 0);
  const pdf = new PdfBuilder();

  function drawHeader(isFirst = false) {
    if (isFirst) {
      pdf.rect(40, 36, 515, 52, [0.08, 0.28, 0.65]);
      pdf.text('MAKON', 52, 47, { font: 'bold', size: 17, color: [1, 1, 1] });
      pdf.text('YOTOQXONA BOSHQARUVI TIZIMI', 52, 68, { font: 'regular', size: 7.5, color: [0.75, 0.88, 1.0] });
      pdf.text('QARZDORLAR RO\'YXATI', 543, 49, { font: 'bold', size: 12.5, color: [1, 1, 1], align: 'right' });
      pdf.text(`Sana: ${today}`, 543, 67, { font: 'regular', size: 8, color: [0.85, 0.92, 1.0], align: 'right' });
    } else {
      pdf.rect(40, 36, 515, 26, [0.08, 0.28, 0.65]);
      pdf.text('MAKON - QARZDORLAR RO\'YXATI', 50, 43, { font: 'bold', size: 9.5, color: [1, 1, 1] });
      pdf.text(`Sana: ${today}`, 545, 44, { font: 'regular', size: 7.5, color: [0.85, 0.92, 1.0], align: 'right' });
    }
  }

  function drawTableHeader(y) {
    pdf.rect(40, y, 515, 20, [0.1, 0.24, 0.48]);
    pdf.text('T/r', 54, y + 5, { font: 'bold', size: 8, color: [1, 1, 1], align: 'center' });
    pdf.text('Blok', 86, y + 5, { font: 'bold', size: 8, color: [1, 1, 1], align: 'center' });
    pdf.text('Xona', 130, y + 5, { font: 'bold', size: 8, color: [1, 1, 1], align: 'center' });
    pdf.text('Ism va familiya', 160, y + 5, { font: 'bold', size: 8, color: [1, 1, 1] });
    pdf.text('Telefon raqami', 390, y + 5, { font: 'bold', size: 8, color: [1, 1, 1], align: 'center' });
    pdf.text('Qarzdorlik', 545, y + 5, { font: 'bold', size: 8, color: [1, 1, 1], align: 'right' });
    return y + 20;
  }

  drawHeader(true);

  // Summary badges
  pdf.rect(40, 96, 160, 34, [0.96, 0.97, 0.99], [0.85, 0.89, 0.94], 0.7);
  pdf.text('JAMI QARZDORLAR', 48, 102, { font: 'regular', size: 6.5, color: [0.4, 0.45, 0.5] });
  pdf.text(`${debtors.length} nafar bola`, 48, 114, { font: 'bold', size: 10.5, color: [0.08, 0.15, 0.3] });

  pdf.rect(210, 96, 185, 34, [0.99, 0.95, 0.95], [0.98, 0.8, 0.8], 0.7);
  pdf.text('UMUMIY QARZDORLIK', 218, 102, { font: 'regular', size: 6.5, color: [0.7, 0.2, 0.2] });
  pdf.text(`${fmtMoney(totalDebt)} so'm`, 218, 114, { font: 'bold', size: 10.5, color: [0.8, 0.1, 0.1] });

  pdf.rect(405, 96, 150, 34, [0.96, 0.97, 0.99], [0.85, 0.89, 0.94], 0.7);
  pdf.text('STANDART OYLIK NARX', 413, 102, { font: 'regular', size: 6.5, color: [0.4, 0.45, 0.5] });
  pdf.text(`${fmtMoney(currentRate)} so'm`, 413, 114, { font: 'bold', size: 10.5, color: [0.08, 0.15, 0.3] });

  let curY = drawTableHeader(138);

  if (debtors.length === 0) {
    pdf.rect(40, curY, 515, 28, [0.98, 0.99, 0.98], [0.85, 0.9, 0.85], 0.5);
    pdf.text('Hozirgi kunda qarzdorlar mavjud emas. Barcha to\'lovlar o\'z vaqtida amalga oshirilgan.', 297, curY + 9, { font: 'regular', size: 8.5, color: [0.15, 0.5, 0.2], align: 'center' });
    curY += 28;
  } else {
    debtors.forEach((d, idx) => {
      if (curY > 770) {
        pdf.addPage();
        drawHeader(false);
        curY = drawTableHeader(68);
      }
      const bg = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 0.99];
      const r = d.resident;
      pdf.rect(40, curY, 515, 18, bg, [0.88, 0.91, 0.95], 0.5);
      pdf.text(String(idx + 1), 54, curY + 4.5, { font: 'regular', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      pdf.text(`${r.block} blok`, 86, curY + 4.5, { font: 'bold', size: 7.5, color: [0.1, 0.2, 0.4], align: 'center' });
      pdf.text(String(r.room), 130, curY + 4.5, { font: 'regular', size: 7.5, color: [0.1, 0.15, 0.2], align: 'center' });
      pdf.text(`${r.lastName} ${r.firstName}`, 160, curY + 4.5, { font: 'bold', size: 8, color: [0.08, 0.12, 0.2] });
      pdf.text(r.phone || '-', 390, curY + 4.5, { font: 'regular', size: 7.5, color: [0.2, 0.3, 0.4], align: 'center' });
      pdf.text(`${fmtMoney(d.status.owed)} so'm`, 545, curY + 4.5, { font: 'bold', size: 8, color: [0.75, 0.1, 0.1], align: 'right' });
      curY += 18;
    });

    if (curY > 760) {
      pdf.addPage();
      drawHeader(false);
      curY = 68;
    }
    pdf.rect(40, curY, 515, 20, [0.94, 0.96, 0.99], [0.75, 0.82, 0.9], 0.7);
    pdf.text('JAMI QARZDORLIK SUMMASI:', 430, curY + 5.5, { font: 'bold', size: 8.5, color: [0.1, 0.2, 0.4], align: 'right' });
    pdf.text(`${fmtMoney(totalDebt)} so'm`, 545, curY + 5.5, { font: 'bold', size: 9, color: [0.8, 0.1, 0.1], align: 'right' });
    curY += 26;

    if (curY < 740) {
      curY += 16;
      pdf.text('Hisobotni tuzdi: ________________________ (Imzo)', 50, curY, { font: 'regular', size: 8, color: [0.3, 0.35, 0.4] });
      pdf.text('Rahbar: ________________________ (Imzo)', 350, curY, { font: 'regular', size: 8, color: [0.3, 0.35, 0.4] });
    }
  }

  return pdf.build('Makon - Qarzdorlar hisoboti');
}

export function generateReportPdf(state, today = todayISO()) {
  const currentRate = state?.settings?.monthlyRate || RATE;
  const summary = getSummary(state, `${today.slice(0, 7)}-01`, today, today);
  const totalPaid = state.payments.reduce((sum, p) => sum + p.amount, 0);
  const totalExpenses = state.expenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalPaid - totalExpenses;
  const occupiedCount = state.residents.filter(r => r.active).length;
  const occupancyPct = Math.round((occupiedCount / CAPACITY) * 100);

  const pdf = new PdfBuilder();

  function drawHeader(isFirst = false) {
    if (isFirst) {
      pdf.rect(40, 36, 515, 52, [0.08, 0.28, 0.65]);
      pdf.text('MAKON', 52, 47, { font: 'bold', size: 17, color: [1, 1, 1] });
      pdf.text('YOTOQXONA BOSHQARUVI TIZIMI', 52, 68, { font: 'regular', size: 7.5, color: [0.75, 0.88, 1.0] });
      pdf.text('UMUMIY HISOBOT', 543, 49, { font: 'bold', size: 13, color: [1, 1, 1], align: 'right' });
      pdf.text(`Sana: ${today}`, 543, 67, { font: 'regular', size: 8, color: [0.85, 0.92, 1.0], align: 'right' });
    } else {
      pdf.rect(40, 36, 515, 26, [0.08, 0.28, 0.65]);
      pdf.text('MAKON - UMUMIY HISOBOT', 50, 43, { font: 'bold', size: 9.5, color: [1, 1, 1] });
      pdf.text(`Sana: ${today}`, 545, 44, { font: 'regular', size: 7.5, color: [0.85, 0.92, 1.0], align: 'right' });
    }
  }

  drawHeader(true);

  // 4 Financial KPI Cards
  const kpiW = 122;
  const kpiGap = 9;

  // 1: Total Paid
  pdf.rect(40, 96, kpiW, 40, [0.94, 0.99, 0.95], [0.7, 0.9, 0.75], 0.7);
  pdf.text('JAMI TUSHUM', 46, 102, { font: 'regular', size: 6.5, color: [0.15, 0.5, 0.2] });
  pdf.text(`${fmtMoney(totalPaid)} so'm`, 46, 116, { font: 'bold', size: 9.5, color: [0.1, 0.55, 0.2] });

  // 2: Total Expenses
  pdf.rect(40 + kpiW + kpiGap, 96, kpiW, 40, [0.99, 0.95, 0.95], [0.95, 0.75, 0.75], 0.7);
  pdf.text('JAMI XARAJAT', 40 + kpiW + kpiGap + 6, 102, { font: 'regular', size: 6.5, color: [0.7, 0.2, 0.2] });
  pdf.text(`${fmtMoney(totalExpenses)} so'm`, 40 + kpiW + kpiGap + 6, 116, { font: 'bold', size: 9.5, color: [0.8, 0.15, 0.15] });

  // 3: Net Profit
  pdf.rect(40 + (kpiW + kpiGap) * 2, 96, kpiW, 40, [0.94, 0.97, 1.0], [0.7, 0.82, 0.98], 0.7);
  pdf.text('SOF FOYDA', 40 + (kpiW + kpiGap) * 2 + 6, 102, { font: 'regular', size: 6.5, color: [0.1, 0.35, 0.7] });
  pdf.text(`${fmtMoney(netProfit)} so'm`, 40 + (kpiW + kpiGap) * 2 + 6, 116, { font: 'bold', size: 9.5, color: netProfit >= 0 ? [0.1, 0.35, 0.7] : [0.8, 0.1, 0.1] });

  // 4: Debt
  pdf.rect(40 + (kpiW + kpiGap) * 3, 96, kpiW, 40, [0.99, 0.97, 0.93], [0.95, 0.85, 0.65], 0.7);
  pdf.text('QOLGAN QARZ', 40 + (kpiW + kpiGap) * 3 + 6, 102, { font: 'regular', size: 6.5, color: [0.7, 0.45, 0.1] });
  pdf.text(`${fmtMoney(summary.owed)} so'm`, 40 + (kpiW + kpiGap) * 3 + 6, 116, { font: 'bold', size: 9.5, color: summary.owed > 0 ? [0.8, 0.1, 0.1] : [0.2, 0.5, 0.2] });

  // Occupancy Row
  pdf.rect(40, 142, 515, 26, [0.97, 0.98, 0.99], [0.85, 0.89, 0.94], 0.5);
  pdf.text(`Band o'rinlar: ${occupiedCount} ta (${occupancyPct}%)   |   Bo'sh o'rinlar: ${CAPACITY - occupiedCount} ta   |   Jami sig'im: ${CAPACITY} o'rin`, 52, 151, { font: 'bold', size: 8, color: [0.15, 0.25, 0.4] });
  pdf.text(`Standart tarif: ${fmtMoney(currentRate)} so'm/oy`, 543, 151, { font: 'regular', size: 8, color: [0.35, 0.4, 0.5], align: 'right' });

  let curY = 180;

  // Section 1: Qarzdorlar
  const debtors = state.residents
    .map(r => ({ resident: r, status: residentStatus(state, r, today) }))
    .filter(item => item.status.owed > 0)
    .sort((a, b) => b.status.owed - a.status.owed);

  pdf.rect(40, curY, 515, 18, [0.1, 0.24, 0.48]);
  pdf.text(`QARZDOR BOLALAR (${debtors.length} nafar)`, 48, curY + 4.5, { font: 'bold', size: 8.5, color: [1, 1, 1] });
  pdf.text(`Jami qarz: ${fmtMoney(summary.owed)} so'm`, 545, curY + 4.5, { font: 'bold', size: 8.5, color: [1, 0.9, 0.9], align: 'right' });
  curY += 18;

  if (debtors.length === 0) {
    pdf.rect(40, curY, 515, 20, [1, 1, 1], [0.88, 0.91, 0.95], 0.5);
    pdf.text('Qarzdorlar yo\'q. Barcha to\'lovlar o\'z vaqtida amalga oshirilgan.', 297, curY + 6, { font: 'regular', size: 8, color: [0.2, 0.5, 0.2], align: 'center' });
    curY += 24;
  } else {
    const shownDebtors = debtors.slice(0, 12);
    shownDebtors.forEach((d, idx) => {
      if (curY > 770) {
        pdf.addPage();
        drawHeader(false);
        curY = 70;
      }
      const bg = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 0.99];
      const r = d.resident;
      pdf.rect(40, curY, 515, 17, bg, [0.88, 0.91, 0.95], 0.5);
      pdf.text(String(idx + 1), 54, curY + 4, { font: 'regular', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      pdf.text(`${r.block} blok, ${r.room}-xona`, 100, curY + 4, { font: 'regular', size: 7.5, color: [0.1, 0.2, 0.4] });
      pdf.text(`${r.lastName} ${r.firstName}`, 210, curY + 4, { font: 'bold', size: 8, color: [0.08, 0.12, 0.2] });
      pdf.text(r.phone || '-', 380, curY + 4, { font: 'regular', size: 7.5, color: [0.2, 0.3, 0.4], align: 'center' });
      pdf.text(`${fmtMoney(d.status.owed)} so'm`, 545, curY + 4, { font: 'bold', size: 8, color: [0.75, 0.1, 0.1], align: 'right' });
      curY += 17;
    });
    if (debtors.length > shownDebtors.length) {
      pdf.rect(40, curY, 515, 16, [0.96, 0.97, 0.99], [0.88, 0.91, 0.95], 0.5);
      pdf.text(`... va yana ${debtors.length - shownDebtors.length} ta qarzdor (Qarzdorlar ro'yxati alohida faylda)`, 297, curY + 4, { font: 'oblique', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      curY += 16;
    }
    curY += 8;
  }

  // Section 2: Oxirgi to'lovlar
  if (curY > 730) {
    pdf.addPage();
    drawHeader(false);
    curY = 70;
  }
  const recentPayments = [...state.payments].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  pdf.rect(40, curY, 515, 18, [0.1, 0.24, 0.48]);
  pdf.text(`OXIRGI QABUL QILINGAN TO'LOVLAR (${state.payments.length} tadan namunalar)`, 48, curY + 4.5, { font: 'bold', size: 8.5, color: [1, 1, 1] });
  curY += 18;

  if (recentPayments.length === 0) {
    pdf.rect(40, curY, 515, 20, [1, 1, 1], [0.88, 0.91, 0.95], 0.5);
    pdf.text('To\'lovlar tarixi bo\'sh.', 297, curY + 6, { font: 'regular', size: 8, color: [0.5, 0.55, 0.6], align: 'center' });
    curY += 24;
  } else {
    recentPayments.forEach((p, idx) => {
      if (curY > 770) {
        pdf.addPage();
        drawHeader(false);
        curY = 70;
      }
      const bg = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 0.99];
      const resident = state.residents.find(r => r.id === p.residentId);
      const name = resident ? `${resident.lastName} ${resident.firstName}` : 'Noma\'lum';
      const room = resident ? `${resident.block}-${resident.room}` : '-';
      pdf.rect(40, curY, 515, 17, bg, [0.88, 0.91, 0.95], 0.5);
      pdf.text(String(idx + 1), 54, curY + 4, { font: 'regular', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      pdf.text(p.date, 95, curY + 4, { font: 'regular', size: 7.5, color: [0.3, 0.35, 0.4], align: 'center' });
      pdf.text(room, 145, curY + 4, { font: 'regular', size: 7.5, color: [0.2, 0.3, 0.4], align: 'center' });
      pdf.text(name, 185, curY + 4, { font: 'bold', size: 8, color: [0.08, 0.12, 0.2] });
      pdf.text(p.method === 'card' ? 'Karta' : 'Naqd pul', 380, curY + 4, { font: 'regular', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      pdf.text(`+${fmtMoney(p.amount)} so'm`, 545, curY + 4, { font: 'bold', size: 8, color: [0.1, 0.55, 0.2], align: 'right' });
      curY += 17;
    });
    curY += 8;
  }

  // Section 3: Oxirgi xarajatlar
  if (curY > 730) {
    pdf.addPage();
    drawHeader(false);
    curY = 70;
  }
  const recentExpenses = [...state.expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  pdf.rect(40, curY, 515, 18, [0.1, 0.24, 0.48]);
  pdf.text(`OXIRGI XARAJATLAR (${state.expenses.length} tadan namunalar)`, 48, curY + 4.5, { font: 'bold', size: 8.5, color: [1, 1, 1] });
  curY += 18;

  if (recentExpenses.length === 0) {
    pdf.rect(40, curY, 515, 20, [1, 1, 1], [0.88, 0.91, 0.95], 0.5);
    pdf.text('Xarajatlar tarixi bo\'sh.', 297, curY + 6, { font: 'regular', size: 8, color: [0.5, 0.55, 0.6], align: 'center' });
    curY += 24;
  } else {
    const catMap = { utilities: 'Kommunal', tax: 'Soliq', other: 'Xo\'jalik' };
    recentExpenses.forEach((e, idx) => {
      if (curY > 770) {
        pdf.addPage();
        drawHeader(false);
        curY = 70;
      }
      const bg = idx % 2 === 0 ? [1, 1, 1] : [0.97, 0.98, 0.99];
      pdf.rect(40, curY, 515, 17, bg, [0.88, 0.91, 0.95], 0.5);
      pdf.text(String(idx + 1), 54, curY + 4, { font: 'regular', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      pdf.text(e.date, 95, curY + 4, { font: 'regular', size: 7.5, color: [0.3, 0.35, 0.4], align: 'center' });
      pdf.text(e.name, 150, curY + 4, { font: 'bold', size: 8, color: [0.08, 0.12, 0.2] });
      pdf.text(catMap[e.category] || 'Boshqa', 380, curY + 4, { font: 'regular', size: 7.5, color: [0.4, 0.45, 0.5], align: 'center' });
      pdf.text(`-${fmtMoney(e.amount)} so'm`, 545, curY + 4, { font: 'bold', size: 8, color: [0.8, 0.15, 0.15], align: 'right' });
      curY += 17;
    });
    curY += 16;
  }

  // Signatures
  if (curY > 750) {
    pdf.addPage();
    drawHeader(false);
    curY = 70;
  }
  pdf.text('Hisobotni tuzdi: ________________________ (Imzo)', 50, curY + 10, { font: 'regular', size: 8, color: [0.3, 0.35, 0.4] });
  pdf.text('Rahbar: ________________________ (Imzo)', 350, curY + 10, { font: 'regular', size: 8, color: [0.3, 0.35, 0.4] });

  return pdf.build('Makon - Umumiy moliyaviy hisobot');
}
