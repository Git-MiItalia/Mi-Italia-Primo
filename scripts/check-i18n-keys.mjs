// Lists translation keys used in src/ that exist in neither primo5.json nor
// src/i18n/new-keys.json — the keys that would render as raw names on screen.
// Run before building for dev:   node scripts/check-i18n-keys.mjs
//
// Only literal keys are checked — t('a.b'), t("a.b"), t(`a.b`) with no ${}.
// Keys built at runtime (t(`status.${s}`), statusLabel(t, s)) cannot be seen
// here. The login pages are skipped: their strings come from the separate
// login bundle and are not in primo5.json (see src/lib/i18n.js).
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const LOGIN_FILES = new Set(['Login.jsx', 'forgot-password.jsx', 'reset-password.jsx', 'set-password.jsx', 'StripeConnect.jsx'])

const flatten = (o, p = '', out = new Set()) => {
  for (const [k, v] of Object.entries(o)) {
    if (v && typeof v === 'object') flatten(v, `${p}${k}.`, out)
    else out.add(p + k)
  }
  return out
}
const known = new Set([
  ...flatten(JSON.parse(readFileSync(join(ROOT, 'primo5.json'), 'utf8'))),
  ...flatten(JSON.parse(readFileSync(join(ROOT, 'src/i18n/new-keys.json'), 'utf8'))),
])
// i18next plural forms: t('x', { count }) resolves x_one / x_other.
const has = k => known.has(k) || known.has(`${k}_one`) || known.has(`${k}_other`)

const files = []
const walk = dir => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p)
    else if (/\.(jsx?|tsx?)$/.test(name) && !LOGIN_FILES.has(name)) files.push(p)
  }
}
walk(join(ROOT, 'src'))

const KEY = /\bt\(\s*(['"`])([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_-]+)+)\1/g
const missing = []
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*)/.test(line)) return // commented-out code
    for (const m of line.matchAll(KEY)) {
      if (!has(m[2])) missing.push(`${relative(ROOT, file)}:${i + 1}  ${m[2]}`)
    }
  })
}

if (missing.length) {
  console.log(`${missing.length} key(s) used in the code but missing from primo5.json and src/i18n/new-keys.json:\n`)
  missing.forEach(m => console.log('  ' + m))
  console.log('\nAdd each to src/i18n/new-keys.json (English) before pushing.')
  process.exitCode = 1
} else {
  console.log(`OK — every literal key in ${files.length} files is in primo5.json or src/i18n/new-keys.json.`)
}
