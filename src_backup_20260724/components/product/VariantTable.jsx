import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getSchema } from '../../common/sizechart'

function makeEmptyRow(cols) {
  return Object.fromEntries(cols.map(c => [c.key, '']))
}

function schemaToVariantCols(schemaCols) {
  return schemaCols.map((label, i) => ({
    key:      label.toLowerCase().replace(/[^a-z0-9]/g, '_'),
    label,
    editable: i > 0,
  }))
}

function schemaToVariantRows(schemaRows, cols) {
  return schemaRows.map(row => {
    const mapped = {}
    cols.forEach(col => {
      const matchingKey = Object.keys(row).find(k =>
        k.toLowerCase().replace(/[^a-z0-9]/g, '_') === col.key || k === col.label
      )
      mapped[col.key] = matchingKey !== undefined ? row[matchingKey] : ''
    })
    return mapped
  })
}

// Convert initialSizes array [{size:'44'}, {size:'46'}] into table rows
function sizesToRows(initialSizes, cols) {
  if (!initialSizes?.length || !cols?.length) return []
  const firstKey = cols[0]?.key
  return initialSizes.map(s => {
    const row = makeEmptyRow(cols)
    if (firstKey) row[firstKey] = s.size ?? s.size_label ?? ''
    return row
  })
}

export default function VariantTable({ category, initialSizes, onRowsChange }) {
  const { t } = useTranslation()

  const l1 = category?.l1 ?? null
  const l2 = category?.l2 ?? null
  const l3 = category?.l3 ?? null

  const schema     = getSchema(l1, l2, l3)
  const activeCols = schema ? schemaToVariantCols(schema.cols) : []

  const [rows,    setRows]    = useState([])
  const [editing, setEditing] = useState(false)
  const [newRow,  setNewRow]  = useState(null)

  // Track previous category to detect actual changes vs mount
  const prevCatRef = useRef({ l1, l2, l3 })
  const initialised = useRef(false)

  useEffect(() => {
    const prev = prevCatRef.current
    const catChanged = prev.l1 !== l1 || prev.l2 !== l2 || prev.l3 !== l3
    prevCatRef.current = { l1, l2, l3 }

    if (!schema) {
      // No schema — if we have initialSizes and haven't initialised yet, use them
      if (!initialised.current && initialSizes?.length) {
        // Build minimal single-col rows
        const minimalCols = [{ key:'size', label:'Size', editable:false }]
        const r = sizesToRows(initialSizes, minimalCols)
        setRows(r)
        if (onRowsChange) onRowsChange(r)
        initialised.current = true
      } else if (catChanged) {
        setRows([]); setEditing(false); setNewRow(null)
      }
      return
    }

    const cols = schemaToVariantCols(schema.cols)

    if (!initialised.current && initialSizes?.length) {
      // Edit mode — seed rows from existing sizes
      const r = sizesToRows(initialSizes, cols)
      setRows(r)
      if (onRowsChange) onRowsChange(r)
      initialised.current = true
    } else if (catChanged) {
      // Category was explicitly changed by user — load schema defaults
      setRows(schemaToVariantRows(schema.rows, cols))
      setEditing(false)
      setNewRow(null)
      initialised.current = true
    } else if (!initialised.current) {
      // Add mode first load — use schema defaults
      setRows(schemaToVariantRows(schema.rows, cols))
      setEditing(false)
      setNewRow(null)
      initialised.current = true
    }
  }, [l1, l2, l3],initialSizes)

  function startEditing() {
    setNewRow(makeEmptyRow(activeCols))
    setEditing(true)
  }

  function removeRow(ri) {
    const next = rows.filter((_, i) => i !== ri)
    setRows(next)
  }

  function updateCell(rowIdx, colKey, value) {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [colKey]: value } : r))
  }

  function updateNewRow(colKey, value) {
    setNewRow(prev => ({ ...prev, [colKey]: value }))
  }

  function saveEditing() {
    let next = rows
    if (newRow) {
      const firstKey = activeCols[0]?.key
      if (firstKey && newRow[firstKey]?.toString().trim()) {
        next = [...rows, { ...newRow }]
        setRows(next)
      }
    }
    if (onRowsChange) onRowsChange(next)
    setEditing(false)
    setNewRow(null)
  }

  function cancelEditing() {
    setEditing(false)
    setNewRow(null)
  }

  if (!schema && !rows.length) {
    return (
      <>
        <div className="vt-hdr">
          <div className="card-title">Sizes</div>
        </div>
        <div className="vt-empty">Select a category above to load the size chart.</div>
      </>
    )
  }

  return (
    <>
      <div className="vt-hdr">
        <div className="card-title">Sizes</div>
        {!editing ? (
          <div className="vt-hdr-actions">
            <button className="btn btn-sm btn-primary" onClick={() => { if (onRowsChange) onRowsChange(rows) }}>
              <span className="material-symbols-outlined">check</span>Save Sizes
            </button>
            <button className="btn btn-sm btn-outline" onClick={startEditing}>
              <span className="material-symbols-outlined">edit</span>Edit Sizes
            </button>
          </div>
        ) : (
          <div className="vt-hdr-actions">
            <button className="btn btn-sm btn-outline" onClick={cancelEditing}>{t('common.cancel')}</button>
            <button className="btn btn-sm btn-primary" onClick={saveEditing}>
              <span className="material-symbols-outlined">check</span>Save Sizes
            </button>
          </div>
        )}
      </div>

      {rows.length === 0 && !editing && (
        <div className="vt-empty">{t('variant_table.empty')}</div>
      )}

      {(rows.length > 0 || editing) && (
        <table className="variant-tbl">
          <thead>
            <tr>
              {activeCols.length > 0
                ? activeCols.map(c => <th key={c.key}>{c.label}</th>)
                : <th>Size</th>
              }
              {editing && <th></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {activeCols.length > 0
                  ? activeCols.map(col => (
                    <td key={col.key}>
                      {col.editable
                        ? <input value={row[col.key] ?? ''} onChange={e => updateCell(ri, col.key, e.target.value)} />
                        : <span className="vt-size-label">{row[col.key]}</span>
                      }
                    </td>
                  ))
                  : <td><span className="vt-size-label">{row.size ?? Object.values(row)[0]}</span></td>
                }
                {editing && (
                  <td>
                    <button className="btn btn-xs btn-red" onClick={() => removeRow(ri)} title="Remove row">
                      <span className="material-symbols-outlined" style={{ fontSize:14 }}>close</span>
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {editing && newRow && (
              <tr className="vt-new-row">
                {activeCols.map((col, ci) => (
                  <td key={col.key}>
                    <input
                      value={newRow[col.key] ?? ''}
                      placeholder={col.label}
                      autoFocus={ci === 0}
                      onChange={e => updateNewRow(col.key, e.target.value)}
                      className="vt-new-input"
                    />
                  </td>
                ))}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      )}

      <div className="form-hint vt-hint">
        {editing
          ? "Remove rows you don't carry. Add a new size at the bottom. Click Save Sizes when done."
          : 'All measurements in cm. Click Edit Sizes to add or remove rows.'}
      </div>
    </>
  )
}
