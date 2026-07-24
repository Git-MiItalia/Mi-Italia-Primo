import { useState } from 'react'

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

function SelectWrap({ label, value, onChange, options, placeholder }) {
  return (
    <div className="catsel-row">
      <label className="catsel-lbl">{label}</label>
      <div className="catsel-select-wrap">
        <select className="catsel-select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
          <option value="">{placeholder}</option>
          {options.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <span className="material-symbols-outlined catsel-chev">expand_more</span>
      </div>
    </div>
  )
}

export default function CategorySelectorDropdown({ onChange }) {
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

  const l2Options = state.l1 ? Object.keys(CAT_DATA[state.l1].types) : []
  const l3Options = state.l1 && state.l2 ? CAT_DATA[state.l1].types[state.l2].styles : []
  const l4Options = state.l1 && state.l2 ? CAT_DATA[state.l1].types[state.l2].attrs  : []

  const resultPath = [state.l1, state.l2, state.l3].filter(Boolean).join(' → ')

  return (
    <div className="catsel-wrap">

      {/* L1 */}
      <SelectWrap
        label="Division"
        value={state.l1}
        onChange={selectL1}
        options={L1_KEYS}
        placeholder="Select division…"
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
