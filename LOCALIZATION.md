# Localization Guide

This guide defines the meaning and tone of player.html interface text. It is a review reference, not authorization to change translations. Proposed terminology changes should be reviewed before catalog edits.

Outstanding linguistic review questions are summarized under Open Review Follow-Ups below. Completed review and release records remain available in Git history and GitHub releases.

## Product And Audience

player.html is a practical audio and video player for HTTP directory listings and user-selected local files. Its library shows filesystem folders and playable media. It is not a streaming subscription service, social app, or video-only application.

Readers include casual listeners and viewers, people browsing personal media collections, and people hosting their own files. Main controls should be familiar without requiring technical knowledge. The file information modal can use precise technical language, with explanations in tooltips.

## Voice And Tone

- Use concise, neutral, familiar software language.
- Prefer established local media-player terminology over literal English translations.
- Use short action labels and direct, factual status messages.
- Follow each language's normal UI register. Do not force English word order, capitalization, or politeness conventions onto another language.
- Avoid marketing language, jokes, excessive enthusiasm, blame, and unnecessary apologies.
- Avoid em dashes and semicolons in authored interface copy and documentation.
- Keep audio and video equally valid. Use viewing-only or listening-only terms only when the feature genuinely applies to one media type.
- Do not shorten a label into a different meaning just to fit a control. Report a layout constraint separately.
- Be consistent within each locale, while allowing grammatical inflection and context-specific wording.

## Product Glossary

The English term describes a concept. Translators should choose a natural equivalent for that concept, not necessarily one fixed word for every grammatical context.

| Concept | Intended meaning | Avoid |
| --- | --- | --- |
| Media | Audio or video content playable by this app | Video-only or music-only wording in general controls |
| Play | Start or resume media playback | Download, open a document, or merely select a tile |
| Pause | Temporarily halt playback while retaining the current media and position | Stop, close, unload, or reset |
| Stop | End the current playback session and unload the media source | Wording that promises the same behavior as Pause |
| Resume | Continue the same media from a saved playback position | Restart from the beginning |
| Continue playing | A library view of unfinished media available to resume | A command to resume the current paused item immediately, or video-only "continue watching" |
| Unplayed | No saved playback progress, or a saved position of zero without completion | A guarantee that the person has never opened the file |
| In progress | Saved partial playback without completion | Currently playing, buffering, downloading, or indexing |
| Played | Saved completion status, including the app's near-end threshold | A guarantee that every second was played, or merely that playback started |
| Completion threshold | Ended playback, at least 97 percent of duration, or at most 30 seconds remaining | Exactly 100 percent or an assertion that all content was consumed |
| Playback history | Saved positions and completion status for recent media | Browsing history, uploaded activity, or a log of every playback event |
| Library | The current browsable media source and its folders | A separate purchased collection, database import, or cloud account |
| Folder | A filesystem directory from an HTTP listing or a selected local directory | Playlist, category, album, or collection |
| Parent folder | The immediate enclosing directory | Previous item in navigation history, root directory, or previous track |
| Playlist | The ordered media queue used for playback | A folder or a newly created media file |
| Add to playlist | Enqueue an item, without moving or copying its source file | Upload, download, or filesystem modification |
| Add folder to playlist | Enqueue playable files under a folder, subject to the configured folder depth | Add the folder as a single playable item or recursively include unlimited depth |
| Add All | Add playable files from the current folder to the playlist, including descendants when the configured playlist depth permits | Add the entire server, all history, or necessarily only the currently filtered visible tiles |
| Remove from playlist | Remove a queue entry only | Delete the source file |
| Clear | Empty the named list, search, history, or cache | Delete source media or reset unrelated settings |
| Reset | Restore the named settings or customization to their defaults | Clear all browser data or delete files |
| Save playlist | Store the playlist in this browser's localStorage | Download a playlist file or save the media itself |
| Export playlist | Download a playlist file | Upload, sync, or download the media files |
| Import playlist | Read a playlist file or URL into the app | Upload the source media |
| Recent | Sort by the most recent playback-history update | Newest file modification date or newly added files |
| Newest / Oldest | Sort by available file date metadata | Playback recency |
| Seek | Move to another playback time | Search filenames or subtitle text |
| Previous / Next track | Move to another queued audio or video item | Seek within the current media or audio-only tracks |
| Playback rate | Speed of playback | Frame rate, bitrate, refresh rate, or download speed |
| Frame | One video image at a point in time | Browser iframe, border, or thumbnail tile |
| Thumbnail | A small preview image for a media tile | The full media, player poster, or screenshot action |
| Animate thumbnails | Generate and cycle multiple preview images | Change media playback speed or animate the whole UI |
| Poster image | The player's custom or configured idle/background image | A media thumbnail or downloaded artwork |
| Capture screenshot | Save the current video frame as an image | Record the screen, capture audio, or export a video clip |
| Subtitle file | A loaded or available SRT/VTT text track | A translation service or embedded-only subtitles |
| Subtitle Tracks | The user-facing media-info name for subtitle and caption tracks, including externally loaded files | Embedded-only wording or a new caption-versus-subtitle distinction. The underlying browser-exposed track count is unchanged |
| Subtitle cue | One timed subtitle text segment | Chapter, queue item, filename, or search term |
| Transcript search | Search text in the already loaded subtitle track and seek to a matching cue | Transcribe audio, translate subtitles, or search all subtitle files |
| Auto-load matching subtitles | Load a sidecar subtitle file matching the video filename. Automatic matching currently excludes audio | Detect speech, translate audio, or guarantee a subtitle exists |
| Author default | Subtitle positioning supplied by the subtitle author | App default, browser default, or current user preference |
| Folder depth | Number of directory levels included in a traversal | Unlimited recursion. A value of 1 means the current folder only |
| On / Off | A setting is enabled or disabled | Present/absent, installed/missing, or a different action |
| Automatic language | Resolve browser preferences, then configured fallback, then English | Force English, follow only the OS region, or translate media content |
| Local folder access | Access explicitly selected files through browser-granted handles for the current session | Server filesystem access, persistent permission, or unrestricted disk access |
| Prevent screen sleep | Request a screen wake lock while audio or video is playing, when available | Guarantee background execution or prevent every form of system sleep |

