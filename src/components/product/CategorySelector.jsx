import { useState,useEffect } from 'react'

const CAT_DATA = {
  "Women's": {
    icon: 'female',
    types: {
      'Dresses':     { styles: ['Mini Dress','Midi Dress','Maxi Dress','Wrap Dress','Shirt Dress','Slip Dress','Bodycon','Cocktail Dress'], attrs: ['Casual','Smart Casual','Evening','Resort','Bridal','Workwear'] },
      'Tops':        { styles: ['Blouse','T-Shirt','Knitwear','Bodysuit','Corset','Camisole','Polo'],                                     attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Trousers':    { styles: ['Straight Leg','Wide Leg','Tailored','Cropped','Joggers','Shorts','Flared'],                              attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Skirts':      { styles: ['Mini','Midi','Maxi','Pleated','A-Line','Pencil','Wrap'],                                                 attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Outerwear':   { styles: ['Coat','Jacket','Blazer','Gilet','Trench','Puffer','Cape'],                                               attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Knitwear':    { styles: ['Sweater','Cardigan','Turtleneck','Vest','Twin Set'],                                                     attrs: ['Casual','Smart Casual','Resort'] },
      'Swimwear':    { styles: ['Bikini','One-Piece','Tankini','Cover-Up'],                                                               attrs: ['Resort','Beach','Sport'] },
      'Accessories': { styles: ['Bag','Shoes','Jewellery','Belt','Scarf','Sunglasses','Hat'],                                             attrs: ['Casual','Evening','Resort'] },
    }
  },
  "Men's": {
    icon: 'male',
    types: {
      'Tops':        { styles: ['Shirt','T-Shirt','Polo','Knitwear','Sweatshirt'],                      attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Trousers':    { styles: ['Tailored','Chinos','Denim','Shorts','Cargo'],                          attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Outerwear':   { styles: ['Coat','Jacket','Blazer','Gilet','Vest','Puffer','Trench'],             attrs: ['Casual','Smart Casual','Evening','Workwear'] },
      'Suits':       { styles: ['Two-Piece','Three-Piece','Dinner Suit','Separates'],                   attrs: ['Business','Evening','Formal'] },
      'Knitwear':    { styles: ['Sweater','Cardigan','Turtleneck','Vest'],                              attrs: ['Casual','Smart Casual'] },
      'Accessories': { styles: ['Bag','Shoes','Tie','Belt','Scarf','Cap','Watch Strap'],                attrs: ['Casual','Evening','Formal'] },
    }
  },
  'Unisex': {
    icon: 'person',
    types: {
      'Streetwear':  { styles: ['Hoodie','Sweatshirt','Joggers','Shorts','T-Shirt'], attrs: ['Casual','Sport'] },
      'Outerwear':   { styles: ['Jacket','Coat','Puffer','Gilet'],                  attrs: ['Casual','Outdoor'] },
      'Accessories': { styles: ['Bag','Cap','Scarf','Belt','Shoes'],                attrs: ['Casual','Sport'] },
    }
  },
  'Vintage': {
    icon: 'history',
    types: {
      "Women's Vintage": { styles: ['Dress','Blouse','Skirt','Jacket','Coat','Trousers'], attrs: ['70s','80s','90s','Y2K'] },
      "Men's Vintage":   { styles: ['Shirt','Jacket','Coat','Trousers','Knitwear'],       attrs: ['70s','80s','90s','Military'] },
      'Unisex Vintage':  { styles: ['Denim','Sportswear','Accessories'],                  attrs: ['70s','80s','90s'] },
    }
  },
  'Kids': {
    icon: 'child_care',
    types: {
      'Girls':  { styles: ['Dress','Top','Trousers','Outerwear','Accessories'], attrs: ['0-2y','3-6y','7-12y'] },
      'Boys':   { styles: ['Top','Trousers','Outerwear','Accessories'],         attrs: ['0-2y','3-6y','7-12y'] },
      'Unisex': { styles: ['Top','Trousers','Outerwear','Accessories'],         attrs: ['0-2y','3-6y','7-12y'] },
    }
  }
}

const L1_KEYS = Object.keys(CAT_DATA)

function initState() { return { l1:null, l2:null, l3:null, l4:[] } }

function parseInitial(categoryPath) {
  if (!categoryPath) return { state: initState(), panel: 'l1', collapsed: false }
  const parts = categoryPath.split(' > ')
  const state = {
    l1: parts[0] ?? null,
    l2: parts[1] ?? null,
    l3: parts[2] ?? null,
    l4: [],
  }
  const collapsed = !!parts[2]
  const panel = parts[2] ? 'attrs' : parts[1] ? 'l3' : parts[0] ? 'l2' : 'l1'
  return { state, panel, collapsed }
}


export default function CategorySelector({ onChange, initialCategory }) {
  const parsed = parseInitial(initialCategory)

  const [state,     setState]     = useState(parsed.state)
  const [panel,     setPanel]     = useState(parsed.panel)
  const [collapsed, setCollapsed] = useState(parsed.collapsed)

  useEffect(() => {
    if (!initialCategory) return
    const parsed = parseInitial(initialCategory)
    setState(parsed.state)
    setPanel(parsed.panel)
    setCollapsed(parsed.collapsed)
    if (onChange) onChange(parsed.state)
  }, [initialCategory])

  function getTypes()    { return state.l1 ? Object.keys(CAT_DATA[state.l1].types) : [] }
  function getStyles()   { return (state.l1 && state.l2) ? CAT_DATA[state.l1].types[state.l2].styles : [] }
  function getAttrs()    { return (state.l1 && state.l2) ? CAT_DATA[state.l1].types[state.l2].attrs  : [] }
  function isSingle(arr) { return arr.length <= 5 }
  function notify(s)     { if (onChange) onChange(s) }

  function selectL1(val) { const next = { l1:val, l2:null, l3:null, l4:[] }; setState(next); setPanel('l2'); notify(next) }
  function selectL2(val) { const next = { ...state, l2:val, l3:null, l4:[] }; setState(next); setPanel('l3'); notify(next) }
  function selectL3(val) {
    const next = { ...state, l3:val, l4:[] }
    setState(next); setPanel('attrs'); setCollapsed(true); notify(next)
  }

  function toggleAttr(val) {
    const l4   = state.l4.includes(val) ? state.l4.filter(a => a !== val) : [...state.l4, val]
    const next = { ...state, l4 }
    setState(next); notify(next)
  }

  function goBack() {
    if (panel === 'l2') { setState(initState()); setPanel('l1') }
    else if (panel === 'l3') { setState(s => ({ ...s, l2:null, l3:null, l4:[] })); setPanel('l2') }
    else if (panel === 'attrs') { setState(s => ({ ...s, l3:null, l4:[] })); setPanel('l3') }
  }

  function goTo(level) {
    if (level === 0)      { setState(initState()); setPanel('l1'); setCollapsed(false) }
    else if (level === 1) { setState(s => ({ ...s, l2:null, l3:null, l4:[] })); setPanel('l2'); setCollapsed(false) }
    else if (level === 2) { setState(s => ({ ...s, l3:null, l4:[] })); setPanel('l3'); setCollapsed(false) }
  }

  function reset() { setState(initState()); setPanel('l1'); setCollapsed(false) }

  const panelHdr = {
    l1:    { icon:'apps',         text:'Gender / Division' },
    l2:    { icon: state.l1 ? CAT_DATA[state.l1].icon : 'category', text: state.l1 ? `${state.l1} — Product Type` : 'Product Type' },
    l3:    { icon:'style',        text: state.l2 ? `${state.l1} ${state.l2} — Style` : 'Style' },
    attrs: { icon:'auto_awesome', text:'Occasion' },
  }[panel] || { icon:'category', text:'Category' }

  const items       = { l1: L1_KEYS, l2: getTypes(), l3: getStyles() }[panel] || []
  const attrs       = getAttrs()
  const canGoBack   = panel !== 'l1'
  const resultPath  = [state.l1, state.l2, state.l3].filter(Boolean).join(' → ')
  const resultFinal = state.l3 ? (state.l3 + (state.l4.length ? ' · ' + state.l4.join(', ') : '')) : ''

  return (
    <div>
      {/* Breadcrumb + Back button */}
      <div className="cat-bc-nav" style={{ justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
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

        {canGoBack && !collapsed && (
          <span
            onClick={goBack}
            style={{ fontSize:10, fontWeight:600, color:'var(--stone)', cursor:'pointer', display:'flex', alignItems:'center', gap:3, flexShrink:0 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize:13 }}>arrow_back</span>
            Back
          </span>
        )}
      </div>

      {/* Drill-down panel */}
      {!collapsed && (panel === 'l1' || panel === 'l2' || panel === 'l3') && (
        <div className="cat-bc-panel">
          <div className="cat-bc-panel-hdr">
            <span className="material-symbols-outlined">{panelHdr.icon}</span>
            <span>{panelHdr.text}</span>
          </div>
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
          <div style={{ padding:'8px 12px', borderTop:'1px solid var(--mist)' }}>
            <button className="btn btn-sm btn-primary" style={{ width:'100%', justifyContent:'center' }}
              onClick={() => setCollapsed(true)}>
              <span className="material-symbols-outlined">check</span>Done
            </button>
          </div>
        </div>
      )}

      {/* Result strip */}
      {state.l3 && collapsed && (
        <div className="cat-result-strip" style={{ marginTop:6 }}>
          <span className="material-symbols-outlined" style={{ fontSize:14, color:'var(--gold)' }}>category</span>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)' }}>{resultPath}</div>
            <div style={{ fontSize:12, fontWeight:600, color:'var(--cream)' }}>{resultFinal}</div>
          </div>
          <div style={{ fontSize:9, color:'var(--gold)', fontWeight:600, cursor:'pointer' }} onClick={reset}>Change</div>
        </div>
      )}
    </div>
  )
}
