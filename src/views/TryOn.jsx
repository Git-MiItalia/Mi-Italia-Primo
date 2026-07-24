import { useState, useEffect, useRef } from 'react'

// ── Data ─────────────────────────────────────────────────
const GALLERY = [
  { id:1, name:'Silk midi dress · Bordeaux', meta:'Editorial · House model · 3:4', status:'published', img:'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400&h=533&fit=crop&q=80' },
  { id:2, name:'Cashmere coat · Camel',      meta:'Natural · Valentina · 3:4',     status:'published', img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=533&fit=crop&q=80' },
  { id:3, name:'Linen blazer · Navy',        meta:'Editorial · House model · 1:1', status:'processing',img:'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=533&fit=crop&q=80' },
  { id:4, name:'Leather tote · Bordeaux',    meta:'Studio · Amara · 3:4',          status:'published', img:'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=533&fit=crop&q=80' },
]

const LOOKS = [
  { id:'editorial', label:'Editorial',        img:'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&q=80' },
  { id:'natural',   label:'Natural light',    img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=300&fit=crop&q=80' },
  { id:'lifestyle', label:'Lifestyle Milano', img:'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=300&fit=crop&q=80' },
  { id:'studio',    label:'Studio clean',     img:'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=300&fit=crop&q=80' },
]

const MODELS = [
  { id:'ab', name:'Atelier Bianchi house model', tag:'DEFAULT', traits:'Mediterranean · 28-32 · Athletic · Dark · long', init:'AB' },
  { id:'m2', name:'Valentina',                   tag:null,      traits:'Northern Italian · 24-28 · Slim · Fair · short', init:'V'  },
  { id:'m3', name:'Amara',                        tag:null,      traits:'W. African · 22-26 · Athletic · Deep · natural', init:'A'  },
]

const SOURCE_IMGS = {
  hanger:    'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=600&h=800&fit=crop&q=80',
  flatlay:   'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=600&h=800&fit=crop&q=80',
  mannequin: 'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=600&h=800&fit=crop&q=80',
}

const RESULT_IMGS = [
  'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=533&fit=crop&q=80',
  'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=400&h=533&fit=crop&q=80',
  'https://images.unsplash.com/photo-1509631179647-0177331693ae?w=400&h=533&fit=crop&q=80',
]

const BATCH_PRODUCTS = [
  { id:1, name:'Silk midi dress · Bordeaux',  meta:'SS26 · €390 · 3 sizes', stock:2,  img:'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=120&h=150&fit=crop&q=80', source:'hanger',    sourceLabel:'Hanger ready',    status:'queued',     statusLabel:'QUEUED',           icon:'more_vert',           iconColor:'var(--stone)' },
  { id:2, name:'Cashmere cardigan · Ivory',   meta:'FW25 · €420 · 5 sizes', stock:4,  img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=120&h=150&fit=crop&q=80', source:'flatlay',   sourceLabel:'Flat-lay ready',  status:'processing', statusLabel:'PROCESSING · 1/3', icon:'more_vert',           iconColor:'var(--stone)' },
  { id:3, name:'Linen blouse · White',        meta:'SS26 · €210 · 4 sizes', stock:3,  img:'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=120&h=150&fit=crop&q=80', source:'hanger',    sourceLabel:'Hanger ready',    status:'done',       statusLabel:'3 VARIANTS READY', icon:'visibility',          iconColor:'var(--gold)'  },
  { id:4, name:'Leather handbag · Cuoio',     meta:'FW25 · €620 · one size',stock:1,  img:'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=120&h=150&fit=crop&q=80', source:'none',      sourceLabel:'No source image', status:'failed',     statusLabel:'NEEDS UPLOAD',    icon:'add_photo_alternate', iconColor:'var(--gold)'  },
  { id:5, name:'Wool coat · Camel',           meta:'FW25 · €780 · 4 sizes', stock:6,  img:'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=120&h=150&fit=crop&q=80', source:'mannequin', sourceLabel:'Mannequin ready', status:'queued',     statusLabel:'QUEUED',           icon:'more_vert',           iconColor:'var(--stone)' },
  { id:6, name:'Leather loafer · Black',      meta:'FW25 · €310 · 6 sizes', stock:5,  img:'https://images.unsplash.com/photo-1554412933-514a83d2f3c8?w=120&h=150&fit=crop&q=80', source:'flatlay',   sourceLabel:'Flat-lay ready',  status:'queued',     statusLabel:'QUEUED',           icon:'more_vert',           iconColor:'var(--stone)' },
  { id:7, name:'Silk scarf · Floral',         meta:'SS26 · €145 · one size',stock:12, img:'https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?w=120&h=150&fit=crop&q=80', source:'flatlay',   sourceLabel:'Flat-lay ready',  status:'queued',     statusLabel:'QUEUED',           icon:'more_vert',           iconColor:'var(--stone)' },
]

const PROC_STEPS = [
  { t:'Reading the garment shape',              d:1500 },
  { t:'Mapping fabric drape and texture',        d:2000 },
  { t:'Lighting the editorial set',              d:1800 },
  { t:'Generating pose 1 / 3 · three-quarter',  d:2400 },
  { t:'Generating pose 2 / 3 · full body',       d:2400 },
  { t:'Generating pose 3 / 3 · detail crop',     d:2400 },
  { t:'Finalising and uploading to your gallery',d:1500 },
]

// ── Shared Sheet Component ────────────────────────────────
function Sheet({ open, onClose, tag, title, sub, children, foot, confirmLabel, onConfirm, hideConfirm }) {
  if (!open) return null
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="sheet-hdr">
          <div>
            <div className="sheet-tag">{tag}</div>
            <div className="sheet-title" dangerouslySetInnerHTML={{__html: title}} />
            {sub && <div className="sheet-sub">{sub}</div>}
          </div>
          <div className="sheet-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="sheet-body">{children}</div>
        <div className="sheet-foot">
          <div className="sheet-foot-note" dangerouslySetInnerHTML={{__html: foot || ''}} />
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          {!hideConfirm && <button className="btn btn-primary" onClick={onConfirm}>{confirmLabel || 'Apply'}</button>}
        </div>
      </div>
    </div>
  )
}

// ── Processing Modal ──────────────────────────────────────
function ProcessingModal({ open, onCancel, isBatch }) {
  const [stepText, setStepText] = useState(PROC_STEPS[0].t)
  const [progress, setProgress] = useState(0)
  const [eta, setEta] = useState('~28 seconds remaining')

  useEffect(() => {
    if (!open) return
    setStepText(PROC_STEPS[0].t)
    setProgress(0)
    setEta('~28 seconds remaining')

    const steps = isBatch ? [
      { t:'Queueing 24 products · 4 in parallel',    d:1200 },
      { t:'Generating: cashmere cardigan · 1 of 4',  d:2200 },
      { t:'Completed: linen blouse · 3 variants',    d:1800 },
      { t:'Generating: silk midi · pose 2 of 3',     d:2000 },
      { t:'Completed: wool coat · 3 variants',       d:1800 },
      { t:'Generating: silk scarf · 18 of 24',       d:2000 },
      { t:'Finalising · uploading to gallery',       d:1500 },
    ] : PROC_STEPS

    const total = steps.reduce((s,x) => s + x.d, 0)
    let elapsed = 0
    let i = 0
    let cancelled = false

    function next() {
      if (cancelled || i >= steps.length) return
      const step = steps[i]
      setStepText(step.t)
      setTimeout(() => {
        if (cancelled) return
        elapsed += step.d
        setProgress((elapsed / total) * 100)
        const rem = Math.max(0, Math.round((total - elapsed) / 1000))
        setEta(rem > 0 ? `~${rem} seconds remaining` : 'Almost done…')
        i++
        next()
      }, step.d)
    }
    next()
    return () => { cancelled = true }
  }, [open])

  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,18,9,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--white)',borderRadius: 0,width:380,overflow:'hidden',boxShadow:'0 20px 60px rgba(26,18,9,0.3)'}}>
        <div style={{height:200,background:`url('https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=400&h=533&fit=crop&q=80') center/cover`,position:'relative',overflow:'hidden'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:'linear-gradient(90deg,transparent,var(--gold),transparent)',animation:'scan 2s linear infinite'}} />
          <div style={{position:'absolute',inset:0,background:'rgba(26,18,9,0.4)'}} />
        </div>
        <div style={{padding:'24px 28px'}}>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:22,fontWeight:500,marginBottom:6}}>
            {isBatch ? 'Running your ' : 'Photographing your '}<em style={{color:'var(--gold)',fontStyle:'italic'}}>
              {isBatch ? 'batch' : 'silk midi'}
            </em>…
          </div>
          <div style={{fontSize:11,color:'var(--stone)',marginBottom:14}}>{stepText}</div>
          <div style={{height:5,background:'var(--mist)',borderRadius: 0,overflow:'hidden',marginBottom:8}}>
            <div style={{height:'100%',background:'linear-gradient(90deg,var(--gold),var(--gold-light))',borderRadius: 0,width:`${progress}%`,transition:'width 0.3s ease'}} />
          </div>
          <div style={{fontSize:10,color:'var(--stone)',marginBottom:16}}>{eta}</div>
          <button style={{fontSize:10,color:'var(--stone)',background:'none',border:'none',cursor:'pointer'}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Results Modal ─────────────────────────────────────────
function RetouchSheet({ open, onClose, variant }) {
  const [activeToolIdx, setActiveToolIdx] = useState(0)
  const tools = [
    { icon:'crop',         name:'Crop & reframe', desc:'Adjust composition without re-generating' },
    { icon:'brightness_6', name:'Lighting',       desc:'Warmer, cooler, brighter, more contrast' },
    { icon:'healing',      name:'Remove artefact',desc:'Brush over a glitch — the AI repaints' },
    { icon:'format_paint', name:'Background',     desc:'Replace or extend background' },
  ]
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:420,background:'var(--white)',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(26,18,9,0.12)',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div className="sheet-hdr">
          <div>
            <div className="sheet-tag">RETOUCH · VARIANT {(variant||0)+1}</div>
            <div className="sheet-title">Retouch <em>variant {(variant||0)+1}</em></div>
            <div className="sheet-sub">Tweak the generated image before publishing. All changes are non-destructive — the original is preserved.</div>
          </div>
          <div className="sheet-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="sheet-body">
          {/* Large image */}
          <div style={{width:'100%',aspectRatio:'3/4',background:"url('https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=800&fit=crop&q=80') center/cover",borderRadius: 0,marginBottom:20}} />
          {/* Tools */}
          <div className="sheet-section-label" style={{marginBottom:10}}>Retouch <em>tools</em></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:18}}>
            {tools.map((t,i) => (
              <div key={i} onClick={() => setActiveToolIdx(i)}
                style={{padding:'14px',background:activeToolIdx===i?'rgba(184,149,90,0.08)':'var(--cream)',border:`1.5px solid ${activeToolIdx===i?'var(--gold)':'var(--mist)'}`,borderRadius: 0,cursor:'pointer',transition:'all 0.15s'}}>
                <div style={{width:32,height:32,borderRadius: 0,background:activeToolIdx===i?'rgba(184,149,90,0.15)':'var(--white)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:8}}>
                  <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--gold)'}}>{t.icon}</span>
                </div>
                <div style={{fontSize:11.5,fontWeight:700,marginBottom:3}}>{t.name}</div>
                <div style={{fontSize:9.5,color:'var(--stone)',lineHeight:1.4}}>{t.desc}</div>
              </div>
            ))}
          </div>
          {/* Regenerate note */}
          <div style={{padding:'13px 14px',background:'rgba(184,149,90,0.06)',borderRadius: 0,fontSize:11,lineHeight:1.5,color:'var(--deep)'}}>
            <strong>Prefer a fresh take?</strong> Use the tools above for fine adjustments, or hit Regenerate to run the whole shoot again. Costs <strong>1 of 33</strong> quota.
          </div>
        </div>
        <div className="sheet-foot">
          <div className="sheet-foot-note">Retouch tools <strong>do not cost quota</strong> — only Regenerate does.</div>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onClose}>Save retouched</button>
        </div>
      </div>
    </div>
  )
}

