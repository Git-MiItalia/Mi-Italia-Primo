# AI Model Studio — i18n

`src/views/AIModelStudio.jsx` (~3900 lines) had **zero i18n wiring at all** — no `useTranslation`
import anywhere in the file — despite an extensive `ais.*` / `ais_legacy.*` key catalog (846 keys)
already sitting in the reference JSON files from an earlier pass. The catalog survived; the code
that was supposed to consume it did not (this project has no git remote and a lot of uncommitted
local history, so a restore/revert most likely wiped the wiring while the JSON files on disk,
edited independently, were untouched).

## What was done

Every top-level component in the file was audited and wired:

`Sheet`, `LookEditorSheet`, `ProcessingModal`, `RetouchSheet`, `SocialSheet`, `ResultsModal`,
`ModelBriefSheet`, `HubScreen`, `ModelPhotoWarning`, `QuickBriefPanel`, `GenerateScreen`,
`BatchScreen`, `ModelEditorSheet`, `BrandScreen`, and the top-level `AIModelStudio()`.

Pattern used throughout: `t` is destructured once in `AIModelStudio()` (`const { t, i18n } =
useTranslation()`) and threaded down as a plain prop (`t={t}`) to every component that needs it —
matching the prop-threading convention already established elsewhere in this file (e.g. `show`).
Module-level helper functions that render text outside any component (`lookOptionLabel`,
`lookDescLine`, `poseLabel`, `aspectLabel`, `photoWarning`, `genStatusLabel`) now take an optional
trailing `t` parameter and fall back to their original hardcoded English when `t` is omitted, so
they still work in isolation.

- **685 distinct static translation keys** referenced across the file, plus 10 dynamic-key
  families (`ais.aspect_word.*`, `ais.aspect.*`, `ais.look_opt.*`, `ais.pose_lib.*`,
  `ais.pose_preset.*`, `ais.retouch_tool.*`, `ais.gen_status.*`, `ais.batch.status.*`,
  `ais.batch.aspect_opt.*`, `ais.batch.parallel_opt.*`, `ais.social_channel.*`).
- **679 of those already existed** in the catalog with matching text — reused verbatim as
  `t('existing.key', 'existing default text')`.
- **6 new keys** were genuinely missing and added to the catalog: `ais.batch.err_already_created_toggle`,
  `ais.batch.n_at_a_time`, `ais.brief.set_photo_brand`, `ais.gen.loading_house_models`,
  `ais.model_sheet.err_photo_put_broken`, `ais.model_sheet.photo_empty_sub`.
- **2 real bugs caught and fixed** mid-pass: two call sites used the wrong namespace prefix
  (`ais.batch.loading_looks2` / `ais.batch.variants_lc`) for keys that actually live under `ais.gen.*`
  — fixed to point at the correct existing key instead of leaving a silent fallback-to-English or
  inventing a duplicate.
- **Reactive-refetch fixes restored** (separate from static-label wiring, per this project's
  language-switch data-refetch convention): `BrandScreen` re-fetches consistency/network insights
  on language change via `useLangStore(s => s.lang)` in its effect deps (its own `useLangStore`
  import was also missing and got restored); the top-level `AIModelStudio()`'s mount effect
  (looks/models/quota/products) now depends on `i18n.language` instead of `[]`.

## Catalog drift found and reconciled

`D:\Ronit\Mi-Italia\backups\primo.json` was missing 5 `pt.fields.*` keys (`boutique`, `boutique_sub`,
`qr`, `qr_sub`, `unavailable_at_size`) that the scratchpad and `D:\Ronit\Mi-Italia\Primo\primo.json`
copies already had from an earlier session. All three files are now byte-identical, including the
6 new `ais.*` keys above.

## Explicitly out of scope (not wired, with reasoning)

- **`MODEL_OPTIONS` and `PERSONAS`** (skin/age/body/hair/pose vocabulary, reference-photo library) —
  these values are sent to the API verbatim as the stored attribute value, not looked up from a
  code; translating the display text would desync it from what's actually stored/round-tripped.
  Matches the same scoping decision from the original AI Studio i18n pass.
- **Mock/demo content** — `SocialSheet`'s sample caption and hashtags (`"Silk midi in
  Bordeaux…"`), the Sartoria Belloni-style reference names — left untranslated, consistent with
  this project's established mock-data precedent.
- **`batchAspect` / `batchParallel` state values** in `BatchScreen` — these are stored as full
  English label strings (`'3:4 STORE'`, `'4 at a time'`) that double as both internal state
  identity and display text (see `aspectValue`/`aspectLabel`/`parallelValue` helpers). The option
  **descriptions** in `ASPECT_OPTS`/`PARALLEL_OPTS` are translated, and `aspectLabel` now localizes
  the aspect *word* when hydrating a saved batch, but the underlying state shape itself still
  round-trips English text. Fully localizing this would mean changing what these two pieces of
  state store throughout `BatchScreen` (comparisons, sheet option lists, the batch-summary bar,
  session hydration) — a larger refactor than an i18n-wiring pass, flagged here rather than
  attempted.
- **Generation/entity data** — product names, model names, look names, quota numbers, timestamps —
  never wired, by design.

## Verification

- Cross-referenced every static `t('ais....')` / `t('ais_legacy....')` call site against the full
  `ais`/`ais_legacy` catalog namespaces (846 keys) via a Node script; zero missing after the 6 new
  keys were added and the 2 wrong-namespace bugs were fixed.
- `npx eslint src/views/AIModelStudio.jsx`: 0 `no-undef` errors (confirms every `t`/`useLangStore`
  reference is properly in scope at every call site). Remaining 18 errors / 6 warnings are all
  pre-existing `react-hooks/set-state-in-effect` and `no-unused-vars` (`hasRef`, `posesLine`)
  issues that predate this pass and are unrelated to i18n — left untouched.
- No live browser/dev-server verification was done for this pass given the scale (static wiring
  correctness was prioritized); worth a pseudo-localization sweep before considering this fully
  closed out, the way earlier pages in this series were verified.
