import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Script } from 'node:vm';
const { parseHTML } = createRequire(new URL('./makon-demo/package.json', import.meta.url))('linkedom');
const fileName = process.argv[2] || 'Makon-demo.html';
const html = await readFile(new URL(`./${fileName}`, import.meta.url), 'utf8');
const { window, document } = parseHTML(html);
const modal = document.querySelector('#modal');
modal.showModal = () => { modal.open = true; };
modal.close = () => { modal.open = false; };
window.scrollTo = () => {};
const context = {
  window, document, console, Intl, Date,
  location: { hash: '', href: 'file:///storage/emulated/0/Download/Makon-demo.html' },
  history: { replaceState() { throw new Error('History unavailable for local file'); } },
  localStorage: {
    getItem() { throw new Error('Storage unavailable for local file'); },
    setItem() { throw new Error('Storage unavailable for local file'); },
  },
  setTimeout() { return 1; }, clearTimeout() {},
};
assert.equal(document.querySelectorAll('script').length, 1);
assert.equal(document.querySelectorAll('script[src],link[rel="stylesheet"],link[rel="manifest"]').length, 0);
for (const image of document.querySelectorAll('img')) assert.ok(image.src.startsWith('data:'));
new Script(document.querySelector('script').textContent).runInNewContext(context);
assert.equal(document.querySelectorAll('#app .stat-card').length, 4);
for (const route of ['rooms', 'residents', 'vacancies', 'debtors', 'expenses', 'dashboard']) {
  document.querySelector(`.side-nav [data-nav="${route}"]`).dispatchEvent(new window.Event('click', { bubbles: true }));
  assert.ok(document.querySelector('#app h1').textContent);
  assert.equal(document.querySelector(`.side-nav [data-nav="${route}"]`).getAttribute('aria-current'), 'page');
  if (route === 'rooms') assert.equal(document.querySelectorAll('.room-card').length, 46);
  if (route === 'residents') assert.equal(document.querySelectorAll('.data-table tbody tr').length, 0);
}
document.querySelector('[data-action="payment-picker"]').dispatchEvent(new window.Event('click', { bubbles: true }));
assert.equal(modal.open, true);
assert.equal(document.querySelectorAll('#payment-results .search-result').length, 0);
console.log('PASS: standalone file loads; all six sections and payment picker work without external assets.');
console.log('PASS: blocked history/storage and absent structuredClone do not break startup/navigation.');
