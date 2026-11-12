# Decisions

Choices made while building the Porto trial MVP, so the reasons stay visible.

## Assumptions

### Phase 0

- **Git:** work happens on `main`, as Jackie chose. The repo-local git identity is set to Jackie's name and email.
- **Versions:** React 19, React Router 7 (the classic `BrowserRouter` API), Vite 6, Vitest 3 and TypeScript 5.8, pinned with caret ranges.
- **Font files:** only the `wght` axis of each variable font is imported (`@fontsource-variable/*/wght.css`) to keep downloads small. Vite builds them as same-origin files (`assetsInlineLimit: 0`), so the CSP needs no `data:` for fonts.
- **Derived tokens:** values the brief gives for components but not in `tokens.css` live in `src/styles/derived-tokens.css`: the scrim, the pressed button shadow, the pill radius, control and chip heights, a 66ch paragraph measure, the 150ms fade, and a `--section-gap` that switches from 96px to 64px below 600px. `tokens.css` is exactly as briefed.
- **Breakpoints:** "phone" type and spacing apply below 600px. The nav collapses to logo plus menu below 720px.
- **Colour lint:** `npm run lint:hex` fails on hex values, colour functions (`rgb()`, `hsl()` and so on) and named colours in CSS, anywhere in `src/` except the two token files. Logo SVG files are exempt. Illustrations are React components that use CSS variables, so they hold no raw colour values.
- **Copy lint:** `npm run lint:copy` parses `src/copy/en-AU.ts` and every non-test `.tsx` with the TypeScript compiler, then checks string literals, template parts and JSX text. It fails on the avoid-list words (plus "puzzle") and on any "!". In the copy file it also flags common American spellings (behavior, color, favorite, organiz-, mom). Test files are skipped because they aren't user-facing.
- **Banners** use `role="status"` (polite) for every tone, errors included, so nothing interrupts. They never auto-dismiss.
- **Sheet:** a tap on the backdrop does **not** close it. It closes only with Escape or the Close button, so nothing typed is lost by accident. While it's open, the app behind it is set to `inert`, focus is trapped, and focus returns to the opener when it closes. It shows as a bottom sheet below 600px and a centred dialog above that.
- **Progress:** done steps are filled `--sky`, the current step is a wider apricot pill, and future steps are white. All have ink outlines. Screen readers hear "Step 2 of 6, current step".
- **Checkboxes** use the native control with `accent-color: var(--ink)`, in a 48px row.
- **CSP:** `netlify.toml` uses `connect-src 'self' https://PROJECT_REF.supabase.co`. **Replace `PROJECT_REF` in Phase 1** once the Sydney project exists. `img-src` is `'self'` only. A QR code drawn as inline SVG needs nothing more.
- **Extra headers** beyond the brief: `Permissions-Policy` (camera, microphone and geolocation off, which matches the "no camera, mic or location" rule), HSTS, and `robots.txt` disallowing `/s/` and the family routes.
- **Manifest:** `start_url` is `/`. A worker who adds the share page to their home screen on Android may land on `/` rather than their share link. To revisit in Phase 4 (see Questions).
- **Welcome page (Phase 0):** shows the tagline, illustration 1 and the explanation. Sign-up is wired in Phase 1. For now the page links to the styleguide instead of showing a primary button that does nothing.

### Phase 1

- **Database tests run on PGlite**, an in-memory Postgres in WebAssembly. This Mac has no Docker, so the Supabase CLI's local stack can't run. A small shim recreates Supabase's `auth.users`, `auth.uid()`, the `anon`, `authenticated` and `service_role` roles, and Supabase's default broad grants, so the tests prove our migrations remove those grants. Tests run in `npm test` and in CI. Once a real project exists, they're worth repeating against it.
- **All tables are created in Phase 1**, so the data model and RLS are reviewed together. Worker RPCs, search, sharing and events arrive in their phases.
- **One profile per family account** (`profiles.owner_id` is unique). Multi-child management is out of scope.
- **`display_name` starts empty.** The profile is created at sign-up, and the name is filled in at setup step 1.
- **Text limits:** names 40 characters, cue labels 120, meanings and worker note fields 500, card sections 1,500, aliases 20 items of up to 80 characters, languages 10 items of up to 40. All enforced in the database.
- **Pinned cues:** at most 5, enforced by a trigger. Unpinning clears `pin_order`.
- **Families can't write `shares` or `shift_notes` directly.** Shares are created and closed through RPCs (Phase 4), because tokens must be made server-side. Notes are approved or dismissed through RPCs (Phase 5). Families can't change `profiles.owner_id` or `id` (column-level grants).
- **`events` rows cascade when a profile is deleted**, so "delete everything" includes analytics. The funnel on `/team` then counts only families who are still in the trial.
- **Invite codes:**
  - Stored uppercase with no spaces. What families type is normalised the same way.
  - `check_invite_code()` (anon) gives early feedback on the form. `create_profile()` enforces the code: it needs current consent plus a valid, unused code, and it marks the code used in the same statement.
  - Codes look like `PORTO-XXXX-XXXX`, built from an unambiguous 29-character set (about 39 bits), which is far too many to guess.
  - Codes aren't committed. `npm run invite-codes` prints new ones as SQL.
- **The invite code travels in the magic-link sign-up metadata** (`options.data.invite_code`), so the profile is created right after consent, even if the family opens the link on another device. If the code is missing or already used, `/start` asks for it.
- **Implicit magic-link flow** rather than PKCE. PKCE links only work in the browser that asked for them, and families often ask on a laptop and open the email on a phone. The tokens arrive in the URL fragment, which is never sent to a server, and supabase-js clears it straight away.
- **Sign-in never reveals whether an account exists.** An unknown email still lands on "Check your email".
- **Consent:**
  - Version `2026-11-v1`, stored per user.
  - The order is sign in → consent → create profile → app. Every family page is wrapped in `FamilyGate`.
  - Changing the consent text needs a new version in both `src/lib/consent.ts` and `public.consent_version()`. A test checks they match.
- **Privacy contact:** set by `VITE_PRIVACY_CONTACT_EMAIL`. If it's missing, the screen says to ask the team member who sent the invite.
- **Bundle size:** adding supabase-js brings the single bundle to about 159 kB gzipped. Phase 4 will split routes so the worker view loads only what it needs (target: Lighthouse 90+ on a phone).
- **`/home` is a temporary signed-in page** for Phase 1. It says profile setup is coming. Phase 2 replaces it with guided setup.

### Phase 2

