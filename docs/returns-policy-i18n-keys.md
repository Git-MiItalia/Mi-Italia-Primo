# Returns Policy — new i18n keys

All new `t('key', 'English default')` calls added across the three Returns Policy phases
(`StoreProfile.jsx`, `src/components/settings/*Modal.jsx`, `AddProduct.jsx`, `POS.jsx`'s receipt
strings live in plain JS, not `t()` — see the note at the bottom). English defaults below are
copy-pasted from the actual code, so they're authoritative. Italian text is sourced from the
original bilingual design mock (`primo-returns-policy-mock.html`) wherever an exact match exists
— those are marked **(mock)**. Everything else is my own draft, matched to the mock's tone and
register (formal *Lei*) but **not native-reviewed** — marked **(draft, please review)**.

`common.cancel` / `common.close` / `common.edit` / `common.change` are reused, not new — already
used across 18+ other files in this app.

## Two structural issues to fix before/while wiring these in

1. **`title_a`/`title_b` split pattern won't localize correctly.** Several titles are rendered as
   `{t('...title_a')} <em>{t('...title_b')}</em>` (e.g. "Returns" + *"Policies"*) so the second word
   can be styled in gold italic. English word order is adjective-first; Italian's mock equivalents
   are noun-first ("Politiche di Reso", "Classi di reso") — splitting them the same way doesn't
   reassemble into correct Italian. Affects: `returns_policy.title_a/b`, `returns_classes.title_a/b`,
   `add_product.returns.title_a/b`. Needs either a single combined key per language (with the
   gold-italic span baked into a `dangerouslySetInnerHTML`-style key, like `Modal`'s `title` prop
   already supports) or accept the two pieces render in a fixed order regardless of language.

2. **`returns_classes.mapping_modal.title` has no real interpolation param.** Current code:
   `t('returns_classes.mapping_modal.title', { defaultValue: `Change mapping — ${className}` })` —
   the class name is baked into the JS-computed default string, not passed as a named `{{var}}`.
   Needs a follow-up: `t('returns_classes.mapping_modal.title', { className, defaultValue: 'Change mapping — {{className}}' })`
   so a translator can position the class name idiomatically per language.

---

## `returns_policy.*`

