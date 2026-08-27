# Engagement.jsx — Backend Gaps (for senior dev)

Everything fixable purely on the frontend (dead buttons, ignored props, logic bugs — 8 items) has already been fixed in `src/views/Engagement.jsx`. This is the remaining list — every case here needs a new endpoint, a new field on an existing endpoint, or field-set confirmation from whoever owns the API.

Existing real endpoints already in use somewhere in this file: `GET/POST/PUT/DELETE /boutique/marketing/campaigns`, `POST /boutique/marketing/campaigns/:id/send`, `GET /boutique/marketing/campaigns/:id/analytics`, `GET/POST/PUT/DELETE /boutique/email-templates`, `POST /boutique/email-templates/:id/translate`, `GET /boutique/customers`, `GET /boutique/customers/:id`, `POST /boutique/marketing/contacts`, `GET /boutique/marketing/segments`, `GET /boutique/marketing/dashboard`.

---

## A. Fields needed on existing endpoints

### 1. Contacts list — pagination/search/filter params
**Endpoint:** `GET /boutique/customers` (currently `?page=1&limit=20` hardcoded)
**Needed:** `search`, `segment`, `language`, and working `page`/`limit` from Prev/Next, plus `total`/`has_more` in the response so pagination can be built. Frontend currently only filters the one loaded page of 20 client-side as a stopgap.

### 2. Contact Detail Panel — order/reservation shape
**Endpoint:** `GET /boutique/customers/:id`
**Needed:** exact per-item fields for `recent_orders[]` and `recent_reservations[]` (date, amount/items, status) — frontend only has counts today, no shape to render a real timeline.

### 3. Add Contact — naming convention
**Endpoint:** `POST /boutique/marketing/contacts`
**Needed:** confirm whether this endpoint actually expects camelCase (`firstName, lastName, phone, segment, notes`) — it's the only write endpoint in the file using that convention; everything else is snake_case. Also confirm whether a consent-request email is a real side effect (UI copy claims it, unverified).

### 4. Campaign list — real per-campaign stats
**Endpoint:** `GET /boutique/marketing/campaigns`
**Needed:** real `open_rate`, `click_rate`, `purchase_count`, `attributed_revenue` (or similar) per campaign. **Currently 100% fabricated** via a deterministic hash of the campaign id (`mockCampaignStats`) — every "sent" campaign card shows fake numbers that look real. Also need real `recipients`, `extra_segment_count`, `languages` (all hardcoded 0/null/[] today).

### 5. Campaign Builder — 4 fields silently dropped
**Endpoint:** `POST/PUT /boutique/marketing/campaigns`
**Needed:** accept and return `languages: string[]`, `preview_text: string`, `exclude_recent_recipients: boolean` (+ a real exclusion count, not the hardcoded "−85 contacts" shown today), `match_recipient_language: boolean`. Builder UI collects all 4 but they're never sent or restored on edit.

### 6. Campaign scheduling — write side doesn't exist
**Endpoint:** `POST/PUT /boutique/marketing/campaigns`
**Needed:** `send_mode: 'immediate'|'scheduled'|'optimal_ai'`, `scheduled_at` (ISO), `timezone`. The campaign list already *reads* `scheduled_at`, but there's no way to *set* it yet.

### 7. Translation Review — no save path for edits/confirmations
**Endpoint:** needs something like `PUT /boutique/marketing/campaigns/:id/translations/:lang`
**Needed:** `{subject, body, confirmed, confirmed_by}` per language. Right now editing the EN/FR text or clicking "confirm" only changes local component state — there is no way to persist it, so it's lost on navigation.

### 8. Retranslate — no per-language target
**Endpoint:** `POST /boutique/email-templates/:id/translate`
**Needed:** a `lang`/`target` field. Both the EN and FR "Re-translate" buttons currently send the identical request.

