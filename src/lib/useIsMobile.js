import { useSyncExternalStore } from 'react'

/* The one place the mobile breakpoint is written in JS.
 *
 * It must stay in step with the `@media (max-width: 900px)` block in
 * styles/mobile.css — the CSS moves the sidebar off-canvas, this tells the
 * components that need to behave differently (the icon rail is meaningless
 * inside a drawer, so Sidebar ignores `collapsed` below the breakpoint). */
export const MOBILE_QUERY = '(max-width: 900px)'

/* One MediaQueryList for the whole app: it is the external store, so it has
 * to be stable across renders or useSyncExternalStore resubscribes forever. */
const mq = typeof window === 'undefined' ? null : window.matchMedia(MOBILE_QUERY)

function subscribe(onChange) {
  if (!mq) return () => {}
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/* Read at render time rather than from state, so a rotate or a resize between
 * the first render and the subscription cannot be missed. */
const getSnapshot = () => !!mq?.matches

export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