function SocialSheet({ open, onClose }) {
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',justifyContent:'flex-end'}} onClick={onClose}>
      <div style={{width:420,background:'var(--white)',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(26,18,9,0.12)',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        <div className="sheet-hdr">
          <div>
            <div className="sheet-tag">PREVIEW · COMING SOON</div>
            <div className="sheet-title">Schedule <em>social posts</em></div>
            <div className="sheet-sub">Cross-posting from AI Model Studio to social platforms is coming. Below is the planned experience.</div>
          </div>
          <div className="sheet-close" onClick={onClose}><span className="material-symbols-outlined">close</span></div>
        </div>
        <div className="sheet-body">
          <div style={{background:'rgba(184,149,90,0.08)',border:'1px solid rgba(184,149,90,0.25)',borderRadius: 0,padding:'13px 15px',fontSize:11,lineHeight:1.6,marginBottom:18,display:'flex',gap:10,alignItems:'flex-start'}}>
            <span className="material-symbols-outlined" style={{fontSize:16,flexShrink:0,color:'var(--gold)'}}>schedule_send</span>
            <div><strong>Direct social posting is in development.</strong> Instagram (Meta App Review), TikTok and Pinterest will arrive in stages. For now, <strong>Save to gallery</strong> and download to post manually.</div>
          </div>
          <div className="sheet-section-label" style={{marginBottom:10}}>Posting <em>to</em></div>
          <div style={{display:'flex',flexDirection:'column',gap:8,marginBottom:18}}>
            {[
              {icon:'photo_camera', name:'Instagram', note:'Meta App Review · 12+ weeks'},
              {icon:'music_video',  name:'TikTok',    note:'Scoped after Instagram'},
              {icon:'push_pin',     name:'Pinterest', note:'Tell us if this is a priority'},
            ].map(c => (
              <div key={c.name} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,opacity:0.7}}>
                <span className="material-symbols-outlined" style={{color:'var(--stone)',fontSize:18}}>{c.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600}}>{c.name}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{c.note}</div>
                </div>
                <div style={{fontSize:7,fontWeight:700,letterSpacing:'0.8px',background:'var(--mist)',color:'var(--stone)',padding:'2px 6px',borderRadius: 0}}>COMING SOON</div>
              </div>
            ))}
          </div>
          <div className="sheet-section-label" style={{marginBottom:8}}>Caption <em>preview</em></div>
          <textarea readOnly style={{width:'100%',padding:'10px 12px',background:'var(--cream)',border:'1px solid var(--mist)',borderRadius: 0,fontSize:11,fontFamily:'inherit',lineHeight:1.5,resize:'none',opacity:0.7,marginBottom:10}} rows={4} defaultValue="Silk midi in Bordeaux. SS26 collection · made in Italy. Sizes 38–46 available in store and at miitalia.com/atelier-bianchi" />
          <input readOnly style={{width:'100%',padding:'10px 12px',background:'var(--cream)',border:'1px solid var(--mist)',borderRadius: 0,fontSize:11,fontFamily:'inherit',opacity:0.7}} defaultValue="#atelierbianchi #miitalia #silkdress #ss26 #madeinitaly" />
          <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.55,marginTop:8,fontStyle:'italic'}}>When social posting goes live, captions will be drafted from your product description and stay editable.</div>
        </div>
        <div className="sheet-foot">
          <div className="sheet-foot-note">For now: <strong>Save to gallery</strong>, then download to post manually.</div>
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={onClose}>Save to gallery instead</button>
        </div>
      </div>
    </div>
  )
}

