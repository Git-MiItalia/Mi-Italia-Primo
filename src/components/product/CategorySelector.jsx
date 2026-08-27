import { useState, useEffect } from 'react'
import { useCategoryTree, findDivision, findType, findStyle, getAttrNames } from '../../lib/categoryTree'

function initState() { return { l1: null, l2: null, l3: null, l4: [], typeId: null, styleId: null, styleSlug: null } }

function parseInitial(tree, categoryPath, styleSlugs) {
  if (!categoryPath) return { state: initState(), panel: 'l1', collapsed: false }
  const parts = categoryPath.split(' / ')
  const l1 = parts[0] ?? null
  const l2 = parts[1] ?? null
  const l3 = parts[2] ?? null

  // Validate l1 exists in the live tree — if not, treat as empty to prevent crash
  const l1Node = l1 ? findDivision(tree, l1) : null
  if (l1 && !l1Node) return { state: initState(), panel: 'l1', collapsed: false }

  // Validate l2 exists under l1
  const l2Node = l2 ? findType(l1Node, l2) : null
  if (l2 && l1 && !l2Node) {
    return { state: { ...initState(), l1, l2: null, l3: null }, panel: 'l2', collapsed: false }
  }

  const l3Node = l3 ? findStyle(l2Node, l3) : null
  const state = {
    l1,
    l2,
    l3,
    l4: Array.isArray(styleSlugs) ? [...styleSlugs] : [],
    typeId:    l2Node?.id ?? null,
    // styleId is null until the backend adds an id to L3 styles — picked up
    // automatically the moment it appears, no frontend change needed then.
    styleId:   l3Node?.id ?? null,
    styleSlug: l3Node?.slug ?? null,
  }
  const collapsed = !!l3
  const panel = l3 ? 'attrs' : l2 ? 'l3' : l1 ? 'l2' : 'l1'
  return { state, panel, collapsed }
}


