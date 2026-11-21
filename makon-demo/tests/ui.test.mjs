import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseHTML } from 'linkedom';
import { todayISO, addDays, residentStatus, roomOccupants, getSummary } from '../dist/engine.mjs';

// This is an event-driven DOM integration test, not a rendering/browser test.
// Linkedom supplies the DOM; only browser services it lacks are shimmed.
const STORAGE_KEY = 'makon.hostel.v2';
const html = await readFile(new URL('../dist/index.html', import.meta.url), 'utf8');

function createEnvironment(savedEntries = []) {
  const { window, document } = parseHTML(html);
  const storage = new Map(savedEntries);
  const location = { hash: '', href: 'http://localhost/' };
  const localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
    clear: () => storage.clear(),
  };
  const history = { replaceState: (_state, _unused, url) => { location.hash = String(url).includes('#') ? `#${String(url).split('#')[1]}` : ''; } };

  // Native selects default to their first option and support assigning value.
  // Linkedom currently only implements the selected-option getter.
  Object.defineProperty(window.HTMLSelectElement.prototype, 'value', {
    configurable: true,
    get() { return (this.querySelector('option[selected]') || this.querySelector('option'))?.value ?? ''; },
    set(value) { for (const option of this.querySelectorAll('option')) { if (option.value === String(value)) option.setAttribute('selected', ''); else option.removeAttribute('selected'); } },
  });
  Object.defineProperty(window.HTMLElement.prototype, 'elements', {
    configurable: true,
    get() { return Object.fromEntries([...this.querySelectorAll('input[name],select[name],textarea[name]')].map(control => [control.name || control.getAttribute('name'), control])); },
  });
  class DOMFormData {
    constructor(form) {
      this.entries = [...form.querySelectorAll('input[name],select[name],textarea[name]')]
        .filter(control => !control.disabled && (!['checkbox', 'radio'].includes(control.type) || control.checked))
        .map(control => [control.name || control.getAttribute('name'), control.value]);
    }
    [Symbol.iterator]() { return this.entries[Symbol.iterator](); }
  }
  const modal = document.querySelector('#modal');
  Object.defineProperty(modal, 'open', { configurable: true, get() { return this.hasAttribute('open'); } });
  modal.showModal = function () { this.setAttribute('open', ''); };
  modal.close = function () { this.removeAttribute('open'); this.dispatchEvent(new window.Event('close')); };
  window.scrollTo = () => {};
  const originalTimeout = globalThis.setTimeout;
  const globals = { window, document, localStorage, location, history, FormData: DOMFormData, setTimeout: (fn, ms, ...args) => { const timer = originalTimeout(fn, ms, ...args); timer.unref?.(); return timer; } };
  const originals = new Map(Object.keys(globals).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(globals)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });

  const find = selector => {
    const element = document.querySelector(selector);
    assert.ok(element, `Expected DOM element: ${selector}`);
    return element;
  };
  const dispatch = (element, type) => element.dispatchEvent(new window.Event(type, { bubbles: true, cancelable: true }));
  const click = selector => dispatch(find(selector), 'click');
  const fill = (selector, value, event = 'input') => { const element = find(selector); element.value = String(value); dispatch(element, event); };
  const submit = selector => dispatch(find(selector), 'submit');
  const nav = name => click(`.side-nav [data-nav="${name}"]`);
  const data = () => JSON.parse(localStorage.getItem(STORAGE_KEY));
  const assertSaved = () => { assert.equal(modal.open, false, document.querySelector('#form-error')?.textContent || 'Expected successful form submission'); };
  const restore = () => { for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; } };
  return { window, document, storage, location, find, click, fill, submit, nav, data, assertSaved, restore };
}

const numericText = text => String(text).replace(/\s/g, '');

