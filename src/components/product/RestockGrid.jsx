import { useMemo } from 'react'
import { sortSizeLabels } from '../../common/sizechart'

export default function RestockGrid({ variants, values, onChange, warnThreshold }) {
  const sizeList = useMemo(() => {
    const seen = new Set()
    const list = []
    variants.forEach(v => {
      if (!seen.has(v.size_label)) { seen.add(v.size_label); list.push(v.size_label) }
    })
    return sortSizeLabels(list)
  }, [variants])

  const colourList = useMemo(() => {
    const seen = new Set()
    const list = []
    variants.forEach(v => {
      const c = v.colour ?? ''
      if (!seen.has(c)) { seen.add(c); list.push(c) }
    })
    return list
  }, [variants])

  function getVariant(size, colour) {
    return variants.find(v => v.size_label === size && (v.colour ?? '') === colour) ?? null
  }

  if (!variants.length) {
    return <div className="vs-empty">This product has no variants yet.</div>
  }

  return (
    <table className="variant-tbl">
      <thead>
        <tr>
          <th>Size</th>
          {colourList.map(c => (
            <th key={c || '—'} className="vs-colour-th">{c || '—'}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sizeList.map(size => (
          <tr key={size}>
            <td className="vs-size-cell">{size}</td>
            {colourList.map(c => {
              const v = getVariant(size, c)
              if (!v) return <td key={c || '—'}>—</td>
              const val = values[v.id] ?? v.stock_qty
              const qty = Number(val)
              const warn = warnThreshold ?? 3
              const cls = qty === 0 ? 'zero' : qty <= warn ? 'low' : 'ok'
              return (
                <td key={c || '—'}>
                  <input
                    type="number"
                    min="0"
                    className={`vs-qty-input ${cls}`}
                    value={val}
                    onChange={e => onChange(v.id, Math.max(0, parseInt(e.target.value) || 0))}
                    onWheel={e => e.target.blur()}
                  />
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