### 9. Campaign analytics — confirm full field set
**Endpoint:** `GET /boutique/marketing/campaigns/:id/analytics`
**Needed:** confirmation that the response includes the union of what two different components expect from it: `campaign.{campaign_name,sent_at,status,channel,target_segment}`, `counts.{sent,opened,clicked,recipients,delivered,unsubscribed,bounced,complained,failed,skipped}`, `rates.{open,click,delivery,bounce,complaint}`. One component only reads the first half; the other reads the full set — if the backend doesn't return all of it, the fuller consumer silently renders empty sections with no visible error.

### 10. Templates tab — ignores its own CRUD API
**Endpoint:** `GET/PUT /boutique/email-templates(/:id)` (already built, already used elsewhere in this file)
**Needed:** nothing new on the backend — this is a frontend rewrite (swap the hardcoded `TEMPLATES` object for real `templateApi` calls), but it's a big enough change (and depends on #22 below for the richer fields) that it's listed here rather than done as a quick frontend fix. Until this lands, the "Request translation" button (#8) and anything else keyed off a real template id in this view will only degrade gracefully, not actually work.

---

## B. New endpoints required (nothing exists today)

### 11. Contacts CSV import
`POST /boutique/marketing/contacts/import` (multipart) → `{imported, merged_duplicates, pending_consent}`

### 12. Contacts bulk actions
`POST /boutique/marketing/contacts/bulk` (add-to-segment / export / bulk-message on selected rows), plus a single-contact messaging endpoint for the per-row Message/Re-engage button.

### 13. Contact language override
`PATCH /boutique/customers/:id` with `{language: {code, source: 'staff_set'}}`

### 14. Contact spend-by-category
Extend `GET /boutique/customers/:id` with `spend_by_category: [{category, amount, pct}]`

### 15. Overview dashboard widgets (3 bundled)
Extend `GET /boutique/marketing/dashboard` with `channel_performance`; add `GET /boutique/marketing/activity-feed`; add `GET /boutique/marketing/automations` (summary, read-only for this view).

### 16. Automations tab — entire feature
`GET/POST/PATCH /boutique/marketing/automations(/:id)` including a step schema for the visual flow builder (trigger/delay/action/condition nodes with branching). The most structurally complex new endpoint in the file.

### 17. Favorites tab — entire feature
`GET /boutique/marketing/favorites/summary`, `/favorites/contacts` (search/filter/sort/paginate), `/favorites/products` (filter/sort), plus `notify-restock`, `alert-low-stock`, and campaign-to-savers action endpoints.

### 18. Campaign analytics sub-panels (3 charts + export)
`GET /campaigns/:id/analytics/by-language`, `/opens-timeline`, `/top-performers`, `/export`. All three charts in the analytics modal are currently generated by hash-seeded fake-data functions (`mockLangBreakdown`, `mockOpensOverTime`, `mockTopPerformers`) that look real but aren't.

### 19. Analytics tab — entire tab
One comprehensive `GET /boutique/marketing/dashboard?range=&compare=` (or a family of sub-endpoints). Every section (KPI sparklines, ID-rate trend + commission tiers, revenue by channel, engagement funnel, campaign ROI table, segment health, cohort retention) is hardcoded per a fixed range key today, including a "vs previous period" compare mode that doesn't have real data for one of its two options. The largest single new-endpoint need in the file.

### 20. Templates — Request Custom Template form
`POST /boutique/marketing/template-requests`

### 21. Templates — Structure tab save
Per-channel structured content fields on the template record (`email_subject`, `email_body`, `wa_header`, `push_title`, etc.) plus wiring the existing `templateApi.update` — there is currently no save action on this tab at all, fields are read-only placeholder text.

### 22. Templates — Variables / Performance / Versions tabs
`GET /boutique/marketing/template-variables` (global token reference); `GET /boutique/email-templates/:id/performance` (per-template campaign performance + best-subject ranking); `GET /boutique/email-templates/:id/versions` + `POST /boutique/email-templates/:id/change-requests` (version history is read-only by design).

---

## Priority notes

Highest-impact if picking a subset: **#4** (fake campaign stats look completely real — a trust issue, not just a missing feature), **#9** (confirm the analytics field set before anything else gets built on top of it), **#7** (translation review currently can't save anything a user edits), and **#10+#22 together** (the Templates tab's entire premise depends on both).
