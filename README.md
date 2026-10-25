# SalesPilot AI

SalesPilot is a React UI and Node/Express server for genuine Gemini Live voice conversations, streamed text transcripts, consent-based mixed microphone/AI recordings, structured AI analysis, and saved call history.

## Run locally

Use Node.js 24 or later. Install dependencies with `npm install`, put `GEMINI_API_KEY` in `.env.local` or `.env`, then run `npm run dev`. Open http://localhost:3000 and refresh any existing tab after updating the code. The startup command uses the system certificate store; TLS verification remains enabled.

Optional model overrides are listed in `.env.example`. The key stays on the server. `/api/health` reports whether a key is loaded, without exposing it. Model access, quota, and connectivity are tested by an actual call, not by that health flag.

Configure the SaaS product, agent, language, and verified product facts in Settings. Missing prices and unsupported capabilities are not invented. English is sufficient for the assignment; other configured languages need their own real voice acceptance tests.

## How it works

The browser requests explicit recording consent and microphone access. Microphone PCM streams through the same-origin `/live` WebSocket to Gemini Live, and generated speech plays through Web Audio. Both sides' transcription fragments are displayed and finalized into history. Microphone and AI audio share a MediaRecorder mix; only the captured blob becomes a call recording.

If Live cannot connect, the app tries browser speech recognition, contextual Gemini replies, and genuine Gemini TTS. This is turn-based voice, with recognition paused while the bot speaks. Unsupported browsers and AI failures show errors. Uncapturable browser speech synthesis and canned sales replies are not used as substitutes.

Ending the call stops microphone access, finalizes the real recording and transcript, and requests structured AI analysis. Successful analysis returns one of the assignment's six sales outcomes. Failed analysis leaves the call visibly awaiting classification (`Unclassified` internally); it does not create customer needs, objections, next steps, or a successful outcome.

Call metadata is saved in browser storage and the server's `.data/calls.json`; actual recordings use IndexedDB and a server file backup. Supabase is optional. Load merges available stores without dropping offline records. Deletion is persisted, with browser deletion markers preventing unavailable remote data from reappearing locally.

## Supabase

For a new project, run `supabase/schema.sql`. Existing projects should run `supabase/migrations/20261025_recording_metadata.sql` to add recording-consent fields and allow the analysis-failure marker. Enter the project URL and anon key in Settings and test the connection. New calls use UUIDs compatible with the schema. Supabase was not connected or validated during this review.

The included anonymous-access policies retain the original app's access model. Use suitable authentication and policies before collecting real customer information on a public deployment.

## Verify

- `npm test`: focused regression and isolated server integration tests; diagnostic records never enter the app's real history.
- `npm run lint`: TypeScript checks.
- `npm run build`: production client build.
- `npm run verify:api`: real Gemini chat, summary, TTS, and Live-greeting checks against a running server; uses the configured key and API quota. Set `SALESPILOT_TEST_URL` to target another local origin. It does not save conversations as calls or substitute generated speech for a call recording.

See `ASSIGNMENT_REVIEW.md` for the requirement matrix and remaining real microphone acceptance steps. Sanitized real API results are in `artifacts/api-verification.json`.

## Production and submission

Run `npm run build`, then `npm start` on a Node.js host that supports long-lived WebSockets. Supply the server key, expose `PORT`, and serve the site over HTTPS for microphone access. Use a persistent `.data` volume (`CALL_DATA_DIR` can override its location), or verify Supabase storage and database persistence.

The existing Netlify configuration builds the client only. A static Netlify deployment alone cannot run `/api/*` or `/live` and cannot satisfy the voice assignment; deploy the Node backend with the same origin or an explicit API/WebSocket reverse proxy. This review did not publish a public website or record the submission video.
