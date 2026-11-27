import test from 'node:test';
import assert from 'node:assert/strict';
import { RATE, CAPACITY, BLOCKS, todayISO, addDays, daysBetween, roomList, roomOccupants, seedData, residentStatus, getSummary, addResident, recordPayment, checkoutResident, addExpense, deletePayment, deleteExpense, createZip, generateDocxReport, generateDebtorsPdf, generateReportPdf } from '../dist/engine.mjs';

const empty = () => ({ version: 1, residents: [], payments: [], expenses: [] });
const input = (overrides = {}) => ({ firstName: 'Aziz', lastName: 'Karimov', phone: '+998 90 123 45 67', block: 'A', room: 1, joined: '2026-01-01', ...overrides });
const add = (state, overrides = {}) => addResident(state, input(overrides));

test('physical inventory is exactly 3 blocks, 46 rooms, 184 beds', () => {
  assert.deepEqual(BLOCKS.map(block => block.rooms), [14, 14, 18]);
  assert.equal(roomList().length, 46);
  assert.equal(roomList().reduce((sum, room) => sum + room.capacity, 0), CAPACITY);
  assert.equal(roomList().filter(room => room.room === 1).length, 3);
});

test('calendar arithmetic crosses leap days and year boundaries without timezone drift', () => {
  assert.equal(addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(addDays('2025-12-31', 1), '2026-01-01');
  assert.equal(daysBetween('2026-01-01', '2026-01-31'), 30);
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  assert.throws(() => addDays('2026-02-30', 1));
});

test('arrival charge, partial payment and 30-day rollover preserve arrears', () => {
  const state = empty(), resident = add(state);
  assert.equal(residentStatus(state, resident, '2026-01-01').owed, RATE);
  recordPayment(state, resident.id, 300000, 'cash', '2026-01-01');
  assert.equal(residentStatus(state, resident, '2026-01-30').owed, 500000);
  const rolled = residentStatus(state, resident, '2026-01-31');
  assert.equal(rolled.owed, 1300000);
  assert.equal(rolled.cycleNumber, 2);
  assert.equal(rolled.cycleStart, '2026-01-31');
  recordPayment(state, resident.id, 1300000, 'card', '2026-01-31');
  assert.equal(residentStatus(state, resident, '2026-01-31').owed, 0);
  assert.equal(residentStatus(state, resident, '2026-01-31').paidThisCycle, RATE);
});

test('day-25 reminder can be cleared by paying next period early', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, RATE, 'cash', '2026-01-01');
  assert.equal(residentStatus(state, resident, '2026-01-25').status, 'paid');
  assert.equal(residentStatus(state, resident, '2026-01-26').status, 'soon');
  assert.equal(residentStatus(state, resident, '2026-01-26').daysUntilDue, 5);
  recordPayment(state, resident.id, RATE, 'cash', '2026-01-26');
  const prepaid = residentStatus(state, resident, '2026-01-26');
  assert.equal(prepaid.status, 'paid');
  assert.equal(prepaid.nextDue, '2026-03-02');
  assert.throws(() => recordPayment(state, resident.id, 1, 'cash', '2026-01-26'));
  assert.equal(residentStatus(state, resident, '2026-01-31').owed, 0);
});

test('historical status does not include later payments', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, RATE, 'card', '2026-01-10');
  assert.equal(residentStatus(state, resident, '2026-01-09').owed, RATE);
  assert.equal(residentStatus(state, resident, '2026-01-10').owed, 0);
});

test('a missing old receipt can be entered when later receipts cover later charges', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, 1600000, 'card', '2026-01-31');
  assert.doesNotThrow(() => recordPayment(state, resident.id, 800000, 'cash', '2026-01-01'));
  assert.equal(residentStatus(state, resident, '2026-01-01').owed, 0);
  assert.equal(residentStatus(state, resident, '2026-01-31').totalPaid, 2400000);
});

test('backdating cannot hide excessive advance credit at a later receipt date', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, RATE, 'cash', '2026-01-01');
  recordPayment(state, resident.id, RATE, 'cash', '2026-01-26');
  assert.throws(() => recordPayment(state, resident.id, 1, 'cash', '2026-01-10'));
  assert.equal(state.payments.length, 2);
});

