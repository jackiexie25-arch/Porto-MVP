# Porto: guide for future sessions

Porto is a family-controlled profile app. It helps a support worker, camp leader or school aide who has never met a minimally verbal autistic child know what to do from their first shift. It is a **trial MVP** for 5 to 10 families. Read `DECISIONS.md` before changing anything, and record new assumptions there.

Two core rules shape everything:
- **Meaning is always meaning in a context.** The same cue can mean different things with different people or in different places. Never model a cue as a flat definition.
- **The app supports human connection and never replaces it.** Show only what the child's family wrote. Never guess, generate or interpret meanings. If nothing matches, say so plainly.

## Stack

- Vite + React + TypeScript (strict), React Router, plain CSS with custom properties and CSS Modules. No Tailwind, no component library.
- Fonts are self-hosted via `@fontsource-variable/fraunces` and `@fontsource-variable/figtree`. Never load Google Fonts or any third-party asset.
- Supabase (Postgres + Auth + RLS) in **Sydney (ap-southeast-2)**. Migrations live in `supabase/migrations/` and must run from scratch.
- Families sign in with **email magic link only**. Workers never have accounts. They use a time-boxed share link, and every worker action goes through `SECURITY DEFINER` RPCs that take the token. `anon` has **no direct table access**.
- Netlify hosting (`netlify.toml` holds the SPA fallback and security headers).
- Vitest (unit), Playwright (e2e), SQL tests for RLS and RPCs.
- Mobile-first: design worker screens for a 360px viewport first. A web app manifest is included; **no service worker or offline caching**.

## Commands

```bash
npm run dev          # local dev server
npm run check        # lint:copy + lint:hex + typecheck + unit tests
npm run lint:copy    # avoid-list words and exclamation marks in user-facing strings
npm run lint:hex     # no raw colours outside src/styles/tokens.css and derived-tokens.css
npm run typecheck
npm test             # unit tests + database tests
npm run test:db      # migrations applied from scratch to PGlite; RLS, RPC and cascade tests
npm run build
npm run invite-codes -- 10   # print new invite codes and the SQL to add them
npm run icons        # regenerate public/icons from public/porto-app-icon.svg
```

## Brand rules (brief section 3)

- Feeling: warm, calm, quietly sure of what to do next. Humanist minimalism. **Light theme only** (`color-scheme: light`); never add dark mode.
- Colours come only from `src/styles/tokens.css`. Anything derived goes in `src/styles/derived-tokens.css` and in DECISIONS.md under "Brand gaps". `npm run lint:hex` enforces this.
- Text colour pairs: `ink`, `ink-soft` or `muted` on `ground`/`surface`; `ink` on `apricot`; `success` on `surface`. **Never put text in apricot, apricot-deep, sky, rose or blob.** Never put blob behind text under 18px.
- 60/30/10: ground for the page; surface and ink for structure; apricot for the few things that matter. **About one primary button per screen.**
- Headings: Fraunces 600 with `text-wrap: balance`. Everything else: Figtree. Type scale is in `src/styles/base.css` (hero 56/60, h2 36/42, h3 24/30, body-lg 18/28, body 16/26, small 14/20, button 16/20 600; phones: hero 36/40, h2 28/34).
- Components live in `src/components/ui/`, and `/styleguide` shows every one. Reuse them; don't restyle locally.
- Errors have no colour: ink text, 2px ink border, "!" icon, calm words. Never red.
- Logo: use the supplied SVGs only (`src/assets/brand/`). Never recolour, outline, shadow, stretch or rebuild it in a font, and never place it on apricot. Wordmark min 88px, mark min 20px.
- Illustrations (`src/assets/illustrations/`): one-pen ink line, 1 or 2 flat fills, unfilled calm faces, a surface blob and a few leaves. Use them sparingly. **Never** use puzzle pieces, distressed children, medical equipment or stock photos.
- Accessibility: WCAG 2.2 AA and gentler. `lang="en-AU"`, skip link, visible focus everywhere, 48px tap targets, 200% zoom, `prefers-reduced-motion`, fades of 150ms or less. No autoplay, flashing, sound or auto-dismiss. `aria-live="polite"` for search results. Every icon has a text label.

