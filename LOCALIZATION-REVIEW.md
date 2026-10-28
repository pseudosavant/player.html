# Localization Review

Review date: 2026-10-27.

Status: The original review was read-only. The maintainer subsequently authorized the main translation findings and shared source-copy fixes. Their implementation status is recorded below. Nothing was committed.

## Implementation Status

- T1 through T6: Applied across the affected catalogs. Turkish switches have wider label space, without increasing their height.
- S1: Folder-add tooltip now explains configured traversal depth and filter independence. The maintainer chose to retain the original Add All label, including its casing.
- S2: Poster description now explains browser-local storage and the SVG exception. The maintainer chose Choose image, localized across all 17 catalogs.
- S3 and S4: Seek help and parent-folder wording corrected across locales. English template fallbacks are synchronized.
- S5: The maintainer chose Subtitle Tracks, localized across all 17 catalogs. The friendly label includes captions without separating them from subtitles. No track-counting behavior changed.
- S6 through S9: Diagnostic descriptions and subtitle-selection tooltips corrected across locales.
- Optional polish and native-review questions remain unmodified. Played classifications and the existing regional conventions are retained.

The findings below preserve the original before-and-proposed wording as a review record. They are not a description of all current catalog values. The corrections have focused regression tests for the approved wording, rendered tooltips, Hebrew result summaries, and Turkish switch geometry.

Both distributable outputs were rebuilt after the corrections. The first correction pass passed all 66 tests, including all-locale layout checks and Turkish switch checks at 320px and 375px. Mobile screenshots of both switch states were inspected. The subsequent naming decisions are recorded above. All short Played labels remain unchanged.

After applying the final naming decisions, both outputs were rebuilt again and all 67 tests passed. Regression checks cover the approved labels in every catalog, their rendered UI in both builds, and preservation of the compact Add All label and its detailed tooltip. The original casing was subsequently restored and is asserted explicitly.

## Scope And Method

Six parallel AI reviewers independently inspected disjoint groups of the 17 catalogs using the [localization guide and glossary](LOCALIZATION.md). Every catalog's 322 keys and all plural variants were included. The parent review checked reported behavior against the template, application code, and relevant API specifications, consolidated shared source problems, and separated proposed wording from established defects.

This is not native-speaker certification. Confidence in a meaning mismatch can be high even when confidence in a particular replacement is only medium. The proposed strings below were review candidates. Consult Implementation Status for which changes were subsequently applied.

The review covered 5,474 catalog keys and 5,552 individual string values. Reviewers checked representative count messages, action labels, settings descriptions, accessible names, tooltips, playback states, privacy wording, and technical diagnostics. This pass did not produce new screenshots or certify speech output in screen readers.

| Locale | Keys reviewed | String values | Observed convention |
| --- | ---: | ---: | --- |
| `en` | 322 | 325 | International English. Existing capitalization is mixed |
| `es` | 322 | 328 | Spain-leaning vocabulary, such as video terminology and add commands. Consistent informal instructions |
| `fr` | 322 | 328 | Standard French software vocabulary and predominantly infinitive actions |
| `de` | 322 | 325 | Standard German, impersonal infinitive actions, and localized key names |
| `pt` | 322 | 328 | Brazilian-leaning vocabulary, including arquivo, tela, baixar, salvar, and mídia |
| `ja` | 322 | 322 | Familiar Japanese software terms, compact labels, and explanatory polite sentences |
| `zh-Hans` | 322 | 325 | Mainland-oriented Simplified Chinese software vocabulary |
| `zh-Hant` | 322 | 325 | Taiwan-oriented Traditional Chinese vocabulary, not just character conversion |
| `hi` | 322 | 325 | Respectful Hindi commands with familiar technical loans |
| `ar` | 322 | 337 | Modern Standard Arabic with concise action nouns and commands |
| `it` | 322 | 328 | Standard Italian with informal singular commands |
| `ko` | 322 | 322 | South Korean software vocabulary with compact labels and formal explanatory sentences |
| `nl` | 322 | 325 | Standard Dutch with infinitive labels and direct prompts |
| `pl` | 322 | 331 | Standard Polish, imperative actions, and inflected counts |
| `fa` | 322 | 325 | Iranian-oriented Persian, including appropriate Persian characters and ZWNJ usage |
| `he` | 322 | 328 | Standard Hebrew, mainly nominal actions without unnecessary gendered address |
| `tr` | 322 | 325 | Standard Turkish, short commands, and consistent counted nouns |

