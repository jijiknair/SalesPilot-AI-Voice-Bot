# Sankar Group assignment review

Review date: 25 October 2026 (Asia/Muscat).

The implementation has been corrected against the supplied assignment. It is not yet fully demonstrated end to end: a real microphone/browser call, audible recording playback, hosted HTTPS link, and explanation video remain to be verified. The existing layout, component styling, and navigation design were retained; a visual browser comparison could not be performed because the automation inventory exposed no browser or app.

## Why responses repeated

1. The running server reported `hasApiKey: false`. When Gemini failed, `/api/gemini/chat-turn` returned HTTP 200 with the same fixed FlowCRM/demo pitch, regardless of the question. A direct pricing question reproduced this.
2. With the configured key loaded in a fresh process, Node failed TLS verification (`UNABLE_TO_VERIFY_LEAF_SIGNATURE`). A genuine Gemini request succeeded using `--use-system-ca`. Startup now uses Windows/system trust without disabling certificate verification.
3. Fallback mode appended the current customer utterance in both the browser and server. It now appears once, with earlier conversation context preserved.
4. Browser speech recognition ran during bot speech, potentially turning the bot's own answer into another customer question. It is paused during fallback generation/playback and respects mute; turns are serialized.
5. Live mode lacked the configured product facts and question-first guidance. Both modes now use the same grounded instructions. They explicitly handle unknown prices and avoid repeated demo pitches or promises of actions the bot cannot perform.

## Requirement matrix

| Assignment requirement | Changes and evidence | Remaining acceptance test |
| --- | --- | --- |
| Interactive voice, specific answers, product explanation | Real Gemini Live handshake, greeting, audio bytes, transcripts, and two separate text-input-to-speech question/answer turns passed. Real chat-turn pricing and reminder questions produced different relevant answers. | Human microphone uplink, listening comprehension, audible output, conversational latency, interruptions, and speaker echo. No full voice conversation was performed. |
| Any language | Configured language reaches both voice instructions; browser fallback maps English, Hindi, and Telugu recognition locales. Product settings reach both modes. | Real English microphone call. Hindi/Telugu were not tested; the assignment requires only one language. |
| Live chat screen | Server emitted genuine Live transcription text. Client now accumulates/finalizes streamed text, including the last fragments before saving. | Watch partial and final user/AI text during a real browser call and compare the saved transcript. Browser rendering was not exercised. |
| Start/End controls, duration/status | Explicit consent guard and idempotent media cleanup passed unit tests. Duplicate starts/ends are guarded; timing uses elapsed time; errors retain End Call controls. Switching tabs keeps the call mounted. | Start, End, rapid double-clicks, cancel while connecting, mute/unmute, tab changes, mic permission denial, actual timer/status changes. |
| Real recording with consent | Consent starts unchecked, is enforced before microphone access, and is stored with a timestamp. Mixed Web Audio routes both sides into MediaRecorder. Fake/unrecordable speech fallbacks were removed. Only captured nonempty blobs are saved. | Record a real conversation with explicit consent; verify both voices, no recording before consent, microphone release, saved format, and duration. Actual MediaRecorder/IndexedDB capture and recording upload were not exercised. |
| Playback | Correct MIME/container handling, source resets, bounded duration, real filename extensions, errors, and byte-range server delivery were implemented. Switching calls no longer reuses a previous call's blob. | Play, pause, restart, seek, mute, download, and reopen a real recorded call after refreshing. No audio was audibly played in this review. |
| AI summary, requirements, objections, next steps | A genuine three-question diagnostic text exchange produced a structured AI summary, identified the stated reminder requirement and pricing objection, and proposed follow-up next week. Missing-key summary failure returned 503 rather than fabricated content. Failed analysis still saves the call with empty extracted fields and an analysis-unavailable marker. | Confirm automatically triggered analysis after a real voice call and compare it with what was actually said. |
| Automatic sales status | Real AI analysis returned `Follow-up Required`; empty-transcript handling returned `No Response`. Six-outcome schema validation passed. Instructions distinguish customer intent from agent sales language and completed purchases from questions or future intent. | Real calls covering Converted, Interested, Not Interested, and Demo Requested; validate refusals, negation, changed intent, and agent-only demo mentions. Schema acceptance is not evidence of model accuracy for every category. |
| Call history | Isolated HTTP/file tests saved, reloaded, and deleted the actual diagnostic text exchange. Repository tests used a browser-storage adapter plus the real isolated server to verify merge, legacy seed removal, reload, and persistent deletion. New calls use UUIDs. Real user history was not replaced with diagnostics. | Real browser history search/filter/drawer, IndexedDB audio retrieval after refresh, and optional Supabase database/storage round trip. |
| Working website link | Updated local backend restarted at http://localhost:3000. | Publish and verify an HTTPS Node/WebSocket deployment. A static Netlify client alone is insufficient. No public submission link was created. |
| Explanation video | Workflow and demonstration checklist documented. | Record the actual working voice flow and show resulting history/recording/summary/status. No video was created. |

