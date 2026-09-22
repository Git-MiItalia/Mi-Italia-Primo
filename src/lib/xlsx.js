// Minimal .xlsx writer — no dependency, a few KB of code.
//
// An .xlsx is a ZIP of small XML files. ZIP allows entries to be STORED
// uncompressed, so no deflate library is needed: the whole format reduces to
// "write these five XML parts into a ZIP container". That keeps the portal's
// bundle where it is — the usual spreadsheet library is close to a megabyte,
// which is not a fair price for one button on one tab.
//
// Why write one at all, when Excel opens the CSV: a CSV is a single flat sheet
// of text. This gives each section of a report its own tab and stores numbers
// as numbers, so totals can be summed in the sheet rather than re-typed.
//
// Deliberately minimal — no styling, no shared-string table, no formulas.
// Strings are written inline, which is slightly larger on disk and much
// simpler to be sure is correct.

// ── CRC-32 (required by the ZIP entry headers) ──────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes) {
  let c = 0xFFFFFFFF
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8)
  return (c ^ 0xFFFFFFFF) >>> 0
}

// ── ZIP container, STORE method ─────────────────────────────────────────────
/* Fixed modification stamp: 1 Jan 1980, 00:00 — the earliest a DOS timestamp
   can express, and the usual choice for reproducible archives.
   Date bits: year-1980 << 9 | month << 5 | day  →  (0 << 9) | (1 << 5) | 1 */
const DOS_DATE = (1 << 5) | 1
const DOS_TIME = 0
/**
 * @param {{name: string, data: Uint8Array}[]} files
 * @returns {Blob} a ZIP archive
 */
