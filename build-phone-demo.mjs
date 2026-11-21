import { readFile, writeFile } from 'node:fs/promises';
import { Script } from 'node:vm';

const isBlue = process.argv.includes('--blue');
const fileName = isBlue ? 'Makon-demo-kok.html' : 'Makon-demo.html';
const root = new URL('./makon-demo/dist/', import.meta.url);
const [html, css, engine, app, logo] = await Promise.all(
  ['index.html', 'styles.css', 'engine.mjs', 'app.mjs', 'icon.svg']
    .map(file => readFile(new URL(file, root), 'utf8'))
);
const variantLogo = isBlue ? logo.replaceAll('#184d3b', '#1d4ed8').replaceAll('#d9e9bc', '#dbeafe') : logo;
const icon = `data:image/svg+xml;base64,${Buffer.from(variantLogo).toString('base64')}`;
const portableApp = app
  .replace(/^import\s+\{[^}]+\}\s+from\s+['"]\.\/engine\.mjs['"];?\s*/m, '')
  .replace("history.replaceState(null,'',`#${page}`);", "try { history.replaceState(null,'',`#${page}`); } catch { /* Some phone file viewers disallow changing history. */ }")
  .replace('Telefonda saytni ochib, brauzer menyusidan “Bosh ekranga qo‘shish” orqali ilovadek ishlatish mumkin.', `Bu bitta faylli demo. ${fileName} faylini brauzerda oching. Fayl ko‘ruvchi dasturga qarab o‘zgarishlarni saqlash imkoniyati farq qilishi mumkin.`);
const javascript = `(() => {\n'use strict';\nconst structuredClone = globalThis.structuredClone || (value => JSON.parse(JSON.stringify(value)));\n${engine.replace(/^export\s+/gm, '')}\n${portableApp}\n})();`;
new Script(javascript, { filename: fileName });
let styles = css.replace(/@import\s+url\([^)]*\)\s*;/g, '');
if (isBlue) {
  // Convert the original sage neutrals as well as saturated greens. Preserve
  // amber/red financial warning colors and each color's transparency.
  styles = styles.replace(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/gi, (original, hex) => {
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map(c => c + c).join('');
    const alpha = hex.slice(6);
    const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
    if (delta < 0.005) return original;
    let hue = max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
    hue *= 60;
    if (hue < 65 || hue > 180) return original;
    const lightness = (max + min) / 2;
    const saturation = delta / (1 - Math.abs(2 * lightness - 1));
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
    const offset = lightness - chroma / 2;
    // Hue 218 degrees, in the blue segment of the HSL color wheel.
    const rgb = [0, chroma * (1 - Math.abs((218 / 60) % 2 - 1)), chroma];
    return '#' + rgb.map(c => Math.round((c + offset) * 255).toString(16).padStart(2, '0')).join('') + alpha;
  });
  styles += '\n' + await readFile(new URL('./phone-themes/blue.css', import.meta.url), 'utf8');
}
let output = html
  .replace(/\s*<link\b[^>]*rel="manifest"[^>]*>/g, '')
  .replace(/<link\b[^>]*rel="stylesheet"[^>]*>/g, () => `<style>\n${styles}\n</style>`)
  .replaceAll('./icon.svg', icon)
  .replace(/<script\b[^>]*src="\.\/app\.mjs"[^>]*><\/script>/, () => `<script>\n${javascript.replace(/<\/script/gi, '<\\/script')}\n</script>`)
  .replace('<main id="app" tabindex="-1" aria-live="polite"></main>', '<main id="app" tabindex="-1" aria-live="polite"><p style="padding:24px">Makon yuklanmoqda. Menyu ochilmasa, faylni JavaScript ishlaydigan brauzerda oching.</p><noscript><p>Demo ishlashi uchun brauzerda JavaScript yoqilgan bo‘lishi kerak.</p></noscript></main>');
if (isBlue) {
  output = output.replace('<body>', '<body data-theme="blue">')
    .replace('content="#184d3b"', 'content="#10243e"')
    .replace('<title>Makon — Yotoqxona boshqaruvi</title>', '<title>Makon — Ko‘k dizayn</title>');
}
if (/<script\b[^>]*src=|<link\b[^>]*rel="(?:stylesheet|manifest)"|@import|type="module"/.test(output)) {
  throw new Error('Portable output still depends on external files.');
}
const destination = new URL(`./${fileName}`, import.meta.url);
await writeFile(destination, output, 'utf8');
console.log(`Created ${decodeURIComponent(destination.pathname)} (${Buffer.byteLength(output)} bytes)`);
