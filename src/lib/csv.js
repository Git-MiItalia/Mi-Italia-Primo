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
 * Inverse of the above: read a CSV string back into rows of cells.
 *
 * The Reports preview renders the very CSV the download produces, rather than
 * a second rendering of the same data — so what is on screen and what lands in
 * the file cannot drift apart, and the eight export builders stay untouched.
 *
 * Handles the three things csvEscape emits: quoted fields, doubled quotes
 * inside them, and newlines inside them. A blank line becomes an empty row,
 * which is what separates one section from the next.
 */
export function parseCsv(text) {
  const rows = []
  let row = [], cell = '', quoted = false
  const str = String(text ?? '').replace(/\r\n?/g, '\n')   // CRLF and lone CR
  for (let i = 0; i < str.length; i++) {
    const c = str[i]
    if (quoted) {
      if (c === '"') {
        if (str[i + 1] === '"') { cell += '"'; i++ }        // escaped quote
        else quoted = false
      } else cell += c
      continue
    }
    if (c === '"')      quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n'){ row.push(cell); rows.push(row); row = []; cell = '' }
    else                cell += c
  }
  // Trailing cell, unless the text ended on a newline with nothing after it.
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

/**
 * Group parsed rows into the sections the builders write: a one-cell line is a
 * heading, the rows under it are its content, and a blank line ends the block.
 * Content whose rows all have two cells is a label/value list; anything wider
 * came from csvTable, which writes its column names first.
 */
export function csvSections(text) {
  const blocks = []
  let current = null
  for (const row of parseCsv(text)) {
    const blank = row.length === 0 || row.every(c => c === '')
    if (blank) { current = null; continue }
    if (!current) { blocks.push(current = { heading: null, rows: [] }) }
    if (current.heading === null && current.rows.length === 0 && row.length === 1) {
      current.heading = row[0]
    } else current.rows.push(row)
  }
  return blocks.map(b => {
    const wide = b.rows.some(r => r.length > 2)
    return {
      heading: b.heading,
      headers: wide ? b.rows[0]   : null,
      rows:    wide ? b.rows.slice(1) : b.rows,
    }
  }).filter(b => b.heading || b.rows.length)
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