test('actual app DOM: navigation, payments, residents, expenses, date reports and persisted state', async t => {
  const env = createEnvironment();
  const { document, find, click, fill, submit, nav, data, assertSaved } = env;
  let residentId;
  const maliciousName = '<img src=x onerror=alert(1)>';
  const phone = '+998 99 111 22 33';
  const today = todayISO();
  globalThis.__FORCE_SEED__ = true;
  try {
    await import(`../dist/app.mjs?ui-smoke=${Date.now()}`);

    await t.test('all six navigation destinations render and inventory counts agree', () => {
      assert.equal(data().residents.length, 151);
      for (const page of ['dashboard', 'rooms', 'residents', 'vacancies', 'debtors', 'expenses']) {
        nav(page);
        assert.equal(env.location.hash, `#${page}`);
        assert.ok(find('#app h1').textContent.trim());
        assert.equal(find(`.side-nav [data-nav="${page}"]`).getAttribute('aria-current'), 'page');
      }
      nav('rooms');
      assert.equal(document.querySelectorAll('.room-card').length, 46);
      nav('residents');
      assert.equal(document.querySelectorAll('.data-table tbody tr').length, 151);
      nav('debtors');
      assert.equal(document.querySelectorAll('.data-table tbody tr').length, 17);
      nav('vacancies');
      assert.equal(document.querySelectorAll('.room-card').length, 25);
    });

    await t.test('empty room opens and preserves selected room when adding a resident', () => {
      click('[data-action="room"][data-block-id="C"][data-room="18"]');
      assert.equal(find('#modal').open, true);
      assert.equal(document.querySelectorAll('#modal .free-slot').length, 4);
      click('#modal [data-action="add-resident"]');
      assert.equal(find('[name="roomChoice"]').value, 'C-18');
      fill('[name="firstName"]', maliciousName);
      fill('[name="lastName"]', 'Sinovbek');
      fill('[name="phone"]', phone);
      fill('[name="joined"]', today);
      fill('[name="initialPayment"]', '300000');
      fill('[name="method"]', 'cash', 'change');
      submit('#resident-form');
      assertSaved();
      const state = data();
      const resident = state.residents.find(item => item.lastName === 'Sinovbek');
      assert.ok(resident);
      residentId = resident.id;
      assert.equal(state.residents.length, 152);
      assert.equal(resident.block, 'C');
      assert.equal(resident.room, 18);
      assert.equal(resident.phone, '+998991112233');
      assert.equal(residentStatus(state, resident).owed, 500000);
      assert.equal(state.payments.find(payment => payment.residentId === resident.id).amount, 300000);
    });

    await t.test('user-controlled name stays literal text in rooms and profiles', () => {
      nav('rooms');
      click('[data-action="room"][data-block-id="C"][data-room="18"]');
      assert.ok(find('#modal').textContent.includes(maliciousName));
      assert.equal(document.querySelectorAll('#modal img, #modal [onerror]').length, 0);
      click(`#modal [data-action="profile"][data-id="${residentId}"]`);
      assert.ok(find('#modal').textContent.includes(maliciousName));
      assert.equal(document.querySelectorAll('#modal img, #modal [onerror]').length, 0);
    });

    await t.test('partial payment updates preview, stored ledger and remaining debt', () => {
      click(`#modal [data-action="pay"][data-id="${residentId}"]`);
      fill('#payment-amount', '200000');
      assert.ok(numericText(find('#payment-preview').textContent).includes('300000'));
      fill('[name="method"]', 'card', 'change');
      submit('#payment-form');
      assertSaved();
      const state = data(), resident = state.residents.find(item => item.id === residentId);
      assert.equal(residentStatus(state, resident).owed, 300000);
      const payments = state.payments.filter(payment => payment.residentId === residentId);
      assert.equal(payments.length, 2);
      assert.equal(payments.at(-1).amount, 200000);
      assert.equal(payments.at(-1).method, 'card');
    });

    await t.test('checkout frees the room and keeps outstanding debt and payment history', () => {
      click('[data-action="room"][data-block-id="C"][data-room="18"]');
      click(`#modal [data-action="profile"][data-id="${residentId}"]`);
      click(`#modal [data-action="checkout"][data-id="${residentId}"]`);
      submit('#checkout-form');
      assertSaved();
      const state = data(), resident = state.residents.find(item => item.id === residentId);
      assert.equal(resident.active, false);
      assert.equal(resident.leftAt, today);
      assert.equal(roomOccupants(state, 'C', 18).length, 0);
      assert.equal(residentStatus(state, resident).owed, 300000);
      assert.equal(state.payments.filter(payment => payment.residentId === residentId).length, 2);
      nav('debtors');
      assert.ok(document.querySelector(`[data-action="pay"][data-id="${residentId}"]`));
    });

    await t.test('expense submission updates stored expenses and dashboard profit', () => {
      const before = getSummary(data(), addDays(today, -29), today, today);
      nav('expenses');
      click('[data-action="add-expense"]');
      fill('[name="name"]', 'Sinov uchun xo‘jalik mollari');
      fill('[name="amount"]', '125000');
      fill('[name="category"]', 'other', 'change');
      fill('[name="date"]', today);
      submit('#expense-form');
      assertSaved();
      const state = data(), after = getSummary(state, addDays(today, -29), today, today);
      assert.equal(after.expenses, before.expenses + 125000);
      assert.equal(after.profit, before.profit - 125000);
      assert.equal(state.expenses.at(-1).category, 'other');
      nav('dashboard');
      const values = [...document.querySelectorAll('.stat-value')].map(element => numericText(element.textContent));
      assert.ok(values[2].includes(String(after.expenses)));
      assert.ok(values[3].includes(String(after.profit)));
    });

    await t.test('custom report range updates cash totals and chart buckets', () => {
      fill('#period', 'custom', 'change');
      fill('[name="from"]', today);
      fill('[name="to"]', today);
      submit('#period-form');
      assertSaved();
      assert.equal(find('#period').value, 'custom');
      assert.equal(document.querySelectorAll('.chart-column').length, 1);
      const expected = getSummary(data(), today, today, today);
      assert.ok(numericText(find('.chart-total').textContent).includes(String(expected.collected)));
      assert.ok(numericText(document.querySelectorAll('.stat-value')[2].textContent).includes(String(expected.expenses)));
    });

    await t.test('formatted phone search works in global and payment pickers', () => {
      click('[data-action="global-search"]');
      fill('#global-search', phone);
      assert.ok(document.querySelector(`#global-results [data-id="${residentId}"]`));
      assert.equal(document.querySelectorAll('#global-results img, #global-results [onerror]').length, 0);
      click('#modal [data-action="close-modal"]');
      click('[data-action="payment-picker"]');
      fill('#payment-search', phone);
      assert.ok(document.querySelector(`#payment-results [data-id="${residentId}"]`));
      click(`#payment-results [data-id="${residentId}"]`);
      assert.equal(find('#payment-amount').getAttribute('max'), '300000');
      submit('#payment-form');
      assertSaved();
      const state = data(), resident = state.residents.find(item => item.id === residentId);
      assert.equal(residentStatus(state, resident).owed, 0);
      nav('debtors');
      assert.equal(document.querySelector(`[data-action="pay"][data-id="${residentId}"]`), null);
    });

    await t.test('mistaken payment and expense can be cancelled and deleted', () => {
      nav('residents');
      fill('#status-filter', 'inactive', 'change');
      click(`[data-action="profile"][data-id="${residentId}"]`);
      const residentPayments = data().payments.filter(p => p.residentId === residentId);
      assert.ok(residentPayments.length > 0);
      const targetPayment = residentPayments[0];
      click(`[data-action="delete-payment-confirm"][data-id="${targetPayment.id}"]`);
      click('[data-action="delete-payment"]');
      assert.equal(data().payments.some(p => p.id === targetPayment.id), false);
      click('#modal [data-action="close-modal"]');
      assertSaved();

      nav('expenses');
      const stateWithExpenses = data();
      const lastExpense = stateWithExpenses.expenses[stateWithExpenses.expenses.length - 1];
      click(`[data-action="delete-expense-confirm"][data-id="${lastExpense.id}"]`);
      click('[data-action="delete-expense"]');
      assertSaved();
      assert.equal(data().expenses.some(e => e.id === lastExpense.id), false);
    });

    await t.test('fresh app import restores saved residents, payments and expenses', async () => {
      const savedState = data();
      const second = createEnvironment([...env.storage]);
      try {
        await import(`../dist/app.mjs?ui-reload=${Date.now()}`);
        assert.deepEqual(second.data(), savedState);
        second.nav('residents');
        second.fill('#status-filter', 'inactive', 'change');
        assert.ok(second.document.querySelector(`[data-action="profile"][data-id="${residentId}"]`));
        assert.equal(second.document.querySelectorAll('#app img, #app [onerror]').length, 0);
      } finally { second.restore(); }
    });
  } finally { env.restore(); }
});