test('departed residents cannot receive advances or have checkout backdated before receipts', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, 300000, 'cash', '2026-01-10');
  assert.throws(() => checkoutResident(state, resident.id, '2026-01-09'));
  assert.equal(resident.active, true);
  checkoutResident(state, resident.id, '2026-01-15');
  assert.throws(() => recordPayment(state, resident.id, 500001, 'cash', '2026-01-05'));
  recordPayment(state, resident.id, 500000, 'cash', '2026-01-05');
  assert.equal(residentStatus(state, resident, '2026-03-01').owed, 0);
  assert.throws(() => checkoutResident(state, resident.id, '2026-01-16'));
});

test('checkout frees one bed, freezes billing and retains debt and payment history', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, 300000, 'cash', '2026-01-10');
  checkoutResident(state, resident.id, '2026-01-15');
  assert.equal(state.residents.length, 1);
  assert.equal(state.payments.length, 1);
  assert.equal(roomOccupants(state, 'A', 1).length, 0);
  const departed = residentStatus(state, resident, '2026-03-01');
  assert.equal(departed.owed, 500000);
  assert.equal(departed.totalCharged, RATE);
  assert.equal(departed.nextDue, null);
  assert.equal(getSummary(state, '2026-01-01', '2026-03-01', '2026-03-01').debtors, 1);
  recordPayment(state, resident.id, 500000, 'card', '2026-02-01');
  assert.equal(residentStatus(state, resident, '2026-03-01').owed, 0);
  assert.throws(() => recordPayment(state, resident.id, 1, 'cash', '2026-02-02'));
});

test('period totals are inclusive and separate current snapshot from filtered receipts', () => {
  const state = empty(), resident = add(state);
  recordPayment(state, resident.id, 300000, 'cash', '2026-01-01');
  recordPayment(state, resident.id, 500000, 'card', '2026-01-31');
  addExpense(state, { name: 'Internet', amount: 100000, category: 'utilities', date: '2026-01-31' });
  const summary = getSummary(state, '2026-01-31', '2026-01-31', '2026-02-01');
  assert.equal(summary.collected, 500000);
  assert.equal(summary.expenses, 100000);
  assert.equal(summary.profit, 400000);
  assert.equal(summary.owed, RATE);
  assert.equal(summary.expected, RATE);
  assert.equal(summary.occupied, 1);
  assert.equal(summary.vacant, 183);
  const before = getSummary(state, '2025-01-01', '2025-12-31', '2026-02-01');
  assert.equal(before.expected, 0);
  assert.equal(before.collected, 0);
  assert.equal(before.owed, RATE);
  assert.throws(() => getSummary(state, '2026-02-01', '2026-01-01'));
});

test('a room rejects its fifth resident and accepts replacement after checkout', () => {
  const state = empty();
  for (let i = 0; i < 4; i++) add(state);
  assert.throws(() => add(state), /bo‘sh joy/);
  checkoutResident(state, state.residents[0].id, '2026-01-02');
  assert.doesNotThrow(() => add(state));
  assert.equal(roomOccupants(state, 'A', 1).length, 4);
});

test('validation rejects bad dates, invalid inventory, unsupported methods and unsafe amounts atomically', () => {
  const state = empty();
  for (const overrides of [{ room: 15 }, { block: 'D' }, { phone: 'abc' }, { joined: '2026-02-30' }, { joined: '2999-01-01' }, { firstName: '' }]) assert.throws(() => add(state, overrides));
  assert.equal(state.residents.length, 0);
  const resident = add(state);
  assert.equal(resident.phone, '+998901234567');
  for (const amount of [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER, '', null, true]) assert.throws(() => recordPayment(state, resident.id, amount, 'cash', '2026-01-02'));
  assert.throws(() => recordPayment(state, resident.id, RATE, 'crypto', '2026-01-02'));
  assert.throws(() => recordPayment(state, resident.id, RATE, 'cash', '2025-12-31'));
  assert.throws(() => recordPayment(state, resident.id, RATE, 'cash', '2999-01-01'));
  assert.equal(state.payments.length, 0);
  assert.throws(() => addExpense(state, { name: 'Bad expense', amount: -1, category: 'other', date: '2026-01-01' }));
  assert.throws(() => addExpense(state, { name: 'Bad expense', amount: 100, category: 'unknown', date: '2026-01-01' }));
  assert.equal(state.expenses.length, 0);
});

