// Relative timestamps ("5 min ago", "Yesterday", "3 weeks ago").
//
// There were three separate copies of this: Notifications, AI Model Studio and
// Engagement. Only Engagement's was translated — the other two returned English
// literals, so notification times and generation history stayed in English on
// an Italian page. They also disagreed on wording ("3m ago" vs "3 min ago").
//
// The day-level keys below are `eng.time.*` because those already exist in the
// backend bundle and are already translated; adding a parallel `common.time.*`
// set would mean asking for the same six words twice. Only the sub-day
// granularity, which nothing had keys for, is new.
//
// Two granularities, because the callers genuinely differ:
//   timeAgo — minutes upward. For recent events: a notification that arrived
//             four minutes ago should not read "Today".
//   dayAgo  — days upward. For dates like "last visit", where minutes are
//             noise and "Today" is the useful answer.

const dayTail = (t, days) => {
  if (days === 1) return t('eng.time.yesterday', 'Yesterday')
  if (days < 7)   return t('eng.time.days_ago',   { count: days, defaultValue: '{{count}} days ago' })
  if (days < 30)  return t('eng.time.weeks_ago',  { count: Math.floor(days / 7),   defaultValue: '{{count}} week(s) ago' })
  if (days < 365) return t('eng.time.months_ago', { count: Math.floor(days / 30),  defaultValue: '{{count}} month(s) ago' })
  return t('eng.time.years_ago', { count: Math.floor(days / 365), defaultValue: '{{count}} year(s) ago' })
}

/**
 * @param {(key: string, opts?: any) => string} t  from useTranslation()
 * @param {string|null|undefined} iso
 * @returns {string} '—' when there is no usable date
 */
export function timeAgo(t, iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const mins = Math.floor((Date.now() - then) / 60000)
  if (mins < 1)  return t('common.time.just_now', 'just now')
  if (mins < 60) return t('common.time.minutes_ago', { count: mins, defaultValue: '{{count}} min ago' })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return t('common.time.hours_ago', { count: hours, defaultValue: '{{count}}h ago' })
  return dayTail(t, Math.floor(hours / 24))
}

/** Day-level flavour: anything today reads "Today". */
export function dayAgo(t, iso) {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return '—'
  const days = Math.floor((Date.now() - then) / 86400000)
  if (days <= 0) return t('eng.time.today', 'Today')
  return dayTail(t, days)
}
