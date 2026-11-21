import fs from 'node:fs';

const logo = fs.readFileSync('makon-demo/dist/icon.svg', 'utf8');
const blueLogo = logo.replaceAll('#184d3b', '#1d4ed8').replaceAll('#d9e9bc', '#dbeafe');
fs.writeFileSync('makon-demo/dist/icon.svg', blueLogo, 'utf8');

const blueExtra = fs.readFileSync('phone-themes/blue.css', 'utf8');
let css = fs.readFileSync('makon-demo/dist/styles.css', 'utf8');

css = css.replace(/#([\da-f]{8}|[\da-f]{6}|[\da-f]{4}|[\da-f]{3})\b/gi, (original, hex) => {
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
  const rgb = [0, chroma * (1 - Math.abs((218 / 60) % 2 - 1)), chroma];
  return '#' + rgb.map(c => Math.round((c + offset) * 255).toString(16).padStart(2, '0')).join('') + alpha;
});
css += '\n' + blueExtra;
fs.writeFileSync('makon-demo/dist/styles.css', css, 'utf8');

let html = fs.readFileSync('makon-demo/dist/index.html', 'utf8');
html = html
  .replace('<body>', '<body data-theme="blue">')
  .replace('content="#184d3b"', 'content="#10243e"')
  .replace('<title>Makon — Yotoqxona boshqaruvi</title>', '<title>Makon — Yotoqxona boshqaruvi</title>');
fs.writeFileSync('makon-demo/dist/index.html', html, 'utf8');

console.log('Blue theme applied successfully to makon-demo/dist!');