test('seed contains usable vacancies, 151 fictional residents and 17 debtors', () => {
  const state = seedData('2026-11-03');
  const summary = getSummary(state, '2026-11-01', '2026-11-03', '2026-11-03');
  assert.equal(state.residents.length, 151);
  assert.equal(summary.occupied, 151);
  assert.equal(summary.vacant, 33);
  assert.equal(summary.debtors, 17);
  assert.ok(summary.dueSoon > 0);
  assert.ok(summary.collected > 0);
  assert.ok(summary.expenses > 0);
  assert.ok(roomList().some(room => roomOccupants(state, room.block, room.room).length === 0));
  assert.ok(roomList().every(room => roomOccupants(state, room.block, room.room).length <= 4));
  assert.deepEqual(seedData('2026-11-03'), state);
  assert.ok(state.payments.every(payment => payment.date <= '2026-11-03'));
});

test('default last-30-day dashboard totals match seeded ledger and expense categories', () => {
  const today = '2026-11-03', from = addDays(today, -29), state = seedData(today);
  const summary = getSummary(state, from, today, today);
  assert.equal(summary.collected, state.payments.filter(payment => payment.date >= from && payment.date <= today).reduce((sum, payment) => sum + payment.amount, 0));
  assert.equal(summary.expected, state.residents.length * RATE);
  assert.equal(summary.profit, summary.collected - summary.expenses);
  assert.ok(state.expenses.some(expense => expense.category === 'tax'));
  assert.ok(state.expenses.some(expense => expense.category === 'utilities'));
  assert.ok(state.expenses.some(expense => expense.category === 'other'));
});

test('deletePayment removes payment and restores arrears correctly', () => {
  const state = empty(), resident = add(state);
  const payment = recordPayment(state, resident.id, 500000, 'cash', '2026-01-01');
  assert.equal(residentStatus(state, resident, '2026-01-01').owed, 300000);
  const removed = deletePayment(state, payment.id);
  assert.equal(removed.id, payment.id);
  assert.equal(state.payments.length, 0);
  assert.equal(residentStatus(state, resident, '2026-01-01').owed, RATE);
  assert.throws(() => deletePayment(state, 'non-existent'));
});

test('deleteExpense removes expense and updates summary', () => {
  const state = empty();
  const expense = addExpense(state, { name: 'Elektr', amount: 500000, category: 'utilities', date: '2026-01-01' });
  assert.equal(state.expenses.length, 1);
  const removed = deleteExpense(state, expense.id);
  assert.equal(removed.id, expense.id);
  assert.equal(state.expenses.length, 0);
  assert.throws(() => deleteExpense(state, 'non-existent'));
});

test('generateDocxReport and createZip produce valid docx archive', () => {
  const zip = createZip([{ name: 'test.txt', content: 'test' }]);
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  assert.equal(zip[2], 0x03);
  assert.equal(zip[3], 0x04);

  const state = seedData();
  const docx = generateDocxReport(state, '2026-11-22');
  assert.ok(docx instanceof Uint8Array);
  assert.ok(docx.length > 2000);
  assert.equal(docx[0], 0x50);
  assert.equal(docx[1], 0x4b);
});

test('custom monthlyRate in settings changes billing calculations', () => {
  const state = empty();
  state.settings = { monthlyRate: 600000 };
  const resident = add(state, { joined: '2026-01-01' });
  const status = residentStatus(state, resident, '2026-01-01');
  assert.equal(status.owed, 600000);
});

test('generateDebtorsPdf produces valid PDF binary', () => {
  const state = seedData();
  const pdf = generateDebtorsPdf(state, '2026-11-27');
  assert.ok(pdf instanceof Uint8Array);
  assert.ok(pdf.length > 1000);
  const text = new TextDecoder().decode(pdf.slice(0, 8));
  assert.equal(text.slice(0, 5), '%PDF-');
});

test('generateReportPdf produces valid PDF binary', () => {
  const state = seedData();
  const pdf = generateReportPdf(state, '2026-11-27');
  assert.ok(pdf instanceof Uint8Array);
  assert.ok(pdf.length > 2000);
  const text = new TextDecoder().decode(pdf.slice(0, 8));
  assert.equal(text.slice(0, 5), '%PDF-');
});
