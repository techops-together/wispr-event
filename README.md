# Ask Tanay — Together × Wispr Flow live Q&A

One-evening hack for the Together Fund × Wispr Flow fireside (Gurgaon, 27 Aug 2026).
Attendees open a link, dictate their question with the Wispr Flow keyboard (no login),
and Claude scores + curates the best questions live for the moderator.

## Pages

- `/` — attendee page. Name + optional company + question textarea. No login.
- `/host?key=<HOST_KEY>` — moderator dashboard. Live-ranked feed (auto-refreshes
  every 4s), pin/hide controls, and a "Curate top 10" button that has Claude
  dedupe and pick the best questions with a one-line note per pick.

## How ranking works

- On every submission the API stores the question instantly, then scores it in
  the background with Claude (relevance to the event themes, specificity,
  novelty, 0–100). Abusive/spam content is auto-hidden.
- "Curate top 10" sends all visible questions to Claude in one pass to
  deduplicate near-identical asks and order the best ones for the stage.
- If the Claude call ever fails, nothing breaks: questions land with a neutral
  score and the host picks manually.

## Run locally

```sh
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY at minimum
npm run dev
```

Without Redis env vars it uses in-memory storage — fine locally, not on Vercel.

## Deploy to Vercel (do this before 6 PM)

1. Push this folder to a Git repo and import it in Vercel (defaults are fine).
2. In the Vercel project → Storage → add the **Upstash Redis** integration
   (one click; it injects `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically).
3. Project → Settings → Environment Variables:
   - `ANTHROPIC_API_KEY` — the Claude key
   - `HOST_KEY` — any random string, e.g. `openssl rand -hex 12`
4. Deploy. Attendee link is the root URL; moderator opens `/host?key=<HOST_KEY>`.
5. Optional but nice: point `ask.together.fund` at the deployment
   (Vercel → Domains → add domain, then a CNAME in Together's DNS).

## Event-night checklist

- Generate a QR code for the attendee URL and put it on the venue screen
  (email the link too, as backup).
- Test end-to-end from a phone on mobile data by ~4 PM.
- Moderator keeps `/host?key=...` open on a phone or laptop; hit
  "Curate top 10" after the 2-minute submission window.

## Limits baked in

- 2 submissions / 30s and 15 / hour per IP; 1,000 questions total.
- Name ≤ 60 chars, question ≤ 500 chars.
- Host routes require `HOST_KEY` (open only when the env var is unset, i.e. local dev).