- **Schema addition: `card_sections.details` (jsonb).** Setup steps 2 to 4 ask two or three questions per section, and a single `body` can't keep them apart. `details` stores each answer under a fixed key (toileting: `signs`, `what_to_do`, `avoid`; food and drink: `signs`, `routines`, `avoid`; overstimulation: `triggers`, `early_signs`), and `card_details_ok()` enforces the keys and a 500-character limit. "What calms" and "Please avoid" have one answer each and use `body`. The card can then label each answer for workers, and the JSON export stays structured.
- **Where step 4's answers go:** "What helps them calm?" goes to **What calms**, and "What makes things worse?" goes to **Please avoid**. The toileting and food "avoid" answers stay in their own sections, next to the cue they relate to.
- **Order within a section:** how they show it, then what to do, then avoid. That's the order a worker meets things in the moment.
- **Setup progress:** stored on `profiles` (`setup_step`, `setup_started_at`, `setup_completed_at`). `/setup` resumes where the family left off. After setup it opens at step 1 so answers can be revisited. `/home` goes to setup until it's finished, then to the card. The timestamps feed the "about 15 minutes" measure in Phase 6.
- **Autosave:** saves 0.8 seconds after typing stops, one save at a time, and saves straight away on "Save and continue", "Skip" or leaving a step. A failed save keeps the text and shows a calm message. "Skip this step" still keeps anything typed.
- **Step 5:** examples open the cue form with the type preset.
  - "Save and continue" adds a half-written cue if it's complete. If it isn't, the form says what's missing, and nothing is lost.
  - Starter cues are **pinned automatically** (up to 5), so they appear on the card's Top cues.
  - The form asks for one meaning per cue. More meanings come with the cue library in Phase 3.
- **Cue then meaning are two inserts.** If the meaning fails, the cue is deleted again. Phase 3 may move this into one database function.
- **Step 6 has one button, "Finish for now", which goes to the card.** "Share it" arrives with sharing in Phase 4, rather than linking to a page that doesn't exist yet.
- **About {name}** is built from the family's own answers (communication modes, languages, the connect note), at most 3 lines. Nothing is generated beyond joining their choices into a sentence.
- **"How do you describe {name}?"** is stored as `language_style`. No current screen describes the child's diagnosis, so it doesn't change any wording yet. It will matter wherever Porto first refers to the child in that way.
- **Empty sections** are hidden from workers. On the family's card page they show "Nothing here yet".
- **Reading time:** every word the worker reads (headings and labels included) at 200 words a minute, rounded up, at least 1 minute. The gentle note appears above 350 words and never blocks saving. A test checks the demo card reads in 2 minutes or less.
- **Worker view sections** use native `<details>`, open by default, so they fold away without any script.
- **Who to call:** the phone number shows as a `tel:` link in the worker view. A number that doesn't look like a phone number isn't saved until it's fixed.
- **Print view** (`/card/print`): A4 with 12 mm margins and smaller print type, and nothing prints automatically. One page is the aim for a typical card. A very long card can run to two pages. Printing hasn't been checked on paper yet.
- **Demo profile** (`src/demo/ari.ts`): the fictional Ari profile from brief section 8, with 8 cues. It's shown on `/styleguide` with the "Demo profile (fictional)" label, and Phase 6's `/demo` will reuse it. The phone number comes from the range ACMA reserves for fiction. The copy lint now checks `src/demo/` too.
- **Family navigation** for now: First-shift card, Setup and Sign out. Cues, Inbox and Share are added in their phases.

### Phase 3

- **Search lives in the database as `search_cues(profile, query, context)`.** It's internal (no client role can call it). Phase 4's `worker_search(token, …)` will check the share token, call it and write `search_log`. Building the ranking now keeps it testable before tokens exist.
- **Ranking, as briefed:** exact label (4) → exact alias (3) → trigram (2) → full text over the description and meanings (1).
  - The trigram tier uses `max(similarity, word_similarity) ≥ 0.25` on the label and each alias. `word_similarity` means a part phrase like "bathroom door" or a half-typed "coo" still finds a long label. *Replaced: see "Search relevance (design round 1)".*
  - Full text uses the `english` configuration, so "hungry" finds "I'm hungry".
  - Up to 5 results. An empty or punctuation-only query returns nothing, never a guess.
- **Context boost:**
  - Within the same tier, cues with a meaning for the chosen place come first. The place never lifts a weaker match above a better one; a test proves an exact label still wins.
  - Each cue's meanings are ordered with the chosen place first, and flagged `in_context` for the worker view.
- **Normalisation:** lowercase, apostrophes dropped ("don't" → "dont"), other punctuation becomes a space, spaces collapsed. It's the same in SQL (`normalise_query`) and TypeScript (`normaliseQuery`), and both are tested against one shared list of cases (`supabase/tests/normalise-cases.json`).
- **No trigram indexes:** each family has tens of cues, so scanning them is instant. Revisit if profiles grow past a few hundred cues.
- **`save_cue(profile, cue, meanings)`** saves a cue and all its meanings in one transaction, running as the caller so RLS still applies.
  - Meanings left out are deleted.
  - Pins keep their place, or take the first free place from 1 to 5.
  - A meaning's `source` is never changed, so meanings that came from worker notes stay marked as such.
  - Setup's quick add now uses it too, replacing Phase 2's two inserts.
- **The family's library search runs in the browser** over their own cues. Every typed word must appear somewhere in the label, aliases, description or meanings. Workers get the ranked database search, because they can't see the whole profile.
- **"Also written as"** is typed as a comma-separated list. Repeats (ignoring case) are dropped, with up to 20 aliases of 80 characters.
- **Deleting a cue** asks first in a sheet ("It can't be undone"), then hard-deletes the cue and its meanings. Worker notes that pointed at it keep their own text (`cue_id` is set to null).
- **The pin limit** is enforced in the database. The editor shows "{n} of 5 used" and turns the limit error into plain words.
- The library and editor screens haven't been checked in a browser yet, because they need sign-in and so the Supabase project. Component tests cover them.

### Phase 4