| Key | English default | Italiano |
|---|---|---|
| `returns_policy.window_none` | No returns | Nessun reso *(mock)* |
| `returns_policy.days` | days | giorni *(mock)* |
| `returns_policy.desc.bespoke_exemption` | bespoke exemption | esenzione su misura *(mock)* |
| `returns_policy.desc.sealed_exemption` | sealed exemption | esenzione sigillato *(mock)* |
| `returns_policy.desc.instore_only` | in-store only | solo in negozio *(mock)* |
| `returns_policy.desc.no_returns_prefix` | No returns, | Nessun reso, *(mock)* |
| `returns_policy.desc.custom_window_prefix` | Custom window of | Finestra personalizzata di *(mock)* |
| `returns_policy.desc.days_suffix` | days. | giorni. *(mock)* |
| `returns_policy.status.default` | Store default | Predefinita *(mock)* |
| `returns_policy.status.instore_only` | In-store only | Solo in negozio *(mock)* |
| `returns_policy.status.exempt_bespoke` | Exempt: bespoke | Esente: su misura *(mock)* |
| `returns_policy.status.exempt_sealed` | Exempt: sealed | Esente: sigillato *(mock)* |
| `returns_policy.status.compliant` | Compliant | Conforme *(mock)* |
| `returns_policy.title_a` | Returns | Politiche *(draft — see issue #1 above)* |
| `returns_policy.title_b` | Policies | di Reso *(draft — see issue #1 above)* |
| `returns_policy.default_lbl` | Store default | Predefinita del negozio *(mock)* |
| `returns_policy.default_sub` | Applied to every product without an override | Applicata a ogni prodotto senza personalizzazione *(mock)* |
| `returns_policy.change_default_btn` | Change default | Cambia predefinita *(mock)* |
| `returns_policy.library_title` | Policy library | Libreria delle politiche *(mock)* |
| `returns_policy.new_policy_btn` | New policy | Nuova politica *(mock)* |
| `returns_policy.online` | Online | Online *(mock)* |
| `returns_policy.online_off` | Not online | Non online *(draft)* |
| `returns_policy.instore` | In-store | In negozio *(mock)* |
| `returns_policy.instore_off` | Not in-store | Non in negozio *(draft)* |
| `returns_policy.callout_strong` | Separate from returns: | Separata dai resi: *(mock)* |
| `returns_policy.callout_body` | the two-year legal guarantee for faulty goods always applies and is never affected by any policy above. Online sales inherit the 14-day withdrawal minimum by law. | la garanzia legale di due anni per i difetti si applica sempre e non è mai toccata dalle politiche qui sopra. Le vendite online ereditano per legge il minimo di 14 giorni. *(draft, trimmed from the mock's longer version to match the shorter EN actually shipped)* |

### `returns_policy.default_modal.*`

| Key | English default | Italiano |
|---|---|---|
| `returns_policy.default_modal.title` | Change store default | Cambia predefinita *(mock)* |
| `returns_policy.default_modal.intro` | The default is the fallback for every product, online included, so only online-lawful policies can be chosen. | La predefinita è il ripiego per ogni prodotto, online compreso, quindi si possono scegliere solo politiche lecite online. *(mock)* |
| `returns_policy.default_modal.cannot_be_default` | Cannot be a default | Non può essere predefinita *(mock)* |
| `returns_policy.default_modal.save_btn` | Set as default | Imposta predefinita *(mock)* |

### `returns_policy.editor.*` (New/Edit policy modal)

| Key | English default | Italiano |
|---|---|---|
| `returns_policy.editor.err_names` | Both names are required. | Servono entrambi i nomi. *(mock)* |
| `returns_policy.editor.err_channel` | Choose at least one channel. | Scegli almeno un canale. *(mock)* |
| `returns_policy.editor.err_online_min` | Online sales require at least 14 days. | Le vendite online richiedono almeno 14 giorni. *(mock)* |
| `returns_policy.editor.err_exemption` | No-returns online needs a legal exemption. Add one, or remove the online channel. | Nessun reso online richiede un'esenzione legale. Aggiungila o togli il canale online. *(mock)* |
| `returns_policy.editor.err_generic` | Please check the fields above. | Controlla i campi sopra. *(draft)* |
| `returns_policy.editor.err_default_unlawful` | This is the store default and must stay lawful for online sales. | Questa è la predefinita e deve restare lecita per le vendite online. *(mock)* |
| `returns_policy.editor.title_new` | New policy | Nuova politica *(mock)* |
| `returns_policy.editor.title_edit` | Edit policy | Modifica politica *(mock)* |
| `returns_policy.editor.name_en` | Name (English) | Nome (Inglese) *(mock)* |
| `returns_policy.editor.name_it` | Name (Italian) | Nome (Italiano) *(mock)* |
| `returns_policy.editor.window` | Return window | Finestra di reso *(mock)* |
| `returns_policy.editor.days_opt` | Days | Giorni *(mock)* |
| `returns_policy.editor.none_opt` | No returns | Nessun reso *(mock)* |
| `returns_policy.editor.channels` | Channels | Canali *(mock)* |
| `returns_policy.editor.online` | Online | Online *(mock)* |
| `returns_policy.editor.instore` | In-store | In negozio *(mock)* |
| `returns_policy.editor.exemption` | Legal exemption (required for no-returns online) | Esenzione legale (richiesta per nessun reso online) *(mock)* |
| `returns_policy.editor.exempt_none` | None | Nessuna *(mock)* |
| `returns_policy.editor.exempt_bespoke` | Bespoke | Su misura *(mock)* |
| `returns_policy.editor.exempt_sealed` | Sealed | Sigillato *(mock)* |
| `returns_policy.editor.remove_btn` | Remove | Rimuovi *(mock)* |
| `returns_policy.editor.add_btn` | Add policy | Aggiungi politica *(mock)* |
| `returns_policy.editor.save_btn` | Save changes | Salva modifiche *(mock)* |

---

## `returns_classes.*`

| Key | English default | Italiano |
|---|---|---|
| `returns_classes.title_a` | Returns | Classi *(draft — see issue #1 above)* |
| `returns_classes.title_b` | Classes | di Reso *(draft — see issue #1 above)* |
| `returns_classes.follow_default` | Store default | Predefinita negozio *(mock)* |
| `returns_classes.callout_strong` | Precedence: | Precedenza: *(mock)* |
| `returns_classes.callout_body` | product override beats returns class beats store default. Final Sale eligible maps to an in-store-only policy; if such a product is listed online it falls back to the store default, shown transparently. | la personalizzazione del prodotto batte la classe di reso che batte la predefinita del negozio. Idoneo a Vendita Finale mappa a una politica solo in negozio; se un tale prodotto è online, ricade sulla predefinita, mostrato in modo trasparente. *(mock)* |

### `returns_classes.mapping_modal.*`

| Key | English default | Italiano |
|---|---|---|
| `returns_classes.mapping_modal.title` | Change mapping — {className} | Cambia mappatura — {className} *(draft — not in mock, which showed just the class name with no prefix; also see issue #2 above)* |
| `returns_classes.mapping_modal.intro` | Products of this class inherit this policy unless a product overrides it. In-store-only policies fall back to the store default when a product is listed online. | I prodotti di questa classe ereditano questa politica salvo override del prodotto. Le politiche solo in negozio ricadono sulla predefinita quando un prodotto è online. *(mock)* |
| `returns_classes.mapping_modal.follow_default` | Follow store default | Segui predefinita negozio *(mock)* |
| `returns_classes.mapping_modal.instore_only` | In-store only | Solo in negozio *(mock)* |
| `returns_classes.mapping_modal.save_btn` | Save mapping | Salva mappatura *(mock)* |

---

## `add_product.returns.*`

| Key | English default | Italiano |
|---|---|---|
| `add_product.returns.title_a` | Returns | Politica *(draft — see issue #1 above)* |
| `add_product.returns.title_b` | Policy | di Reso *(draft — see issue #1 above)* |
| `add_product.returns.online_label` | Listed online | In vendita online *(mock)* |
| `add_product.returns.online_hint_on` | Distance sale: 14-day minimum enforced. | Vendita a distanza: minimo 14 giorni applicato. *(mock)* |
| `add_product.returns.online_hint_off` | In-store only: boutique sets its own goodwill policy. | Solo in negozio: la boutique fissa la propria politica. *(mock)* |
| `add_product.returns.class_label` | Returns class | Classe di reso *(mock)* |
| `add_product.returns.suggested_tag` | suggested | suggerita *(mock)* |
| `add_product.returns.suggest_from` | Suggested class | Classe suggerita *(mock)* |
| `add_product.returns.suggest_none` | No special signal from this category. Defaulting to Standard goods. | Nessun segnale da questa categoria. Predefinito a Merce standard. *(mock)* |
| `add_product.returns.policy_label` | Returns policy | Politica di reso *(mock)* |
| `add_product.returns.src_product` | Overridden · this product | Personalizzata · questo prodotto *(mock)* |
| `add_product.returns.src_class` | From returns class | Da classe di reso *(mock)* |
| `add_product.returns.src_store` | Inherited · store default | Ereditata · predefinita del negozio *(mock)* |
| `add_product.returns.online_fallback` | online fallback | ripiego online *(mock)* |
| `add_product.returns.override_btn` | Override | Personalizza *(mock)* |
| `add_product.returns.trail_store` | Store default | Predefinita negozio *(mock)* |
| `add_product.returns.trail_class` | Returns class | Classe di reso *(mock)* |
| `add_product.returns.trail_product` | This product | Questo prodotto *(mock)* |
| `add_product.returns.no_override` | No override — use resolved policy | Nessuna personalizzazione — usa la politica risolta *(draft — not in mock, which only had a 2-tier chooser)* |
| `add_product.returns.no_override_sub` | Follows the returns class, or the store default. | Segue la classe di reso, o la predefinita del negozio. *(draft)* |
| `add_product.returns.unavailable_online` | Unavailable online | Non disponibile online *(mock)* |
| `add_product.returns.callout_strong` | Why locked, not hidden: | Perché bloccata, non nascosta: *(draft — rewritten from the mock's "why hide" framing since this implementation greys out + locks instead of hiding the option; see below)* |
| `add_product.returns.callout_body` | Primo won't let you pick a policy that would be unlawful for the current channel — those options are grayed out and locked instead of silently accepted. Turn the channel off and they become available for in-store use. | Primo non permette di scegliere una politica che sarebbe illecita per il canale attuale — queste opzioni sono disattivate e bloccate invece di essere accettate silenziosamente. Disattiva il canale e diventano disponibili per l'uso in negozio. *(draft — same reason as above)* |

---

## POS receipt (`copy.js`, not `t()`)

These aren't translation-bundle keys — `src/lib/returnsPolicy/copy.js` is a pure JS module that
takes a `lang` string directly (`'en'|'it'`) and returns hardcoded bilingual text, same pattern as
the reference handoff spec. No action needed unless this module gets migrated to the `t()`
convention later. For reference, the strings it currently returns:

- `receiptPolicyLine`: "Returns accepted within {days} days" / "Resi entro {days} giorni"; "Non-refundable (made to measure)" / "Non rimborsabile (su misura)"; "Non-returnable (sealed goods)" / "Non restituibile (beni sigillati)"; "Final sale, no returns" / "Vendita finale, nessun reso"
- `guaranteeLine`: "Covered by the 2-year legal guarantee against faults, separate from returns." / "Coperto dalla garanzia legale di 2 anni contro i difetti, separata dai resi."
- The POS receipt's bottom "Returns" section also hardcodes "In-store goodwill policy." / "Politica di cortesia in negozio." directly in `buildReceiptHtml()` (not via `copy.js`) — small inconsistency, could be moved into `copy.js`'s existing `receiptChannelNote()` if this gets revisited.
