// Shared CSV helpers.
//
// Reports.jsx grew a correct implementation of these (quoting, BOM, object-URL
// cleanup) while Inventory.jsx separately grew a naive `row.join(',')` export
// that corrupts any file whose data contains a comma — which product names
// routinely do ("Blazer, Navy"). Rather than duplicate the good one, both views
// now import from here.

/**
 * Quote a single cell if it contains a comma, quote or newline, doubling any
 * embedded quotes — the minimum RFC 4180 needs to survive a round trip.
 */
export function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvRow(cells) { return cells.map(csvEscape).join(',') }

/**
 * Render an array of like-shaped objects as a header row plus body rows.
 * Column order follows the first object's keys; `headerOverrides` maps a key to
 * a friendlier column title.
 */
export function csvTable(rows, headerOverrides = null) {
  if (!rows || rows.length === 0) return csvRow(['(no data)'])
  const cols = Object.keys(rows[0])
  const headerRow = headerOverrides
    ? csvRow(cols.map(c => headerOverrides[c] ?? c))
    : csvRow(cols)
  const bodyRows = rows.map(r => csvRow(cols.map(c => r[c])))
  return [headerRow, ...bodyRows].join('\n')
}

/**
 * Save `text` as `filename`. The leading BOM is what makes Excel read the file
 * as UTF-8 rather than the local ANSI codepage — without it accented product
 * names arrive mangled. The object URL is revoked so the blob can be freed.
 */
export function triggerDownload(text, filename) {
  const blob = new Blob(['\ufeff', text], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