- **One gate for every worker call: `use_share(token)`.** It hashes the token and checks it isn't closed or expired, then applies the rate limit and records first and last open. It answers `closed` for a wrong, expired or closed token alike, so a worker can't tell whether a token ever existed. Malformed tokens (anything other than 43 base64url characters) are refused before the database is searched.
- **Rate limit:** 60 calls a minute per link, counted on the share row in a fixed one-minute window. Over the limit, the answer is `busy` and the worker sees "Please try again in a moment." Other links aren't affected. Wrong tokens aren't rate-limited by Porto, because 256-bit tokens can't be guessed; Supabase's own API limits still apply.
- **`worker_log_note` and `worker_cue_feedback` come in Phase 5** with their screens. Until then, the "card + search + notes" scope behaves like "card + search".
- **Durations:** "This shift" is 8 hours. "Today" runs to midnight on the family's device. Then 3, 7 or 14 days. The database refuses anything outside 1 to 336 hours.
- **The token is shown once,** in the "Link ready" panel with the QR code, "Copy link" and the phone's own share sheet where there is one. "Done" clears it from the page. "Share again" makes a new link with the old label, name and scope filled in.
- **Closing a link** takes one tap with no confirmation, as briefed. It works straight away.
- **QR codes** are made in the browser with `qrcode-generator` (MIT, no dependencies) and drawn as one SVG path from the module grid, in ink on white for reliable scanning. The link never goes to a QR service.
- **The worker view loads on its own.**
  - `/s/:token` is a separate bundle that calls the two worker functions with plain `fetch` (anon key, `credentials: omit`, `cache: no-store`, `no-referrer`) instead of the Supabase client. Workers download about 101 kB gzipped, against 190 kB for the family app.
  - It never stores a session, and a signed-in family member opening a link is treated exactly like a worker.
- **The token comes out of the address bar** after load: it's kept in `sessionStorage` for that tab only, and the address becomes `/s/open`, still under `/s/` for the no-index and no-store headers. A refresh still works. If the browser won't allow `sessionStorage`, the token stays in the address so refresh keeps working.
- **The worker's search:**
  - Runs 0.4 seconds after typing stops. It only runs when the tidied query changes, so "cookie" then "cookie!" doesn't search, or get logged, twice. Empty queries aren't sent or logged.
  - The place chips ("Where are you?") stay chosen for the tab, and tapping one again clears it.
  - Results show every meaning, with the chosen place first and marked by a calm ink edge rather than a colour. "Show larger" opens the cue in a sheet with bigger text.
- **No match:** "Nothing in {name}'s profile matches yet." plus the card's **What calms** lines. "Tell {name}'s family what happened" arrives with the log form in Phase 5.
- **Closed links:** "This link has closed. Ask {name}'s family for a new one." The name appears only if this page already loaded the card. Otherwise it reads "Ask the family for a new one", so a closed link never reveals a name.
- **The worker page title** is "Shared profile · Porto", never the child's name, so the name doesn't land in browser history.
- **Step 6** now has "Share it" (primary, goes to `/share`) and "Finish later" (goes to the card). Both mark setup complete.
- **"Share for a shift"** is the nav's primary button on every family page except `/share` itself, where the form's own button is the one primary action.
- **Emergency line:** on the worker page it's in the footer, so the card there leaves out its own copy (`showEmergency={false}`) and it isn't said twice.

### Phase 5

- **One added question on the worker's log: "What do you think they needed?"** (optional, `shift_notes.seemed_to_need`). The brief's log has no field for what a cue *meant*, but a cue meaning can't be saved without one.
  - When the worker answers it and picked one of the family's cues, **Add to profile** is one tap.
  - Otherwise, Add to profile opens the cue editor prefilled with the note, so the family writes the meaning. A new description always goes to the prefilled form, as briefed.
- **How a note becomes a meaning:**
  - Context and place come from the note. What they tried becomes "What to do" if it helped (Yes or A bit), or "What to avoid" if it didn't.
  - Confidence starts at **Sometimes**, since a note is one observation. The family can change any of it in "Edit then add".
- **`approve_note`** saves the cue (through `save_cue`), marks only the meanings this save created as `source: worker_note` with `source_note_id`, and resolves the note, all in one transaction. A family-typed extra meaning added in the same "Edit then add" save would also be marked as from the note; that seems acceptable.
- **Notes are only ever pending, added or set aside.** "Not now" (`dismiss_note`) keeps the note, and set-aside and added notes stay viewable in folded sections. Families can't edit notes directly.
- **`worker_log_note`:**
  - Needs a "card + search + notes" link.
  - Needs either one of the family's cues or a description, plus whether it helped.
  - Over-long text is trimmed to the limits rather than refused, so a worker never loses a note. Unknown places are dropped.
  - The worker sees "Thank you. {name}'s family will see this." It never says the note was added.
- **The log form's cue list** comes from `worker_get_card`'s new `cue_options` (id and label for every cue), sent only on links that allow notes. A worker on such a link can already search those cues, so the labels reveal nothing new.
- **"Did this help? Yes / Not really"** shows under each search result on any link that allows search. After an answer, the worker sees "Thank you. The family will see this." Answers are stored per cue and link in `cue_feedback`. The family doesn't see them yet; the `/team` "helped rate" in Phase 6 uses them.
- **Where the log opens:** a calm "Something happened? Let {name}'s family know." card below the search, and "Tell {name}'s family what happened" when nothing matches. That one prefills the description with what the worker typed.
- **Inbox badge:** the nav shows the number of new notes beside "Inbox" (read out as "Inbox, 2 new"), and on phones beside "Menu". There's no push, email or other nudge.

### Phase 6

- **Most events are recorded by the database, not the browser,** through triggers on the rows they describe:
  - `signup_completed` (profile created), `consent_given`, `cue_created`
  - `share_created {scope, duration_hours}`, `share_opened` (first open only)
  - `worker_search {had_results}`, `cue_feedback {helpful}`
  - `note_logged`, `note_approved`, `note_dismissed`
  - `signup_started` is recorded when a valid, unused invite code is checked on the sign-up form.
  - `profile_deleted` is recorded by `delete_my_account`, with no profile id.

  So the counts match what actually happened, and no client can invent them.
- **The browser reports four events,** through `log_event`: `onboarding_step_completed {step}`, `onboarding_completed` (the database works out `{minutes}` from the profile, once), `card_viewed_by_family` and `profile_exported`. Any other name is ignored, and props are rebuilt in the database rather than trusted. A failed event never interrupts the family.
- **The `/team` funnel is counted from the real tables** (profiles, shares, searches, notes), not by replaying events, so it stays right even if an event were missed. Events add what the tables don't hold, such as card views.
- **`team_metrics()`** checks the caller's sign-in email against `team_members`. Anyone else gets `{status: 'not_team'}` and a calm "This page is for the Porto team."
  - It returns totals, rates, the median setup time and a per-family table labelled "Family 01", "Family 02" (by sign-up order).
  - It never returns cue text, searches, notes, worker names, child names, emails or ids. A test checks the output contains none of them.
  - "Download totals (CSV)" exports exactly what's on the page, with spreadsheet-formula characters neutralised.
