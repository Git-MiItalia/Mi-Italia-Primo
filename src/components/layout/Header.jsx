import { useState, useRef, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useLangStore from '../../store/langStore'

const titleKeys = {
  '/dashboard':         'sidebar.dashboard',
  '/products':          'sidebar.products',
  '/products/add':      'header.add_product',
  '/inventory':         'sidebar.inventory',
  '/reservations':      'sidebar.reservations',
  '/orders':            'sidebar.orders',
  '/pos':               'sidebar.pos',
  '/messages':          'sidebar.messages',
  '/customers':         'sidebar.customers',
  '/engagement':        'sidebar.engagement',
  '/discounts':         'sidebar.discounts',
  '/promotions':        'sidebar.promotions',
  '/analytics':         'sidebar.analytics',
  '/financials':        'sidebar.financials',
  '/reports':           'sidebar.reports',
  '/subscription':      'sidebar.subscription',
  '/store':             'sidebar.store_profile',
  '/tryon':             'sidebar.ai_model_studio',
  '/integrations':      'sidebar.integrations',
  '/staff':             'sidebar.staff',
  '/showroom':          'sidebar.showroom',
  '/notifications':     'sidebar.notifications',
  '/support':           'sidebar.support',
  '/void-cil':          'sidebar.void_cil',
  '/locations':         'sidebar.locations',
  '/locations/new':     'locations.wizard.title',
  '/oro-points':        'sidebar.oro_royalty',
  '/price-tags':        'sidebar.price_tags',
  '/products/edit/:id': 'header.edit_product',
}

const titleDefaults = {
  '/tryon':             'AI Model Studio',
  '/integrations':      'Integrations',
  '/locations/new':     'Add a Location',
}

const LANGUAGES = [
  { code:'it', label:'Italiano' },
  { code:'en', label:'English' },
]

function Header() {
  const { pathname }  = useLocation()
  const navigate      = useNavigate()
  const { t }         = useTranslation()

  const lang       = useLangStore(state => state.lang)
  const setLang    = useLangStore(state => state.setLang)
  const activeLang = LANGUAGES.find(l => l.code === lang) ?? LANGUAGES[0]

  const titleKey = titleKeys[pathname] ?? 'Primo'


  return (
    <div className="main-hdr">
      <div className="main-hdr-left">
        <h2 className="main-title">{t(titleKey, titleDefaults[pathname])}</h2>
      </div>
      <div className="main-hdr-actions">
        <div className="search-box">
          <span className="material-symbols-outlined">search</span>
          <input placeholder={t('header.search_placeholder')} />
        </div>

        {/* Language switcher */}
        <div className="lang-switcher">
          {LANGUAGES.map(l => (
            <button key={l.code}
              className={`lang-btn-opt${l.code === lang ? ' act' : ''}`}
              onClick={() => setLang(l.code)}>
              {l.code.toUpperCase()}
            </button>
          ))}
        </div>

                <div className="notif-btn" onClick={() => navigate('/notifications')}>
                  <span className="material-symbols-outlined">notifications</span>
                  <div className="notif-dot" />
                </div>
              </div>
            </div>
          )
        }

export default Header
