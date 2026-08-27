import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { sortSizeLabels } from '../../common/sizechart'

function Toggle({ on, onToggle }) {
  return (
    <div className={`toggle${on ? ' on' : ''}`} onClick={onToggle}>
      <div className="toggle-knob" />
    </div>
  )
}

export default function VariantsStock({ sizes, colours, onStockChange, initialStock = [], variants = [], warnThreshold = 3 }) {
  const { t } = useTranslation()

  const sizeList = useMemo(() => {
    const fromSizes = (sizes ?? []).filter(r => r.size?.toString().trim())
    if (fromSizes.length > 0) return fromSizes
    if (variants.length > 0) return sortSizeLabels([...new Set(variants.map(v => v.size_label))]).map(s => ({ size: s }))
    return []
  }, [JSON.stringify(sizes), variants.length])

  const colourList = useMemo(() => {
    // Always prefer the colours prop if it has entries (user-controlled)
    if ((colours ?? []).length > 0) return colours
    // Fall back to deriving from variants (initial edit mode load before ColourVariants seeds)
    if (variants.length > 0) {
      return [...new Map(variants.map(v => [
        v.colour ?? 'Default',
        { id: v.colour ?? 'Default', name: v.colour ?? 'Default', hex: v.colour_hex ?? '#888888' }
      ])).values()]
    }
    return []
  }, [JSON.stringify(colours), variants.length])

  const hasData = sizeList.length > 0 && colourList.length > 0

  const [stock, setStock] = useState({})
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    
    setStock(() => {
      const next = {}
      sizeList.forEach((row, si) => {
        next[si] = {}
        colourList.forEach(c => {
          const existing = initialStock.find(s =>
            s.size === row.size?.toString() && (s.colour === c.name || c.name === 'Default')
          )
          const fromVariant = variants.find(v =>
            v.size_label === row.size?.toString() &&
            (v.colour === c.name || c.name === 'Default' || !v.colour)
          )
          next[si][c.id] = existing
            ? { qty: existing.qty, active: existing.active ?? true }
            : fromVariant
            ? { qty: fromVariant.stock_qty ?? 0, active: true }
            : { qty: 0, active: true }
        })
      })
      return next
    })
    setSaved(false)
  }, [JSON.stringify(sizeList), JSON.stringify(colourList), variants.length])

  function notifyParent(nextStock) {
    if (!onStockChange) return
    const result = []
    sizeList.forEach((row, si) => {
      colourList.forEach(c => {
        const cell = nextStock[si]?.[c.id] ?? { qty: 0, active: true }
        result.push({ size: row.size?.toString(), colour: c.name, hex: c.hex, qty: cell.qty, active: cell.active })
      })
    })
    onStockChange(result)
  }

  function setQty(si, cid, val) {
    const qty = Math.max(0, parseInt(val) || 0)
    setStock(prev => {
      const next = { ...prev, [si]: { ...prev[si], [cid]: { ...prev[si]?.[cid], qty } } }
      notifyParent(next)
      return next
    })
    setSaved(false)
  }

  function toggleActive(si, cid) {
    setStock(prev => {
      const next = { ...prev, [si]: { ...prev[si], [cid]: { ...prev[si]?.[cid], active: !prev[si]?.[cid]?.active } } }
      notifyParent(next)
      return next
    })
    setSaved(false)
  }

  function saveStock() {
    notifyParent(stock)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Variants &amp; <em>Stock</em></div>
        {hasData && (
          <button className="btn btn-sm btn-primary vs-save-btn" onClick={saveStock}>
            {saved
              ? <><span className="material-symbols-outlined">check</span>{t('common.save')}</>
              : <><span className="material-symbols-outlined">save</span>{t('common.save')}</>
            }
          </button>
        )}
      </div>

      {!hasData ? (
        <div className="vs-empty">
          {sizeList.length === 0 && colourList.length === 0
            ? t('variants_stock.empty_both')
            : sizeList.length === 0
            ? t('variants_stock.empty_sizes')
            : t('variants_stock.empty_colours')}
        </div>
      ) : (
        <table className="variant-tbl">
          <thead>
            <tr>
              <th>{t('variants_stock.size_col')}</th>
              {colourList.map(c => (
                <th key={c.id} className="vs-colour-th">
                  <div className="vs-colour-hdr">
                    <div className="vs-colour-dot" style={{ background: c.hex }} />
                    <span>{c.name}</span>
                  </div>
                </th>
              ))}
            </tr>
            <tr className="vs-subhdr">
              <th />
              {colourList.map(c => (
                <th key={c.id}>
                  <div className="vs-subhdr-cols">
                    <span className="vs-subhdr-lbl">{t('variants_stock.stock_col')}</span>
                    <span className="vs-subhdr-lbl">{t('variants_stock.active_col')}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sizeList.map((row, si) => (
              <tr key={si}>
                <td className="vs-size-cell">{row.size}</td>
                {colourList.map(c => {
                  const cell = stock[si]?.[c.id] ?? { qty: 0, active: true }
                  return (
                    <td key={c.id}>
                      <div className="vs-cell">
                        <input
                          type="number"
                          min="0"
                          value={cell.qty}
                          onChange={e => setQty(si, c.id, e.target.value)}
                          className={`vs-qty-input${cell.qty === 0 ? ' zero' : cell.qty <= warnThreshold ? ' low' : ' ok'}`}
                          onWheel={e => e.target.blur()}
                        />
                        <div className="vs-toggle-wrap">
                          <Toggle on={cell.active} onToggle={() => toggleActive(si, c.id)} />
                        </div>
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {hasData && <div className="form-hint vs-hint">{t('variants_stock.hint')}</div>}

      <style>{`
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type=number] { -moz-appearance: textfield; }
      `}</style>
    </div>
  )
}