- **Team members need a sign-in account.** Team members don't use invite codes: add their email to `team_members`, and invite them from the Supabase dashboard (Authentication → Users → Invite user). They then sign in at `/signin` and go to `/team`. Phase 7's runbook covers this.
- **"Delete this profile and everything in it"** (Account) runs `delete_my_account`:
  - It removes the profile and everything that cascades from it (card, cues, meanings, links, notes, searches, feedback and the family's events), plus their consent records and **their sign-in account** (`auth.users`).
  - Every link stops working at once. The invite code stays marked as used.
  - The family types the child's name to confirm (or `DELETE` if there's no name yet), in a sheet with "Keep the profile" as the way out. Afterwards they see a calm "Everything has been deleted" page.
- **Export** builds the JSON in the browser from the family's own rows (`schema_version: 1`): profile, card sections, cues with meanings (including source and source note), links (never tokens or hashes), notes, searches, feedback and consent records. The file is called `porto-{name}-{date}.json`. The PDF is the existing print view.
- **The Account page** holds the settings (About and Who to call, saving as the family types), download, "Go through setup again", sign out and delete. The nav is now Cues · First-shift card · Inbox · Account, plus the Share button.
- **`/demo`:**
  - The real worker view, fed by `demoSource`: the fictional Ari profile and a simple in-browser search. The tiers, rules and context ordering match the database's (see "Search relevance (design round 1)").
  - It makes no network calls. Notes and feedback are acknowledged and dropped, and a sticky line says "Demo profile (fictional). Not a real child. Nothing you type here is saved or sent."
  - It loads as its own small bundle and is linked from the welcome page.

### After launch

