import { useState } from 'react'
import { useCategoryTree, findDivision, findType, getAttrNames } from '../../lib/categoryTree'

function initState() { return { l1:null, l2:null, l3:null, l4:[] } }

function SelectWrap({ label, value, onChange, options, placeholder, disabled }) {
  return (
    <div className="catsel-row">
      <label className="catsel-lbl">{label}</label>
      <div className="catsel-select-wrap">
        <select className="catsel-select" value={value ?? ''} onChange={e => onChange(e.target.value)} disabled={disabled}>
          <option value="">{placeholder}</option>
          {options.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <span className="material-symbols-outlined catsel-chev">expand_more</span>
      </div>
    </div>
  )
}

export default function CategorySelectorDropdown({ onChange }) {
  const { tree, loading } = useCategoryTree()
  const [state, setState] = useState(initState())

  function notify(s) { if (onChange) onChange(s) }

  function selectL1(val) {
    const next = { l1: val || null, l2: null, l3: null, l4: [] }
    setState(next); notify(next)
  }

  function selectL2(val) {
    const next = { ...state, l2: val || null, l3: null, l4: [] }
    setState(next); notify(next)
  }

  function selectL3(val) {
    const next = { ...state, l3: val || null, l4: [] }
    setState(next); notify(next)
  }

  function toggleAttr(val) {
    const l4   = state.l4.includes(val) ? state.l4.filter(a => a !== val) : [...state.l4, val]
    const next = { ...state, l4 }
    setState(next); notify(next)
  }

  function reset() { const next = initState(); setState(next); notify(next) }

  const l1Options = tree.map(c => c.name)
  const divisionNode = state.l1 ? findDivision(tree, state.l1) : null
  const typeNode     = state.l1 && state.l2 ? findType(divisionNode, state.l2) : null
  const l2Options = divisionNode?.types?.map(t => t.name) ?? []
  const l3Options = typeNode?.styles?.map(s => s.name) ?? []
  const l4Options = getAttrNames(typeNode)

  const resultPath = [state.l1, state.l2, state.l3].filter(Boolean).join(' → ')

  return (
    <div className="catsel-wrap">

      {/* L1 */}
      <SelectWrap
        label="Division"
        value={state.l1}
        onChange={selectL1}
        options={l1Options}
        placeholder={loading ? 'Loading divisions…' : 'Select division…'}
        disabled={loading}
      />

      {/* L2 */}
      {state.l1 && (
        <SelectWrap
          label="Category"
          value={state.l2}
          onChange={selectL2}
          options={l2Options}
          placeholder="Select category…"
        />
      )}

      {/* L3 */}
      {state.l2 && (
        <SelectWrap
          label="Style"
          value={state.l3}
          onChange={selectL3}
          options={l3Options}
          placeholder="Select style…"
        />
      )}

      {/* Force line break before second row */}
      {state.l3 && <div className="catsel-break" />}

      {/* Result strip — second line, left */}
      {state.l3 && (
        <div className="catsel-result">
          <span className="material-symbols-outlined catsel-result-icon">category</span>
          <div className="catsel-result-body">
            <div className="catsel-result-path">{resultPath}</div>
            {state.l4.length > 0 && <div className="catsel-result-attrs">{state.l4.join(', ')}</div>}
          </div>
          <button className="btn btn-xs btn-outline catsel-reset" onClick={reset}>
            <span className="material-symbols-outlined" style={{ fontSize:13 }}>refresh</span>Reset
          </button>
        </div>
      )}

      {/* L4 chips — second line, right of result */}
      {state.l3 && l4Options.length > 0 && (
        <div className="catsel-row">
          <label className="catsel-lbl">Occasion <span className="catsel-optional">(optional)</span></label>
          <div className="catsel-chips">
            {l4Options.map(a => (
              <div key={a} className={`catsel-chip${state.l4.includes(a) ? ' sel' : ''}`} onClick={() => toggleAttr(a)}>
                {a}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}
