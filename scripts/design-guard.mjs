#!/usr/bin/env node
/**
 * OG-WDS lightweight design guard.
 *
 * It is intentionally conservative: it flags likely visual-system drift inside
 * migrated/v3 code. It does not replace ESLint or visual QA.
 *
 * Usage:
 *   node scripts/design-guard.mjs
 *   node scripts/design-guard.mjs src/components/v3 src/app/path/to/migrated-route
 */
import fs from 'node:fs';
import path from 'node:path';

const roots = process.argv.slice(2);
const targets = roots.length ? roots : ['src/components/v3'];
const extensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.scss']);
const ignoreParts = new Set(['node_modules', '.next', 'dist', 'build']);

const rules = [
  {
    id: 'raw-hex',
    re: /#[0-9a-fA-F]{3,8}\b/g,
    message: 'Raw hex color. Use an OG-WDS semantic token.',
  },
  {
    id: 'raw-functional-color',
    re: /\b(?:rgb|rgba|hsl|hsla)\s*\([^)]*\)/g,
    message: 'Raw functional color. Use an OG-WDS semantic token.',
  },
  {
    id: 'arbitrary-tailwind-color',
    re: /\b(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
    message: 'Generic Tailwind palette color. Map to an OG-WDS semantic token.',
  },
  {
    id: 'arbitrary-radius',
    re: /\brounded-\[(?!var\()[^\]]+\]/g,
    message: 'Arbitrary radius. Use S/M/L radius tokens.',
  },
  {
    id: 'arbitrary-shadow',
    re: /\bshadow-\[(?!var\()[^\]]+\]/g,
    message: 'Arbitrary shadow. Use an OG-WDS depth token.',
  },
];

function walk(p, out = []) {
  if (!fs.existsSync(p)) return out;
  const stat = fs.statSync(p);
  if (stat.isFile()) {
    if (extensions.has(path.extname(p))) out.push(p);
    return out;
  }
  for (const entry of fs.readdirSync(p, { withFileTypes: true })) {
    if (ignoreParts.has(entry.name)) continue;
    walk(path.join(p, entry.name), out);
  }
  return out;
}

let violations = 0;
for (const target of targets) {
  for (const file of walk(target)) {
    // Token files are the one place raw values are expected.
    if (/og-design-tokens\.(?:css|json)$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const rule of rules) {
        rule.re.lastIndex = 0;
        const matches = [...line.matchAll(rule.re)];
        for (const match of matches) {
          violations += 1;
          console.error(`${file}:${index + 1}: [${rule.id}] ${rule.message}  -> ${match[0]}`);
        }
      }
    });
  }
}

if (violations) {
  console.error(`\nOG-WDS design guard found ${violations} potential violation(s).`);
  process.exit(1);
}
console.log('OG-WDS design guard: no obvious token drift found.');
