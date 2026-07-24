import { useState, useEffect } from 'react'
import { PR_TODAY, fmtDateShort } from '../../lib/dateHelpers'
import RangePicker from './RangePicker'

/**
 * Full range-selection bar. Renders:
 *
 *   [Range] [MTD] [YTD] [7D] [30D] [90D] [12M] [📅 Custom]  |  <period label>  |  [Compare ▾]  [Export]
 *
 * Fully controlled — parent owns `range`, `compare`, `customRange`, and the
 * period label. Internal state is limited to picker/dropdown open flags.
 *
 * Props:
 *   range             — current preset key ('mtd' | 'ytd' | '7d' | '30d' | '90d' | '12m' | 'custom')
 *   compare           — 'none' | 'prev' | 'prevyear'
 *   customRange       — { start: Date, end: Date } | null
 *   periodLabel       — string shown in the middle of the bar
 *   presetKeys        — array of preset keys to render (default: mtd/ytd/7d/30d/90d/12m)
 *   onRangeChange(k)  — user clicked a preset button
 *   onCompareChange(k) — user picked a compare option; pass `undefined` to hide the compare dropdown
 *   onCustomApply({ start, end }) — user applied a custom date range from the picker
 *   onExport()        — user clicked Export; pass `undefined` to hide the button
 */
const DEFAULT_PRESETS = ['mtd', 'ytd', '7d', '30d', '90d', '12m']

export default function RangeBar({
  range,
  compare = 'none',
  customRange = null,
  periodLabel = '',
  presetKeys = DEFAULT_PRESETS,
  onRangeChange,
  onCompareChange,
  onCustomApply,
  onExport,
}) {
  const [pickerOpen,  setPickerOpen]  = useState(false)
  const [cmpMenuOpen, setCmpMenuOpen] = useState(false)

  // Close picker / compare menu when clicking outside the bar
  useEffect(() => {
    if (!pickerOpen && !cmpMenuOpen) return
    const handler = (e) => {
      if (!e.target.closest('.prange-bar')) {
        setPickerOpen(false); setCmpMenuOpen(false)
      }
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [pickerOpen, cmpMenuOpen])

  const handleRangeClick = (k) => {
    onRangeChange?.(k)
    setPickerOpen(false)
  }
  const handleApplyCustom = (r) => {
    onCustomApply?.(r)
    setPickerOpen(false)
  }
  const handleCompareSet = (cmp) => {
    onCompareChange?.(cmp)
    setCmpMenuOpen(false)
  }

  const customBtnLabel = range === 'custom' && customRange
    ? `${fmtDateShort(customRange.start)} – ${fmtDateShort(customRange.end)}`
    : 'Custom'

  const prevYear = PR_TODAY.getFullYear() - 1

  const compareLabels = {
    none:     'None',
    prev:     'Prev period',
    prevyear: String(prevYear),
  }

  return (
    <div className="prange-bar">
      <div className="prange-bar-lbl">Range</div>

      <div className="prange-cap">
        {presetKeys.map(k => (
          <button
            key={k}
            className={`prange-btn${range === k ? ' act' : ''}`}
            onClick={() => handleRangeClick(k)}>
            {k.toUpperCase()}
          </button>
        ))}
        <button
          className={`prange-btn prange-custom${range === 'custom' ? ' act has-range' : ''}`}
          onClick={(e) => { e.stopPropagation(); setPickerOpen(v => !v); setCmpMenuOpen(false) }}>
          <span className="material-symbols-outlined">calendar_month</span>
          <span>{customBtnLabel}</span>
        </button>
        <RangePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onApply={handleApplyCustom}
        />
      </div>

      <div className="prange-period">{periodLabel}</div>

      {onCompareChange && (
        <div className="pcmp">
          <button
            className={`pcmp-btn${compare !== 'none' ? ' has-cmp' : ''}`}
            onClick={(e) => { e.stopPropagation(); setCmpMenuOpen(v => !v); setPickerOpen(false) }}>
            <span className="pcmp-lbl">Compare</span>
            <span className="pcmp-val">{compareLabels[compare] ?? compare}</span>
            <span className="material-symbols-outlined">expand_more</span>
          </button>
          {cmpMenuOpen && (
            <div className="pcmp-menu open" onClick={e => e.stopPropagation()}>
              {[
                { k: 'none',     title: 'None',                        sub: 'Show just the selected range' },
                { k: 'prev',     title: 'Previous period',             sub: 'Same length, immediately before' },
                { k: 'prevyear', title: `Previous year (${prevYear})`, sub: 'Same dates, one year earlier' },
              ].map(o => (
                <div
                  key={o.k}
                  className={`pcmp-opt${compare === o.k ? ' act' : ''}`}
                  onClick={() => handleCompareSet(o.k)}>
                  <span className="pcmp-opt-check material-symbols-outlined">check</span>
                  <div>
                    <div className="pcmp-opt-title">{o.title}</div>
                    <div className="pcmp-opt-sub">{o.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {onExport && (
        <button className="prange-export" onClick={onExport}>
          <span className="material-symbols-outlined">download</span>Export
        </button>
      )}
    </div>
  )
}