function ResultsModal({ open, onClose, variants, selectedAspect }) {
  const [selectedCards, setSelectedCards] = useState([0])
  const [showPublish,  setShowPublish]  = useState(false)
  const [showRetouch,  setShowRetouch]  = useState(false)
  const [retouchIdx,   setRetouchIdx]   = useState(0)
  const [showSocial,   setShowSocial]   = useState(false)
  const [fading,       setFading]       = useState({})

  if (!open) return null

  const results = [
    { img:'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&h=800&fit=crop&q=80', conf:94, pose:'Three-quarter', desc:'Editorial · warm tungsten · vertical pose' },
    { img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=600&h=800&fit=crop&q=80', conf:89, pose:'Full body',      desc:'Editorial · same lighting · stride pose' },
    { img:'https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&h=800&fit=crop&q=80', conf:76, pose:'Detail crop',    desc:'Editorial · close-up · hem detail' },
  ]

  function toggleCard(i) {
    setSelectedCards(prev => prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i])
  }

  function handleRegenerate(i, e) {
    e.stopPropagation()
    setFading(prev => ({...prev, [i]: true}))
    setTimeout(() => setFading(prev => ({...prev, [i]: false})), 2500)
  }

  function handleSaveToGallery() {
    onClose()
  }

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,18,9,0.7)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:24,overflowY:'auto'}}>
      <div style={{background:'var(--white)',borderRadius: 0,width:'100%',maxWidth:900,boxShadow:'0 20px 60px rgba(26,18,9,0.3)'}}>
        {/* Head */}
        <div style={{padding:'24px 28px',borderBottom:'1px solid var(--mist)',display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:14}}>
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500}}>Three takes of your <em style={{color:'var(--gold)',fontStyle:'italic'}}>Bordeaux midi</em></div>
            <div style={{fontSize:11,color:'var(--stone)',marginTop:3}}>Pick a hero, save the rest, or regenerate any with a small adjustment.</div>
          </div>
          <div style={{width:32,height:32,borderRadius: 0,background:'var(--cream)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}} onClick={onClose}>
            <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--stone)'}}>close</span>
          </div>
        </div>

        {/* Body */}
        <div style={{padding:'24px 28px'}}>
          {/* Result cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:16,marginBottom:28}}>
            {results.map((r,i) => (
              <div key={i} onClick={() => toggleCard(i)}
                style={{borderRadius: 0,border:`2px solid ${selectedCards.includes(i)?'var(--gold)':'var(--mist)'}`,overflow:'hidden',cursor:'pointer',background:'var(--white)',transition:'all 0.15s',opacity:fading[i]?0.4:1}}>
                <div style={{background:`url('${r.img}') center/cover`,aspectRatio:'3/4',position:'relative'}}>
                  <div style={{position:'absolute',bottom:8,left:8,background:'rgba(255,255,255,0.95)',fontSize:9,fontWeight:700,padding:'3px 7px',borderRadius: 0,color:r.conf>=85?'var(--green)':'var(--gold)',display:'flex',alignItems:'center',gap:3}}>
                    <span className="material-symbols-outlined" style={{fontSize:11}}>{r.conf>=85?'check_circle':'info'}</span>{r.conf}%
                  </div>
                  <div style={{position:'absolute',top:8,right:8,width:22,height:22,borderRadius: 0,background:'rgba(255,255,255,0.95)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'var(--deep)'}}>{i+1}</div>
                </div>
                <div style={{padding:'11px 13px'}}>
                  <div style={{fontSize:11.5,fontWeight:700,marginBottom:2}}>Variant {i+1} · {r.pose}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)',marginBottom:8}}>{r.desc}</div>
                  <div style={{display:'flex',gap:6}}>
                    <div style={{flex:1,padding:'5px',background:'var(--cream)',borderRadius: 0,fontSize:9.5,fontWeight:600,textAlign:'center',cursor:'pointer'}}
                      onClick={e=>{e.stopPropagation();setRetouchIdx(i);setShowRetouch(true)}}>Edit</div>
                    <div style={{flex:1,padding:'5px',background:'var(--cream)',borderRadius: 0,fontSize:9.5,fontWeight:600,textAlign:'center',cursor:'pointer'}}
                      onClick={e=>handleRegenerate(i,e)}>Regenerate</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Post-gen actions */}
          <div>
            <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:500,marginBottom:4}}>What's next, <em style={{color:'var(--gold)',fontStyle:'italic'}}>Giulia</em>?</div>
            <div style={{fontSize:11,color:'var(--stone)',marginBottom:14}}>{selectedCards.length} variant{selectedCards.length!==1?'s':''} selected. Pick how to use them — you can do more than one.</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
              {[
                { icon:'storefront',          name:'Push to product',  desc:'Replace Bordeaux midi gallery on storefront. Old images keep in backup.', primary:true,    onClick:()=>setShowPublish(true) },
                { icon:'tune',                name:'Retouch',          desc:'Tweak lighting, crop, or remove an artefact before pushing.',              primary:false,   onClick:()=>{setRetouchIdx(0);setShowRetouch(true)} },
                { icon:'share',               name:'Schedule social',  desc:'Cross-post to Instagram, TikTok and Pinterest with AI-drafted captions. In development.', comingSoon:true, onClick:()=>setShowSocial(true) },
                { icon:'collections_bookmark',name:'Save to gallery',  desc:'Add to brand assets without publishing yet.',                              primary:false,   onClick:handleSaveToGallery },
              ].map((a,i) => (
                <div key={i} onClick={a.onClick}
                  style={{position:'relative',padding:'16px 14px',background:a.primary?'var(--deep)':'var(--cream)',border:`1.5px solid ${a.primary?'var(--deep)':'var(--mist)'}`,borderRadius: 0,cursor:'pointer',transition:'all 0.15s'}}>
                  {a.comingSoon && <div style={{position:'absolute',top:8,right:8,fontSize:7,fontWeight:700,letterSpacing:'0.8px',background:'var(--mist)',color:'var(--stone)',padding:'2px 5px',borderRadius: 0}}>COMING SOON</div>}
                  <div style={{width:36,height:36,borderRadius: 0,background:a.primary?'rgba(184,149,90,0.2)':'var(--white)',display:'flex',alignItems:'center',justifyContent:'center',marginBottom:10}}>
                    <span className="material-symbols-outlined" style={{fontSize:18,color:a.primary?'var(--gold)':'var(--gold)'}}>{a.icon}</span>
                  </div>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4,color:a.primary?'var(--gold)':'var(--deep)'}}>{a.name}</div>
                  <div style={{fontSize:10,color:a.primary?'rgba(245,240,232,0.65)':'var(--stone)',lineHeight:1.5}}>{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Publish sheet */}
      {showPublish && (
        <div style={{position:'fixed',inset:0,zIndex:400,display:'flex',justifyContent:'flex-end'}} onClick={() => setShowPublish(false)}>
          <div style={{width:420,background:'var(--white)',height:'100vh',display:'flex',flexDirection:'column',boxShadow:'-8px 0 40px rgba(26,18,9,0.12)'}} onClick={e=>e.stopPropagation()}>
            <div className="sheet-hdr">
              <div>
                <div className="sheet-tag">PUBLISH · TO PRODUCT</div>
                <div className="sheet-title">Push to <em>storefront</em></div>
                <div className="sheet-sub">Replace the current gallery on the Bordeaux midi product page. The old gallery is saved to backup automatically.</div>
              </div>
              <div className="sheet-close" onClick={()=>setShowPublish(false)}><span className="material-symbols-outlined">close</span></div>
            </div>
            <div className="sheet-body">
              <div className="sheet-section">
                <div className="sheet-section-label">Before / After</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {[
                    {img:'https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=300&h=400&fit=crop&q=80',label:'CURRENT · HANGER ONLY',color:'var(--stone)'},
                    {img:'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=300&h=400&fit=crop&q=80',label:'REPLACING WITH · 2 VARIANTS',color:'var(--green)'},
                  ].map((c,i) => (
                    <div key={i}>
                      <div style={{aspectRatio:'3/4',background:`url('${c.img}') center/cover`,borderRadius: 0}} />
                      <div style={{fontSize:8,fontWeight:700,letterSpacing:'0.8px',color:c.color,marginTop:6,textAlign:'center'}}>{c.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="sheet-section">
                <div className="sheet-section-label">Publish options</div>
                {[
                  {label:'Replace gallery (recommended)', sub:'New images become the primary gallery · hanger shot moves to backup', on:true},
                  {label:'Set first variant as hero image', sub:'Three-quarter pose · 94% confidence · appears first on the product page', on:true},
                  {label:'Update Showroom listing', sub:'Wholesale buyers will see the new imagery too', on:false},
                  {label:'Add AI-generated tag', sub:'Discreet metadata tag · only visible to your team in product admin', on:true},
                ].map((t,i) => (
                  <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',borderBottom:'1px solid var(--mist)'}}>
                    <div>
                      <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{t.label}</div>
                      <div style={{fontSize:10,color:'var(--stone)'}}>{t.sub}</div>
                    </div>
                    <div className={`toggle${t.on?' on':''}`}><div className="toggle-knob"/></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="sheet-foot">
              <div className="sheet-foot-note">Old gallery stays in backups for <strong>90 days</strong> — you can roll back any time from product history.</div>
              <button className="btn btn-outline" onClick={()=>setShowPublish(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={()=>{setShowPublish(false);onClose()}}>Publish to storefront</button>
            </div>
          </div>
        </div>
      )}

      <RetouchSheet open={showRetouch} onClose={()=>setShowRetouch(false)} variant={retouchIdx} />
      <SocialSheet  open={showSocial}  onClose={()=>setShowSocial(false)} />
    </div>
  )
}

// ── HUB SCREEN ────────────────────────────────────────────
function HubScreen({ onNavigate }) {
  return (
    <div>
      <div className="hub-hero">
        <div className="hub-hero-tag">AI MODEL STUDIO</div>
        <h1>Photograph your collection <em>without<br />a camera.</em></h1>
        <p className="hub-hero-sub">Turn any hanger, flat-lay, or mannequin shot into editorial on-model imagery in under a minute. Powered by FASHN, scoped to Atelier Bianchi's brand.</p>
        <div className="hub-quota-row">
          <div className="hub-quota">
            <div className="hub-quota-label">MI ITALIA PRO · THIS MONTH</div>
            <div className="hub-quota-bar"><div className="hub-quota-fill" /></div>
            <div className="hub-quota-stats">
              <span><strong>17</strong> of 50 generations used</span>
              <span><strong>33 left</strong> · resets 1 Jun</span>
            </div>
          </div>
          <button className="hub-quick-gen" onClick={() => onNavigate('generate')}>
            <span className="material-symbols-outlined">bolt</span>Quick generate
          </button>
        </div>
      </div>

      <div className="hub-paths">
        {[
          {tag:'+30s',    icon:'photo_camera', title:'Single',  em:'shoot',   desc:'One product, three on-model variants. Best for hero pieces or new arrivals you want to feature.',           cta:'Start a shoot',   nav:'generate'},
          {tag:'2-15min', icon:'grid_view',    title:'Batch',   em:'session', desc:'Process 5–50 products at once with shared model and look. Best when refreshing a season or onboarding new stock.', cta:'Open batch mode', nav:'batch'},
          {tag:'SET ONCE',icon:'styler',       title:'Brand',   em:'setup',   desc:"Save house models and studio looks so every shoot feels like Atelier Bianchi — not a stock catalogue.",          cta:'Manage brand',    nav:'brand'},
        ].map(p => (
          <div key={p.nav} className="hub-path" onClick={() => onNavigate(p.nav)}>
            <div className="hub-path-tag">{p.tag}</div>
            <div className="hub-path-icon"><span className="material-symbols-outlined">{p.icon}</span></div>
            <h3>{p.title} <em>{p.em}</em></h3>
            <p className="hub-path-desc">{p.desc}</p>
            <div className="hub-path-cta">{p.cta} <span className="material-symbols-outlined">arrow_forward</span></div>
          </div>
        ))}
      </div>

      <div className="hub-section-head">
        <div className="hub-section-title">Recent <em>generations</em></div>
        <div className="hub-section-link">View all <span className="material-symbols-outlined">arrow_forward</span></div>
      </div>
      <div className="hub-gallery">
        {GALLERY.map(g => (
          <div key={g.id} className="gen-card" onClick={() => onNavigate('generate')}>
            <div className="gen-card-img" style={{backgroundImage:`url('${g.img}')`}}>
              <div className={`gen-card-status${g.status==='processing'?' processing':''}`}>
                <span className="material-symbols-outlined">{g.status==='processing'?'pending':'check_circle'}</span>
                {g.status==='processing'?'Processing':'Published'}
              </div>
              <div className="gen-card-overlay">
                <div className="gen-card-actions">
                  {['download','edit','content_copy'].map(ic => (
                    <div key={ic} className="gen-card-action"><span className="material-symbols-outlined">{ic}</span></div>
                  ))}
                </div>
              </div>
            </div>
            <div className="gen-card-body">
              <div className="gen-card-name">{g.name}<span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)'}}>more_horiz</span></div>
              <div className="gen-card-meta"><span className="material-symbols-outlined">auto_awesome</span>{g.meta}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="hub-spotlight">
        <div className="spotlight-left">
          <div className="spotlight-tag">NETWORK INSIGHT · THIS MONTH</div>
          <h3>Natural is<br /><em>converting better</em></h3>
          <p>78% of generations across Mi Italia in May chose Natural or Lifestyle Milano over Editorial. Worth a try if your catalogue is heavy on editorial — it tends to convert 12% better for casual pieces.</p>
          <span className="btn-text" onClick={() => onNavigate('brand')}>
            See network trends <span className="material-symbols-outlined">arrow_forward</span>
          </span>
        </div>
        <div className="spotlight-right">
          {['https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=300&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=300&h=400&fit=crop&q=80','https://images.unsplash.com/photo-1483985988355-763728e1935b?w=300&h=400&fit=crop&q=80'].map((u,i) => (
            <div key={i} className="spotlight-thumb" style={{backgroundImage:`url('${u}')`}} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── GENERATE SCREEN ───────────────────────────────────────
function GenerateScreen({ onNavigate }) {
  const [selectedLook,      setSelectedLook]      = useState('editorial')
  const [selectedModel,     setSelectedModel]     = useState('ab')
  const [selectedAspect,    setSelectedAspect]    = useState('3:4')
  const [variants,          setVariants]          = useState(3)
  const [sourceTab,         setSourceTab]         = useState('hanger')
  const [processing,        setProcessing]        = useState(false)
  const [showResults,       setShowResults]       = useState(false)
  const [showModelSheet,    setShowModelSheet]    = useState(false)
  const [showUploadSheet,   setShowUploadSheet]   = useState(false)
  const [showVariantsSheet, setShowVariantsSheet] = useState(false)
  const [draftVariants,     setDraftVariants]     = useState(3)

  const currentLook  = LOOKS.find(l => l.id === selectedLook)
  const currentModel = MODELS.find(m => m.id === selectedModel)

  function runGeneration() {
    setProcessing(true)
    const total = PROC_STEPS.reduce((s,x) => s+x.d, 0)
    setTimeout(() => { setProcessing(false); setShowResults(true) }, total)
  }

  return (
    <div>
      <div className="gen-head">
        <div className="gen-head-left">
          <div className="gen-product-img" />
          <div>
            <div className="gen-product-name">Silk midi dress · <em>Bordeaux</em></div>
            <div className="gen-product-meta">Atelier Bianchi · SS26 · €390 · 3 sizes in stock</div>
          </div>
        </div>
        <div className="gen-head-right">
          <div className="gen-mode-toggle">
            <div className="gen-mode-btn active"><span className="material-symbols-outlined">tune</span>Detailed</div>
            <div className="gen-mode-btn"><span className="material-symbols-outlined">bolt</span>Quick</div>
          </div>
          <button className="btn btn-outline btn-sm"><span className="material-symbols-outlined">history</span>History</button>
        </div>
      </div>

      <div className="gen-layout">
        <div className="gen-canvas">
          <div className="gen-canvas-source">
            <div className="canvas-corner tl"/><div className="canvas-corner tr"/>
            <div className="canvas-corner bl"/><div className="canvas-corner br"/>
            <img src={SOURCE_IMGS[sourceTab]} alt="source" style={{maxWidth:'80%',maxHeight:'80%',objectFit:'contain'}} />
          </div>
          <div className="gen-canvas-footer">
            <div style={{display:'flex',gap:8}}>
              {[{key:'hanger',icon:'checkroom',label:'Hanger shot'},{key:'flatlay',icon:'image',label:'Flat-lay'},{key:'mannequin',icon:'accessibility',label:'Mannequin'}].map(t => (
                <div key={t.key} className={`source-tab${sourceTab===t.key?' active':''}`} onClick={() => setSourceTab(t.key)}>
                  <span className="material-symbols-outlined">{t.icon}</span>{t.label}
                </div>
              ))}
              <div className="source-tab" onClick={() => setShowUploadSheet(true)}>
                <span className="material-symbols-outlined">add_photo_alternate</span>Upload new
              </div>
            </div>
            <div style={{fontSize:'9.5px',color:'var(--stone)'}}>2400×3200 · 1.2 MB</div>
          </div>
        </div>

        <div className="gen-rhs">
          <div className="brief-card">
            <div className="brief-card-head"><div className="brief-card-title">Studio <em>look</em></div><div className="brief-card-num">1</div></div>
            <div className="brief-card-body">
              <div className="look-grid">
                {LOOKS.map(l => (
                  <div key={l.id} className={`look-card${selectedLook===l.id?' selected':''}`} onClick={() => setSelectedLook(l.id)}>
                    <div className="look-card-img" style={{backgroundImage:`url('${l.img}')`}} />
                    <div className="look-card-foot">
                      <div className="look-card-name">{l.label}</div>
                      <div className="look-card-check"><span className="material-symbols-outlined">check</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="brief-card">
            <div className="brief-card-head"><div className="brief-card-title">Model <em>brief</em></div><div className="brief-card-num">2</div></div>
            <div className="brief-card-body">
              <div className="brief-saved" onClick={() => setShowModelSheet(true)}>
                <div className="brief-saved-hero"><div className="brief-saved-hero-init">{currentModel?.init}</div></div>
                <div className="brief-saved-body">
                  <div className="brief-saved-name">{currentModel?.name}{currentModel?.tag&&<span className="tag">{currentModel.tag}</span>}</div>
                  <div className="brief-saved-meta">{currentModel?.traits}</div>
                </div>
                <span className="material-symbols-outlined brief-saved-chev">expand_more</span>
              </div>
              <div className="diversity-note">
                <div className="diversity-note-icon"><span className="material-symbols-outlined">diversity_3</span></div>
                <div className="diversity-note-body"><strong>Mi Italia model diversity standard.</strong> Italian fashion is global. Choose authentic combinations that represent your actual customer base.</div>
              </div>
            </div>
          </div>

          <div className="brief-card">
            <div className="brief-card-head"><div className="brief-card-title">Format &amp; <em>output</em></div><div className="brief-card-num">3</div></div>
            <div className="brief-card-body">
              <div className="brief-row" style={{border:'none',paddingBottom:8}}>
                <div><div className="brief-row-label">Aspect ratio</div><div className="brief-row-sub">3:4 for store · 1:1 for catalogue · 9:16 for social</div></div>
              </div>
              <div className="aspect-toggle">
                {[{key:'3:4',label:'3:4 STORE',cls:'ar-3-4'},{key:'1:1',label:'1:1 CATALOGUE',cls:'ar-1-1'},{key:'9:16',label:'9:16 SOCIAL',cls:'ar-9-16'}].map(a => (
                  <div key={a.key} className={`aspect-btn${selectedAspect===a.key?' selected':''}`} onClick={() => setSelectedAspect(a.key)}>
                    <div className={`ar-icon ${a.cls}`}/>{a.label}
                  </div>
                ))}
              </div>
              <div className="brief-row" style={{marginTop:16}} onClick={() => {setDraftVariants(variants);setShowVariantsSheet(true)}}>
                <div><div className="brief-row-label">Variants</div><div className="brief-row-sub">Number of poses generated</div></div>
                <div className="brief-row-value">
                  <span>{variants} {variants===1?'pose':'poses'}</span>
                  <span className="material-symbols-outlined" style={{fontSize:13,color:'var(--stone)'}}>chevron_right</span>
                </div>
              </div>
            </div>
          </div>

          <div className="gen-footer">
            <div className="gen-summary">
              <div className="gen-summary-stats">
                <div className="gen-summary-stat"><strong>{variants}</strong> variants</div>
                <div className="gen-summary-stat"><strong>{selectedAspect}</strong> @ 2K</div>
                <div className="gen-summary-stat">{currentLook?.label} · {currentModel?.name?.split(' ')[0]}</div>
              </div>
              <div className="gen-summary-quota"><span className="material-symbols-outlined">data_usage</span>Uses 1 of 33 left</div>
            </div>
            <button className="btn-generate" onClick={runGeneration}>
              <span className="material-symbols-outlined">auto_awesome</span>Generate the shoot
            </button>
          </div>
        </div>
      </div>

      <ProcessingModal open={processing} onCancel={() => setProcessing(false)} isBatch={false} />
      <ResultsModal open={showResults} onClose={() => setShowResults(false)} variants={variants} selectedAspect={selectedAspect} />

      {/* Model Sheet */}
      <Sheet open={showModelSheet} onClose={() => setShowModelSheet(false)} tag="SELECT · MODEL" title="Model <em>brief</em>" sub="Choose a saved model brief for this shoot." foot="" confirmLabel="Apply" onConfirm={() => setShowModelSheet(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:9}}>
          {MODELS.map(m => (
            <div key={m.id} onClick={() => {setSelectedModel(m.id);setShowModelSheet(false)}}
              style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:selectedModel===m.id?'rgba(184,149,90,0.05)':'var(--cream)',borderRadius: 0,cursor:'pointer',border:`1.5px solid ${selectedModel===m.id?'var(--gold)':'transparent'}`}}>
              <div style={{width:42,height:42,borderRadius: 0,flexShrink:0,background:'linear-gradient(135deg,#D4AF72,#8A6A30)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:14,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>{m.init}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:7,marginBottom:2}}>
                  {m.name}{m.tag&&<span style={{fontSize:'7.5px',fontWeight:700,background:'var(--gold)',color:'var(--deep)',padding:'1px 5px',borderRadius: 0}}>{m.tag}</span>}
                </div>
                <div style={{fontSize:'9.5px',color:'var(--stone)'}}>{m.traits}</div>
              </div>
              {selectedModel===m.id&&<span className="material-symbols-outlined" style={{color:'var(--gold)'}}>check_circle</span>}
            </div>
          ))}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:7,padding:14,border:'1.5px dashed var(--mist)',borderRadius: 0,color:'var(--stone)',fontSize:11,fontWeight:600,cursor:'pointer'}}>
            <span className="material-symbols-outlined" style={{fontSize:16}}>add</span>Add new model brief
          </div>
        </div>
      </Sheet>

      {/* Upload Sheet */}
      <Sheet open={showUploadSheet} onClose={() => setShowUploadSheet(false)} tag="UPLOAD · NEW SOURCE" title="Upload a <em>new source</em>" sub="A new hanger, flat-lay, mannequin, or any clean reference shot." foot="Source images are stored in your boutique S3 bucket. Never shared across the Mi Italia network." hideConfirm>
        <div className="sheet-section">
          <div className="sheet-upload-zone">
            <span className="material-symbols-outlined" style={{fontSize:36,color:'var(--gold)'}}>cloud_upload</span>
            <div className="sheet-upload-label">Drop an image or click to browse</div>
            <div className="sheet-upload-sub">PNG · JPG · WEBP · up to 25MB · 2:3 aspect or taller works best</div>
          </div>
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">For best <em>results</em></div>
          <ul className="sheet-tips">
            <li>Plain or neutral background (we will remove it)</li>
            <li>Garment laid flat or hung straight — no folds or twists</li>
            <li>Even lighting, no harsh shadow</li>
            <li>Phone shot is fine — does not need to be a studio shoot</li>
          </ul>
        </div>
      </Sheet>

      {/* Variants Sheet */}
      <Sheet open={showVariantsSheet} onClose={() => setShowVariantsSheet(false)} tag="EDIT · VARIANTS" title="Variants <em>per product</em>" sub="Number of poses to generate for this shoot." foot="Each <strong>generation</strong> burns 1 quota unit regardless of variant count — variants are bundled." confirmLabel="Apply" onConfirm={() => {setVariants(draftVariants);setShowVariantsSheet(false)}}>
        <div className="sheet-section">
          <div className="num-row">
            <div><div className="num-row-label">Poses generated</div><div className="num-row-sub">3 is the sweet spot · 5 gives wider variety · 1 saves quota</div></div>
            <div className="num-stepper">
              <button className="num-btn" onClick={() => setDraftVariants(v => Math.max(1,v-1))}><span className="material-symbols-outlined">remove</span></button>
              <span className="num-value">{draftVariants}</span>
              <button className="num-btn" onClick={() => setDraftVariants(v => Math.min(5,v+1))}><span className="material-symbols-outlined">add</span></button>
            </div>
          </div>
          <div className="sheet-quota-note"><strong>Quota use: </strong>{draftVariants} variants · uses 1 of 33 quota</div>
        </div>
      </Sheet>
    </div>
  )
}

// ── BATCH SCREEN — Full implementation ───────────────────
function BatchScreen({ onNavigate }) {
  const [selectedLook,  setSelectedLook]  = useState('editorial')
  const [selectedModel, setSelectedModel] = useState('ab')
  const [batchAspect,   setBatchAspect]   = useState('3:4 STORE')
  const [batchVariants, setBatchVariants] = useState(3)
  const [batchParallel, setBatchParallel] = useState('4 at a time')
  const [selected,      setSelected]      = useState(BATCH_PRODUCTS.map(p => p.id))
  const [processing,    setProcessing]    = useState(false)
  const [showResults,   setShowResults]   = useState(false)

  const [showLookSheet,    setShowLookSheet]    = useState(false)
  const [showModelSheet,   setShowModelSheet]   = useState(false)
  const [showAspectSheet,  setShowAspectSheet]  = useState(false)
  const [showVariants,     setShowVariants]     = useState(false)
  const [showParallel,     setShowParallel]     = useState(false)
  const [showVary,         setShowVary]         = useState(false)
  const [varyOn,           setVaryOn]           = useState(false)
  const [rowSheet,         setRowSheet]         = useState(null)
  const [showAddProducts,  setShowAddProducts]  = useState(false)
  const [showSourceFilter, setShowSourceFilter] = useState(false)
  const [draftVariants,    setDraftVariants]    = useState(3)
  const [draftAspect,      setDraftAspect]      = useState('3:4 STORE')
  const [draftParallel,    setDraftParallel]    = useState('4 at a time')
  const [draftLook,        setDraftLook]        = useState('editorial')
  const [draftModel,       setDraftModel]       = useState('ab')

  const currentLook  = LOOKS.find(l => l.id === selectedLook)
  const currentModel = MODELS.find(m => m.id === selectedModel)
  const currentStep  = 2
  const steps = ['Pick products','Set shared brief','Generate','Review & publish']

  function toggleProduct(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function runBatch() {
    setProcessing(true)
    const total = 1200+2200+1800+2000+1800+2000+1500
    setTimeout(() => { setProcessing(false); setShowResults(true) }, total)
  }

  const ASPECT_OPTS = [
    { val:'3:4 STORE',    desc:'Default for product pages. Reads well on phone and tablet.' },
    { val:'1:1 CATALOGUE',desc:'Square format for uniform catalogue grids.' },
    { val:'9:16 SOCIAL',  desc:'Vertical for Instagram Stories, Reels, TikTok.' },
    { val:'4:5 INSTAGRAM',desc:'Optimal feed crop for Instagram posts.' },
  ]

  const PARALLEL_OPTS = [
    { val:'1 at a time', desc:'Slowest but reliable · ~22 min for 24 products' },
    { val:'2 at a time', desc:'Balanced · ~12 min for 24 products' },
    { val:'4 at a time', desc:'Recommended · ~9 min for 24 products' },
    { val:'8 at a time', desc:'Fastest · may hit rate limits on Pro · ~5 min' },
  ]

  return (
    <div>
      <div className="batch-head">
        <div>
          <h1>Batch <em>session</em></h1>
          <p className="batch-head-sub">Generate on-model images for many products at once. Pick a shared studio look and model — adjust per-product later if needed.</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-outline btn-sm"><span className="material-symbols-outlined">save</span>Save draft</button>
          <button className="btn btn-outline btn-sm"><span className="material-symbols-outlined">history</span>Past sessions</button>
        </div>
      </div>

      <div className="batch-stepper">
        {steps.map((s,i) => (
          <div key={s} style={{display:'flex',alignItems:'center',flex:i<steps.length-1?1:'auto'}}>
            <div className={`bstep${i+1<currentStep?' done':''}${i+1===currentStep?' active':''}`}>
              <div className="bstep-num">{i+1<currentStep?<span className="material-symbols-outlined" style={{fontSize:14}}>check</span>:i+1}</div>
              <div className="bstep-label">{s}</div>
            </div>
            {i<steps.length-1&&<div className={`bstep-sep${i+1<currentStep?' done':''}`}/>}
          </div>
        ))}
      </div>

      <div className="batch-layout">
        <div className="batch-side">
          <div className="batch-side-title">Shared <em>brief</em></div>
          <div className="batch-shared">
            <span className="material-symbols-outlined">tips_and_updates</span>
            <div className="batch-shared-body">These settings apply to <strong>all {selected.length} selected products</strong>. You can override per-row before generating.</div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftLook(selectedLook); setShowLookSheet(true) }}>
            <div className="batch-side-row-label">Studio look</div>
            <div className="batch-side-row-value">
              <div style={{width:18,height:18,borderRadius: 0,background:`url('${LOOKS.find(l=>l.id===selectedLook)?.img}') center/cover`,flexShrink:0}} />
              <span>{currentLook?.label}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftModel(selectedModel); setShowModelSheet(true) }}>
            <div className="batch-side-row-label">Model brief</div>
            <div className="batch-side-row-value">
              <div style={{width:22,height:22,borderRadius: 0,background:'linear-gradient(135deg,#D4AF72,#8A6A30)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:9,fontWeight:700,flexShrink:0}}>{currentModel?.init}</div>
              <span>{currentModel?.name?.split(' ')[0]} (house model)</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftAspect(batchAspect); setShowAspectSheet(true) }}>
            <div className="batch-side-row-label">Aspect ratio</div>
            <div className="batch-side-row-value">
              <span>{batchAspect}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftVariants(batchVariants); setShowVariants(true) }}>
            <div className="batch-side-row-label">Variants per product</div>
            <div className="batch-side-row-value">
              <span>{batchVariants} poses</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="batch-side-row" style={{cursor:'pointer'}} onClick={() => { setDraftParallel(batchParallel); setShowParallel(true) }}>
            <div className="batch-side-row-label">Run in parallel</div>
            <div className="batch-side-row-value">
              <span>{batchParallel}</span>
              <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)',marginLeft:'auto'}}>chevron_right</span>
            </div>
          </div>

          <div className="diversity-note" style={{marginTop:18}}>
            <div className="diversity-note-icon"><span className="material-symbols-outlined">groups</span></div>
            <div className="diversity-note-body">
              <strong>Vary model across batch?</strong> Toggle on to randomise within your saved presets so the batch doesn't read as one model in many outfits.
              <div style={{marginTop:8,fontSize:'9.5px',fontWeight:700,color:'var(--gold)',cursor:'pointer'}} onClick={() => setShowVary(true)}>Toggle variation →</div>
            </div>
          </div>
        </div>

        <div className="batch-main">
          <div className="batch-toolbar">
            <div className="batch-toolbar-left">
              <div className="batch-checkbox checked"/>
              <div className="batch-select-count"><strong>{selected.length}</strong> of {BATCH_PRODUCTS.length} products selected</div>
            </div>
            <div style={{display:'flex',gap:10,alignItems:'center'}}>
              <div className="batch-toolbar-search">
                <span className="material-symbols-outlined">search</span>
                <input placeholder="Filter…"/>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowSourceFilter(true)}><span className="material-symbols-outlined">filter_list</span>Source: any</button>
              <button className="btn-batch-add" onClick={() => setShowAddProducts(true)}><span className="material-symbols-outlined">add</span>Add products</button>
            </div>
          </div>

          <div className="batch-rows">
            {BATCH_PRODUCTS.map(p => (
              <div key={p.id} className={`batch-row${selected.includes(p.id)?' selected':''}`}>
                <div className={`batch-checkbox${selected.includes(p.id)?' checked':''}`} onClick={() => toggleProduct(p.id)}/>
                <div className="batch-row-img" style={{backgroundImage:`url('${p.img}')`}}/>
                <div className="batch-row-info">
                  <div className="batch-row-name">{p.name}</div>
                  <div className="batch-row-meta">{p.meta}</div>
                </div>
                <div className="batch-row-stock"><strong>{p.stock}</strong> in stock</div>
                <div className={`batch-row-source${p.source==='none'?' no-image':' has-image'}`}>
                  <span className="material-symbols-outlined">{p.source==='none'?'warning':'check_circle'}</span>{p.sourceLabel}
                </div>
                <div className={`batch-row-status ${p.status}`}>{p.statusLabel}</div>
                <span className="material-symbols-outlined" style={{color:p.iconColor,fontSize:18,cursor:'pointer'}}
                  onClick={() => p.icon==='more_vert' && setRowSheet(p)}>{p.icon}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="batch-summary-bar">
        <div className="batch-summary-left">
          <div>
            <div className="batch-summary-stat-label">SELECTED</div>
            <div className="batch-summary-stat-value">{selected.length}</div>
            <div className="batch-summary-stat-sub">products · {selected.length*batchVariants} variants total</div>
          </div>
          <div style={{width:1,height:36,background:'rgba(245,240,232,0.15)'}}/>
          <div>
            <div className="batch-summary-stat-label">QUOTA</div>
            <div className="batch-summary-stat-value">{selected.length} <em>/ 33</em></div>
            <div className="batch-summary-stat-sub">leaves {33-selected.length} for the rest of May</div>
          </div>
          <div style={{width:1,height:36,background:'rgba(245,240,232,0.15)'}}/>
          <div>
            <div className="batch-summary-stat-label">ETA</div>
            <div className="batch-summary-stat-value">~{Math.ceil(selected.length*0.4)}<em>min</em></div>
            <div className="batch-summary-stat-sub">running {batchParallel}</div>
          </div>
        </div>
        <button className="btn-batch-generate" onClick={runBatch}>
          <span className="material-symbols-outlined">play_arrow</span>
          Run batch · {selected.length} products
        </button>
      </div>

      <ProcessingModal open={processing} onCancel={() => setProcessing(false)} isBatch={true} />
      <ResultsModal open={showResults} onClose={() => setShowResults(false)} variants={batchVariants} selectedAspect={batchAspect} />

      <Sheet open={showLookSheet} onClose={() => setShowLookSheet(false)}
        tag="EDIT · STUDIO LOOK · BATCH"
        title="Studio <em>look</em>"
        sub={`Applies to all ${selected.length} selected products. You can override per-row before generating.`}
        foot="Applies to all <strong>selected products</strong>."
        confirmLabel="Apply look"
        onConfirm={() => { setSelectedLook(draftLook); setShowLookSheet(false) }}>
        <div className="sheet-section">
          <div className="sheet-section-label">Preset <em>looks</em></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {LOOKS.map(l => (
              <div key={l.id} onClick={() => setDraftLook(l.id)}
                style={{borderRadius: 0,border:`1.5px solid ${draftLook===l.id?'var(--gold)':'var(--mist)'}`,background:'var(--white)',cursor:'pointer',overflow:'hidden',transition:'all 0.15s'}}>
                <div style={{height:140,background:`url('${l.img}') center/cover`}}/>
                <div style={{padding:'10px 12px'}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:3,display:'flex',alignItems:'center',gap:6}}>
                    {l.label}
                    {l.id==='editorial' && <span style={{fontSize:'7px',fontWeight:700,background:'var(--gold)',color:'var(--deep)',padding:'1px 5px',borderRadius: 0,letterSpacing:'0.4px'}}>DEFAULT</span>}
                  </div>
                  <div style={{fontSize:9.5,color:'var(--gold)',lineHeight:1.4}}>{
                    l.id==='editorial' ? 'High contrast · warm tungsten · soft drape' :
                    l.id==='natural'   ? 'Soft window light · cream walls · candid' :
                    l.id==='lifestyle' ? 'Cobblestone · golden hour · candid stride' :
                    'Plain backdrop · ringlight · catalogue-clean'
                  }</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">From <em>reference</em></div>
          <div style={{padding:24,border:'1.5px dashed var(--mist)',borderRadius: 0,textAlign:'center',cursor:'pointer',background:'var(--cream)'}}>
            <span className="material-symbols-outlined" style={{fontSize:24,color:'var(--gold)'}}>cloud_upload</span>
            <div style={{fontSize:11,fontWeight:600,marginTop:6}}>Drop a reference image to create a custom look</div>
            <div style={{fontSize:'9.5px',color:'var(--stone)',marginTop:4}}>PNG, JPG, or PDF moodboard · up to 25MB</div>
          </div>
        </div>
      </Sheet>

      <Sheet open={showModelSheet} onClose={() => setShowModelSheet(false)}
        tag="EDIT · MODEL BRIEF · BATCH"
        title="Model <em>brief</em>"
        sub={`Applies to all ${selected.length} selected products. Pick a saved model or fine-tune attributes — preview updates live.`}
        foot="Applies to all <strong>selected products</strong>."
        confirmLabel="Apply brief"
        onConfirm={() => { setSelectedModel(draftModel); setShowModelSheet(false) }}>

        {(() => {
          const m = MODELS.find(x => x.id === draftModel) || MODELS[0]
          const HERO_PHOTOS = {
            ab: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80&fit=crop&crop=faces',
            m2: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80&fit=crop&crop=faces',
            m3: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80&fit=crop&crop=faces',
          }
          return (
            <div style={{display:'flex',gap:14,padding:'0 0 18px',borderBottom:'1px solid var(--mist)',marginBottom:18}}>
              <div style={{position:'relative',width:120,height:150,borderRadius: 0,background:`url('${HERO_PHOTOS[draftModel]}') center/cover`,flexShrink:0,overflow:'hidden'}}>
                <div style={{position:'absolute',top:8,left:8,fontSize:7,fontWeight:700,letterSpacing:'0.8px',background:'rgba(26,18,9,0.75)',color:'var(--cream)',padding:'3px 6px',borderRadius: 0}}>REPRESENTATIVE PREVIEW</div>
              </div>
              <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
                <div>
                  <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'1px',color:'var(--stone)',marginBottom:4,textTransform:'uppercase'}}>
                    {draftModel==='ab'?'Mediterranean Italian · Exact match':draftModel==='m2'?'Northern European · Closest match':'East African · Closest match'}
                  </div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:500,lineHeight:1.1,marginBottom:10}}>{m.name}</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {m.traits.split(' · ').map(t => (
                      <span key={t} style={{padding:'3px 9px',background:'var(--cream)',border:'1px solid var(--mist)',borderRadius: 0,fontSize:10,fontWeight:600}}>{t}</span>
                    ))}
                  </div>
                </div>
                <div style={{fontSize:9.5,color:'var(--stone)',lineHeight:1.5,display:'flex',gap:5,alignItems:'flex-start',marginTop:10}}>
                  <span className="material-symbols-outlined" style={{fontSize:12,flexShrink:0,marginTop:1}}>info</span>
                  Preview snaps to the closest match in our reference library. Your final FASHN output will follow this brief, not be this exact face.
                </div>
              </div>
            </div>
          )
        })()}

        <div style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',background:'var(--cream)',borderRadius: 0,marginBottom:18,cursor:'pointer'}}>
          <span className="material-symbols-outlined" style={{fontSize:16,color:'var(--stone)'}}>add_a_photo</span>
          <span style={{fontSize:11,fontWeight:600}}>Use your own model photo instead</span>
        </div>

        <div style={{marginBottom:18}}>
          <div className="sheet-section-label" style={{marginBottom:10}}>Saved <em>house models</em> · tap to pick</div>
          <div style={{display:'flex',gap:10,overflowX:'auto',paddingBottom:4}}>
            {MODELS.map(m => (
              <div key={m.id} onClick={() => setDraftModel(m.id)}
                style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer',flexShrink:0}}>
                <div style={{width:52,height:52,borderRadius:'50%',background:'linear-gradient(135deg,#D4AF72,#8A6A30)',display:'flex',alignItems:'center',justifyContent:'center',border:`2.5px solid ${draftModel===m.id?'var(--gold)':'transparent'}`,fontSize:15,fontWeight:700,color:'white',fontFamily:"'Cormorant Garamond',serif",boxShadow:draftModel===m.id?'0 0 0 3px rgba(184,149,90,0.2)':'none',transition:'all 0.15s'}}>{m.init}</div>
                <div style={{fontSize:9,fontWeight:600,textAlign:'center',color:draftModel===m.id?'var(--gold)':'var(--stone)',maxWidth:56,lineHeight:1.3}}>{m.name.split(' ')[0]}{m.isDefault&&<div style={{fontSize:7,color:'var(--gold)'}}>★ default</div>}</div>
              </div>
            ))}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer',flexShrink:0}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'var(--cream)',border:'2px dashed var(--mist)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span className="material-symbols-outlined" style={{fontSize:20,color:'var(--gold)'}}>add</span>
              </div>
              <div style={{fontSize:9,fontWeight:600,color:'var(--gold)',textAlign:'center'}}>New model</div>
            </div>
          </div>
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">Skin <em>tone</em></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:6}}>
            {['Pale','Light','Mediterranean','Olive','Brown','Deep brown','Dark'].map(v => (
              <div key={v} style={{padding:'5px 11px',borderRadius: 0,border:`1.5px solid ${v==='Mediterranean'?'var(--gold)':'var(--mist)'}`,background:v==='Mediterranean'?'rgba(184,149,90,0.08)':'var(--white)',fontSize:10.5,fontWeight:600,cursor:'pointer'}}>{v}</div>
            ))}
          </div>
          <div style={{fontSize:'9.5px',color:'var(--stone)',lineHeight:1.5}}>Specify directly — never default silently. Mi Italia is committed to authentic representation.</div>
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">Apparent <em>age</em></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {['18-22','22-28','28-32','32-40','40-48','48-60','60+'].map(v => (
              <div key={v} style={{padding:'5px 11px',borderRadius: 0,border:`1.5px solid ${v==='28-32'?'var(--gold)':'var(--mist)'}`,background:v==='28-32'?'rgba(184,149,90,0.08)':'var(--white)',fontSize:10.5,fontWeight:600,cursor:'pointer'}}>{v}</div>
            ))}
          </div>
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">Body <em>type</em></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:6}}>
            {['Petite','Slim','Athletic','Mid-size','Curve','Plus','Tall'].map(v => (
              <div key={v} style={{padding:'5px 11px',borderRadius: 0,border:`1.5px solid ${v==='Athletic'?'var(--gold)':'var(--mist)'}`,background:v==='Athletic'?'rgba(184,149,90,0.08)':'var(--white)',fontSize:10.5,fontWeight:600,cursor:'pointer'}}>{v}</div>
            ))}
          </div>
          <div style={{fontSize:'9.5px',color:'var(--stone)',lineHeight:1.5}}>Italian fashion is increasingly inclusive. Choose the body type your actual customers see themselves in.</div>
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">Hair</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {['Dark · long','Dark · short','Brown · medium','Blonde · long','Red · medium','Grey · bob','Black · curly','Natural texture · short'].map(v => (
              <div key={v} style={{padding:'5px 11px',borderRadius: 0,border:`1.5px solid ${v==='Dark · long'?'var(--gold)':'var(--mist)'}`,background:v==='Dark · long'?'rgba(184,149,90,0.08)':'var(--white)',fontSize:10.5,fontWeight:600,cursor:'pointer'}}>{v}</div>
            ))}
          </div>
        </div>

        <div className="sheet-section">
          <div className="sheet-section-label">Pose <em>energy</em></div>
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {['Relaxed','Editorial · static','Confident stride','Candid · in motion','Quiet · contemplative'].map(v => (
              <div key={v} style={{padding:'5px 11px',borderRadius: 0,border:`1.5px solid ${v==='Editorial · static'?'var(--gold)':'var(--mist)'}`,background:v==='Editorial · static'?'rgba(184,149,90,0.08)':'var(--white)',fontSize:10.5,fontWeight:600,cursor:'pointer'}}>{v}</div>
            ))}
          </div>
        </div>

        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,marginTop:8,border:'1px solid var(--mist)'}}>
          <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--gold)',flexShrink:0}}>bookmark_add</span>
          <input style={{flex:1,border:'none',background:'none',outline:'none',fontSize:11,fontFamily:'inherit',color:'var(--stone)'}} placeholder="Save edits as new preset, e.g. 'Brida…'" />
          <button style={{padding:'7px 14px',background:'var(--gold)',color:'var(--deep)',border:'none',borderRadius: 0,fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0,whiteSpace:'nowrap'}}>Save as preset</button>
        </div>
      </Sheet>

      <Sheet open={showAspectSheet} onClose={() => setShowAspectSheet(false)}
        tag="EDIT · ASPECT RATIO"
        title="Aspect <em>ratio</em>"
        sub={`Applied to all ${selected.length} selected products. Different products can override later.`}
        foot="Pro tip: pick one ratio per shoot and stay consistent across the season."
        confirmLabel="Apply"
        onConfirm={() => { setBatchAspect(draftAspect); setShowAspectSheet(false) }}>
        <div className="sheet-section" style={{display:'flex',flexDirection:'column',gap:9}}>
          {ASPECT_OPTS.map(o => (
            <div key={o.val} onClick={() => setDraftAspect(o.val)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius: 0,cursor:'pointer',border:`1.5px solid ${draftAspect===o.val?'var(--gold)':'transparent'}`,background:draftAspect===o.val?'rgba(184,149,90,0.1)':'var(--cream)'}}>
              <div>
                <div className="num-row-label" dangerouslySetInnerHTML={{__html:`<strong>${o.val.split(' ')[0]}</strong> · ${o.val.split(' ').slice(1).join(' ')}`}}/>
                <div className="num-row-sub">{o.desc}</div>
              </div>
              <span className="material-symbols-outlined" style={{color:draftAspect===o.val?'var(--gold)':'var(--mist)'}}>{draftAspect===o.val?'check_circle':'radio_button_unchecked'}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={showVariants} onClose={() => setShowVariants(false)}
        tag="EDIT · VARIANTS"
        title="Variants <em>per product</em>"
        sub={`Number of poses generated for each of the ${selected.length} products. More variants = more quota burn.`}
        foot="Each <strong>generation</strong> burns 1 quota unit regardless of variant count — variants are bundled."
        confirmLabel="Apply"
        onConfirm={() => { setBatchVariants(draftVariants); setShowVariants(false) }}>
        <div className="sheet-section">
          <div className="num-row">
            <div><div className="num-row-label">Poses generated</div><div className="num-row-sub">3 is the sweet spot · 5 gives wider variety · 1 saves quota</div></div>
            <div className="num-stepper">
              <button className="num-btn" onClick={() => setDraftVariants(v => Math.max(1,v-1))}><span className="material-symbols-outlined">remove</span></button>
              <span className="num-value">{draftVariants}</span>
              <button className="num-btn" onClick={() => setDraftVariants(v => Math.min(5,v+1))}><span className="material-symbols-outlined">add</span></button>
            </div>
          </div>
          <div className="sheet-quota-note"><strong>Batch total: </strong>{draftVariants*selected.length} variants · uses {selected.length} of 33 quota</div>
        </div>
      </Sheet>

      <Sheet open={showParallel} onClose={() => setShowParallel(false)}
        tag="EDIT · CONCURRENCY"
        title="Run in <em>parallel</em>"
        sub="How many generations to run at once. Higher numbers finish faster but burn quota the same — this is just about throughput."
        foot="<strong>4 at a time</strong> is the sweet spot — fast enough for a coffee break, slow enough not to trigger FASHN rate limits."
        confirmLabel="Apply"
        onConfirm={() => { setBatchParallel(draftParallel); setShowParallel(false) }}>
        <div className="sheet-section" style={{display:'flex',flexDirection:'column',gap:9}}>
          {PARALLEL_OPTS.map(o => (
            <div key={o.val} onClick={() => setDraftParallel(o.val)}
              style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',borderRadius: 0,cursor:'pointer',border:`1.5px solid ${draftParallel===o.val?'var(--gold)':'transparent'}`,background:draftParallel===o.val?'rgba(184,149,90,0.1)':'var(--cream)'}}>
              <div>
                <div className="num-row-label">{o.val}</div>
                <div className="num-row-sub">{o.desc}</div>
              </div>
              <span className="material-symbols-outlined" style={{color:draftParallel===o.val?'var(--gold)':'var(--mist)'}}>{draftParallel===o.val?'check_circle':'radio_button_unchecked'}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={showVary} onClose={() => setShowVary(false)}
        tag="EDIT · MODEL VARIATION"
        title="Vary model <em>across batch</em>"
        sub='Avoid the "one model in 24 outfits" feel. Randomises within your saved house presets.'
        foot="When on, the AI distributes products across selected models roughly evenly. Each product still keeps the same look."
        confirmLabel="Apply"
        onConfirm={() => setShowVary(false)}>
        <div className="sheet-section">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer',marginBottom:18}} onClick={() => setVaryOn(v => !v)}>
            <div>
              <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>Randomise model across batch</div>
              <div style={{fontSize:10,color:'var(--stone)'}}>Picks from your saved house models to add visual variety</div>
            </div>
            <div className={`toggle${varyOn?' on':''}`}><div className="toggle-knob"/></div>
          </div>
          <div className="sheet-section-label">Pool of <em>models</em></div>
          <div style={{display:'flex',flexDirection:'column',gap:9}}>
            {[
              {init:'AB', name:'Atelier Bianchi house model', traits:'Mediterranean · 28-32 · athletic', bg:'linear-gradient(135deg,#D4AF72,#B8955A)', color:'var(--deep)', on:true},
              {init:'SI', name:'Lifestyle · Southern Italian', traits:'Sicilian · 22-28 · natural',       bg:'linear-gradient(135deg,#E8C99A,#C9A26F)', color:'var(--deep)', on:true},
              {init:'DM', name:'Diverse · global capsule',    traits:'East African · 25-32 · tall',       bg:'linear-gradient(135deg,#5C4A3A,#3D2F22)', color:'var(--cream)',on:false},
            ].map(m => (
              <div key={m.init} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0}}>
                <div style={{width:36,height:36,borderRadius: 0,background:m.bg,display:'flex',alignItems:'center',justifyContent:'center',color:m.color,fontSize:13,fontWeight:700,flexShrink:0}}>{m.init}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{m.name}</div>
                  <div style={{fontSize:9.5,color:'var(--stone)'}}>{m.traits}</div>
                </div>
                <div className={`toggle${m.on?' on':''}`} style={{pointerEvents:'none'}}><div className="toggle-knob"/></div>
              </div>
            ))}
          </div>
        </div>
      </Sheet>

      {rowSheet && (
        <Sheet open={!!rowSheet} onClose={() => setRowSheet(null)}
          tag="OVERRIDE · ONE PRODUCT"
          title={`Override for <em>${rowSheet.name.split('·')[0].trim()}</em>`}
          sub="Depart from the shared brief just for this product. Useful when one piece needs a different model or look."
          foot={`Overrides apply <strong>only to ${rowSheet.name.split('·')[0].trim()}</strong>. All other products keep the shared brief.`}
          confirmLabel="Save override"
          onConfirm={() => setRowSheet(null)}>
          <div className="sheet-section">
            <div className="sheet-section-label">Shared brief <em>baseline</em></div>
            <div style={{padding:'12px 14px',background:'var(--cream)',borderRadius: 0,fontSize:10.5,lineHeight:1.55}}>
              <strong>Look:</strong> {currentLook?.label}<br/>
              <strong>Model:</strong> {currentModel?.name}<br/>
              <strong>Aspect:</strong> {batchAspect} · <strong>Variants:</strong> {batchVariants} poses
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">Override <em>look</em></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {['Use shared','Natural light','Lifestyle Milano','Studio clean'].map(v => (
                <div key={v} style={{padding:'6px 12px',background:'var(--cream)',borderRadius: 0,fontSize:10.5,fontWeight:600,cursor:'pointer',border:'1.5px solid var(--mist)'}}>{v}</div>
              ))}
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">Override <em>model</em></div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {['Use shared','Editorial · mature','Lifestyle · Sicilian','Diverse · global'].map(v => (
                <div key={v} style={{padding:'6px 12px',background:'var(--cream)',borderRadius: 0,fontSize:10.5,fontWeight:600,cursor:'pointer',border:'1.5px solid var(--mist)'}}>{v}</div>
              ))}
            </div>
          </div>
          <div className="sheet-section">
            <div className="sheet-section-label">Other <em>actions</em></div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {[
                {icon:'remove_circle',  color:'var(--red)',  label:'Remove from batch',         sub:"Skip this product · don't generate"},
                {icon:'open_in_new',    color:'var(--gold)', label:'Open in single mode',        sub:'Edit this product\'s shoot in detail · returns to batch when done'},
                {icon:'add_photo_alternate',color:'var(--gold)',label:'Upload different source image',sub:'Replace the current hanger / flat-lay / mannequin shot'},
              ].map(a => (
                <div key={a.label} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}} onClick={() => a.label==='Open in single mode'&&onNavigate('generate')}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{a.label}</div>
                    <div style={{fontSize:9.5,color:'var(--stone)'}}>{a.sub}</div>
                  </div>
                  <span className="material-symbols-outlined" style={{color:a.color,fontSize:18}}>{a.icon}</span>
                </div>
              ))}
            </div>
          </div>
        </Sheet>
      )}

      <Sheet open={showAddProducts} onClose={() => setShowAddProducts(false)}
        tag="BATCH · ADD PRODUCTS"
        title="Add <em>products</em>"
        sub={`Pick from your catalogue to add to this batch. Currently ${selected.length} of 47 available products selected.`}
        foot="You can add up to <strong>50 products per batch</strong> on the Pro plan."
        confirmLabel="Done"
        onConfirm={() => setShowAddProducts(false)}>
        <div className="sheet-section">
          <div className="sheet-section-label">Quick <em>add</em></div>
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {[
              {label:'All SS26 arrivals',                sub:'18 products added in last 30 days'},
              {label:'Products missing on-model images', sub:'12 products with only hanger / flat-lay'},
              {label:'Best-sellers last 30 days',        sub:'7 products with most pickups'},
            ].map(a => (
              <div key={a.label} style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}} onClick={() => setShowAddProducts(false)}>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:2}}>{a.label}</div>
                  <div style={{fontSize:'9.5px',color:'var(--stone)'}}>{a.sub}</div>
                </div>
                <span className="material-symbols-outlined" style={{color:'var(--gold)',fontSize:18}}>add_circle</span>
              </div>
            ))}
          </div>
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">Pick <em>specific products</em></div>
          <div style={{display:'flex',alignItems:'center',gap:6,padding:'7px 12px',background:'var(--cream)',borderRadius: 0,marginBottom:12}}>
            <span className="material-symbols-outlined" style={{fontSize:14,color:'var(--stone)'}}>search</span>
            <input style={{border:'none',background:'none',outline:'none',flex:1,fontSize:11,fontFamily:'inherit'}} placeholder="Search catalogue…"/>
          </div>
          <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.5,textAlign:'center',padding:20}}>
            Search a product name, SKU, or season tag.<br/>
            Or close this and use the dropdown filters on the batch toolbar.
          </div>
        </div>
      </Sheet>

      <Sheet open={showSourceFilter} onClose={() => setShowSourceFilter(false)}
        tag="FILTER · SOURCE IMAGE"
        title="Filter by <em>source availability</em>"
        sub="Show products by whether they have a source image ready to generate from."
        foot="Useful when prepping a batch — filter to 'no source' to see what needs uploading first."
        confirmLabel="Apply filter"
        onConfirm={() => setShowSourceFilter(false)}>
        <div className="sheet-section" style={{display:'flex',flexDirection:'column',gap:9}}>
          {['Any source','Hanger shot ready','Flat-lay ready','Mannequin ready','No source image · needs upload'].map(o => (
            <div key={o} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 14px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}}>
              <div className="num-row-label">{o}</div>
              <span className="material-symbols-outlined" style={{color:'var(--mist)'}}>radio_button_unchecked</span>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

// ── BRAND SCREEN ──────────────────────────────────────────
// Static data the Brand screen renders against
const BRAND_CONSISTENCY_CHECKS = [
  { type:'good', icon:'check', title:'House model used in 87% of shoots', desc:'The Atelier Bianchi default appears in 26 of last 30 generations.' },
  { type:'good', icon:'check', title:'Editorial dominant',                 desc:'62% Editorial · 28% Natural · 10% Studio — a clear point of view.' },
  { type:'warn', icon:'info',  title:'Some lifestyle variety',             desc:'Three lifestyle shots in last 30 days. Worth deciding if this is a sub-brand or a stretch.' },
  { type:'good', icon:'check', title:'Single aspect ratio',                desc:'3:4 used consistently — uniform grid on store and catalogue.' },
]
const NETWORK_TREND_LOOKS  = [{ name:'Natural light', pct:42 },{ name:'Editorial', pct:28 },{ name:'Lifestyle Milano', pct:18 },{ name:'Studio clean', pct:12 }]
const NETWORK_TREND_RATIOS = [{ name:'3:4 Store', pct:64 },{ name:'1:1 Catalogue', pct:22 },{ name:'9:16 Social', pct:14 }]
const NETWORK_BOUTIQUES    = [
  { name:'Casa Lombardi',   loc:'Milano · Quadrilatero', img:'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=400&h=533&fit=crop&q=80' },
  { name:'Studio Marchesi', loc:'Firenze · Centro',      img:'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400&h=533&fit=crop&q=80' },
  { name:'Boutique Conti',  loc:'Roma · Trastevere',     img:'https://images.unsplash.com/photo-1488161628813-04466f872be2?w=400&h=533&fit=crop&q=80' },
]
const LOOK_DESCS = {
  editorial:'High contrast · warm tungsten · soft drape',
  natural:  'Soft window light · cream walls · candid',
  lifestyle:'Cobblestone · golden hour · candid stride',
  studio:   'Plain backdrop · ringlight · catalogue-clean',
}

function BrandScreen() {
  // Local state — house models + studio looks live as editable presets
  const [models, setModels] = useState(() => MODELS.map((m, i) => ({ ...m, isDefault: i === 0 })))
  const [looks,  setLooks]  = useState(() => LOOKS.map((l, i) => ({ ...l, isDefault: i === 0 })))

  // Sheet / modal visibility
  const [showBrandMenu,     setShowBrandMenu]     = useState(false)
  const [showNetworkTrends, setShowNetworkTrends] = useState(false)
  const [showAddModel,      setShowAddModel]      = useState(false)
  const [showAddLook,       setShowAddLook]       = useState(false)
  const [showExplain,       setShowExplain]       = useState(false)
  const [showResetConfirm,  setShowResetConfirm]  = useState(false)

  // Drafts for add sheets
  const [newModelName, setNewModelName] = useState('')
  const [newModelBase, setNewModelBase] = useState('ab')
  const [newLookName,  setNewLookName]  = useState('')
  const [newLookBase,  setNewLookBase]  = useState('editorial')

  // Add Model sheet — attribute state (matches "new mode" from spec)
  const [newModelSkin, setNewModelSkin] = useState('Mediterranean')
  const [newModelAge,  setNewModelAge]  = useState('28-32')
  const [newModelBody, setNewModelBody] = useState('Athletic')
  const [newModelHair, setNewModelHair] = useState('Dark · long')
  const [newModelPose, setNewModelPose] = useState('Editorial · static')

  // Hero photo lookup — picks closest reference photo by skin tone
  const HERO_PHOTOS = {
    ab: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80&fit=crop&crop=faces',
    m2: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&q=80&fit=crop&crop=faces',
    m3: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=400&q=80&fit=crop&crop=faces',
  }
  const heroPhotoFor = (skin) =>
    ['Brown','Deep brown','Dark'].includes(skin) ? HERO_PHOTOS.m3 :
    ['Pale','Light'].includes(skin)              ? HERO_PHOTOS.m2 :
                                                    HERO_PHOTOS.ab
  const regionFor = (skin) =>
    ['Brown','Deep brown','Dark'].includes(skin) ? 'East African · closest match' :
    ['Pale','Light'].includes(skin)              ? 'Northern European · closest match' :
                                                    'Mediterranean · closest match'

  const setDefault = (list, setter, id) => setter(list.map(item => ({ ...item, isDefault: item.id === id })))
  const removeItem = (list, setter, id) => setter(list.filter(item => item.id !== id))

  const doReset = () => {
    setModels(MODELS.map((m, i) => ({ ...m, isDefault: i === 0 })))
    setLooks(LOOKS.map((l, i) => ({ ...l, isDefault: i === 0 })))
    setShowResetConfirm(false)
  }

  return (
    <div>
      {/* ── Add Model sheet ── */}
      <Sheet open={showAddModel} onClose={() => setShowAddModel(false)}
        tag="NEW · MODEL BRIEF" title="Add a <em>house model</em>"
        sub="Build a model brief you can re-use across shoots. Specify attributes directly — never default silently. The preview updates as you choose."
        foot="A model brief never overrides your editorial judgement — it just gives the AI a clear starting point."
        confirmLabel="Save model preset"
        onConfirm={() => {
          const name = newModelName.trim() || 'New preset'
          const init = name.split(' ').slice(0,2).map(w=>w[0]||'').join('').toUpperCase() || 'NM'
          setModels(prev => [...prev, {
            id: 'custom-' + Date.now(),
            name,
            tag: null,
            traits: `${newModelSkin} · ${newModelAge} · ${newModelBody} · ${newModelHair}`,
            init,
            isDefault: false,
          }])
          // reset
          setNewModelName('')
          setNewModelSkin('Mediterranean'); setNewModelAge('28-32'); setNewModelBody('Athletic')
          setNewModelHair('Dark · long');   setNewModelPose('Editorial · static')
          setShowAddModel(false)
        }}>

        {/* LIVE PREVIEW HERO */}
        <div style={{display:'flex',gap:14,padding:'0 0 18px',borderBottom:'1px solid var(--mist)',marginBottom:18}}>
          <div style={{position:'relative',width:120,height:150,borderRadius: 0,background:`url('${heroPhotoFor(newModelSkin)}') center/cover`,flexShrink:0,overflow:'hidden'}}>
            <div style={{position:'absolute',top:8,left:8,fontSize:7,fontWeight:700,letterSpacing:'0.8px',background:'rgba(26,18,9,0.75)',color:'var(--cream)',padding:'3px 6px',borderRadius: 0}}>REPRESENTATIVE PREVIEW</div>
          </div>
          <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'space-between'}}>
            <div>
              <div style={{fontSize:9.5,fontWeight:700,letterSpacing:'1px',color:'var(--stone)',marginBottom:4,textTransform:'uppercase'}}>{regionFor(newModelSkin)}</div>
              <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:20,fontWeight:500,lineHeight:1.1,marginBottom:10}}>New <em style={{color:'var(--gold)',fontStyle:'italic'}}>house model</em></div>
              <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {[newModelSkin,newModelAge,newModelBody,newModelHair].map(t => (
                  <span key={t} style={{padding:'3px 9px',background:'var(--cream)',border:'1px solid var(--mist)',borderRadius: 0,fontSize:10,fontWeight:600}}>{t}</span>
                ))}
              </div>
            </div>
            <div style={{fontSize:9.5,color:'var(--stone)',lineHeight:1.5,display:'flex',gap:5,alignItems:'flex-start',marginTop:10}}>
              <span className="material-symbols-outlined" style={{fontSize:12,flexShrink:0,marginTop:1}}>info</span>
              Preview snaps to the closest match in our reference library. Your final FASHN output will follow this brief, not be this exact face.
            </div>
          </div>
        </div>

        {/* UPLOAD ZONE — primary affordance in "new" mode */}
        <div className="sheet-section">
          <div className="sheet-section-label">Photo <em>source</em></div>
          <div style={{position:'relative',border:'1.5px dashed rgba(184,149,90,0.4)',borderRadius: 0,padding:'24px 18px',textAlign:'center',cursor:'pointer',background:'rgba(184,149,90,0.03)'}}>
            <div style={{width:38,height:38,borderRadius: 0,background:'var(--gold)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto'}}>
              <span className="material-symbols-outlined" style={{fontSize:18,color:'var(--deep)'}}>cloud_upload</span>
            </div>
            <div style={{fontSize:12,fontWeight:700,marginTop:8,color:'var(--deep)'}}>Upload your own model photo</div>
            <div style={{fontSize:9.5,color:'var(--stone)',marginTop:3,lineHeight:1.4}}>Drag &amp; drop, or click to browse · we'll suggest attributes</div>
            <div style={{fontSize:9,color:'var(--stone)',marginTop:8,letterSpacing:'0.3px'}}>JPG · PNG · WebP · up to 8 MB</div>
          </div>
          <div style={{fontSize:9.5,color:'var(--stone)',lineHeight:1.55,marginTop:10,padding:'8px 11px',background:'rgba(184,149,90,0.06)',borderLeft:'2px solid var(--gold)',borderRadius: 0,textAlign:'left',fontStyle:'italic'}}>
            <strong style={{color:'var(--gold-dk, #8A6A30)',fontStyle:'normal'}}>Consent:</strong> by uploading, you confirm you have permission to use this person's likeness in AI-generated imagery. We never share your uploads with other boutiques.
          </div>
          <div style={{fontSize:10,color:'var(--stone)',lineHeight:1.55,marginTop:10,textAlign:'center'}}>
            <em>or</em> skip the upload and use one of our reference models — pick attributes below.
          </div>
        </div>

        {/* ATTRIBUTE PICKERS */}
        {[
          { label:'Skin <em>tone</em>',     opts:['Pale','Light','Mediterranean','Olive','Brown','Deep brown','Dark'], val:newModelSkin, set:setNewModelSkin, note:'Specify directly — never default silently. Mi Italia is committed to authentic representation.' },
          { label:'Apparent <em>age</em>',  opts:['18-22','22-28','28-32','32-40','40-48','48-60','60+'],              val:newModelAge,  set:setNewModelAge,  note:null },
          { label:'Body <em>type</em>',     opts:['Petite','Slim','Athletic','Mid-size','Curve','Plus','Tall'],        val:newModelBody, set:setNewModelBody, note:'Italian fashion is increasingly inclusive. Choose the body type your actual customers see themselves in.' },
          { label:'Hair',                   opts:['Dark · long','Dark · short','Brown · medium','Blonde · long','Red · medium','Grey · bob','Black · curly','Natural texture · short'], val:newModelHair, set:setNewModelHair, note:null },
          { label:'Pose <em>energy</em>',   opts:['Relaxed','Editorial · static','Confident stride','Candid · in motion','Quiet · contemplative'], val:newModelPose, set:setNewModelPose, note:null },
        ].map(group => (
          <div key={group.label} className="sheet-section">
            <div className="sheet-section-label" dangerouslySetInnerHTML={{__html:group.label}} />
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {group.opts.map(v => (
                <div key={v} onClick={() => group.set(v)}
                  style={{padding:'5px 11px',borderRadius: 0,border:`1.5px solid ${group.val===v?'var(--gold)':'var(--mist)'}`,background:group.val===v?'rgba(184,149,90,0.08)':'var(--white)',fontSize:10.5,fontWeight:600,cursor:'pointer'}}>
                  {v}
                </div>
              ))}
            </div>
            {group.note && <div style={{fontSize:'9.5px',color:'var(--stone)',marginTop:7,lineHeight:1.5}}>{group.note}</div>}
          </div>
        ))}

        {/* PRESET NAME */}
        <div className="sheet-section">
          <div className="sheet-section-label">Preset <em>name</em></div>
          <input value={newModelName} onChange={e=>setNewModelName(e.target.value)}
            style={{width:'100%',padding:'10px 13px',border:'1.5px solid var(--mist)',borderRadius: 0,fontSize:11.5,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            placeholder="e.g. 'Casual · Spring' or 'Bridal · soft'" />
        </div>
      </Sheet>

      {/* ── Add Look sheet ── */}
      <Sheet open={showAddLook} onClose={() => setShowAddLook(false)}
        tag="NEW · STUDIO LOOK" title="Save a <em>new look</em>"
        sub="Save a custom look from reference. Pick the closest preset to start from, or upload a moodboard."
        confirmLabel="Save look"
        onConfirm={() => {
          const base = LOOKS.find(l => l.id === newLookBase) || LOOKS[0]
          const name = newLookName.trim() || 'New look'
          setLooks(prev => [...prev, { ...base, id:'look-'+Date.now(), label:name, isDefault:false }])
          setNewLookName(''); setNewLookBase('editorial')
          setShowAddLook(false)
        }}>
        <div className="sheet-section">
          <div className="sheet-section-label">Start <em>from</em></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {LOOKS.map(l => (
              <div key={l.id} onClick={() => setNewLookBase(l.id)}
                style={{borderRadius: 0,border:`1.5px solid ${newLookBase===l.id?'var(--gold)':'var(--mist)'}`,background:'var(--white)',cursor:'pointer',overflow:'hidden'}}>
                <div style={{height:120,background:`url('${l.img}') center/cover`}} />
                <div style={{padding:'8px 10px'}}>
                  <div style={{fontSize:11,fontWeight:700}}>{l.label}</div>
                  <div style={{fontSize:9,color:'var(--gold)',marginTop:2}}>{LOOK_DESCS[l.id]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">From <em>reference</em></div>
          <div style={{padding:24,border:'1.5px dashed var(--mist)',borderRadius: 0,textAlign:'center',cursor:'pointer',background:'var(--cream)'}}>
            <span className="material-symbols-outlined" style={{fontSize:24,color:'var(--gold)'}}>cloud_upload</span>
            <div style={{fontSize:11,fontWeight:600,marginTop:6}}>Drop a moodboard image</div>
            <div style={{fontSize:9.5,color:'var(--stone)',marginTop:4}}>PNG, JPG, or PDF · up to 25MB</div>
          </div>
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">Look <em>name</em></div>
          <input value={newLookName} onChange={e=>setNewLookName(e.target.value)}
            style={{width:'100%',padding:'10px 13px',border:'1.5px solid var(--mist)',borderRadius: 0,fontSize:11.5,fontFamily:'inherit',outline:'none',boxSizing:'border-box'}}
            placeholder="e.g. 'Brera afternoon'" />
        </div>
      </Sheet>

      {/* ── Brand menu sheet ── */}
      <Sheet open={showBrandMenu} onClose={() => setShowBrandMenu(false)}
        tag="BRAND · OPTIONS" title="Brand <em>setup</em>"
        sub="Manage your saved house models and studio looks."
        foot="More options coming soon — bulk export, archive view, brand kit settings."
        confirmLabel="Close"
        onConfirm={() => setShowBrandMenu(false)}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px',background:'var(--cream)',borderRadius: 0,cursor:'pointer'}}
            onClick={() => { setShowBrandMenu(false); setShowResetConfirm(true) }}>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>Reset to defaults</div>
              <div style={{fontSize:10,color:'var(--stone)',marginTop:2}}>Removes all custom presets. Cannot be undone.</div>
            </div>
            <span className="material-symbols-outlined" style={{fontSize:20,color:'var(--red)'}}>restart_alt</span>
          </div>
        </div>
      </Sheet>

      {/* ── Network trends sheet ── */}
      <Sheet open={showNetworkTrends} onClose={() => setShowNetworkTrends(false)}
        tag="NETWORK · TRENDS" title="Mi Italia <em>network trends</em>"
        sub="Anonymous aggregate data across Mi Italia. Individual generations are never shared."
        confirmLabel="Close"
        onConfirm={() => setShowNetworkTrends(false)}>
        <div className="sheet-section">
          <div className="sheet-section-label">Most-used <em>looks</em> · May 2026</div>
          {NETWORK_TREND_LOOKS.map(t => (
            <div key={t.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{flex:1,fontSize:11,fontWeight:600}}>{t.name}</div>
              <div style={{flex:2,height:8,background:'var(--cream)',borderRadius: 0,overflow:'hidden'}}>
                <div style={{height:'100%',background:'var(--gold)',width:`${t.pct*2}%`,borderRadius: 0}} />
              </div>
              <div style={{width:36,fontSize:10.5,fontWeight:700,textAlign:'right'}}>{t.pct}%</div>
            </div>
          ))}
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">Most-used <em>aspect ratios</em></div>
          {NETWORK_TREND_RATIOS.map(t => (
            <div key={t.name} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <div style={{flex:1,fontSize:11,fontWeight:600}}>{t.name}</div>
              <div style={{flex:2,height:8,background:'var(--cream)',borderRadius: 0,overflow:'hidden'}}>
                <div style={{height:'100%',background:'var(--gold)',width:`${t.pct}%`,borderRadius: 0}} />
              </div>
              <div style={{width:36,fontSize:10.5,fontWeight:700,textAlign:'right'}}>{t.pct}%</div>
            </div>
          ))}
        </div>
        <div className="sheet-section">
          <div className="sheet-section-label">Conversion <em>lift</em></div>
          <div style={{padding:'14px 16px',background:'rgba(184,149,90,0.06)',borderRadius: 0,fontSize:11,lineHeight:1.55}}>
            Products with AI-generated on-model imagery convert <strong>+18%</strong> better than hanger-only listings across Mi Italia. Lift is strongest for <strong>casual / lifestyle pieces</strong> (+24%) and weakest for <strong>accessories</strong> (+6%).
          </div>
        </div>
      </Sheet>

      {/* ── Explain modal ── */}
      {showExplain && (
        <div className="explain-overlay" onClick={() => setShowExplain(false)}>
          <div className="explain-modal" onClick={e => e.stopPropagation()}>
            <div className="explain-head">
              <div>
                <div className="sheet-tag">METHODOLOGY</div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:500,marginTop:6}}>
                  How is brand <em style={{color:'var(--gold)',fontStyle:'italic'}}>consistency</em> calculated?
                </div>
                <div style={{fontSize:11,color:'var(--stone)',marginTop:5}}>A guide, never a constraint. Here is exactly what we look at.</div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowExplain(false)}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="explain-body">
              <div className="explain-formula">
                Score = <em>model consistency</em> × 0.35 + <em>look concentration</em> × 0.30 + <em>format uniformity</em> × 0.20 + <em>palette coherence</em> × 0.15
              </div>
              <div className="explain-list">
                {[
                  { title:'Model consistency · 35%',  desc:'How often your saved house model appears across the last 30 generations. We weight this highest because it is the single strongest brand signal customers register.' },
                  { title:'Look concentration · 30%', desc:'The Herfindahl index of your studio look distribution. Higher when one look dominates, lower when you spread evenly. We do not punish variety — we reward having a clear point of view.' },
                  { title:'Format uniformity · 20%',  desc:'Aspect ratio consistency across generations destined for the same surface. Mixed ratios on the storefront cost you here.' },
                  { title:'Palette coherence · 15%',  desc:'Colour-temperature and saturation similarity across the set. Two shoots in cool blue light next to a warm tungsten shot read as unrelated.' },
                ].map((item, i) => (
                  <div key={i} className="explain-item">
                    <div className="explain-item-num">{i + 1}</div>
                    <div className="explain-item-body">
                      <div className="explain-item-title">{item.title}</div>
                      <div className="explain-item-desc">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:18,padding:'14px 16px',background:'rgba(184,149,90,0.06)',borderRadius: 0,fontSize:11,lineHeight:1.55,color:'var(--stone)'}}>
                <strong style={{color:'var(--deep)'}}>A note on the score.</strong> We surface this because boutiques tell us they want to be told when their visual language is drifting. We never block a generation, lower your score in private, or share it across the network. Ignore the number if it does not serve you.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset confirm modal ── */}
      {showResetConfirm && (
        <div className="unsaved-overlay" onClick={() => setShowResetConfirm(false)}>
          <div className="unsaved-modal" onClick={e => e.stopPropagation()}>
            <div className="unsaved-icon" style={{background:'rgba(197,0,26,0.1)'}}>
              <span className="material-symbols-outlined" style={{fontSize:28,color:'var(--red)'}}>restart_alt</span>
            </div>
            <h3 className="unsaved-title">Reset brand setup to <em>defaults</em>?</h3>
            <p className="unsaved-desc">This will remove all custom house models and looks you've created. The Mi Italia defaults will be restored. <strong>This cannot be undone.</strong></p>
            <div className="unsaved-actions">
              <button className="unsaved-btn unsaved-btn-cancel" onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button className="unsaved-btn unsaved-btn-discard" onClick={doReset}>
                <span className="material-symbols-outlined">restart_alt</span>
                Reset everything
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page header ── */}
      <div className="brand-head">
        <div className="brand-head-text">
          <h1>Your <em>brand</em> setup</h1>
          <p className="brand-head-sub">Save the models and looks that make Atelier Bianchi feel like Atelier Bianchi. Every shoot starts from these — fewer choices, more consistency.</p>
        </div>
        <button className="brand-head-menu" onClick={() => setShowBrandMenu(true)}>
          <span className="material-symbols-outlined">more_horiz</span>
        </button>
      </div>

      {/* ── House models + Studio looks ── */}
      <div className="brand-grid">
        <div className="brand-card">
          <div className="brand-card-tag">SAVED · MODELS</div>
          <h3>House <em>models</em></h3>
          <p className="brand-card-sub">Up to 6 saved model briefs. The default is used for Quick generate and as the starting point in Detailed mode.</p>
          <div className="preset-list">
            {models.map(m => (
              <div key={m.id} className={`preset-item${m.isDefault?' default':''}`}>
                <div className="preset-av" style={{background:'linear-gradient(135deg,#D4AF72,#8A6A30)',display:'flex',alignItems:'center',justifyContent:'center',color:'white',fontSize:13,fontWeight:700,fontFamily:"'Cormorant Garamond',serif"}}>{m.init}</div>
                <div className="preset-body">
                  <div className="preset-name">
                    {m.name}
                    {m.isDefault && <span className="preset-name-tag">DEFAULT</span>}
                  </div>
                  <div className="preset-traits">{m.traits}</div>
                </div>
                <button className="preset-action" onClick={() => setDefault(models, setModels, m.id)} title="Set as default">
                  <span className="material-symbols-outlined" style={{color:m.isDefault?'var(--gold)':'var(--stone)'}}>{m.isDefault?'star':'star_outline'}</span>
                </button>
                {!m.isDefault && (
                  <button className="preset-action" onClick={() => removeItem(models, setModels, m.id)} title="Remove">
                    <span className="material-symbols-outlined">delete_outline</span>
                  </button>
                )}
              </div>
            ))}
            {models.length < 6 && (
              <button className="preset-add" onClick={() => setShowAddModel(true)}>
                <span className="material-symbols-outlined">add</span>Add house model
              </button>
            )}
          </div>
        </div>

        <div className="brand-card">
          <div className="brand-card-tag">SAVED · LOOKS</div>
          <h3>Studio <em>looks</em></h3>
          <p className="brand-card-sub">Custom looks beyond the four built-in presets. Save reference moodboards from past shoots, magazine spreads, or other Mi Italia boutiques.</p>
          <div className="preset-list">
            {looks.map(l => (
              <div key={l.id} className={`preset-item${l.isDefault?' default':''}`}>
                <div className="preset-av" style={{backgroundImage:`url('${l.img}')`,backgroundSize:'cover',backgroundPosition:'center'}} />
                <div className="preset-body">
                  <div className="preset-name">
                    {l.label}
                    {l.isDefault && <span className="preset-name-tag">DEFAULT</span>}
                  </div>
                  <div className="preset-traits">{LOOK_DESCS[l.id] || 'Custom look'}</div>
                </div>
                <button className="preset-action" onClick={() => setDefault(looks, setLooks, l.id)} title="Set as default">
                  <span className="material-symbols-outlined" style={{color:l.isDefault?'var(--gold)':'var(--stone)'}}>{l.isDefault?'star':'star_outline'}</span>
                </button>
                {!l.isDefault && (
                  <button className="preset-action" onClick={() => removeItem(looks, setLooks, l.id)} title="Remove">
                    <span className="material-symbols-outlined">delete_outline</span>
                  </button>
                )}
              </div>
            ))}
            <button className="preset-add" onClick={() => setShowAddLook(true)}>
              <span className="material-symbols-outlined">add</span>Save new look
            </button>
          </div>
        </div>
      </div>

      {/* ── Network spotlight ── */}
      <div className="brand-card" style={{marginBottom:20}}>
        <div className="brand-card-tag">MI ITALIA NETWORK · FOR REFERENCE ONLY</div>
        <h3>Other boutiques' <em>aesthetics</em></h3>
        <p className="brand-card-sub">A reference — never a copy. Use this to see what's resonating across Mi Italia. Your boutique stays distinctly yours.</p>
        <div className="network-grid">
          {NETWORK_BOUTIQUES.map(b => (
            <div key={b.name} className="network-card">
              <div className="network-card-img" style={{backgroundImage:`url('${b.img}')`}} />
              <div className="network-card-body">
                <div className="network-card-name">{b.name}</div>
                <div className="network-card-loc">
                  <span className="material-symbols-outlined">place</span>{b.loc}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',paddingTop:14,borderTop:'1px solid var(--mist)',gap:16}}>
          <div style={{fontSize:11,color:'var(--stone)',lineHeight:1.5,flex:1}}>Network insights are anonymous aggregate trends across Mi Italia boutiques. Individual generations are never shared without explicit permission from the originating boutique.</div>
          <button className="btn btn-outline btn-sm" style={{flexShrink:0}} onClick={() => setShowNetworkTrends(true)}>See full network trends</button>
        </div>
      </div>

      {/* ── Brand consistency score ── */}
      <div className="consistency-row">
        <div className="consistency-head">
          <div className="consistency-title">Brand <em>consistency</em></div>
          <button className="consistency-how-link" onClick={() => setShowExplain(true)}>How is this calculated? →</button>
        </div>
        <div className="consistency-score">
          <div className="consistency-circle">
            <div className="consistency-circle-val">81</div>
          </div>
          <div style={{flex:1}}>
            <div className="consistency-body-title">Strong &amp; recognisable.</div>
            <div className="consistency-body-desc">Your last 30 generations share a consistent house model, look, and aspect ratio. Customers will recognise an Atelier Bianchi shot. This is a guide — never a constraint.</div>
          </div>
        </div>
        <div className="consistency-checks">
          {BRAND_CONSISTENCY_CHECKS.map((c, i) => (
            <div key={i} className="consistency-check">
              <div className={`consistency-check-icon ${c.type}`}>
                <span className="material-symbols-outlined">{c.icon}</span>
              </div>
              <div>
                <div className="consistency-check-title">{c.title}</div>
                <div className="consistency-check-desc">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────
export default function AIStudio() {
  const [screen, setScreen] = useState('hub')
  const TABS = [
    {key:'hub',      icon:'home',         label:'Hub'},
    {key:'generate', icon:'photo_camera', label:'Single shoot'},
    {key:'batch',    icon:'grid_view',    label:'Batch session'},
    {key:'brand',    icon:'styler',       label:'Brand setup'},
  ]
  return (
    <>
      <div className="studio-subnav">
        {TABS.map(t => (
          <div key={t.key} className={`studio-sni${screen===t.key?' act':''}`} onClick={() => setScreen(t.key)}>
            <span className="material-symbols-outlined">{t.icon}</span>{t.label}
          </div>
        ))}
        <div className="studio-sni-quota">
          <span className="material-symbols-outlined">data_usage</span>
          <strong>33</strong> of 50 generations left · resets 1 Jun
        </div>
        <div className="studio-sni-reset">
          <span className="material-symbols-outlined">refresh</span>Reset demo
        </div>
      </div>
      <div className="studio-content">
        {screen==='hub'      && <HubScreen      onNavigate={setScreen}/>}
        {screen==='generate' && <GenerateScreen onNavigate={setScreen}/>}
        {screen==='batch'    && <BatchScreen    onNavigate={setScreen}/>}
        {screen==='brand'    && <BrandScreen/>}
      </div>
    </>
  )
}
