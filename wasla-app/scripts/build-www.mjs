import { mkdirSync, copyFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SRC = join(ROOT, '..');
const DST = join(SRC, 'www');

mkdirSync(DST, { recursive: true });

const files = ['index.html', 'app.js', 'style.css', 'manifest.json', 'sw.js', 'icon.svg'];
for (const f of files) {
  const src = join(SRC, f);
  if (existsSync(src)) copyFileSync(src, join(DST, f));
}

const apiBase = process.env.WASLA_API_BASE || 'http://127.0.0.1:4000';
writeFileSync(join(DST, 'config.json'), JSON.stringify({ apiBase }, null, 2));

console.log('www/ built with', files.length, 'files + config.json =>', apiBase);