Completion and history terms describe the app's saved classification. Privacy settings, history eviction, and missing metadata can limit what is known about past playback.

## Technical Terminology

| Concept | Meaning to preserve |
| --- | --- |
| Bitrate | Estimated average encoded media bits per second, not network throughput |
| Frame rate | Video frames per second, estimated where the label says estimated |
| Dropped frames | Video frames not presented during playback, not lost network packets |
| Corrupted frames | Frames the browser reports as corrupted, not every dropped frame |
| Buffering / Buffered | Media time ranges the browser already has available |
| Seekable | Media time ranges the browser currently allows seeking within |
| Range requests | HTTP byte-range requests used to check partial-content and seeking support |
| Encoded body size | Resource Timing response-body bytes before content decoding, not a text character encoding |
| Transfer size | Resource Timing transferred-byte measurement, distinct from file size and encoded body size |
| Content-Encoding | HTTP content coding such as gzip, distinct from the audio/video codec |
| CORS | Browser cross-origin request policy, not proof of a server outage or file absence |
| HEAD failed | A metadata request failed, not necessarily media playback or every network request |
| canPlayType | Browser confidence for a MIME type, not a guarantee of successful playback |
| Volume percentage | Normalized user-facing control level before gain mapping, not a promise of linear gain or perceived loudness. The 33 and 66 percent labels are intentional |
| Unknown | The value is not known |
| Unavailable | The value or operation cannot currently be obtained or used |
| Unsupported | The browser or feature lacks support |
| None | No items or no active value, where the underlying data establishes that |

