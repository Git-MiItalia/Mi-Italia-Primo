#!/usr/bin/env node
/**
 * radius-transform.js
 *
 * Nero Editoriale · Edizione II — zero-radius sweep.
 *
 * Sweeps CSS files AND JSX files:
 *   • CSS:  targets `border-radius: X`  → `border-radius:0`
 *   • JSX:  targets `borderRadius: X`   → `borderRadius: 0`
 *
 * Rules:
 *   • Lines containing 50% or 100% in a radius value are LEFT UNCHANGED
 *     (avatars, dots, toggles, spinners — circular shapes stay circular)
 *   • All other radius declarations become 0
 *
 * Usage from your Primo project root:
 *
 *   DRY RUN (shows what would change, doesn't touch files):
 *     node radius-transform.js
 *
 *   APPLY (writes changes to files):
 *     node radius-transform.js --write
 *
 * Rollback:
 *   git checkout HEAD -- src/App.css src/app-additions.css src/views/*.jsx src/components/** /*.jsx
 */

const fs   = require('fs')
const path = require('path')

const TARGETS = [
  // CSS files (kebab-case border-radius)
  'src/App.css',
  'src/app-additions.css',
  // Template-string CSS in JSX (kebab-case)
  'src/views/PriceTags.jsx',
  // JSX inline styles (camelCase borderRadius)
  'src/components/product/VirtualTryOn.jsx',
  'src/components/ui/NotifToast.jsx',
  'src/views/Financials.jsx',
  'src/views/Marketing.jsx',
  'src/views/POS.jsx',
  'src/views/Reports.jsx',
  'src/views/TryOn.jsx',
  'src/views/VoidCIL.jsx',
]

const write = process.argv.includes('--write')

// Two patterns, applied in sequence to every file:
//   1. CSS kebab-case  — matches `border-radius: ...` up to `;`, `}`, or newline
//   2. JSX camelCase   — matches `borderRadius: ...` up to `,`, `}`, or newline
const PATTERNS = [
  { name: 'css',  re: /border-radius\s*:\s*[^;}\n]+/g, replace: 'border-radius:0' },
  { name: 'jsx',  re: /borderRadius\s*:\s*[^,}\n]+/g,  replace: 'borderRadius: 0' },
]

const CIRCULAR_RE = /\b50%|\b100%/

let grandTotal = { hits: 0, kept: 0, rewritten: 0 }

for (const rel of TARGETS) {
  const abs = path.resolve(rel)
  if (!fs.existsSync(abs)) {
    console.log(`⚠  Skipped (not found): ${rel}`)
    continue
  }

  const original = fs.readFileSync(abs, 'utf8')
  const lines    = original.split(/\r?\n/)
  const eol      = original.includes('\r\n') ? '\r\n' : '\n'

  let hits      = 0
  let kept      = 0
  let rewritten = 0
  const changedLines = []

  const transformed = lines.map((line, idx) => {
    let mutated = line
    let lineChanged = false

    for (const p of PATTERNS) {
      const matches = mutated.match(p.re)
      if (!matches) continue

      hits += matches.length

      // If any radius value on this line is circular (50%/100%), we still
      // process each match individually — but only rewrite the non-circular ones.
      // Simpler: check the WHOLE line for a circular radius; if present, skip this pattern for this line.
      const anyCircular = matches.some(m => CIRCULAR_RE.test(m))
      if (anyCircular) {
        // If ALL matches on this line are circular → skip
        // If MIXED (rare but possible) → still process, replacing only non-circular
        const nonCircular = matches.filter(m => !CIRCULAR_RE.test(m))
        if (nonCircular.length === 0) {
          kept += matches.length
          continue
        }
        // Mixed: replace only non-circular matches
        kept      += matches.length - nonCircular.length
        rewritten += nonCircular.length
        for (const m of nonCircular) {
          mutated = mutated.replace(m, p.replace)
        }
        lineChanged = true
      } else {
        // No circular → replace all
        mutated = mutated.replace(p.re, p.replace)
        rewritten += matches.length
        lineChanged = true
      }
    }

    if (lineChanged) {
      changedLines.push({
        lineNum: idx + 1,
        before:  line.trim().slice(0, 220),
        after:   mutated.trim().slice(0, 220),
      })
    }
    return mutated
  })

  console.log(`\n═══ ${rel} ═══`)
  console.log(`  Total radius occurrences: ${hits}`)
  console.log(`  Kept (circular):          ${kept}`)
  console.log(`  Rewritten to 0:           ${rewritten}`)

  if (changedLines.length > 0 && !write) {
    const sampleSize = Math.min(3, changedLines.length)
    console.log(`\n  Sample changes (${sampleSize} of ${changedLines.length}):`)
    for (const c of changedLines.slice(0, sampleSize)) {
      console.log(`    L${c.lineNum}:`)
      console.log(`      -  ${c.before}`)
      console.log(`      +  ${c.after}`)
    }
  }

  if (write && rewritten > 0) {
    fs.writeFileSync(abs, transformed.join(eol), 'utf8')
    console.log(`  ✓ Written.`)
  }

  grandTotal.hits      += hits
  grandTotal.kept      += kept
  grandTotal.rewritten += rewritten
}

console.log('\n═══ SUMMARY ═══')
console.log(`  Total occurrences found:  ${grandTotal.hits}`)
console.log(`  Kept (circular):          ${grandTotal.kept}`)
console.log(`  Rewritten to 0:           ${grandTotal.rewritten}`)

if (!write) {
  console.log('\n  This was a DRY RUN. No files changed.')
  console.log('  Run with --write to apply the changes.')
} else {
  console.log('\n  Files updated in place.')
  console.log('  Rollback: git checkout HEAD -- ' + TARGETS.join(' '))
}