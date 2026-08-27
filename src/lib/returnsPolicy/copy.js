/**
 * Returns Policy — Customer & Receipt Copy
 * ---------------------------------------------------------------------------
 * Bilingual (EN / IT formal Lei) shopper-facing and POS-receipt text.
 * Pure functions. `lang` is 'en' | 'it'.
 *
 * Boundary: the receipt strings are Primo POS output (this project owns them).
 * The product-page strings are a reference for the Mi Italia consumer app,
 * which the parent project implements from the same resolved policy — not
 * built in this repo.
 * ---------------------------------------------------------------------------
 */

/**
 * Full shopper-facing returns sentence for a product page.
 * @param {import('./model.js').Policy} p
 * @param {'en'|'it'} lang
 */
export function customerProductLine(p, lang) {
  if (p.none) {
    if (p.exempt === 'bespoke') return lang === 'en'
      ? 'Made to your measurements, so this piece cannot be returned or refunded.'
      : 'Realizzato su misura, quindi non puo essere restituito o rimborsato.'
    if (p.exempt === 'sealed') return lang === 'en'
      ? 'For hygiene, this item cannot be returned once the seal is broken.'
      : 'Per igiene, non puo essere restituito una volta rotto il sigillo.'
    return lang === 'en'
      ? 'Final sale. This item cannot be returned or exchanged.'
      : 'Vendita finale. Non puo essere restituito o cambiato.'
  }
  return lang === 'en'
    ? `Return within ${p.days} days for a full refund.`
    : `Reso entro ${p.days} giorni per il rimborso completo.`
}

/** Terse returns line for a receipt. */
export function receiptPolicyLine(p, lang) {
  if (p.none) {
    if (p.exempt === 'bespoke') return lang === 'en' ? 'Non-refundable (made to measure)' : 'Non rimborsabile (su misura)'
    if (p.exempt === 'sealed') return lang === 'en' ? 'Non-returnable (sealed goods)' : 'Non restituibile (beni sigillati)'
    return lang === 'en' ? 'Final sale, no returns' : 'Vendita finale, nessun reso'
  }
  return lang === 'en' ? `Returns accepted within ${p.days} days` : `Resi entro ${p.days} giorni`
}

/** The always-on statutory guarantee line (separate from returns). */
export function guaranteeLine(lang) {
  return lang === 'en'
    ? 'Covered by the 2-year legal guarantee against faults, separate from returns.'
    : 'Coperto dalla garanzia legale di 2 anni contro i difetti, separata dai resi.'
}

/** DD/MM/YYYY. */
export function formatDate(date) {
  const z = (n) => (n < 10 ? '0' : '') + n
  return `${z(date.getDate())}/${z(date.getMonth() + 1)}/${date.getFullYear()}`
}

/** Withdrawal deadline = purchase date + window days. */
export function withdrawalDeadline(purchaseDate, days) {
  const d = new Date(purchaseDate.getTime())
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Channel-appropriate legal note for a receipt, including the guarantee.
 * @param {{policy:import('./model.js').Policy, online:boolean, purchaseDate:Date, lang:'en'|'it'}} args
 */
export function receiptChannelNote({ policy, online, purchaseDate, lang }) {
  let note
  if (online && !policy.none && policy.days > 0) {
    const deadline = formatDate(withdrawalDeadline(purchaseDate, policy.days))
    note = (lang === 'en' ? 'Right of withdrawal until ' : 'Diritto di recesso fino al ') + deadline + '.'
  } else if (policy.none && policy.exempt !== 'none') {
    note = lang === 'en' ? 'Statutory withdrawal does not apply (exempt).' : 'Il recesso legale non si applica (esente).'
  } else if (!online) {
    note = lang === 'en' ? 'In-store goodwill policy.' : 'Politica di cortesia in negozio.'
  } else {
    note = lang === 'en' ? 'No returns.' : 'Nessun reso.'
  }
  const guar = lang === 'en'
    ? ' 2-year legal guarantee against faults applies.'
    : ' Si applica la garanzia legale di 2 anni contro i difetti.'
  return note + guar
}
