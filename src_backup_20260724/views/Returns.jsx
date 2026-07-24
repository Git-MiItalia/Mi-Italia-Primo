import { useState } from 'react'
import { useTranslation } from 'react-i18next'

const returns = [
  { id:'RET-084', customer:'Sarah Mitchell', item:'Nylon Vest · M',   reason:'Wrong size',         value:'€598.00', opened:'Mar 20', status:'Open',        statusCls:'pending', order:'MI-4821', rowBg:'rgba(184,149,90,0.02)' },
  { id:'RET-083', customer:'Anna Kowalski',  item:'Linen Shirt × 2', reason:'Changed mind',        value:'€370.00', opened:'Mar 18', status:'Open',        statusCls:'pending', order:'MI-4822' },
  { id:'RET-081', customer:'James Kim',      item:'Crossbody Bag',   reason:'Damaged in transit',  value:'€245.00', opened:'Mar 15', status:'In Progress', statusCls:'shipped', order:'MI-4819' },
]

const PIPELINE_KEYS = [
  { cls:'done',   label:null,  titleKey:'ret.pipeline.step1_title', subKey:'ret.pipeline.step1_sub', time:'Mar 20 · 11:24' },
  { cls:'active', label:'2',   titleKey:'ret.pipeline.step2_title', subKey:'ret.pipeline.step2_sub', time:'Now' },
  { cls:'todo',   label:'3',   titleKey:'ret.pipeline.step3_title', subKey:'ret.pipeline.step3_sub', time:'—' },
  { cls:'todo',   label:'4',   titleKey:'ret.pipeline.step4_title', subKey:'ret.pipeline.step4_sub', time:'—' },
  { cls:'todo',   label:'5',   titleKey:'ret.pipeline.step5_title', subKey:'ret.pipeline.step5_sub', time:'—' },
]

const REASON_KEYS = [
  'ret.reasons.damaged',
  'ret.reasons.wrong_size',
  'ret.reasons.not_described',
  'ret.reasons.changed_mind',
  'ret.reasons.too_late',
  'ret.reasons.quality',
]

export default function Returns() {
  const { t } = useTranslation()

  const [activeTab, setActiveTab]       = useState(0)
  const [selected, setSelected]         = useState(returns[0])
  const [selectedReason, setSelectedReason] = useState('ret.reasons.wrong_size')

  const TABS = [
    t('ret.tabs.open'),
    t('ret.tabs.in_progress'),
    t('ret.tabs.completed'),
    t('ret.tabs.rejected'),
  ]

  return (
    <>
      <div className="tabs">
        {TABS.map((tab, i) => (
          <div key={tab} className={`tab${activeTab===i?' act':''}`} onClick={() => setActiveTab(i)}>
            {i === 0 ? <>{tab} <span className="tab-badge">2</span></> : tab}
          </div>
        ))}
      </div>

      <div className="grid2 ret-grid">

        {/* ── Left: table ── */}
        <div>
          <div className="card ret-table-card">
            <table className="tbl">
              <thead>
                <tr>
                  <th>{t('ret.table.id')}</th>
                  <th>{t('ret.table.customer')}</th>
                  <th>{t('ret.table.item')}</th>
                  <th>{t('ret.table.reason')}</th>
                  <th>{t('ret.table.value')}</th>
                  <th>{t('ret.table.opened')}</th>
                  <th>{t('ret.table.status')}</th>
                </tr>
              </thead>
              <tbody>
                {returns.map(r => (
                  <tr key={r.id} onClick={() => setSelected(r)}
                    className="ret-row" style={r.rowBg ? { background:r.rowBg } : {}}>
                    <td className="ret-id" onClick={() => setSelected(r)}>#{r.id}</td>
                    <td>{r.customer}</td>
                    <td>{r.item}</td>
                    <td>{r.reason}</td>
                    <td>{r.value}</td>
                    <td>{r.opened}</td>
                    <td><span className={`status ${r.statusCls}`}>{r.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Right: detail panel ── */}
        <div className="detail-panel">
          <div className="detail-panel-hdr">
            <div className="detail-panel-icon">
              <span className="material-symbols-outlined">undo</span>
            </div>
            <div>
              <div className="detail-panel-title">{t('ret.detail.return')} #{selected.id}</div>
              <div className="detail-panel-sub">{selected.customer} · {t('ret.detail.order')} #{selected.order} · {t('ret.detail.opened')} {selected.opened}</div>
            </div>
            <span className={`status ${selected.statusCls} ret-status`}>{selected.status}</span>
          </div>

          <div className="detail-panel-body">

            {/* Item card */}
            <div className="inner-card-sm ret-item-card">
              <div className="ret-item-img" style={{ backgroundImage:"url('https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=72&h=92&fit=crop&q=80')" }} />
              <div className="ret-item-body">
                <div className="ret-item-name">Nylon Vest Camouflage</div>
                <div className="ret-item-meta">Size M · Green · SKU: FRT-VNC</div>
              </div>
              <div className="ret-item-price">€598.00</div>
            </div>

            {/* Pipeline */}
            <div className="lbl-section ret-section-lbl">{t('ret.detail.pipeline')}</div>
            <div className="ret-pipeline">
              {PIPELINE_KEYS.map((s, i) => (
                <div key={i} className={`return-step${i===PIPELINE_KEYS.length-1?' ret-step-last':''}`}>
                  <div className={`return-step-num ${s.cls}`}>
                    {s.cls === 'done'
                      ? <span className="material-symbols-outlined ret-check-icon">check</span>
                      : s.label}
                  </div>
                  <div className="return-step-body">
                    <div className="return-step-title">{t(s.titleKey)}</div>
                    <div className="return-step-sub">{t(s.subKey)}</div>
                  </div>
                  <div className="ret-step-time">{s.time}</div>
                </div>
              ))}
            </div>

            {/* Return reason */}
            <div className="lbl-section ret-section-lbl">{t('ret.detail.reason')}</div>
            <div className="ret-reasons">
              {REASON_KEYS.map(key => (
                <div key={key} className={`reason-chip${selectedReason===key?' sel':''}`}
                  onClick={() => setSelectedReason(key)}>
                  {t(key)}
                </div>
              ))}
            </div>

            {/* Refund breakdown */}
            <div className="lbl-section ret-section-lbl">{t('ret.detail.refund_breakdown')}</div>
            <div className="refund-breakdown">
              <div className="refund-line"><span>{t('ret.refund.item_total')}</span><span>€598.00</span></div>
              <div className="refund-line"><span>{t('ret.refund.shipping')}</span><span>{t('ret.refund.shipping_val')}</span></div>
              <div className="refund-line deduction"><span>{t('ret.refund.restock')}</span><span>−€0.00</span></div>
              <div className="refund-line total"><span>{t('ret.refund.total')}</span><span className="ret-refund-total">€598.00</span></div>
            </div>

            <div className="detail-divider" />

            {/* Actions */}
            <div className="ret-action-btns">
              <button className="btn btn-dhl ret-full-btn">
                <span className="material-symbols-outlined">local_shipping</span>
                {t('ret.actions.dhl')}
              </button>
              <div className="ret-action-row">
                <button className="btn btn-green ret-half-btn">
                  <span className="material-symbols-outlined">check_circle</span>
                  {t('ret.actions.approve_no_return')}
                </button>
                <button className="btn btn-red ret-half-btn">
                  <span className="material-symbols-outlined">cancel</span>
                  {t('ret.actions.reject')}
                </button>
              </div>
              <button className="btn btn-whatsapp ret-full-btn">
                <span className="material-symbols-outlined">chat_bubble</span>
                WhatsApp {selected.customer}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