Preserve product names, filenames, URLs, extensions, config keys, browser API names, HTTP header names, and status codes when they identify literal technical values. Translate the surrounding explanation. Do not turn a browser-generated error into a stronger claim than its contents support.

## Locale Conventions To Review

These are review baselines, not a claim of native-speaker approval. Regional wording differences should be recorded as decisions rather than silently treated as errors.

| Locale | Review baseline |
| --- | --- |
| `en` | Concise international English. Check the source against actual behavior before using it as authority |
| `es` | Broadly understandable Spanish. Use one consistent address and terminology convention |
| `fr` | Standard French software language. Keep address, grammatical form, accents, and punctuation consistent |
| `de` | Standard German UI language. Use one address convention and conventional media terms |
| `pt` | The current catalog uses Brazilian-oriented vocabulary. Keep that regional convention consistent unless a change is approved |
| `ja` | Familiar Japanese software terminology. Keep action labels and explanatory sentence register consistent within their roles |
| `zh-Hans` | Simplified Chinese with consistent software and media terminology |
| `zh-Hant` | The current catalog uses Taiwan-oriented Traditional Chinese vocabulary. Do not rely on character conversion alone |
| `hi` | Natural Hindi UI wording. Use familiar technical loans where clearer than obscure literal terms |
| `ar` | Modern Standard Arabic. Check command forms, agreement, plural grammar, and mixed-direction text |
| `it` | Standard Italian UI language. Keep address and media terminology consistent |
| `ko` | Familiar Korean software language. Keep explanatory politeness consistent and action labels idiomatic |
| `nl` | Standard Dutch UI language. Keep address and compound terminology consistent |
| `pl` | Standard Polish UI language. Check case, inflection, and actual plural sentences |
| `fa` | Standard Persian UI language. Check terminology, Persian character forms, spacing, and mixed-direction text |
| `he` | Standard Hebrew UI language. Review gendered phrasing and mixed-direction text without forcing awkward neutral constructions |
| `tr` | Standard Turkish UI language. Check established state labels, command forms, and case-sensitive characters |

Matching a browser preference such as `pt-PT` to the current `pt` catalog does not make its vocabulary European Portuguese. These regional choices do not by themselves require additional locale catalogs.

## Open Review Follow-Ups

The following items were left open after the initial 17-catalog review. They are optional polish or questions for fluent, contextual review, not confirmed runtime defects or authorization to change translations. Recheck the current catalog and related UI before proposing a change.

| Area and keys | Locales | Follow-up |
| --- | --- | --- |
| Subtitle reset, `settings.subtitle-reset.label` | `de`, `nl`, `es`, `fr`, `it`, `pt` | Consider explicitly naming subtitle settings rather than subtitles. Existing descriptions already explain the reset scope, so this is not a destructive-action defect |
| Playback history, `settings.watch-history.desc` | `tr` | Consider explicitly saying recently played media files rather than last media. No privacy or retention defect was established |
| Seek duration, `playback.seconds` variant `two` | `ar` | Review the oblique dual required after the prepositions in seek messages instead of the current nominative dual. Default speed presets do not ordinarily produce this interval. Check all uses before changing a shared plural variant, and do not reuse this inflection for unrelated result counts |
| Completion labels and tooltips, `ui.played` and `ui.this-media-has-been-played` | All | Retain the compact Played classification unless a product terminology change is approved. More explicit saved-history tooltip wording is optional. Do not rename labels to Completed merely because near-end completion is inferred |
| Unplayed, `ui.unplayed` | `de`, `nl` | Review whether the current not-started wording is the most natural compact UI equivalent. Missing history cannot prove a file was never started, but that limitation does not require verbose no-saved-progress labels |
| Continue playing, `ui.continue-playing` | `de`, `nl`, `pl`, `tr`, `ja` | Check whether resume-style wording reads naturally as a collection tab rather than an immediate playback command. Assess alternatives in the connected-button UI, not in isolation |
| Subtitle cues, `transcript.cues`, `transcript.noCues`, `ui.no-matching-cues` | `fr`, `it`, `nl` | Confirm that dialogue- or line-oriented terms also cover non-dialogue cues and cues containing multiple lines. Review count, empty, and no-match messages together |
| Result counts, `library.results` variant `one` | `hi` | Check zero-count wording with a fluent reader. Hindi selects the one category for both zero and one. Do not impose English zero-plural rules. A count-neutral number-of-results phrase is an option only after review |
| Setting states, `ui.on` and `ui.off` | `ar`, `fa`, `he` | Existing yes/no wording can be natural with declarative setting labels. No specific confusion was established, so do not replace it merely to copy English on/off vocabulary |
| Authored positioning, `subtitle.position.author` | `ar`, `fa`, `he`, `ko` | Assess whether explicitly naming the subtitle author improves the existing original-position wording within the narrow selector. The current wording was not established as incorrect |