export default function CategorySelector({ onChange, initialCategory, initialStyleSlugs, onNotFound }) {
  const { tree, loading, error } = useCategoryTree()

  const [state, setState]         = useState(initState())
  const [panel, setPanel]         = useState('l1')
  const [collapsed, setCollapsed] = useState(false)
  const [initRef, setInitRef]     = useState(null)

  // Re-sync from props once the live tree has loaded — but only fire onChange
  // once per distinct initialCategory value to avoid overwriting AddProduct state
  useEffect(() => {
    if (loading) return
    if (!initialCategory) return
    if (initRef === initialCategory) return
    const parsed = parseInitial(tree, initialCategory, initialStyleSlugs)
    setState(parsed.state)
    setPanel(parsed.panel)
    setCollapsed(parsed.collapsed)
    setInitRef(initialCategory)
    if (onChange) onChange(parsed.state)
  }, [loading, tree, initialCategory, initialStyleSlugs])

  // Safe accessors — guard against missing entries in the live tree
  function getDivisionNode() { return state.l1 ? findDivision(tree, state.l1) : null }
  function getTypeNode()     { return state.l2 ? findType(getDivisionNode(), state.l2) : null }
  function getTypes()  { return getDivisionNode()?.types?.map(t => t.name) ?? [] }
  function getStyles() { return getTypeNode()?.styles?.map(s => s.name) ?? [] }
  function getAttrs()  { return getAttrNames(getTypeNode()) }
  function isSingle(arr) { return arr.length <= 5 }
  function notify(s)     { if (onChange) onChange(s) }

  function selectL1(val) { const next = { ...initState(), l1: val }; setState(next); setPanel('l2'); notify(next) }
  function selectL2(val) {
    const typeId = findType(getDivisionNode(), val)?.id ?? null
    const next = { ...state, l2: val, l3: null, l4: [], typeId, styleId: null, styleSlug: null }
    setState(next); setPanel('l3'); notify(next)
  }
  function selectL3(val) {
    const typeNode = findType(getDivisionNode(), state.l2)
    const styleNode = findStyle(typeNode, val)
    const next = { ...state, l3: val, l4: [], styleId: styleNode?.id ?? null, styleSlug: styleNode?.slug ?? null }
    setState(next)
    setPanel('attrs')
    // Live API doesn't populate attrs today — skip the empty Occasion step
    if (getAttrNames(typeNode).length === 0) setCollapsed(true)
    notify(next)
  }

  function toggleAttr(val) {
    const l4   = state.l4.includes(val) ? state.l4.filter(a => a !== val) : [...state.l4, val]
    const next = { ...state, l4 }
    setState(next); notify(next)
  }

  function goBack() {
    if (panel === 'l2') { setState(initState()); setPanel('l1') }
    else if (panel === 'l3') { setState(s => ({ ...s, l2: null, l3: null, l4: [], typeId: null, styleId: null, styleSlug: null })); setPanel('l2') }
    else if (panel === 'attrs') { setState(s => ({ ...s, l3: null, l4: [], styleId: null, styleSlug: null })); setPanel('l3') }
  }

  function goTo(level) {
    if (level === 0)      { setState(initState()); setPanel('l1'); setCollapsed(false) }
    else if (level === 1) { setState(s => ({ ...s, l2: null, l3: null, l4: [], typeId: null, styleId: null, styleSlug: null })); setPanel('l2'); setCollapsed(false) }
    else if (level === 2) { setState(s => ({ ...s, l3: null, l4: [], styleId: null, styleSlug: null })); setPanel('l3'); setCollapsed(false) }
  }

  function reset() { setState(initState()); setPanel('l1'); setCollapsed(false); notify(initState()) }

  const panelHdr = {
    l1:    { icon: 'apps',         text: 'Gender / Division' },
    l2:    { icon: getDivisionNode()?.icon || 'category', text: state.l1 ? `${state.l1} — Product Type` : 'Product Type' },
    l3:    { icon: 'style',        text: state.l2 ? `${state.l1} ${state.l2} — Style` : 'Style' },
    attrs: { icon: 'auto_awesome', text: 'Occasion' },
  }[panel] || { icon: 'category', text: 'Category' }

  const items       = { l1: tree.map(c => c.name), l2: getTypes(), l3: getStyles() }[panel] || []
  const attrs       = getAttrs()
  const canGoBack   = panel !== 'l1'
  const resultPath  = [state.l1, state.l2, state.l3].filter(Boolean).join(' → ')
  const resultFinal = state.l3 ? (state.l3 + (state.l4.length ? ' · ' + state.l4.join(', ') : '')) : ''

  return (
    <div>
      {/* Breadcrumb + Back button */}
      <div className="cat-bc-nav">
        <div className="cat-bc-crumbs">
          {state.l3 && collapsed && (
            <span className="cat-selected-label">Selected Category:</span>
          )}
          {!state.l1 && <span className="cat-bc-crumb">Choose...</span>}
          {state.l1 && (
            <span
              className={`cat-bc-crumb ${!state.l2 ? 'bc-active' : 'bc-done'}`}
              onClick={state.l2 ? () => goTo(1) : undefined}
            >
              {state.l1}
            </span>
          )}
          {state.l2 && (
            <>
              <span className="cat-bc-sep"><span className="material-symbols-outlined cat-bc-chevron">chevron_right</span></span>
              <span
                className={`cat-bc-crumb ${!state.l3 ? 'bc-active' : 'bc-done'}`}
                onClick={state.l3 ? () => goTo(2) : undefined}
              >
                {state.l2}
              </span>
            </>
          )}
          {state.l3 && (
            <>
              <span className="cat-bc-sep"><span className="material-symbols-outlined cat-bc-chevron">chevron_right</span></span>
              <span className="cat-bc-crumb bc-done" onClick={() => goTo(2)}>{state.l3}</span>
            </>
          )}
        </div>

        <div className="cat-bc-nav-right">
          {canGoBack && !collapsed && (
            <span className="cat-bc-back" onClick={goBack}>
              <span className="material-symbols-outlined">arrow_back</span>
              Back
            </span>
          )}

          {state.l3 && collapsed && (
            <span className="cat-bc-change" onClick={reset}>Change</span>
          )}

          {onNotFound && (
            <span className="cat-notfound-btn" onClick={onNotFound}>
              <span className="material-symbols-outlined">search_off</span>
              Category Not Found
            </span>
          )}
        </div>
      </div>

      {/* Drill-down panel */}
      {!collapsed && (panel === 'l1' || panel === 'l2' || panel === 'l3') && (
        <div className="cat-bc-panel">
          <div className="cat-bc-panel-hdr">
            <span className="material-symbols-outlined">{panelHdr.icon}</span>
            <span>{panelHdr.text}</span>
          </div>
          {loading && <div className="cat-bc-hint">Loading categories…</div>}
          {!loading && error && <div className="cat-bc-hint">Couldn't load categories. Please refresh.</div>}
          <div className={`cat-bc-grid${isSingle(items) ? ' col1' : ''}`}>
            {items.map(item => {
              const selected =
                (panel === 'l1' && state.l1 === item) ||
                (panel === 'l2' && state.l2 === item) ||
                (panel === 'l3' && state.l3 === item)
              const onClick =
                panel === 'l1' ? () => selectL1(item) :
                panel === 'l2' ? () => selectL2(item) :
                                 () => selectL3(item)
              return (
                <div key={item} className={`cat-bc-item${selected ? ' cat-bc-sel' : ''}`} onClick={onClick}>
                  <span>{item}</span>
                  <span className="material-symbols-outlined">chevron_right</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Attributes panel */}
      {!collapsed && panel === 'attrs' && (
        <div className="cat-bc-panel">
          <div className="cat-bc-panel-hdr">
            <span className="material-symbols-outlined">auto_awesome</span>
            <span>Occasion <span className="cat-bc-optional">(optional · select all that apply)</span></span>
          </div>
          <div className="cat-attr-row">
            {attrs.map(a => (
              <div key={a} className={`cat-attr-chip${state.l4.includes(a) ? ' attr-sel' : ''}`} onClick={() => toggleAttr(a)}>
                {a}
              </div>
            ))}
          </div>
          <div className="cat-bc-hint">Helps surface this product in occasion-based filters in the app</div>
          <div className="cat-done-wrap">
            <button className="btn btn-sm btn-primary cat-done-btn" onClick={() => setCollapsed(true)}>
              <span className="material-symbols-outlined">check</span>Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