function zip(files) {
  const enc    = new TextEncoder()
  const chunks = []
  const central = []
  let offset = 0

  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF]
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]

  for (const f of files) {
    const nameBytes = enc.encode(f.name)
    const crc  = crc32(f.data)
    const size = f.data.length
    // Local file header. A fixed timestamp keeps the same input producing the
    // same bytes; it must still be a VALID DOS date. Zero encodes day 0 of
    // month 0, which unzip tolerates but Excel rejects — it treats the whole
    // workbook as corrupt and offers to repair it, dropping the contents.
    const local = Uint8Array.from([
      ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0),   // sig, version, flags, method(0=store)
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0),
      ...nameBytes,
    ])
    chunks.push(local, f.data)

    central.push(Uint8Array.from([
      ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0),
      ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(size), ...u32(size),
      ...u16(nameBytes.length), ...u16(0), ...u16(0),
      ...u16(0), ...u16(0), ...u32(0),
      ...u32(offset),
      ...nameBytes,
    ]))
    offset += local.length + size
  }

  const cdSize = central.reduce((n, c) => n + c.length, 0)
  const eocd = Uint8Array.from([
    ...u32(0x06054b50), ...u16(0), ...u16(0),
    ...u16(files.length), ...u16(files.length),
    ...u32(cdSize), ...u32(offset), ...u16(0),
  ])

  return new Blob([...chunks, ...central, eocd],
    { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// ── Worksheet XML ───────────────────────────────────────────────────────────
const xmlEsc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  // Control characters are not legal in XML 1.0, and one arriving in a product
  // name makes Excel refuse the whole workbook rather than skip that cell.
  // Matching them deliberately is the point, so the rule is off for this line.
  // eslint-disable-next-line no-control-regex
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')

/** 0 -> A, 25 -> Z, 26 -> AA */
function colName(i) {
  let s = ''
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s
  return s
}

/* A cell is written as a number only when the text is exactly what a number
   round-trips to. That keeps "00123" and "1,5" as text — an SKU with leading
   zeros must not become 123, and a European decimal comma is not a number to
   Excel. Empty cells are skipped entirely, which is legal and smaller. */
const isNumeric = (v) => {
  const s = String(v).trim()
  return s !== '' && Number.isFinite(Number(s)) && String(Number(s)) === s
}

/* Text goes through the workbook's shared string table rather than being
   written inline in the cell.
   Both are legal. Inline strings were tried first and are more direct, but
   effectively every spreadsheet in the world uses the shared table, so that is
   the path readers are actually tested against — and a reader that mishandles
   inline strings shows a workbook whose cells are all empty, with no error to
   explain it. `dimension` is declared for the same reason: optional by spec,
   present in every real file, and used by readers to size the sheet. */
function sheetXml(rows, strId) {
  let maxCols = 0
  const body = rows.map((cells, r) => {
    maxCols = Math.max(maxCols, cells.length)
    const tds = cells.map((v, c) => {
      if (v === '' || v == null) return ''       // empty cells are simply absent
      const ref = `${colName(c)}${r + 1}`
      return isNumeric(v)
        ? `<c r="${ref}"><v>${Number(v)}</v></c>`
        : `<c r="${ref}" t="s"><v>${strId(String(v))}</v></c>`
    }).join('')
    return `<row r="${r + 1}">${tds}</row>`
  }).join('')
  const dim = rows.length ? `A1:${colName(Math.max(0, maxCols - 1))}${rows.length}` : 'A1'
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dim}"/><sheetData>${body}</sheetData></worksheet>`
}

/* Excel's rules for a tab name: 31 characters, and none of : \ / ? * [ ].
   Duplicates are refused too, so a suffix is added when one repeats. */
function sheetNames(raw) {
  const used = new Set()
  return raw.map((name, i) => {
    let s = String(name || `Sheet${i + 1}`).replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || `Sheet${i + 1}`
    let n = 2
    while (used.has(s.toLowerCase())) s = `${s.slice(0, 28)} ${n++}`
    used.add(s.toLowerCase())
    return s
  })
}

// ── Workbook ────────────────────────────────────────────────────────────────
/**
 * Build an .xlsx workbook.
 * @param {{name: string, rows: (string|number)[][]}[]} sheets one tab each
 * @returns {Blob}
 */
export function buildXlsx(sheets) {
  const list  = sheets.length ? sheets : [{ name: 'Sheet1', rows: [] }]
  const names = sheetNames(list.map(s => s.name))
  const enc   = new TextEncoder()
  const file  = (name, text) => ({ name, data: enc.encode(text) })

  /* Shared string table, filled while the sheets are written below. Repeated
     text — a column header appearing on several sheets — is stored once. */
  const sstIndex = new Map()
  const sst = []
  let stringCells = 0
  const strId = (s) => {
    stringCells++
    if (sstIndex.has(s)) return sstIndex.get(s)
    sstIndex.set(s, sst.length)
    sst.push(s)
    return sst.length - 1
  }
  // Written before the parts that reference them, so the table is complete.
  const sheetXmls = list.map(s => sheetXml(s.rows ?? [], strId))

  const sharedStrings = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${stringCells}" uniqueCount="${sst.length}">${
    sst.map(s => `<si><t xml:space="preserve">${xmlEsc(s)}</t></si>`).join('')}</sst>`

  const sheetTags = names.map((n, i) =>
    `<sheet name="${xmlEsc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')
  // The stylesheet and string table are referenced after the sheets, so their
  // ids continue from the last sheet's.
  const relTags = names.map((_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${names.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + `<Relationship Id="rId${names.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>`
  const overrides = names.map((_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>`
    + `<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>`

  /* Minimal stylesheet. No cell here carries an `s` attribute, so nothing
     actually uses it — but Excel expects the part to exist and treats a
     workbook without it as damaged. Two fills are declared because Excel
     reserves the first two slots (none, then the gray125 pattern) and
     misreads the table if either is absent. */
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`

  return zip([
    file('[Content_Types].xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`),
    file('_rels/.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    file('xl/workbook.xml',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`),
    file('xl/_rels/workbook.xml.rels',
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relTags}</Relationships>`),
    file('xl/styles.xml', styles),
    file('xl/sharedStrings.xml', sharedStrings),
    ...sheetXmls.map((xml, i) => file(`xl/worksheets/sheet${i + 1}.xml`, xml)),
  ])
}

/** Save a Blob under `filename`. Mirrors triggerDownload in lib/csv.js. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
