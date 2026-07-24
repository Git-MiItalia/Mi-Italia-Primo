// SizeChart.jsx
// Usage: <SizeChart l1="Women's" l2="Tops" l3="Blouse" />

const ONE_SIZE = { cols: ['Size'], rows: [{ Size: 'ONE SIZE' }] }

const SCHEMAS = {

  // ── WOMEN'S ──────────────────────────────────────────────────────────────────

  "Women's|Dresses": {
    cols: ['Size', 'To Fit Bust (cm)', 'To Fit Waist (cm)', 'To Fit Hip (cm)'],
    rows: [
      { Size:'XS', 'To Fit Bust (cm)':80.0,  'To Fit Waist (cm)':64.8, 'To Fit Hip (cm)':85.1  },
      { Size:'S',  'To Fit Bust (cm)':86.1,  'To Fit Waist (cm)':69.8, 'To Fit Hip (cm)':90.9  },
      { Size:'M',  'To Fit Bust (cm)':94.0,  'To Fit Waist (cm)':78.2, 'To Fit Hip (cm)':97.5  },
      { Size:'L',  'To Fit Bust (cm)':102.4, 'To Fit Waist (cm)':87.6, 'To Fit Hip (cm)':103.9 },
    ],
  },

  "Women's|Tops": {
    cols: ['Size', 'To Fit Bust (cm)', 'To Fit Waist (cm)'],
    rows: [
      { Size:'XS', 'To Fit Bust (cm)':80.0, 'To Fit Waist (cm)':63.5 },
      { Size:'S',  'To Fit Bust (cm)':91.7, 'To Fit Waist (cm)':76.2 },
      { Size:'M',  'To Fit Bust (cm)':95.5, 'To Fit Waist (cm)':80.0 },
      { Size:'L',  'To Fit Bust (cm)':99.3, 'To Fit Waist (cm)':83.8 },
    ],
  },

  "Women's|Trousers": {
    cols: ['Size', 'Brand Size', 'To Fit Waist (cm)', 'Inseam Length (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'26', 'To Fit Waist (cm)':66.0, 'Inseam Length (cm)':68.6 },
      { Size:'S',  'Brand Size':'28', 'To Fit Waist (cm)':71.1, 'Inseam Length (cm)':73.7 },
      { Size:'M',  'Brand Size':'31', 'To Fit Waist (cm)':78.7, 'Inseam Length (cm)':81.3 },
      { Size:'L',  'Brand Size':'34', 'To Fit Waist (cm)':86.4, 'Inseam Length (cm)':88.9 },
    ],
  },

  "Women's|Skirts": {
    cols: ['Size', 'Brand Size', 'To Fit Waist (cm)', 'Inseam Length (cm)', 'Outseam Length (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'28', 'To Fit Waist (cm)':71.1, 'Inseam Length (cm)':17.8, 'Outseam Length (cm)':39.4 },
      { Size:'S',  'Brand Size':'30', 'To Fit Waist (cm)':76.2, 'Inseam Length (cm)':17.8, 'Outseam Length (cm)':40.6 },
      { Size:'M',  'Brand Size':'32', 'To Fit Waist (cm)':81.3, 'Inseam Length (cm)':17.8, 'Outseam Length (cm)':41.9 },
      { Size:'L',  'Brand Size':'34', 'To Fit Waist (cm)':86.4, 'Inseam Length (cm)':20.3, 'Outseam Length (cm)':43.2 },
    ],
  },

  "Women's|Outerwear": {
    cols: ['Size', 'To Fit Bust (cm)', 'To Fit Waist (cm)'],
    rows: [
      { Size:'S',  'To Fit Bust (cm)':86.4,  'To Fit Waist (cm)':71.1 },
      { Size:'M',  'To Fit Bust (cm)':91.4,  'To Fit Waist (cm)':76.2 },
      { Size:'L',  'To Fit Bust (cm)':96.5,  'To Fit Waist (cm)':81.3 },
      { Size:'XL', 'To Fit Bust (cm)':101.6, 'To Fit Waist (cm)':86.4 },
    ],
  },

  "Women's|Knitwear": {
    cols: ['Size', 'Bust (cm)', 'Front Length (cm)', 'Across Shoulder (cm)'],
    rows: [
      { Size:'XS', 'Bust (cm)':111.5, 'Front Length (cm)':51.8, 'Across Shoulder (cm)':61.7 },
      { Size:'S',  'Bust (cm)':117.6, 'Front Length (cm)':53.6, 'Across Shoulder (cm)':64.0 },
      { Size:'M',  'Bust (cm)':123.7, 'Front Length (cm)':55.4, 'Across Shoulder (cm)':66.3 },
      { Size:'L',  'Bust (cm)':130.6, 'Front Length (cm)':57.1, 'Across Shoulder (cm)':69.3 },
    ],
  },

  "Women's|Swimwear": {
    cols: ['Size', 'Brand Size', 'To Fit Bust (cm)', 'To Fit Waist (cm)', 'To Fit Hip (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'XL',  'To Fit Bust (cm)':76.2, 'To Fit Waist (cm)':66.0, 'To Fit Hip (cm)':81.3 },
      { Size:'S',  'Brand Size':'2XL', 'To Fit Bust (cm)':81.3, 'To Fit Waist (cm)':71.1, 'To Fit Hip (cm)':86.4 },
      { Size:'M',  'Brand Size':'3XL', 'To Fit Bust (cm)':86.4, 'To Fit Waist (cm)':76.2, 'To Fit Hip (cm)':91.4 },
      { Size:'L',  'Brand Size':'4XL', 'To Fit Bust (cm)':91.4, 'To Fit Waist (cm)':81.3, 'To Fit Hip (cm)':96.5 },
    ],
  },

  "Women's|Accessories": ONE_SIZE,

  // ── WOMEN'S SHOES ─────────────────────────────────────────────────────────────

  "Women's|Accessories|Shoes": {
    cols: ['UK', 'EURO', 'To Fit Foot Length (cm)'],
    rows: [
      { UK:'6',  EURO:'39',   'To Fit Foot Length (cm)':25.0 },
      { UK:'7',  EURO:'40.5', 'To Fit Foot Length (cm)':26.0 },
      { UK:'8',  EURO:'42',   'To Fit Foot Length (cm)':27.0 },
      { UK:'9',  EURO:'43',   'To Fit Foot Length (cm)':28.0 },
      { UK:'10', EURO:'44.5', 'To Fit Foot Length (cm)':29.0 },
    ],
  },

  // ── MEN'S ─────────────────────────────────────────────────────────────────────

  "Men's|Tops": {
    cols: ['Size', 'Brand Size', 'Chest (cm)', 'Across Shoulder (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'XS', 'Chest (cm)':91.4,  'Across Shoulder (cm)':44.5 },
      { Size:'S',  'Brand Size':'S',  'Chest (cm)':96.5,  'Across Shoulder (cm)':45.7 },
      { Size:'M',  'Brand Size':'M',  'Chest (cm)':101.6, 'Across Shoulder (cm)':47.0 },
      { Size:'L',  'Brand Size':'L',  'Chest (cm)':106.7, 'Across Shoulder (cm)':48.3 },
    ],
  },

  "Men's|Trousers": {
    cols: ['Size', 'Brand Size', 'To Fit Waist (cm)', 'Inseam Length (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'30', 'To Fit Waist (cm)':76.2, 'Inseam Length (cm)':83.8 },
      { Size:'S',  'Brand Size':'32', 'To Fit Waist (cm)':81.3, 'Inseam Length (cm)':83.8 },
      { Size:'M',  'Brand Size':'34', 'To Fit Waist (cm)':86.4, 'Inseam Length (cm)':83.8 },
      { Size:'L',  'Brand Size':'36', 'To Fit Waist (cm)':91.4, 'Inseam Length (cm)':83.8 },
    ],
  },

  "Men's|Outerwear": {
    cols: ['Size', 'Brand Size', 'Chest (cm)', 'Across Shoulder (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'38', 'Chest (cm)':101.6, 'Across Shoulder (cm)':44.5 },
      { Size:'S',  'Brand Size':'40', 'Chest (cm)':106.7, 'Across Shoulder (cm)':45.2 },
      { Size:'M',  'Brand Size':'42', 'Chest (cm)':111.8, 'Across Shoulder (cm)':46.5 },
    ],
  },

  "Men's|Suits": {
    cols: ['Size', 'Brand Size', 'Chest (cm)', 'Across Shoulder (cm)', 'To Fit Waist (cm)', 'Inseam Length (cm)'],
    rows: [
      { Size:'XS', 'Brand Size':'34', 'Chest (cm)':99.1,  'Across Shoulder (cm)':41.9, 'To Fit Waist (cm)':71.1, 'Inseam Length (cm)':92.7 },
      { Size:'S',  'Brand Size':'36', 'Chest (cm)':104.1, 'Across Shoulder (cm)':43.2, 'To Fit Waist (cm)':76.2, 'Inseam Length (cm)':91.4 },
      { Size:'M',  'Brand Size':'38', 'Chest (cm)':109.2, 'Across Shoulder (cm)':44.5, 'To Fit Waist (cm)':81.3, 'Inseam Length (cm)':91.4 },
    ],
  },

  "Men's|Knitwear": {
    cols: ['Size', 'Chest (cm)', 'Across Shoulder (cm)'],
    rows: [
      { Size:'XS', 'Chest (cm)':96.5,  'Across Shoulder (cm)':61.0 },
      { Size:'S',  'Chest (cm)':101.6, 'Across Shoulder (cm)':62.2 },
      { Size:'M',  'Chest (cm)':106.7, 'Across Shoulder (cm)':63.5 },
      { Size:'L',  'Chest (cm)':111.8, 'Across Shoulder (cm)':64.8 },
    ],
  },

  "Men's|Accessories": ONE_SIZE,

  // ── MEN'S SHOES ───────────────────────────────────────────────────────────────

  "Men's|Accessories|Shoes": {
    cols: ['UK', 'EURO', 'To Fit Foot Length (cm)'],
    rows: [
      { UK:'6',  EURO:'40',   'To Fit Foot Length (cm)':24.5 },
      { UK:'7',  EURO:'41',   'To Fit Foot Length (cm)':25.4 },
      { UK:'8',  EURO:'42.5', 'To Fit Foot Length (cm)':26.2 },
      { UK:'10', EURO:'45',   'To Fit Foot Length (cm)':27.9 },
      { UK:'11', EURO:'46',   'To Fit Foot Length (cm)':28.8 },
    ],
  },

  // ── UNISEX ────────────────────────────────────────────────────────────────────

  'Unisex|Accessories': ONE_SIZE,

  // ── KIDS · GIRLS ─────────────────────────────────────────────────────────────

  'Kids|Girls|Dress': {
    cols: ['Size', 'Brand Size', 'To Fit Bust (cm)', 'To Fit Waist (cm)', 'To Fit Hip (cm)'],
    rows: [
      { Size:'Newborn', 'Brand Size':'0-1M', 'To Fit Bust (cm)':36.8, 'To Fit Waist (cm)':37.6, 'To Fit Hip (cm)':39.4 },
      { Size:'0-3M',    'Brand Size':'1-2M', 'To Fit Bust (cm)':40.6, 'To Fit Waist (cm)':41.4, 'To Fit Hip (cm)':43.2 },
      { Size:'3M',      'Brand Size':'2-4M', 'To Fit Bust (cm)':44.2, 'To Fit Waist (cm)':44.2, 'To Fit Hip (cm)':46.7 },
      { Size:'6M',      'Brand Size':'4-6M', 'To Fit Bust (cm)':45.7, 'To Fit Waist (cm)':46.0, 'To Fit Hip (cm)':48.3 },
    ],
  },

  'Kids|Girls|Top': {
    cols: ['Size', 'Brand Size', 'Across Shoulder (cm)', 'Chest (cm)'],
    rows: [
      { Size:'3-4Y', 'Brand Size':'3Y', 'Across Shoulder (cm)':24.1, 'Chest (cm)':54.1 },
      { Size:'4-5Y', 'Brand Size':'4Y', 'Across Shoulder (cm)':24.9, 'Chest (cm)':55.9 },
      { Size:'5-6Y', 'Brand Size':'5Y', 'Across Shoulder (cm)':25.4, 'Chest (cm)':57.9 },
    ],
  },

  'Kids|Girls|Trousers': {
    cols: ['Size', 'Brand Size', 'To Fit Waist (cm)', 'Inseam Length (cm)'],
    rows: [
      { Size:'6Y',  'Brand Size':'S', 'To Fit Waist (cm)':55.1, 'Inseam Length (cm)':58.4 },
      { Size:'8Y',  'Brand Size':'M', 'To Fit Waist (cm)':57.1, 'Inseam Length (cm)':61.0 },
      { Size:'10Y', 'Brand Size':'L', 'To Fit Waist (cm)':61.0, 'Inseam Length (cm)':64.8 },
    ],
  },

  'Kids|Girls|Outerwear': {
    cols: ['Size', 'Brand Size', 'Chest (cm)', 'Across Shoulder (cm)'],
    rows: [
      { Size:'6-7Y',   'Brand Size':'S',  'Chest (cm)':63.5, 'Across Shoulder (cm)':30.5 },
      { Size:'8-9Y',   'Brand Size':'M',  'Chest (cm)':68.6, 'Across Shoulder (cm)':31.8 },
      { Size:'10-11Y', 'Brand Size':'L',  'Chest (cm)':72.4, 'Across Shoulder (cm)':33.0 },
      { Size:'12-13Y', 'Brand Size':'XL', 'Chest (cm)':76.2, 'Across Shoulder (cm)':34.3 },
    ],
  },

  // ── KIDS · BOYS ───────────────────────────────────────────────────────────────

  'Kids|Boys|Top': {
    cols: ['Size', 'Chest (cm)', 'Across Shoulder (cm)'],
    rows: [
      { Size:'6-7Y',   'Chest (cm)':68.6, 'Across Shoulder (cm)':25.4 },
      { Size:'7-8Y',   'Chest (cm)':71.1, 'Across Shoulder (cm)':26.7 },
      { Size:'9-10Y',  'Chest (cm)':76.2, 'Across Shoulder (cm)':29.2 },
      { Size:'11-12Y', 'Chest (cm)':81.3, 'Across Shoulder (cm)':31.8 },
      { Size:'13-14Y', 'Chest (cm)':87.6, 'Across Shoulder (cm)':34.3 },
    ],
  },

  'Kids|Boys|Trousers': {
    cols: ['Size', 'Brand Size', 'To Fit Waist (cm)'],
    rows: [
      { Size:'2-3Y', 'Brand Size':'2-3Y', 'To Fit Waist (cm)':53.1 },
      { Size:'3-4Y', 'Brand Size':'3-4Y', 'To Fit Waist (cm)':54.4 },
      { Size:'4-5Y', 'Brand Size':'4-5Y', 'To Fit Waist (cm)':55.4 },
      { Size:'5-6Y', 'Brand Size':'5-6Y', 'To Fit Waist (cm)':56.6 },
      { Size:'6-7Y', 'Brand Size':'6-7Y', 'To Fit Waist (cm)':57.4 },
      { Size:'7-8Y', 'Brand Size':'7-8Y', 'To Fit Waist (cm)':59.4 },
    ],
  },

  'Kids|Boys|Outerwear': {
    cols: ['Size', 'Brand Size', 'To Fit Chest (cm)', 'To Fit Waist (cm)'],
    rows: [
      { Size:'18-24M', 'Brand Size':'1-2Y',  'To Fit Chest (cm)':53.1, 'To Fit Waist (cm)':50.3 },
      { Size:'2-4Y',   'Brand Size':'2-4Y',  'To Fit Chest (cm)':55.9, 'To Fit Waist (cm)':54.6 },
      { Size:'4-6Y',   'Brand Size':'4-6Y',  'To Fit Chest (cm)':60.5, 'To Fit Waist (cm)':55.9 },
      { Size:'6-8Y',   'Brand Size':'6-8Y',  'To Fit Chest (cm)':64.8, 'To Fit Waist (cm)':59.2 },
      { Size:'8-10Y',  'Brand Size':'8-10Y', 'To Fit Chest (cm)':70.1, 'To Fit Waist (cm)':63.0 },
    ],
  },
}