- **Consent version 2 (`2026-11-v2`).** The privacy text now names the services that help run Porto: Supabase (data, Sydney), Resend (sign-in emails, United States; sees email addresses and sign-in links only) and Netlify (delivers the pages; never receives the child's information). Because the consent text changed, everyone is asked to agree again on their next visit, as the privacy text promises. A family that already has a profile sees a short "We've updated this page" note saying what changed. **Deploy order:** push the database migration first (`npm run db:push`), then the site. Otherwise a new family could be asked to consent to a version the database doesn't accept yet.

### Phase 7

- **End-to-end tests use a test-only stand-in for Supabase** (`e2e/mini-supabase.mjs`), not the live project. There's no Docker for the Supabase CLI, and testing against real families' data is unacceptable. The stand-in:
  - runs every real migration in PGlite and executes each request as the real `anon` or `authenticated` role, so RLS, grants and every function behave as in production
  - implements only the slice of Supabase's API that Porto uses: magic-link auth with a test mailbox; table reads and writes with `eq` filters, ordering, limits, single rows, upserts and the two embedded relations; and RPC
  - trusts unsigned tokens and has an admin SQL endpoint, so it's never deployed

  `config.ts` now also accepts `http://127.0.0.1` or `http://localhost` as the Supabase URL, which is only used for this.
- **19 Playwright tests** cover the brief's 7 flows, plus: a wrong invite code; sign-in that doesn't reveal accounts; an expired sign-in link; JSON export; acceptance 2 (find a cue within 10 seconds at 360px); acceptance 5 (note → inbox → add → search finds it); and acceptance 7 (every request goes to the app or the database, checked in every test).
- **Accessibility:**
  - axe (WCAG 2.2 AA) runs on every screen in its main states: errors, open sheets, the log form, previews, editing and the closed link.
  - Further tests check keyboard-only use of the worker view (skip link, chips, sheet focus trap, Escape, focus returning), visible focus rings, no sideways scrolling at 320px, at 360px and at 200% zoom, and reduced motion.
  - **Found and fixed:**
    - Button names that didn't start with their visible words (WCAG 2.5.3). These are now "Not really: Cookie time", "Add to profile: …", "Close this link now: …".
    - The Inbox count is now real text ("Inbox 1 new").
    - The "Everything has been deleted" heading had `role="status"`, which hid it as a heading. It's now a heading that takes focus.
    - The worker pages had no skip link; they now do.
- **A real bug found by the browser tests:** after deleting an account, the sign-out could land before the move to the "deleted" page, and the sign-in guard then sent the family to Sign in. The "deleted" page now clears the sign-in itself, outside every guard.
- **Lighthouse, mobile, live site:** worker view (`/demo`) scores performance 94 and accessibility 100; closed link 96 and 100; welcome page 95 and 100. Best practices is 93 on all three, only because of console errors from Netlify's injected script (next point).
- **Netlify injects a script into every page it serves:** `/.netlify/scripts/hud?variant=public`, tagged `data-account-tier="free"`. Porto's CSP blocks its inline frame, it loads nothing from other domains, and visitors don't see it. But it's code Porto didn't write, running on pages that show children's information. **Question for Jackie:** turn it off in Netlify if your plan allows it (look for a toolbar, HUD or badge setting), or ask Netlify support how. It's in the runbook checklist.
- **Trial runbook:** `docs/RUNBOOK.md` covers inviting families, closing links, deleting a family's data on request, team access, metrics, common problems, making changes, and keys and secrets.

### Design round 1

- **Fraunces optical sizing.** `main.tsx` now imports `@fontsource-variable/fraunces/opsz.css` (opsz and wght axes) instead of `wght.css` (wght only, so every heading used the 14pt text cut). Same family name (`Fraunces Variable`), still self-hosted, same CSP (`font-src 'self'`). Headings set `font-optical-sizing: auto`. Cost: the latin file goes from about 36.6 KB to 67.3 KB (woff2 is already compressed, so gzip changes nothing): about 31 KB more on first load, cached after.
- **MeaningView** (`src/components/cues/MeaningView.tsx`) is the one way a cue meaning is shown: context line, the meaning (the strongest text), then "What to do" and "Avoid". Densities: compact (library, setup, card Top cues), full (worker search) and large ("Show larger"). It replaces four hand-written copies. It's shared with the worker bundle, so it imports nothing from the family app.
- **Confidence is worded into the context line** ("At school · usually") instead of a rose pill after the meaning, which wrapped onto its own line. The rose `Tag` stays for any other use but is now rarely needed.
- **"Anywhere"** is shown as the place when the family didn't name one, so every meaning has a context line.
- **One wording pair for the family's two answers:** "What to do" and "Avoid", everywhere (search, card, library, large view). "Try:" is retired. It matches the form ("What to do" / "What to avoid") and the card's section labels.
- **Choice chips are 48px tall** (`--chip-height-selectable`), up from 44px, to match the 48px tap-target rule. At rest: surface fill, 1.5px control border. Selected: sky fill, 2px ink border and a tick before the word. The hover border only applies on devices that can hover.
- **Static tags no longer look like chips:** no fill, a 1px control-border outline, `--ink-soft` 14px text, a small 6px radius, and they wrap. This fixes the share page scrolling sideways at 360px (the scope tag in "Your links").
- **Type tokens** (`--text-*`, with phone sizes for hero and h2) and one label style (`.t-label`, 14/20 600). Raw font-size/line-height pairs in CSS modules now use the tokens.
- **Route focus.** On a new page (not back or forward), the family app scrolls to the top (`RouteScroll`) and moves focus to the page's h1 (`PageHeading`, which also replaces Setup's and Deleted's own focus code). The first page load leaves focus alone. Form errors use one pattern (`src/lib/reveal.ts`): the first field with an error, or the error message, takes focus and scrolls to the middle of the screen. Used by the cue editor, the quick cue form, the log form and the share page.
- **Long words wrap.** Headings, paragraphs and list text use `overflow-wrap: anywhere`; buttons and chips reset to `break-word` so they keep whole words. An e2e test checks a 120-character unbroken label at 320px and 360px in the library, the editor and worker search.
- **SearchField** (`src/components/ui/SearchField.tsx`) is used by the worker view and the cue library. It uses the standard 3px ink focus outline, hides the browser's own clear cross and shows a 48px "Clear" text button (spoken as "Clear search") while there's text. The cue library's separate "Clear search" button under "Nothing matches" was removed, because it duplicated this one.
- **Worker bundle guard** (`src/worker/bundle.test.ts`, part of `npm run check`): walks every import reachable from `src/worker/WorkerPage.tsx` and fails if any reach `@supabase/*`, `src/lib/supabase.ts`, `src/auth`, `src/family` or `src/data` (except `data/types.ts`).

### Search relevance (design round 1)

- **The problem:** two reviewers searched the fictional Ari profile and got cues that only shared a few letters with what they typed. "hungry" put "Hands over ears and humming" first and "Cookie time" (I'm hungry) last; "hit" returned four unrelated cues; "swimming" found humming. The Phase 3 close-match tier compared the whole query with a whole label at `≥ 0.25`, which short words pass just by starting with the same two letters, and it ranked above the meanings. A worker acts on the first result, so this looked like the app guessing.
- **New ranking** (`supabase/migrations/20261111000100_search_relevance.sql`), highest first:
  - 4 exact label, 3 exact alias (unchanged).
  - 2 close match on the label or an alias, either:
    - the whole query is very close to a whole label or alias (trigram similarity `≥ 0.45`, for "cokie tme"), or
    - every word typed matches a word of the label or aliases: the same word; the start of it when 3 or more letters are typed ("coo", "knock"); or a near spelling when 4 or more letters are typed, starting with the same letter, with word-to-word similarity `≥ 0.4` ("cokie", "bathrom", "fredy"). Stop words ("the", "his", "at") are skipped and never match on their own.
  - 1 full text (english stemming) over the label, aliases, description and meanings. Adding the label and aliases lets "waving" find "wave" and "shoe" find "shoes".
  - Context boost rules are unchanged.
- **How it was chosen:** a table of 56 queries with the expected first cue, or nothing (`supabase/tests/search-cases.json`): 40 on Ari (all the reported cases and the near-misses to keep) and 16 on a second fictional profile shape ("Juno": an echolalia phrase, a description, a meaning with place text). A query is fully right when the expected cue comes first (or nothing comes back when nothing should) and nothing unrelated appears. Candidates, scored on the 57-query draft (one case was later dropped, below):

  | Candidate | First result right | No unrelated results | Empty when it should be | Fully right |
  |---|---|---|---|---|
  | A. Phase 3 as it was | 45 | 30 | 6 of 14 | **30 of 57** |
  | B. Phase 3 with threshold 0.5 | 49 | 48 | 8 of 14 | 46 |
  | C. Phase 3 with meanings ranked above close matches | 49 | 30 | 6 of 14 | 30 |
  | D. Per-word matching, 0.3 | 52 | 51 | 9 of 14 | 51 |
  | E. D plus same first letter | 53 | 52 | 10 of 14 | 52 |
  | F. E with 0.4 | 53 | 54 | 11 of 14 | 53 |
  | **J. F plus stop words skipped (chosen)** | 56 | 57 | 14 of 14 | **56 of 57** |

  Sensitivity checks around J: word threshold 0.35 scores 54 ("shoe" also finds "Short, low mm-mm"; "squeeze" finds "Squeals"); 0.45 scores 56; whole-query threshold 0.4 scores 56 and 0.5 scores 55 (loses "cokie tme"). Ranking meanings above close matches scores the same as J, so the briefed order (close match above meanings) stays. Leaving the label out of the full text loses "waving". J sits in the middle of a flat range, so small data changes shouldn't tip it.
- **Known miss, accepted:** swapped letters in a short word ("rokcing") no longer find the cue. Its similarity to "rocking" (0.33) is the same as "swimming" to "humming" (0.31), so no threshold catches one without the other. It was dropped from the table, which now has 56 cases.
- **Allowed second results:** "humming" also shows "Short, low mm-mm" (alias "hum", the same word stemmed), and "hum" also shows "Hands over ears and humming". Both are words the family wrote.
- **Before and after on the reported queries (Ari):**
  - "hungry": humming, mm-mm, Cookie time → **Cookie time**
  - "biting": humming, rocking → **nothing** (honest no-match)
  - "hit": shoes, wave, humming, mm-mm → **nothing**
  - "swimming": humming → **nothing**
  - "water": Blue bottle, wave, rocking → **Blue bottle**
  - "cookie": Cookie time, humming → **Cookie time**
  - Kept: "cokie", "cokie tme", "coo" → Cookie time; "bathrom door", "taps door", "toilet" → the door cue.
- **The demo search** (`src/demo/demoSource.ts`) now follows the same rules: it computes trigram similarity the way pg_trgm does, uses Postgres's english stop words, and a simple suffix trim stands in for stemming. The same 56 cases run against it in `src/demo/demoSource.test.ts`, and against the database in `supabase/tests/search-relevance.test.ts`.
- `normalise_query` is unchanged.

### Worker view, variant C (design round 1)

- **Worker view as a note from the family (design round, variant C).** The page opens with the child's name as the h1, "Shared by Ari's family", the link expiry and a "Call Sam" `tel:` link in the masthead (Who to call also stays as the card's last section, as approved). The family's connect note is now its own field on the card model (`CardModel.note`) and opens the card as its first line, attributed "From Ari's family"; on the worker page it opens the page instead, so it isn't said twice. About keeps only the plain facts.
- **The place shapes each result (W3).** `arrangeMeanings` (`src/worker/arrange.ts`) only reorders the family's meanings: the one for the chosen place leads with the ink edge; a meaning written for no particular place counts as "anywhere"; if neither exists the result says "Ari's family hasn't written what this means at camp" and shows the others. With no place chosen and meanings that differ by place, it asks the worker to choose a place. Other places are never hidden.
- **Search stays still while typing (W6).** The last results stay on screen while a new search runs; the status line says "Looking…". When the worker starts typing on a phone, the search box scrolls to the top so the answer sits above the keyboard, and the hint hides. The live region announces only the count ("1 match from Ari's family" / "No matches from Ari's family").
- **Log form (W8).** Starts with what the worker wants to say: what they tried, then whether it helped, then what they saw (prefilled from the cue being read, or from what they typed when nothing matched), then their first name. What they think was needed and the place sit under "Add more detail" (the place is prefilled from "I'm at"). "Did it help?" stays required because `worker_notes.outcome` is `not null` in the database; changing that needs a migration, which this round didn't touch. After "Did this help?" the worker can tap "Add a note", which opens the form with the cue and their answer filled in.
- **Fold labels:** card sections fold with a visible "Hide" / "Show" word instead of a chevron. The word is hidden from screen readers because `<details>` already announces whether it's open.

### Worker view, variant C (design round 2)

- **Two moments, labelled.** "Before you start" (the name with "Call Sam" beside it, the family's note, the facts, "Read Ari's card first · about 2 minutes", then the card) and "Right now" (I'm at, "What did Ari do or say?", the answer). On a phone they stack in that order with the card last; at 960px and wider they are two columns, and the place and search box stay in reach (sticky, on the ground colour) while the results flow beneath, so there's no nested scroll area.
- **"Call Sam" sits on the name row** instead of the masthead, and wraps under the name at 200% zoom (180px wide) with no sideways scroll.
- **The search label is one short question,** "What did Ari do or say?". Typing scrolls the input itself to the top of a phone screen. The count line echoes the place ("1 match · At school · Change"); Change moves focus to the place chips. Only the count is in the live region.
- **Focus after every action:** a quick cue moves focus to the first result (or the no-match line), Change to the chosen place, feedback to the thank-you line, Clear to the box, the log's errors and "sent" message to themselves. A second skip link, "Skip to search", focuses the search box.
- **Show it large is full screen** (`Sheet size="full"`, shared and shown on /styleguide). Its title becomes a quiet 14/20 label, so the cue label never competes with the meaning; other places wait at the foot of the screen.
- **No match is one block on the page,** not a card, and its one action, "Tell Ari's family what happened", is also the log sheet's title and the log line's button.
- **Log form:** the cue list shows only when the note is about one of the family's cues (from "Add a note"); otherwise there's one text field, "What did you see or hear?", prefilled from the search when nothing matched.
- **Card:** the setup preview and family card page keep the "About Ari" heading, with the family's note inside it, and the reading-time word count is unchanged (the "From Ari's family" attribution isn't counted). Every rule inside the sheet is a 1px hairline except "Please avoid", which keeps its two ink rules with clear space outside them. Who to call has extra space above its rule. Long single-word headings ("Overstimulation" at 360px) stay whole and the Hide or Edit control moves to the next line.
- **Code:** the worker view is split into `WorkerView` (state and layout), `WorkerShell`, `WorkerIntro`, `QuickCues`, `WorkerResult`, `NoMatch`, `LargeView`, `place.ts` and `useWorkerSearch.ts`.

### Worker view, final round (variant C with pieces from A)

- **Desktop search stays pinned.** "Right now" is its own column behind a vertical hairline, stretched to the page's height, and its place, search box and count line are sticky at the top (no nested scroll). When the worker types while scrolled down the card, the answer lands just under the pinned search: the page moves only as far as needed (`landingDelta`, unit-tested), and the count line offers "Back to where you were", which returns to the exact spot in the card.
- **Desktop door:** "Before you start" heads the left column; the family's note is set at h2 size (36/42) so it outranks the card heading, which drops to h3 size on desktop.
- **Phones: the turn to "Right now"** is a full-width 1px ink rule with room above it. It's the only full-width rule on the page, so it reads as structure, not decoration.
- **"I'm at" hangs:** the chips sit beside the words, and a second row lines up after them.
- **Card rhythm:** 8px from label to answer, 16px between pairs, 32px between sections (16px either side of the hairline). "Please avoid" keeps its two ink rules with 16px outside them.
- **Top cues as one calm unit:** the family's label, then each meaning at body size with its place and confidence after it on the same line, quieter ("I'm hungry · At home or at mealtimes · usually"), then What to do and Avoid in a fixed label column. This is MeaningView's new `brief` density, shown on /styleguide.
- **No match:** the Fraunces line, "Try fewer words, or how it looks or sounds.", then "What usually helps" (ink, no colon) between hairlines, then the one action.
- **Log from "Add a note":** what they saw is a line, "What did you see or hear? Cookie time · Change", instead of a dropdown. Change turns it into the text field, filled in, with focus.
- **Show it large:** "Other places" follows straight after Avoid.
- **Family card page below 400px:** section headings are 20/26 so every heading keeps Edit on its row ("Overstimulation" included).

### Design round 2: cue library

- **The library is one typeset sheet** (edge to edge below 600px). Its parts sit under small Figtree 14/20 600 labels on a 1px ink rule, with the count at the right: "On Ari's card · 5 of 5" (the pinned cues, in the order a worker sees them) and "Other cues · 3" (A to Z). Cues are hairline rows. The cue name is Fraunces 600 18/28 with no underline. The whole row opens the cue (spoken "Cookie time, edit"). Category is not a filter or a group: with 8 to 40 cues, search plus the card split answers Sam's questions, and the category is still set in the editor's "More detail".
- **The meaning has the weight.** Each meaning is a line pair: the place and how sure ("At school · usually", 14/20 600 ink-soft), then the meaning in ink 600. Each pair links to that meaning in the editor (`/cues/:id#meaning-<id>`).
- **Gaps are plain facts, in the default view too.** "No “What to do” yet" sits under a meaning without one. "Not written for school, camp or out and about" names only the worker places a cue has nothing for: home, school, camp and out and about. Mealtime is a moment, not a place, so it's left out. Nothing is listed when a meaning holds anywhere. Muted text, never a warning colour.
- **Place lens:** "See it as a worker at" uses the worker view's five places on one line of chips, which scrolls sideways on phones and wraps on desktop. With a place chosen:
  - The list becomes "Nothing written at camp yet" first, each row showing "Written for: …" and "Add what it means at camp".
  - Then "Written at camp", where each row leads with the meaning a worker there would read (the worker view's `arrangeMeanings`), then "Also written for: …".
  - "Add what it means at camp" opens the editor (`?add=camp`) with a new meaning already set to camp, open, and its heading focused.
- **Fixing one meaning:** tapping a meaning line opens the editor on that meaning, open, with its place heading focused and scrolled to the top. The other meanings stay closed. This takes 3 taps: the line, the field, then Save cue. We chose this over a one-meaning sheet because:
  - it keeps one save path (`saveCue`), the unsaved-changes guard and the live preview;
  - Sam sees the cue's other places while changing one;
  - there is no second editing surface to keep in step.
- **Card control:** each row has one quiet text button, "Add to card" or "Take off card", at the lower right beside the meanings, so the name keeps the full width. Focus follows the cue to its new place on the page. With 5 on the card, it opens "The card holds 5 cues": the five as a ruled list of Fraunces names with "Take off" at the right, between ink rules, plus "Keep the card as it is". A swap saves in order: take one off, put the other on, and undo the first if the second fails.
- **Editor: one written page.** One surface sheet holds:
  - "What you'll see or hear" in a Fraunces input.
  - "More detail", whose summary states the folded facts: kind, topic, also written as, description.
  - The card tick.
  - "What it means".
- **Closed meanings read as a worker sees them:** a quiet place line with "Change" on it, then `MeaningView` without a second context line. The meaning is the only Fraunces line.
- **Open meanings:** the place is the Fraunces 24 title, with "Remove". The text fields lead. For a meaning that already has a place, the place choice waits behind "Change where". "What to avoid" and "How sure" sit under the meaning's "More detail". Examples show only for a meaning written from scratch.
- **"Where does it mean this?"** offers "Anywhere", Home, School, Camp and Out and about first. Mealtime, Transport, With a specific person and Other wait behind "More places". "Name the place or person" appears only when it's needed.
- **"Add what it means in another place"** is a quiet underlined text action under the last meaning. It adds an open section and focuses its heading.
- **A new cue is a short interview:** what you see or hear, then where, then what it means and what to do. "More detail" and the card tick come after.
- **The card tick at 5 of 5** opens the same swap sheet, and the chosen cue comes off when Sam saves ("Cookie time comes off the card when you save."). The count line can no longer read "6 of 5" (`cardCountAfter`).
- **From the inbox:** what the worker wrote is quoted above the form as a figure with the house 2px ink left rule. It shows "What Jo wrote", then only the note's own fields: what happened, where, they thought, they tried, did it help. The note's meaning comes first and open, marked "New, from Jo's note. Check it, then save." The page opens at the top, on the worker's words. The saved order of meanings is unchanged.
- **Desktop:**
  - The library has a 300px sticky column: heading, Add a cue, search, place, and "Ari's card, in order" as a numbered Fraunces list. Beside it is the index, with each place and its meaning side by side so meanings line up.
  - The editor sits beside the sticky "What a worker sees" column, which sets the whole cue as a worker's search result for a chosen place.
  - The phone-only "What a worker reads" preview inside an open meaning was removed: the closed meaning already reads as a worker sees it.
- **Nav:** "Share for a shift" is an outlined button, so each page keeps one apricot primary.
- **Unsaved changes:** links to other pages are held by "Leave without saving?", and closing or reloading the tab gets the browser's own question. The browser's Back button isn't caught: the app uses a plain `BrowserRouter` (`useLeaveGuard`).
- **Sheet titles keep whole words at 200% zoom:** "Close" drops under the title, and below 320px the title is 18/28. The swap list's names wrap by word, and "Take off" drops beneath them.
- **Setup step 5:** after "Add to profile", focus moves to "Added to the profile." instead of being lost with the closed form.

## Brand gaps

Things the brand doesn't define, and how each was derived from existing tokens.

- **Spacing additions:** `--space-3` (12px), `--space-8` (32px), `--space-16` (64px), as listed in the brief.
- **Scrim:** `rgba(36, 48, 79, 0.4)` (`--ink` at 40%), stored as `--scrim`.
- **Errors:** the brand has no error colour. Errors use `--ink` text on `--surface`, a `2px solid var(--ink)` border and a "!" icon with a text label. Never red. Invalid inputs get a 2px ink border.
- **Disabled buttons:** not defined. Derived as a `--surface` fill, a `--control-border` edge and `--muted` text, with no shadow and no press movement.
- **Info banner:** a neutral note, `--ink-soft` text on `--surface` with a `--blob` border and an ink "i" icon. Used for gentle notes such as the card-length nudge.
- **Success banner:** `--success` text (600 weight) on `--surface` with a check icon and a `--blob` border.
- **Selectable chips:** `--surface` fill and a 1.5px `--control-border` edge at rest, `--ink` edge on hover (hover devices only). Selected (`aria-pressed`): `--sky` fill, 2px `--ink` border and an ink tick. 48px tall.
- **Static tags:** transparent, 1px `--control-border` outline, `--ink-soft` text, 6px radius. Rose tags keep the `--rose` fill with `--ink` text.
- **Type tokens** in `derived-tokens.css`: `--text-hero`, `--text-h2`, `--text-h3`, `--text-body-lg`, `--text-body`, `--text-small`, each with a `-lh` line height, taken from the type scale in CLAUDE.md (hero and h2 change below 600px).
- **SearchField Clear button:** ink, 600, underlined text, no fill, the full height of the input (at least 48px).
- **"Please avoid" on the card:** set between two 2px `--ink` rules, no colour, so its shape tells it apart from the hairline-divided sections.
- **"What to do" is ink 600 in every MeaningView density,** because it's the line a worker scans for.
- **"Show it large" meaning on phones: 44/48,** a step above the 36/40 phone hero size, for reading at arm's length. Wider screens use the 56/60 hero size.
- **Full-screen sheet:** no scrim edge, no radius, `--surface` panel filling the viewport; on wide screens the content is centred in a 960px measure.
- **Family card section headings below 400px: 20/26,** between body-lg and h3, so the longest heading and its Edit button share a row.
- **Rose tag:** kept for one tag type only, the family's confidence ("Usually").
- **Styleguide code labels** use the system monospace font. They appear only on `/styleguide`, never on family or worker screens.

## Needs human review

All of this copy was drafted by Claude in the brief's voice. A person should check it before real families use it.

- Welcome screen: heading, intro, "who it's for" and the control line (`copy.welcome`).
- Not-found page (`copy.notFound`).
- Common microcopy: "Saved.", "Link copied.", "Please try again in a moment.", step labels and icon labels (`copy.common`).
- Illustration text alternatives (`copy.illustrations`).
- Styleguide sample copy (`copy.styleguide`): internal only, but it models the voice.
- Emergency line: "If it's an emergency, call 000." (`copy.layout.emergency`).
- **Consent and privacy text** (`copy.consent`, `copy.privacy`), including the v2 wording about Supabase, Resend and Netlify and the "We've updated this page" note. This needs careful review, ideally by someone who knows the Australian Privacy Principles. Pay particular attention to the claim that the team "won't read your profile unless you ask us to help". It's a promise about behaviour, not something the system enforces.
- Sign-up, sign-in, check-your-email, expired-link and set-up copy (`copy.signUp`, `copy.signIn`, `copy.checkEmail`, `copy.authCallback`, `copy.start`, `copy.home`).
- Error messages (`copy.errors`).
- All setup step copy, the prompts and their fictional examples (`copy.setup`, `copy.sectionFields`, `copy.cueForm`). Check the examples suit the age range of children in the trial.
- Card copy, including the worker-facing labels "How they show it", "What to do" and "Avoid" (`copy.card`), and the enum labels (`copy.labels`).
- **Design round 1 copy:** the meaning labels "What to do" / "Avoid" (replacing "Try"), "Anywhere" for a meaning with no place, the context line "At school · usually" with lowercase confidence (`copy.meaning`, `copy.labels.confidenceInline`), the search "Clear" button spoken as "Clear search" (`copy.searchField`), and new styleguide samples.
- The demo profile content for Ari (`src/demo/ari.ts`).
- Cue library and editor copy (`copy.cues`, `copy.cueEditor`), including the delete warning and the pin-limit message.
- Sharing copy (`copy.share`), especially the scope labels, the "shown only once" note and the closed-link message.
- Account, delete, deleted, demo and team copy (`copy.account`, `copy.deleted`, `copy.demo`, `copy.team`), especially the delete warning: it must be unmistakable that deleting can't be undone.
- The worker log form, the feedback buttons and the inbox (`copy.worker.log`, `copy.worker.feedback*`, `copy.inbox`), including the added question "What do you think they needed?".
- Worker view copy (`copy.worker`), especially the privacy footer ("Please don't screenshot or forward this page") and the no-match wording.
- Worker view round C copy (`copy.worker`): "Call Sam", "From Ari's family", "If Ari does or says something you don't understand, type it here.", "I'm at", "Things Ari often does", "In other places", "Ari's family hasn't written what this means at camp. This is what they wrote for other places.", "Ari's family wrote different meanings for different places. Choose where you are, above the search.", "Show it large", "Add a note", "No matches from Ari's family", "Ari's first-shift card", "About 2 minutes to read.", "Ari's family hasn't written the card yet.", the reordered log form with "Add more detail", and the card's "Hide" / "Show" and "Call Sam on 0491 570 156" (`copy.card`).
- Worker view round 2 copy (`copy.worker`): "What did Ari do or say?", "Before you start", "Right now", "Read Ari's card first · about 2 minutes", "Skip to search", "1 match · At school · Change" (and "No place chosen · Choose"), "Something happened?", "Tell Ari's family what happened" as the log title, "Say what you saw or heard.", and the styleguide's full-screen sheet sample.
- Worker view final-round copy: "Back to where you were", "Try fewer words, or how it looks or sounds.", "What usually helps" (no colon), "Change" for what they saw in the log, and the styleguide label for the brief meaning.
- Design round 2 cue library and editor copy (`copy.cues`, `copy.cueEditor`): "What Ari says or does, and what it means in each place.", "See it as a worker at", "On Ari's card" with "5 of 5", "Other cues", "Ari's card, in order", "Add to card" / "Take off card", "Saved. Blue bottle is on the card instead of Rocking faster than usual.", "The card holds 5 cues", "Choose one to take off, to make room for Blue bottle.", "Take off", "Keep the card as it is", "No “What to do” yet", "Not written for school, camp or out and about", "Nothing written at camp yet", "Written at camp", "Written for: …", "Add what it means at camp", "Also written for: …", "More detail" with Show / Hide, "Where does it mean this?", "Anywhere", "More places", "Name the place or person", "Change", "Change where", "Done", "Remove", "What a worker sees", "Add what it means in another place", "The card already has 5 cues. Tick this to choose one to swap out.", "Cookie time comes off the card when you save.", "What Jo wrote", "New, from Jo's note. Check it, then save.", "Leave without saving?", "Keep editing".
- Supabase's own magic-link **email template**: it still says "Magic Link" and needs rewording in Porto's voice in the Supabase dashboard (Authentication, then Emails).


## Questions for Jackie

1. **Live setup: done.** Site: **https://porto-app.com** (Netlify project `porto-communicate`, auto-deploys from `main`; `www` and `http` redirect to it; Let's Encrypt HTTPS). Database: Supabase project `qcjtiypfexmdyogaoled` (all migrations through `…800_metrics_and_account` pushed). Domain and DNS: Cloudflare. Sign-in email: Resend via custom SMTP from `hello@porto-app.com`, email limit raised in Supabase. Checked live: headers, worker pages, `/demo`, database connection and a real magic-link sign-in. **Still to confirm:** the dashboard shows the region as Sydney (ap-southeast-2). **Before families sign up:** reword the Supabase email templates, set `VITE_PRIVACY_CONTACT_EMAIL` in Netlify, and add to the privacy text that an email service (Resend, US) sends sign-in links. **Consider Supabase Pro while the trial runs:** free projects pause after a week of inactivity and have no daily backups.
2. **Trial values:** the invite codes (`<<TRIAL_INVITE_CODES>>`), the privacy contact email (`<<PRIVACY_CONTACT_EMAIL>>`) and the team emails for `/team` (`<<TEAM_EMAILS>>`). Placeholders are used until then.
4. **Home-screen installs for workers:** the manifest can't carry a per-share link. Since Phase 4, the token is kept only for the browser tab (the address becomes `/s/open`), so an icon added to the home screen won't reopen the profile once the tab is closed. For the trial, workers open the link from their messages each shift. Keeping the token longer on the worker's phone would make the icon work, but it's a privacy trade-off. Is the current behaviour acceptable?
5. **Search relevance migration needs pushing live.** `20261111000100_search_relevance.sql` changes the worker search. Push it with `npm run db:push` before (or with) the site deploy, so real worker links get the fix and match what `/demo` shows. The site code doesn't depend on it, so nothing breaks if the order slips.
