# player.html 2.38.0

## Highlights

- Added Continue playing alongside Library, making unfinished media easy to find without pushing folders down the page.
- Added library sorting, media and playback-progress filters, and a compact list view.
- Added 17 interface languages, including right-to-left layouts for Arabic, Persian, and Hebrew.
- Cloud picker SDKs now load only when their provider is configured and the player is served over HTTPS.

## Library And Playback

- Switch between Library and Continue playing using connected buttons. Tile and list views use the same connected-button treatment.
- Sort naturally by filename, modified date, size, or recent playback. Missing size and date metadata stays at the end.
- Combine audio/video filters with Played, Unplayed, and In progress filters. Media and progress filters preserve folder navigation.
- Search results include folders only when their names match. Result counts appear only while searching.
- The responsive list view keeps Name and Add columns, with playback status below the filename. Switching views preserves loaded thumbnails.
- Library switches leave the page's current scroll position alone rather than restoring separate tab positions.
- Played and Unplayed terminology now applies equally to audio and video.

## Languages And Layout

- Included English, Spanish, French, German, Portuguese, Japanese, Simplified Chinese, Traditional Chinese, Hindi, Arabic, Italian, Korean, Dutch, Polish, Persian, Hebrew, and Turkish.
- Automatic language selection follows supported browser preferences. Settings can select a specific language, which takes priority and persists in the browser.
- Added optional `defaultLanguage` configuration for browsers without a supported preferred language. English remains the default fallback.
- Language changes apply without restarting playback or clearing the playlist, subtitles, or local folder access.
- Localized labels, tooltips, accessible names, diagnostic descriptions, and plural messages. Dates, numbers, and filename sorting follow the selected locale.
- RTL layouts adapt library controls and modals while keeping media transport, seeking, and timestamps in chronological left-to-right order.
- All catalogs remain embedded in the single-file outputs. Only English and the active catalog are parsed at startup. Other catalogs are parsed when first selected.
- Improved checkbox focus visibility and thumb centering, including Edge pinch zoom at 125% display scaling. The original 2px thumb gap is retained, with no application-side device-pixel-ratio tracking.
- Clarified subtitle and poster labels with Subtitle Tracks and Choose image. The original Add All label and casing remain unchanged.

## Cloud Sources

- OneDrive and Google Drive controls remain hidden unless HTTPS and all required credentials are available.
- Configured SDKs load during startup without blocking library loading or playback. Provider controls remain disabled until their SDK is ready.
- SDK failures and timeouts remain isolated to the affected provider. Authentication still starts only when its picker is opened.
- Existing cloud SDK versions and authentication flows are unchanged.

## Fixes And Performance

- Fixed local-folder navigation and recursive folder-to-playlist traversal. Back and Forward preserve local handles within the current page session.
- Fixed local-folder playback-history indicators so saved progress appears before playback starts.
- Fixed overlapping folder requests and stale search indexing so older work cannot replace a newer navigation or restore disabled search state.
- Fixed folder searches and Continue playing queries interfering with subsequent library browsing.
- Fixed parent-folder icons when filters hide all media files, and improved list/tile action feedback and tooltips.
- Thumbnail cache accounting stays dormant while Settings is closed. Cache eviction uses indexed keys instead of reading every cached image.
- Failed looping playlists stop after one unsuccessful pass instead of retrying indefinitely. Manual playback can retry failed entries.
- Updated the bundled directory parser to folder.api 3.0.0.
- HTTP directory browsing, search indexing, and folder-to-playlist traversal use fetch with `cache: 'no-store'`. Failed requests do not fall back to potentially stale iframe listings.
- Added regression coverage for library behavior, directory caching, localization, conditional cloud loading, and toggle geometry and rendered Edge pinch-zoom alignment.

## Deployment Notes

- Both `player.html` and `player.min.html` remain self-contained. No separate locale files are required when deploying the built outputs.
- Directory listing responses now have a default limit of 4 MiB after HTTP decompression. This limit does not apply to audio or video files.
- `cache: 'no-store'` bypasses the HTTP cache, not service workers. An unrelated worker controlling a reused development origin can still intercept directory requests.