// ─── RESOLVER ─────────────────────────────────────────────────────────────────

export function getSchema(l1, l2, l3) {
  if (!l1 || !l2 || !l3) return null

  // Shoes
  if (l3 === 'Shoes') {
    if (l1 === 'Unisex') return SCHEMAS["Men's|Accessories|Shoes"]
    return SCHEMAS[`${l1}|Accessories|Shoes`] ?? ONE_SIZE
  }

  // Kids — L3 specific
  if (l1 === 'Kids') {
    const girlsKey = `Kids|Girls|${l3}`
    const boysKey  = `Kids|Boys|${l3}`
    if (l2 === 'Girls')  return SCHEMAS[girlsKey] ?? ONE_SIZE
    if (l2 === 'Boys')   return SCHEMAS[boysKey]  ?? ONE_SIZE
    if (l2 === 'Unisex') return SCHEMAS[boysKey]  ?? ONE_SIZE
    return ONE_SIZE
  }

  // Unisex Streetwear — map by L3
  if (l1 === 'Unisex' && l2 === 'Streetwear') {
    const map = {
      'Hoodie':     "Men's|Outerwear",
      'Sweatshirt': "Men's|Outerwear",
      'Joggers':    "Men's|Trousers",
      'Shorts':     "Men's|Trousers",
      'T-Shirt':    "Men's|Tops",
    }
    const target = map[l3]
    return target ? SCHEMAS[target] ?? ONE_SIZE : ONE_SIZE
  }

  // Unisex Outerwear → Men's Outerwear
  if (l1 === 'Unisex' && l2 === 'Outerwear') return SCHEMAS["Men's|Outerwear"]

  // Unisex Accessories
  if (l1 === 'Unisex' && l2 === 'Accessories') return ONE_SIZE

  // Vintage — map by L3
  if (l1 === 'Vintage') {
    const isWomens = l2 === "Women's Vintage"
    const map = {
      'Dress':       "Women's|Dresses",
      'Blouse':      "Women's|Tops",
      'Skirt':       "Women's|Skirts",
      'Jacket':      isWomens ? "Women's|Outerwear" : "Men's|Outerwear",
      'Coat':        isWomens ? "Women's|Outerwear" : "Men's|Outerwear",
      'Trousers':    isWomens ? "Women's|Trousers"  : "Men's|Trousers",
      'Shirt':       "Men's|Tops",
      'Knitwear':    "Men's|Knitwear",
      'Denim':       "Men's|Outerwear",
      'Sportswear':  "Men's|Outerwear",
      'Accessories': 'Unisex|Accessories',
    }
    const target = map[l3]
    return target ? SCHEMAS[target] ?? ONE_SIZE : ONE_SIZE
  }

  // Direct L2 lookup
  return SCHEMAS[`${l1}|${l2}`] ?? ONE_SIZE
}

// ─── COMPONENT ────────────────────────────────────────────────────────────────

export default function SizeChart({ l1, l2, l3 }) {
  const schema = getSchema(l1, l2, l3)
  if (!schema) return null

  const { cols, rows } = schema

  return (
    <div className="sizechart-wrap">
      <div className="sizechart-hdr">
        <span className="material-symbols-outlined sizechart-icon">straighten</span>
        <span className="sizechart-title">Size Chart</span>
        <span className="sizechart-unit">All measurements in cm</span>
      </div>
      <div className="sizechart-tbl-wrap">
        <table className="sizechart-tbl">
          <thead>
            <tr>
              {cols.map(col => (
                <th key={col} className="sizechart-th">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="sizechart-row">
                {cols.map(col => (
                  <td key={col} className={`sizechart-td${col === 'Size' || col === 'UK' ? ' sizechart-td-size' : ''}`}>
                    {row[col] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cols[0] !== 'UK' && (
        <div className="sizechart-note">* To-Fit denotes body measurements in cm</div>
      )}
    </div>
  )
}