`Unclassified` is an internal analysis-failure marker displayed as **Analysis unavailable**, not an invented seventh successful sales outcome. The six specified outcomes remain the only model-generated classifications.

## Tests actually run

- `npm test`: 12 passing regression and integration tests. Test server used a temporary data directory and no API key for failure-path tests; its diagnostic metadata was removed afterward. These tests do not simulate successful provider responses or generate placeholder call recordings.
- `npm run lint`: passed.
- `npm run build`: passed. Vite reports a bundle-size advisory; it does not fail the build.
- Real Gemini chat-turn requests: pricing uncertainty handled directly; reminder features explained; later-contact request acknowledged without claiming an action was scheduled.
- Real Gemini summary: specific requirements, objection, next step, and `Follow-up Required` verified against the diagnostic exchange.
- Real TTS: returned a genuine WAV response (RIFF/WAVE header), not saved as a call recording or played audibly.
- Real Gemini Live: greeting plus two distinct pricing/reminder answers returned generated speech bytes and transcription. Input for this diagnostic was text, not microphone audio.
- Baseline and failure handling: reproduced the original canned pricing reply; confirmed missing-key requests now return errors instead of scripted answers or fabricated summaries.

Sanitized API evidence: [artifacts/api-verification.json](artifacts/api-verification.json). No seeded demo conversations or fake recordings were added to the application.

## Manual acceptance sequence

1. Refresh http://localhost:3000 in a microphone-capable browser. Start Call should remain disabled until the recording checkbox is explicitly checked. Do not approve microphone permission until consenting.
2. Start a real call. Ask about reminders, then ask for the exact price, then refer back to the first answer. Confirm each answer addresses the question and unknown facts are acknowledged. Listen for repetition and echo; test with headphones and speakers.
3. Watch both live transcripts. Interrupt the bot, mute/unmute, change tabs, and return. Confirm duration and status remain accurate and End Call always works. Microphone access should end when the call ends.
4. State a genuine requirement and concern, then request a follow-up. End the call. Compare the summary, requirements, objections, next steps, and status with the actual conversation.
5. Listen to the saved recording: both customer and bot must be audible. Seek, pause, restart, mute playback, and download it. Refresh, open Call History, and replay the same actual recording. Test filtering and deletion with a disposable real test call.
6. Repeat real calls for the other sales outcomes. A question about purchasing must not count as Converted; a demo offer from the AI must not count as Demo Requested. A silent call should be No Response.
7. If using Supabase, apply [the migration](supabase/migrations/20261025_recording_metadata.sql), connect in Settings, and verify the actual audio upload, UUID record, consent metadata, reload from another session, and deletion. This connection was not available during the review.
8. Repeat on the final public HTTPS deployment. Show this real sequence in the submission video.

## API references checked

The integration was checked against the official [Gemini Live capabilities guide](https://ai.google.dev/gemini-api/docs/live-api/capabilities), [model catalog](https://ai.google.dev/gemini-api/docs/models), and [speech generation guide](https://ai.google.dev/gemini-api/docs/speech-generation). Actual key/model access was verified with requests; documentation alone was not treated as a passing runtime test.
