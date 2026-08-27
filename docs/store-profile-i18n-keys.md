# Store Profile — new i18n keys

All new `t('store_profile.xxx', 'English default')` calls added to `src/views/StoreProfile.jsx`,
outside the Returns Policy / Returns Classes cards (those already had their own keys and doc —
see `returns-policy-i18n-keys.md`; this session filled in one thing they'd missed, see below).

Unlike Promotions, every call here **does** carry an English `defaultValue` — matching the
convention this file already established for its returns-policy calls — so nothing regresses to a
raw key while the backend catalog catches up.

## Status

**Every user-visible string on this page now routes through `t()`.** Before this pass, the entire
page outside the returns-policy cards was raw English — Store Details, Founder Card, Store
Photography, Categories, Language & Region, and the whole Tech Stack card, including every select
option, alert, upload-error message, and the day-of-week abbreviations.

Verified by pseudo-localization (bundle served with every value wrapped in `⟦…⟧`, locale set to
`it`) across the base page plus five branch states (Shopify/WooCommerce website integration boxes,
non-Primo POS alert, external-terminal alert) and the three returns-policy modals. Zero unmarked
strings, aside from:
- the `PhoneInput` library's own country dropdown (third-party content, not part of this catalog),
- `RP_SEED_DESC` / `RP_CLASS_NOTES` (pre-existing, already bilingual via `lang === 'it' ? ... : ...`
  — a different mechanism than the `t()` catalog, working as designed, not touched),
- `sidebar.store_profile` (pre-existing, unrelated to this page's own keys).

### One thing fixed that belonged to the earlier Returns Policy pass

The Store Details, Returns Policy, and Returns Classes cards each have a Save Changes button whose
label was `'✓ Saved' : 'Saving…' : 'Save Changes'` — **never wrapped in `t()`** despite living right
next to fully-translated returns-policy content. Now uses the existing `common.saved` / `common.saving`
keys plus a new `store_profile.save_changes_btn`.

### Left alone, flagged not fixed

- **`{ open: 'Closed', close: '' }`** — the fallback value written into `hours` state when a day is
  missing from the backend response (`opening_hours_json`). This is stored *form data*, not a label —
  translating it would mean the literal Italian word gets submitted back to the API as the "open"
  time value. Not a labeling gap; flagging in case whoever owns this wants to reconsider the fallback
  shape itself.

---

## `store_profile.*` (shared, not nested)

| Key | English default |
|---|---|
| `store_profile.loading` | Loading profile… |
| `store_profile.save_changes_btn` | Save Changes |
| `store_profile.save_btn` | Save |
| `store_profile.replace_btn` | Replace |
| `store_profile.uploading` | Uploading… |

## `store_profile.details.*`

| Key | English default |
|---|---|
| `store_profile.details.title` | Store |
| `store_profile.details.title_em` | Details |
| `store_profile.details.name_label` | Store Name |
| `store_profile.details.address_label` | Address |
| `store_profile.details.city_label` | City |
| `store_profile.details.postcode_label` | Postcode |
| `store_profile.details.email_label` | Email |
| `store_profile.details.phone_label` | Phone |
| `store_profile.details.invalid_phone` | Not a valid phone number |
| `store_profile.details.whatsapp_label` | WhatsApp |
| `store_profile.details.bio_label` | Store Bio |
| `store_profile.details.hours_label` | Opening Hours |
| `store_profile.details.hours_open_placeholder` | 10:00 |
| `store_profile.details.hours_close_placeholder` | 19:00 or Closed |
| `store_profile.details.day_mon` … `day_sun` | Mon … Sun |

## `store_profile.founder.*`

| Key | English default |
|---|---|
| `store_profile.founder.title` | Founder |
| `store_profile.founder.title_em` | Card |
| `store_profile.founder.toggle_title` | Show founder card on boutique page |
| `store_profile.founder.toggle_sub` | Displays founder photo and name on your Mi Italia listing |
| `store_profile.founder.name_label` | Founder Name |
| `store_profile.founder.role_label` | Founder Title |
| `store_profile.founder.photo_uploaded` | Founder photo uploaded |
| `store_profile.founder.upload_title` | Upload Founder Photo |
| `store_profile.founder.upload_hint` | Min 400×400px · Square crop recommended |

## `store_profile.photo.*`

| Key | English default |
|---|---|
| `store_profile.photo.title` / `title_em` | Store / Photography |
| `store_profile.photo.cover_label` | Cover Photo |
| `store_profile.photo.err_not_image` | Please select an image file. |
| `store_profile.photo.err_too_large` | File is over {{size}}MB. |
| `store_profile.photo.upload_failed` | Upload failed |
| `store_profile.photo.upload_failed_network` | Upload failed — check your connection |
| `store_profile.photo.upload_cover_title` | Upload Cover Photo |
| `store_profile.photo.upload_cover_hint` | 1200×400px recommended · Used as hero on boutique page |
| `store_profile.photo.gallery_label` | Gallery |
| `store_profile.photo.gallery_count` | {{photoCount}}/{{maxPhotos}} photos · {{videoCount}}/{{maxVideos}} videos |
| `store_profile.photo.err_unsupported` | {{count}} file(s) rejected (unsupported format) |
| `store_profile.photo.err_photos_oversized` | {{count}} photo(s) over {{size}}MB |
| `store_profile.photo.err_videos_oversized` | {{count}} video(s) over {{size}}MB |
| `store_profile.photo.err_photos_skipped` | {{count}} photo(s) skipped (max {{max}}) |
| `store_profile.photo.err_videos_skipped` | {{count}} video(s) skipped (max {{max}}) |
| `store_profile.photo.err_max_per_upload` | Only {{max}} files per upload |
| `store_profile.photo.delete_failed` | Delete failed |
| `store_profile.photo.delete_failed_network` | Delete failed — check your connection |
| `store_profile.photo.loading_media` | Loading media… |
| `store_profile.photo.video_badge` | VIDEO |
| `store_profile.photo.remove_tooltip` | Remove |
| `store_profile.photo.add_media` | Add media |
| `store_profile.photo.media_hint` | Photos up to {{photoSize}}MB · Videos up to {{videoSize}}MB · Max {{max}} files per upload |
| `store_profile.photo.gallery_full` | Gallery full — remove media to add more |

## `store_profile.categories.*`

| Key | English default |
|---|---|
| `store_profile.categories.title` | Categories |

## `store_profile.language.*`

| Key | English default |
|---|---|
| `store_profile.language.title` / `title_em` | Language & / Region |
| `store_profile.language.primary_label` | Primary Language |
| `store_profile.language.opt_italian` | Italian |
| `store_profile.language.opt_english` | English |
| `store_profile.language.currency_label` | Currency |
| `store_profile.language.opt_eur` | EUR € |
| `store_profile.language.active_label` | Active Languages |

Note: the language/currency dropdowns aren't wired to state (no `value`/`onChange`) — pre-existing,
not something this pass touched. The `IT`/`EN`/`FR`/`DE`/`AR`/`ZH` chips are ISO codes, left as-is.

## `store_profile.tech.*`

| Key | English default |
|---|---|
| `store_profile.tech.title` / `title_em` | Tech / Stack |
| `store_profile.tech.sub` | Helps us connect Primo to your existing tools |
| `store_profile.tech.terminal_section` | In-Store Payment Terminal |
| `store_profile.tech.terminal_question` | How do you take card payments in-store? |
| `store_profile.tech.opt_stripe` | Stripe Terminal (Mi Italia integrated) |
| `store_profile.tech.opt_bank` | Bank-issued terminal |
| `store_profile.tech.opt_other_terminal` | Other external terminal |
| `store_profile.tech.opt_no_terminal` | No card payments in-store |
| `store_profile.tech.stripe_alert` | Stripe Terminal is fully integrated with Primo POS. Card payments are processed directly and commission is auto-deducted per sale. |
| `store_profile.tech.external_alert` | External terminals work seamlessly with Primo. Primo tracks the sale and calculates commission. You'll receive a monthly invoice for POS commission rather than per-transaction deduction. |
| `store_profile.tech.pos_method_label` | Default POS Payment Method |
| `store_profile.tech.opt_pos_external` | External Terminal (show external panel first) |
| `store_profile.tech.opt_pos_stripe` | Stripe Terminal |
| `store_profile.tech.opt_pos_cash` | Cash |
| `store_profile.tech.pos_method_hint` | This pre-selects the payment tab when you open POS. You can always switch during a sale. |
| `store_profile.tech.website_section` | Your Website |
| `store_profile.tech.website_question` | Do you have your own website? |
| `store_profile.tech.opt_no_website` | No — Mi Italia is my only online presence |
| `store_profile.tech.opt_website_shopify` | Yes — Shopify |
| `store_profile.tech.opt_website_woo` | Yes — WooCommerce |
| `store_profile.tech.opt_website_lightspeed` | Yes — Lightspeed eCom |
| `store_profile.tech.opt_website_custom` | Yes — Custom / other platform |
| `store_profile.tech.website_url_label` | Website URL |
| `store_profile.tech.website_url_placeholder` | https://yourstore.com |
| `store_profile.tech.shopify_title` | Shopify Integration — Coming Soon |
| `store_profile.tech.shopify_body` | When the Mi Italia Shopify app launches, your products, stock levels, and orders will sync automatically between Shopify and Primo. |
| `store_profile.tech.notify_btn` | Notify Me When Available |
| `store_profile.tech.woo_title` | WooCommerce Integration — Coming Soon |
| `store_profile.tech.woo_body` | A Mi Italia WooCommerce plugin will allow automatic product and inventory sync between your WordPress store and Primo. |
| `store_profile.tech.no_website_alert` | Mi Italia + Primo is your complete online retail presence. Your boutique page on Mi Italia serves as your public storefront. |
| `store_profile.tech.pos_section` | Existing POS System |
| `store_profile.tech.pos_question` | Do you use a dedicated POS system? |
| `store_profile.tech.opt_no_pos` | No — Primo POS is my only system |
| `store_profile.tech.opt_other_pos` | Other POS system |
| `store_profile.tech.dual_pos_alert` | Running two POS systems is fine. Use Primo POS for Mi Italia app customers and reservations. Use your existing POS for all other in-store transactions. |

Brand-name-only select options (SumUp, Square, Verifone, Lightspeed Retail, Square POS, Shopify POS,
Revel Systems, Shopify, WooCommerce) are left untranslated — proper nouns, not labels.
