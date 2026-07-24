import { useState, useEffect } from 'react'
import { PR_TODAY, PR_MONTHS, sameDay, fmtDate } from '../../lib/dateHelpers'

/**
 * Custom date range picker — 2-month calendar view + preset shortcuts.
 * Rendered inside a `.prange-cap` container so its absolute positioning
 * anchors to the RangeBar's Custom button.
 *
 * Props:
 *   open       — bool, controls visibility
 *   onClose()  — parent closes the picker (e.g. click outside or Cancel)
 *   onApply({ start, end }) — parent handles applied date range
 */
export default function RangePicker({ open, onClose, onApply }) {
  const [leftYear,     setLeftYear]     = useState(PR_TODAY.getFullYear())
  const [leftMonth,    setLeftMonth]    = useState(PR_TODAY.getMonth() - 1)
  const [start,        setStart]        = useState(null)
  const [end,          setEnd]          = useState(null)
  const [hover,        setHover]        = useState(null)
  const [selecting,    setSelecting]    = useState(false)
  const [activePreset, setActivePreset] = useState(null)

  useEffect(() => {
    if (open) {
      setStart(null); setEnd(null); setHover(null); setSelecting(false); setActivePreset(null)
      setLeftYear(PR_TODAY.getFullYear()); setLeftMonth(PR_TODAY.getMonth() - 1)
    }
  }, [open])

  const shift = (delta) => {
    let m = leftMonth + delta, y = leftYear
    if (m > 11) { m = 0;  y++ }
    if (m < 0)  { m = 11; y-- }
    setLeftMonth(m); setLeftYear(y)
  }

  const pickDay = (date) => {
    if (!selecting || !start) {
      setStart(date); setEnd(null); setSelecting(true); setActivePreset(null)
    } else {
      if (date < start) { setEnd(start); setStart(date) }
      else              { setEnd(date) }
      setSelecting(false)
    }
    setHover(null)
  }

  const applyPreset = (preset) => {
    setActivePreset(preset)
    const presets = {
      'this-month':   [new Date(2026, 4, 1), PR_TODAY],
      'last-month':   [new Date(2026, 3, 1), new Date(2026, 3, 30)],
      'last-quarter': [new Date(2026, 0, 1), new Date(2026, 2, 31)],
      'ytd':          [new Date(2026, 0, 1), PR_TODAY],
    }
    const [s, e] = presets[preset] || [null, null]
    setStart(s); setEnd(e); setSelecting(false)
    if (s) { setLeftYear(s.getFullYear()); setLeftMonth(s.getMonth()) }
  }

  const renderMonth = (year, month) => {
    const first = new Date(year, month, 1)
    let offset = first.getDay() - 1
    if (offset < 0) offset = 6
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} className="prange-pk-d prange-pk-empty" />)
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month, d)
      const disabled = date > PR_TODAY
      const isToday  = sameDay(date, PR_TODAY)
      const isStart  = start && sameDay(date, start)
      const isEnd    = end   && sameDay(date, end)
      const ref      = end || hover
      const rs = start && ref ? (start <= ref ? start : ref) : null
      const re = start && ref ? (start <= ref ? ref : start) : null
      const inRange = rs && re && date > rs && date < re

      let cls = 'prange-pk-d'
      if (disabled) cls += ' prange-pk-disabled'
      if (isToday)  cls += ' prange-pk-today'
      if (isStart)  cls += ' prange-pk-start'
      if (isEnd)    cls += ' prange-pk-end'
      if (inRange)  cls += ' prange-pk-inrange'

      cells.push(
        <div key={d} className={cls}
          onClick={disabled ? undefined : () => pickDay(date)}
          onMouseEnter={disabled ? undefined : () => { if (selecting && start) setHover(date) }}>
          {d}
        </div>
      )
    }
    return cells
  }

  if (!open) return null

  const rightMonth = leftMonth === 11 ? 0 : leftMonth + 1
  const rightYear  = leftMonth === 11 ? leftYear + 1 : leftYear

  const selLabel = !start        ? 'Select a start date'
                 : start && !end ? `${fmtDate(start)} → select end date`
                 :                 `${fmtDate(start)} – ${fmtDate(end)}`

  return (
    <div className="prange-picker open" onClick={e => e.stopPropagation()}>
      <div className="prange-pk-hdr">
        <div className="prange-pk-title">Custom date range</div>
        <div className="prange-pk-sel">{selLabel}</div>
      </div>
      <div className="prange-pk-months">
        <div className="prange-pk-month">
          <div className="prange-pk-mnav">
            <button className="prange-pk-navbtn" onClick={() => shift(-1)}>←</button>
            <div className="prange-pk-mlbl">{PR_MONTHS[leftMonth]} {leftYear}</div>
            <div style={{ width: 24 }} />
          </div>
          <div className="prange-pk-wd">
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(w => <div key={w} className="prange-pk-wdc">{w}</div>)}
          </div>
          <div className="prange-pk-days">{renderMonth(leftYear, leftMonth)}</div>
        </div>
        <div className="prange-pk-month">
          <div className="prange-pk-mnav">
            <div style={{ width: 24 }} />
            <div className="prange-pk-mlbl">{PR_MONTHS[rightMonth]} {rightYear}</div>
            <button className="prange-pk-navbtn" onClick={() => shift(1)}>→</button>
          </div>
          <div className="prange-pk-wd">
            {['Mo','Tu','We','Th','Fr','Sa','Su'].map(w => <div key={w} className="prange-pk-wdc">{w}</div>)}
          </div>
          <div className="prange-pk-days">{renderMonth(rightYear, rightMonth)}</div>
        </div>
      </div>
      <div className="prange-pk-foot">
        <div className="prange-pk-presets">
          {[
            { k: 'this-month',   label: 'This month' },
            { k: 'last-month',   label: 'Last month' },
            { k: 'last-quarter', label: 'Last quarter' },
            { k: 'ytd',          label: 'Year to date' },
          ].map(p => (
            <button
              key={p.k}
              className={`prange-pk-preset${activePreset === p.k ? ' act' : ''}`}
              onClick={() => applyPreset(p.k)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="prange-pk-actions">
          <button className="prange-pk-cancel" onClick={onClose}>Cancel</button>
          <button
            className="prange-pk-apply"
            disabled={!start || !end}
            onClick={() => start && end && onApply({ start, end })}>
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
