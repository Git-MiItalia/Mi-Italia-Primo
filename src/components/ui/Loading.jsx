import { useTranslation } from 'react-i18next'

/* The portal's one loading indicator.
 *
 * Before this there were thirteen. Subscription had a centred spinner on the
 * page and, four hundred lines later, an unstyled `dc-loading` div for its
 * attribution card — a class with no CSS anywhere, so it rendered as naked
 * text; Customers had the same with `cu-loading`. Engagement had small italics
 * in about forty places, Products and Dashboard borrowed the "empty table"
 * style, Locations and Reports borrowed the "nothing here" style, and Orders
 * and Notifications showed nothing at all while they fetched. Support and
 * Locations had the word "Loading" hardcoded in English.
 *
 * Three shapes, because there are three genuinely different situations:
 *
 *   <Loading page />              the tab is blank until the data arrives
 *   <Loading row cols={11} />     the page is drawn, the table rows are not
 *   <Loading />                   one card on a page of cards
 *
 * `row` renders a real <tr><td>. A <div> placed among table rows is invalid
 * markup and the browser hoists it out of the table, which is why a table
 * could not simply reuse the page spinner.
 *
 * It appears immediately, with no delay: a spinner that waits avoids a flash
 * on fast responses, but it also makes a slow tab look frozen for as long as it
 * waits, and matching Subscription's existing behaviour was the ask.
 *
 * The label is `common.loading` unless one is passed, so no tab needs a
 * translation key of its own for the word.
 */
export default function Loading({ page, row, cols = 1, label, className = '' }) {
  const { t } = useTranslation()
  // The trailing ellipsis is added here, not stored in the bundle, so that one
  // key serves every caller. But the bundle's own `common.loading` currently
  // reads "Loading..." — already ended — and appending to that printed
  // "Loading...…" under every spinner in the portal. Add the ellipsis only
  // when the words do not already finish with one, in either spelling, so this
  // holds whichever way the key is written in any language.
  const word = t('common.loading', 'Loading')
  const text = label ?? (/(\.{3}|…)\s*$/.test(word) ? word : word + '…')

  // role="status" so a screen reader announces the wait rather than leaving a
  // silent gap; aria-hidden on the icon stops it reading the ligature name.
  const icon = <span className="material-symbols-outlined ld-icon" aria-hidden="true">sync</span>

  if (page) {
    return (
      <div className={`ld-page ${className}`} role="status" aria-label={text}>
        {icon}
      </div>
    )
  }

  if (row) {
    return (
      <tr>
        <td colSpan={cols} className={`ld-cell ${className}`}>
          <span className="ld-inline" role="status">{icon}{text}</span>
        </td>
      </tr>
    )
  }

  return (
    <div className={`ld-block ${className}`} role="status">
      <span className="ld-inline">{icon}{text}</span>
    </div>
  )
}