## Voice rules (brief section 4)

- Plain, kind, practical. Short sentences. **Lead with what to do.** Families are in charge.
- Buttons say exactly what happens ("Share for this shift", "Save and continue"). Confirmations read "Saved." or "Link copied."
- Default to "autistic child" and "minimally verbal", and respect the family's choice of identity-first or person-first language.
- **Avoid:** "suffers from", "special needs", "warriors", "afflicted", "wandering"/"elopement", exclamation marks, pity framing, puzzle pieces.
- Australian spelling and context (behaviour, colour, NDIS, AUD, 000).
- Tagline: "Know what to do, from the first shift."
- **All user-facing strings live in `src/copy/en-AU.ts`**, grouped by screen. New drafted copy goes in DECISIONS.md under "Needs human review".

## Privacy and safety rules (brief section 6, non-negotiable)

- Data minimisation: first name or nickname only. No surname, date of birth, address, NDIS number, school name or photos.
- No audio, video, camera, microphone, location, sensors or in-app speech recognition.
- No third-party trackers, analytics, fonts or scripts. The only network destination besides our own origin is the Supabase project. Analytics are the first-party `events` table, with no free text, worker names or queries.
- `/s/*` pages: `noindex`, `no-store`. `no-referrer` everywhere, plus `nosniff`, `DENY` and a strict CSP. Never put tokens in events or logs. Strip the token from the URL after load where possible.
- Tokens: 32 random bytes, base64url, generated server-side, shown once, SHA-256 hashed at rest, expiring, revocable, rate-limited (about 60 a minute).
- Never put the service-role key in the frontend. `.env.example` holds placeholders only.
- Length-limit all text, rely on React escaping, and **never use `dangerouslySetInnerHTML`**.
- The app is not medical advice. The card footer says "If it's an emergency, call 000."
- No real child data anywhere. Demo data uses the fictional "Ari", labelled "Demo profile (fictional)".
- Delete means hard delete, cascaded, with every link invalidated.

## Out of scope (brief section 7)

Do not build: hardware or sensors; audio or voice analysis; any ML or AI "guess what they mean"; medical or diagnostic cues; hospital and clinician features; emergency QR ID; payments; agency or camp admin and multi-child teams; push or email notifications beyond the magic link; offline mode or service workers; photos or video; chat; activity guides and the "when things go wrong" playbook; public sign-up without an invite code; locales beyond en-AU. If something seems essential, add it to DECISIONS.md under "Questions for Jackie".

## Database conventions

- Every new table gets RLS enabled, explicit grants (never rely on Supabase defaults) and a test in `supabase/tests/` proving family B can't reach family A's rows and anon can't reach anything.
- Every function sets `search_path = ''`, uses schema-qualified names, revokes execute from `public` (and from `anon` unless workers need it), and grants only what's needed.
- Family-owned rows hang off `profiles` with `on delete cascade`. Deleting a profile must remove everything, and a test proves it.
- Search normalisation exists twice (`public.normalise_query` and `normaliseQuery` in `src/lib/search.ts`). Change both together and add a case to `supabase/tests/normalise-cases.json`, which both test suites read.
- Every worker function starts with `use_share(p_token)` and returns `{status: 'closed' | 'busy'}` unless the outcome is `ok`. Worker functions return only what the card or search shows, never profile, owner or share ids.
- The worker view (`src/worker/`) is its own bundle and must not import the Supabase client or anything from the family app's auth. It calls the worker functions with `fetch` in `src/worker/api.ts`.
- Search never guesses: `search_cues` returns only the family's own cues, and `[]` when nothing matches.
- `CONSENT_VERSION` in `src/lib/consent.ts` must match `public.consent_version()`. A test checks this. Bump both, in a new migration, when the consent text changes.

## Working conventions

- Work in the phases in the brief. After each phase: run `npm run check`, commit, and stop for a summary.
- Small, plainly named commits. Typed, small components. Test any logic.
- No dead code. Every TODO needs a DECISIONS.md entry.
