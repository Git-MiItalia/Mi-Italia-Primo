import { create } from 'zustand'

const COLLAPSED_KEY = 'primo_sidebar_collapsed'
const SECTIONS_KEY  = 'primo_sidebar_sections'

function loadCollapsed() {
  return localStorage.getItem(COLLAPSED_KEY) === '1'
}

function loadSections() {
  try {
    const raw = localStorage.getItem(SECTIONS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

const useSidebarStore = create((set, get) => ({
  collapsed: loadCollapsed(),
  openSections: loadSections(),

  toggleCollapsed: () => {
    const collapsed = !get().collapsed
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
    set({ collapsed })
  },

  toggleSection: (key) => {
    const openSections = { ...get().openSections, [key]: get().openSections[key] === false ? true : false }
    localStorage.setItem(SECTIONS_KEY, JSON.stringify(openSections))
    set({ openSections })
  },
}))

export default useSidebarStore