The Portuguese and Traditional Chinese regional conventions should be recorded and maintained. They do not require adding more locales now. Matching `pt-PT` to the current `pt` catalog does not make its vocabulary European Portuguese.

## Translation Corrections

### T1. Casual Font Is Labeled As Handwriting

Impact: Medium. Mismatch confidence: High. Scope: All 16 non-English catalogs. Key: `subtitle.font.casual`.

The configured font stack is Trebuchet MS, Segoe UI, Arial, and sans-serif in [app.js](src/js/app.js#L2273). None requests a handwriting font. Every non-English label currently promises handwriting or handwriting-style rendering. English says Casual.

Proposed replacements mean casual or informal style. They are descriptive labels, not standardized font-family categories. The semantic mismatch is established. Several exact replacements still merit fluent review.

| Locale and current source line | Current | Proposed | Replacement confidence |
| --- | --- | --- | --- |
| `ar`, [line 62](src/locales/ar.json#L62) | خط يدوي | غير رسمي | Medium |
| `de`, [line 71](src/locales/de.json#L71) | Handschrift | Informell | Medium |
| `es`, [line 74](src/locales/es.json#L74) | Manuscrita | Informal | High |
| `fa`, [line 71](src/locales/fa.json#L71) | دست‌نویس | غیررسمی | Medium |
| `fr`, [line 62](src/locales/fr.json#L62) | Manuscrite | Décontractée | High |
| `he`, [line 62](src/locales/he.json#L62) | כתב יד | לא רשמי | Medium |
| `hi`, [line 71](src/locales/hi.json#L71) | हस्तलिखित | अनौपचारिक | Medium |
| `it`, [line 74](src/locales/it.json#L74) | Manoscritto | Informale | High |
| `ja`, [line 68](src/locales/ja.json#L68) | 手書き風 | カジュアル | High |
| `ko`, [line 68](src/locales/ko.json#L68) | 손글씨 | 캐주얼 | Medium |
| `nl`, [line 71](src/locales/nl.json#L71) | Handschrift | Informeel | High |
| `pl`, [line 77](src/locales/pl.json#L77) | Odręczna | Swobodna | Medium |
| `pt`, [line 74](src/locales/pt.json#L74) | Manuscrita | Informal | High |
| `tr`, [line 71](src/locales/tr.json#L71) | El yazısı | Gündelik | Medium |
| `zh-Hans`, [line 62](src/locales/zh-Hans.json#L62) | 手写风格 | 休闲风格 | Medium |
| `zh-Hant`, [line 62](src/locales/zh-Hant.json#L62) | 手寫風格 | 輕鬆風格 | Medium |

The Chinese candidates in particular are descriptive proposals, not established font classifications. An alternative product decision would be to intentionally supply a handwriting font, but that would be a separate behavior change rather than a translation correction.

### T2. RTL Completion Tooltips Add A Full-Playback Claim

Impact: Medium. Confidence: High. Key: `ui.this-media-has-been-played`.

These translations add entirely or fully to the English meaning. The application can classify media as complete at 97 percent or with 30 seconds remaining. The tooltip must describe a saved classification, not guarantee that every second was consumed. See [completion logic](src/js/app.js#L1599).

| Locale and source line | Current | Proposed |
| --- | --- | --- |
| `ar`, [line 209](src/locales/ar.json#L209) | تم تشغيل هذه الوسائط بالكامل | هذه الوسائط مسجّلة كمكتملة |
| `fa`, [line 218](src/locales/fa.json#L218) | این رسانه به‌طور کامل پخش شده است | این رسانه به‌عنوان تکمیل‌شده ثبت شده است |
| `he`, [line 209](src/locales/he.json#L209) | מדיה זו נוגנה במלואה | מדיה זו מסומנת כהושלמה |

The replacements mean recorded or marked as completed. Existing short completion labels in these three locales do not require replacement on this evidence.

### T3. Turkish Switches Use Present And Absent

Impact: Medium. Confidence: High. Keys: `ui.on` and `ui.off`.

| Source | Current | Proposed |
| --- | --- | --- |
| [tr.json line 12](src/locales/tr.json#L12) | var | açık |
| [tr.json line 13](src/locales/tr.json#L13) | yok | kapalı |

Current wording means present and absent, not enabled and disabled. The distinction matters for settings such as remembering playback history. The replacements convey on and off.

The switch is small. These replacements will require a layout check after approval. Do not retain inaccurate vocabulary merely because it fits the current knob.

### T4. Hebrew Result Summary Has Singular Agreement Trouble

Impact: Medium. Confidence: High. Key: `library.showing`, [he.json line 28](src/locales/he.json#L28).

Current: `מוצגות {shown} מתוך {total} תוצאות`

Proposed: `תוצאות מוצגות: {shown} מתוך {total}`

The current predicate assumes a plural displayed count, producing awkward agreement when one result is displayed out of several. The proposal means Displayed results: X of Y and avoids count-dependent agreement without changing placeholders. This summary is separate from the otherwise valid `library.results` plural variants.

### T5. Dutch Partial Progress Can Sound Like Active Playback

Impact: Medium. Confidence: Medium. Key: `ui.in-progress`, [nl.json line 336](src/locales/nl.json#L336).

Current: `Bezig`

Proposed: `Gedeeltelijk afgespeeld`

The current label can suggest an activity happening now. The proposal means partially played and describes saved unfinished media, including paused or inactive items. A fluent contextual check should confirm the preferred compact wording. This is not evidence of broken playback state handling.

### T6. Korean Incomplete Label Also Describes Unplayed Items

Impact: Medium. Confidence: Medium. Key: `ui.in-progress`, [ko.json line 333](src/locales/ko.json#L333).

Current: `미완료`

Proposed: `일부 재생`

The current label means incomplete, which can include items never started. The filter instead requires saved partial progress greater than zero. The proposal means partially played. Confirm natural UI phrasing in context before approving the replacement.

## Shared English-Source Findings

These are source-copy or shared UI-semantics issues, not independent translation mistakes. English meanings and affected translations were updated together for approved changes. Technical keys were retained to avoid unnecessary key churn. Consult Implementation Status for the maintainer's final naming decisions.

### S1. Add All Tooltip Understates Scope

Impact: Medium. Confidence: High. Key: `ui.add-all-files-from-current-folder`, [en.json line 226](src/locales/en.json#L226).

Current: `Add all files from current folder view`

Proposed: `Add playable files from the current folder to the playlist, including subfolders up to the configured depth. Library filters do not limit this action.`

The action uses unfiltered folder links at depth 1 and traverses descendants at greater configured depths. It is not limited to filtered visible tiles. See [addCurrentFolderToPlaylist](src/js/app.js#L2317). This deserves coordination with the desired UX, not merely a shorter translation. If only visible matches should be added, that would require a separate behavior decision.

### S2. Poster Selection Is Called Upload

Impact: Medium. Confidence: High for local behavior and conversion scope. Keys: `ui.upload` and `settings.poster-upload.desc`, [en.json line 103](src/locales/en.json#L103).

Current button: `Upload`

Proposed button: `Choose image`

Current description: `Upload a custom player poster image (resized to fit 1920x1080 and encoded as WebP when supported).`

Proposed description: `Choose a custom player poster image stored in this browser. Raster images are resized to fit 1920x1080 and encoded as WebP when supported. SVG images remain unchanged.`

The operation selects a local file and persists its data URI in this browser. It does not upload it in this flow. SVG bypasses resizing and WebP conversion. See [fileToPosterDataUri](src/js/app.js#L3150) and [uploadCustomPosterImage](src/js/app.js#L3180).

No actual data transmission or privacy breach was found. This is a privacy-expectation and accuracy issue. French Importer and Italian Carica already admit a local-import reading and need not be replaced just for uniformity. Description corrections still apply.

### S3. Keyboard Help Promises The Wrong Seek Distance

Impact: Medium. Confidence: High. Keys: `ui.go-back-10-seconds` and `ui.go-forward-30-seconds`, [en.json line 301](src/locales/en.json#L301).

Current: `Go back 10 seconds` and `Go forward 30 seconds`

Proposed static wording: `Seek backward` and `Seek forward`

At normal speed the intervals are 15 and 30 seconds. They scale with playback rate and use frame-sized increments at rate zero. The help should either avoid a fixed amount or display the calculated interval, as the dynamic button tooltips already do. See [seek durations](src/js/app.js#L4296). The incorrect 10-second help is inherited across all 17 catalogs.

### S4. Backspace Says Previous Instead Of Parent Folder

Impact: Medium. Confidence: High. Key: `ui.go-to-previous-folder`, [en.json line 313](src/locales/en.json#L313).

Current: `Go to previous folder`

Proposed: `Go to parent folder`

The handler activates `.folder.parent`, not browser navigation history. See [Backspace handler](src/js/app.js#L5122). The English source and 14 other catalogs use previous-folder wording. Both Chinese catalogs already correctly describe the parent folder and should not be rewritten merely to mirror the old English.

### S5. Subtitle Count Is Not Embedded-Only

Impact: Medium. Confidence: High. Key: `info.subtitles.name`, [en.json line 145](src/locales/en.json#L145).

Current: `Embedded Subtitles`

Proposed: `Text tracks`

Final naming decision: `Subtitle Tracks`. The maintainer prefers familiar subtitle terminology, including captions, over the technical browser term. The existing count remains unchanged. The original Text tracks proposal below is retained only as review history.

The value uses all exposed `textTracks`, including externally loaded subtitle tracks. The current title misrepresents which tracks are embedded in the media file. The existing explanation already refers to exposed text tracks. See [metadata collection](src/js/app.js#L6270). All catalogs inherit the embedded-only label.

### S6. Metadata Errors Are Diagnosed As CORS Without Evidence

Impact: Medium. Confidence: High. Keys: `info.corsStatus.desc`, `info.corsError.name`, and `info.corsError.desc`, [en.json line 162](src/locales/en.json#L162).

| Key | Current | Proposed |
| --- | --- | --- |
| `info.corsStatus.desc` | Whether browser CORS policy allowed metadata requests for this media. | Outcome of the HEAD metadata request made in CORS mode. Failure does not identify the cause. |
| `info.corsError.name` | CORS Error | Metadata request error |
| `info.corsError.desc` | Error reported when a CORS metadata request failed. | Error reported when the HEAD metadata request failed. |

The catch block handles any rejected HEAD fetch. It does not establish CORS as the cause. Keep the browser's actual error detail without adding a stronger diagnosis. See [getHeaderData](src/js/app.js#L6013).

### S7. Encoded Body Size Does Not Prove Compression

Impact: Medium. Confidence: High. Key: `info.encodedBodySize.desc`, [en.json line 200](src/locales/en.json#L200).

Current: `Compressed response body size from Resource Timing. Cross-origin values may require Timing-Allow-Origin.`

Proposed: `Response body size before HTTP content decoding, from Resource Timing. Cross-origin values may require Timing-Allow-Origin.`

This value is present even when HTTP content compression is absent. It should not be confused with a video codec or text character encoding. All catalogs inherit the compression assumption. See [Resource Timing](https://www.w3.org/TR/resource-timing/#dom-performanceresourcetiming-encodedbodysize).

### S8. Subtitle Button Tooltip Describes A Different Action

Impact: Medium. Confidence: High. Key: `ui.toggle-subtitles`, [en.json line 279](src/locales/en.json#L279).

Current: `Toggle Subtitles`

Proposed: `Select subtitles`

The button opens or closes the subtitle-selection dialog. It does not directly toggle track visibility. The proposed tooltip also matches the existing accessible name. Some translations explicitly promise on/off behavior, making the mismatch stronger. See [setupPrimaryControls](src/js/app.js#L4941).

### S9. Total Frames Include Displayed And Dropped Frames

Impact: Medium. Confidence: High. Key: `info.totalVideoFrames.desc`, [en.json line 190](src/locales/en.json#L190).

Current: `Total decoded/rendered video frames reported by getVideoPlaybackQuality().`

Proposed: `Total displayed and dropped video frames reported by getVideoPlaybackQuality().`

The API's total includes dropped frames, including frames dropped before decoding. The application uses the API value directly. The revised wording avoids an incorrect denominator interpretation when investigating playback performance. See the [Media Playback Quality specification](https://w3c.github.io/media-playback-quality/).

## Optional Polish

### O1. Subtitle Reset Labels Can Name Settings Explicitly

Impact: Low. Confidence: High that the proposed wording is more explicit. Existing descriptions already explain scope, so these are not destructive-action bugs. Key: `settings.subtitle-reset.label`.

| Locale and source line | Current | Proposed |
| --- | --- | --- |
| `de`, [line 115](src/locales/de.json#L115) | Untertitel zurücksetzen | Untertiteleinstellungen zurücksetzen |
| `nl`, [line 115](src/locales/nl.json#L115) | Ondertiteling herstellen | Ondertitelinstellingen herstellen |
| `es`, [line 118](src/locales/es.json#L118) | Restablecer los subtítulos | Restablecer los ajustes de subtítulos |
| `fr`, [line 106](src/locales/fr.json#L106) | Réinitialiser les sous-titres | Réinitialiser les paramètres des sous-titres |
| `it`, [line 118](src/locales/it.json#L118) | Ripristina i sottotitoli | Ripristina le impostazioni dei sottotitoli |
| `pt`, [line 118](src/locales/pt.json#L118) | Redefinir legendas | Redefinir configurações das legendas |

### O2. Turkish History Description Can Say Recently Played

Impact: Low. Confidence: Medium. Key: `settings.watch-history.desc`, [tr.json line 111](src/locales/tr.json#L111).

Current: `Son medyaların oynatma konumlarını ve tamamlanma durumlarını hatırlayın.`

Proposed: `Son oynatılan medya dosyalarının oynatma konumlarını ve tamamlanma durumlarını hatırlayın.`

The proposal explicitly means recently played media files rather than last media. Existing wording does not establish a privacy or retention defect.

### O3. Arabic Dual Inflection In Seek Tooltips

Impact: Low. Confidence: High for the current grammatical context. Key: `playback.seconds.two`, [ar.json line 32](src/locales/ar.json#L32).

Current: `ثانيتان ({total})`

Proposed: `ثانيتين ({total})`

The current use follows a preposition in the backward and forward seek messages, requiring the oblique dual. Default speed presets do not ordinarily generate a two-second interval, so this is a latent grammar issue rather than a default-UI blocker. Do not reuse this context-specific inflection for standalone result or cue counts.

## Decisions And Native-Review Questions

These are not established translation defects. Do not apply them automatically.

### N1. Keep Played As A Classification Or Rename It

Some reviewers proposed Completed instead of Played in English, Chinese, Hindi, and Korean, with similar questions for Japanese, Polish, and Turkish. Others accepted the existing labels as normal saved-history classifications.

The product already intentionally uses Played, Unplayed, and In progress to remain audio/video neutral. A short status label need not explain the entire completion algorithm. The strongest required correction is T2's added fully claim, not a wholesale rename of every Played label.

Recommended decision: Retain the short Played concept unless the maintainer wants a terminology change. Consider making its tooltip explicitly say Marked as played in playback history across languages. The Korean reviewer proposed `재생 완료` for the label and `이 미디어는 재생 완료로 표시되어 있습니다` for the tooltip. Chinese candidates were `已完成` and an explicit history-classification tooltip. These are alternatives for discussion, not approved replacements.

### N2. German And Dutch Unplayed Labels

Current `ui.unplayed` values are `Nicht gestartet` in [de.json line 335](src/locales/de.json#L335) and `Niet gestart` in [nl.json line 335](src/locales/nl.json#L335). A reviewer proposed `Ohne gespeicherten Fortschritt` and `Zonder opgeslagen voortgang`, meaning no saved progress.

The reviewer correctly noted that missing history cannot prove a file was never started. However, the same limitation applies to the English Unplayed label. Ordinary history classifications do not necessarily claim exhaustive knowledge. Parent triage therefore treats the longer wording as optional, not a high-impact defect. A fluent UI review should decide whether a more conventional compact equivalent of Unplayed is preferable.

### N3. Continue Playing Is A Tab, Not An Immediate Resume Command

German Fortsetzen, Dutch Hervatten, Polish Kontynuuj, Turkish Sürdür, and Japanese's resume-style wording might be understood as commands. Their tab roles and connected-button context also provide meaning.

Candidate collection-style labels include German `Begonnene Medien`, Dutch `Gedeeltelijk afgespeeld`, Polish `Niedokończone multimedia`, and Turkish `Yarım kalanlar`. This would be a contextual naming choice, not a proven bug. Preserve the current navigation design and assess natural wording in the actual UI before changing it.

### N4. Cue Terminology

French `réplique`, Italian `battuta`, and Dutch `ondertitelregels` may be conventional in context, but cues can contain non-dialogue text and multiple lines. Confirm whether these terms cover that meaning naturally.

Candidate terminology is French `segment de sous-titres`, Italian `segmento di sottotitoli`, and Dutch `ondertitelfragment`. If approved, review the count messages, no-cue message, and no-match message together. This is not an instruction to force identical inflected wording into every sentence.

### N5. Hindi Zero-Count Wording

`library.results.one` is `{total} नतीजा` in [hi.json line 30](src/locales/hi.json#L30). The locale's plural rules select the one category for both zero and one, so zero can render with this noun form.

Whether that count label is idiomatic needs fluent review. Do not impose English zero-plural rules or blindly pluralize the one variant. A count-neutral candidate for both variants would be `नतीजों की संख्या: {total}`, but no change is recommended without confirmation.

### N6. Yes/No Switches And Author Positioning

Arabic, Persian, and Hebrew use yes/no for settings switches. Declarative setting labels can make that natural. No specific confusion was established. Do not replace these merely to match English on/off vocabulary.

Those locales also use original-position wording for `subtitle.position.author`, as does Korean. A fluent review could decide whether explicitly naming subtitle-author positioning adds useful clarity within the small selector. The existing wording was not established as incorrect.

## Suggestions Excluded After Verification

- A reviewer initially suggested replacing video filename with media filename in automatic subtitle loading descriptions. The actual `getMatchingSubtitleUrl` function explicitly excludes audio at [app.js line 3821](src/js/app.js#L3821). The reviewer retracted the suggestion. Video-specific wording is accurate for this feature.
- A reviewer initially treated the 33 and 66 percent volume labels as incorrect because gain is nonlinear. They represent normalized user-facing control levels before the configurable gain mapping. That is a valid volume-control convention. The reviewer reclassified it as optional presentation clarification, not a required correction.
- Completion-label ambiguity and the German/Dutch no-history limitation were not retained as high-impact defects. They require a product or native-context decision rather than automatic replacement with verbose labels.

These checks illustrate why reviewer findings need source validation and maintainer triage before edits.

## Verification And Next Steps

The focused catalog test passed for all 17 catalogs, checking matching keys, plural category coverage, nonempty text, and identical placeholders. No structural defects were found. These results do not settle the linguistic findings above.

Before applying changes, approve the shared English-source meanings and decide the open terminology questions. Apply only the approved corrections. Then rebuild both outputs and run the full suite, with extra mobile checks for Turkish switches and longer translated labels. Add focused assertions for completion tooltips, state terminology, and source-copy behavior contradictions where appropriate.

The initial review only added documentation and a README link. Subsequent maintainer instructions authorized the corrections and naming decisions listed under Implementation Status. The report itself does not authorize additional translation changes or commits.
