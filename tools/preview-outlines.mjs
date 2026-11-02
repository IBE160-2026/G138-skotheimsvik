import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const data = JSON.parse(readFileSync('src/trainers/geography/outlines.json', 'utf8'));
const pick = [
  'Norway', 'France', 'Italy', 'Japan', 'United States',
  'Brazil', 'India', 'Australia', 'Chile', 'Egypt',
  'Spain', 'Greece', 'Indonesia', 'Canada', 'Mexico',
  'New Zealand', 'United Kingdom', 'Germany', 'Sweden', 'South Africa',
];

const cells = pick
  .map((name) => {
    const entry = data.outlines[name];
    if (!entry) return `<figure><p>MANGLER</p><figcaption>${name}</figcaption></figure>`;
    return `<figure><svg viewBox="${data.viewBox}"><path d="${entry.d}" fill="#2dd4bf" fill-rule="evenodd"/></svg><figcaption>${name}</figcaption></figure>`;
  })
  .join('');

const html = `<!doctype html><meta charset="utf-8"><title>Outline preview</title>
<style>
body{background:#0f172a;color:#e2e8f0;font:14px system-ui;margin:16px}
main{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}
figure{margin:0;text-align:center;background:#1e293b;border-radius:8px;padding:8px}
svg{width:100%;height:110px}
figcaption{margin-top:6px;font-size:12px;color:#94a3b8}
</style><main>${cells}</main>`;

const out = join(process.cwd(), 'outline-preview.html');
writeFileSync(out, html, 'utf8');
console.log(out);