Native-speaker review should also confirm the naturalness of the approved informal-font labels, especially in the Chinese catalogs, and the Dutch and Korean partial-progress labels. Preserve their corrected meanings rather than reverting to handwriting or active-playback terminology. These checks are linguistic follow-ups, not evidence that the approved corrections should be rolled back.

## Review Procedure

1. Read all keys and plural variants in the assigned catalogs, not only the main buttons.
2. Read the source template and relevant JS for context. A source translation can be inaccurate if the English string already misstates the feature.
3. Review visible labels with their tooltips, accessible names, settings descriptions, and related controls.
4. Render representative full messages mentally or in the running UI. Include counts of 0, 1, 2, 3, 5, 11, 21, 22, and 100 where relevant, plus timestamps and filenames.
5. Check technical meaning, audio/video neutrality, action/state distinctions, register, regional vocabulary, and terminology consistency.
6. Separate linguistic findings from clipping, accessibility, runtime, and English-source issues.
7. Report findings before making catalog changes. Do not rewrite acceptable text just to express a stylistic preference.

For each finding record the locale, exact key or variant, source line, current text, proposed wording, reason, impact, and confidence. Distinguish required meaning corrections from optional polish and unresolved native-speaker questions. Explain proposed non-English wording in English so the maintainer can evaluate the change.

### Impact And Confidence

- High impact: Misleads about privacy, data loss, file operations, completion, or the action a control performs.
- Medium impact: Incorrect or ambiguous everyday media terminology, technical meaning, grammar, or scope.
- Low impact: Defensible consistency or tone improvement without a material meaning change.
- High confidence: Direct semantic mismatch, verified behavior contradiction, or clear grammatical error.
- Medium confidence: Contextual naturalness or regional terminology that merits another fluent review.
- Low confidence: Open question. Do not present it as an established defect or apply it automatically.

Do not confuse a high-confidence low-impact issue with a release blocker. A second AI review is useful but does not constitute native-speaker validation. Back-translation can expose meaning drift but cannot certify natural tone.

## Existing Checks And Remaining Limits

The build and tests validate catalog structure, matching keys and placeholders, plural category coverage, safe interpolation, language resolution, and live switching. Browser tests cover RTL layout and narrow viewports. These checks do not certify correct word choice, grammar, appropriate tone, or a naturally spoken accessible name.

After wording is approved, add targeted regression assertions for important distinctions. Keep those assertions separate from tests that merely compare runtime output with the same catalog used to produce it. Review changed source strings and affected translations together.

## References

- [Microsoft Localization Style Guides](https://learn.microsoft.com/en-us/globalization/reference/microsoft-style-guides) provide language-specific software-writing conventions. They are references, not a requirement to adopt Microsoft's product voice.
- [Unicode CLDR plural rules](https://cldr.unicode.org/index/cldr-spec/plural-rules) explain plural categories and example sentences. Category coverage alone does not establish grammatical correctness.
- [W3C internationalization and localization overview](https://www.w3.org/International/questions/qa-i18n) describes localization as adaptation beyond replacing words.
