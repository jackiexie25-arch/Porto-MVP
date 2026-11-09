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
  - The trigram tier uses `max(similarity, word_similarity) ≥ 0.25` on the label and each alias. `word_similarity` means a part phrase like "bathroom door" or a half-typed "coo" still finds a long label.
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
  - The real worker view, fed by `demoSource`: the fictional Ari profile and a simple in-browser search. The tiers and context ordering match the database's, using word prefixes instead of trigrams.
  - It makes no network calls. Notes and feedback are acknowledged and dropped, and a sticky line says "Demo profile (fictional). Not a real child. Nothing you type here is saved or sent."
  - It loads as its own small bundle and is linked from the welcome page.

## Brand gaps

Things the brand doesn't define, and how each was derived from existing tokens.

- **Spacing additions:** `--space-3` (12px), `--space-8` (32px), `--space-16` (64px), as listed in the brief.
- **Scrim:** `rgba(36, 48, 79, 0.4)` (`--ink` at 40%), stored as `--scrim`.
- **Errors:** the brand has no error colour. Errors use `--ink` text on `--surface`, a `2px solid var(--ink)` border and a "!" icon with a text label. Never red. Invalid inputs get a 2px ink border.
- **Disabled buttons:** not defined. Derived as a `--surface` fill, a `--control-border` edge and `--muted` text, with no shadow and no press movement.
- **Info banner:** a neutral note, `--ink-soft` text on `--surface` with a `--blob` border and an ink "i" icon. Used for gentle notes such as the card-length nudge.
- **Success banner:** `--success` text (600 weight) on `--surface` with a check icon and a `--blob` border.
- **Selectable chips:** a 2px transparent border at rest, `--control-border` on hover, `--ink` when selected (`aria-pressed`).
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
- **Consent and privacy text** (`copy.consent`, `copy.privacy`). This needs careful review, ideally by someone who knows the Australian Privacy Principles. Pay particular attention to the claim that the team "won't read your profile unless you ask us to help". It's a promise about behaviour, not something the system enforces.
- Sign-up, sign-in, check-your-email, expired-link and set-up copy (`copy.signUp`, `copy.signIn`, `copy.checkEmail`, `copy.authCallback`, `copy.start`, `copy.home`).
- Error messages (`copy.errors`).
- All setup step copy, the prompts and their fictional examples (`copy.setup`, `copy.sectionFields`, `copy.cueForm`). Check the examples suit the age range of children in the trial.
- Card copy, including the worker-facing labels "How they show it", "What to do", "Avoid" and "Try" (`copy.card`), and the enum labels (`copy.labels`).
- The demo profile content for Ari (`src/demo/ari.ts`).
- Cue library and editor copy (`copy.cues`, `copy.cueEditor`), including the delete warning and the pin-limit message.
- Sharing copy (`copy.share`), especially the scope labels, the "shown only once" note and the closed-link message.
- Account, delete, deleted, demo and team copy (`copy.account`, `copy.deleted`, `copy.demo`, `copy.team`), especially the delete warning: it must be unmistakable that deleting can't be undone.
- The worker log form, the feedback buttons and the inbox (`copy.worker.log`, `copy.worker.feedback*`, `copy.inbox`), including the added question "What do you think they needed?".
- Worker view copy (`copy.worker`), especially the privacy footer ("Please don't screenshot or forward this page") and the no-match wording.
- Supabase's own magic-link **email template**: it still says "Magic Link" and needs rewording in Porto's voice in the Supabase dashboard (Authentication, then Emails).

## Questions for Jackie

1. **Live setup: done.** Site: **https://porto-app.com** (Netlify project `porto-communicate`, auto-deploys from `main`; `www` and `http` redirect to it; Let's Encrypt HTTPS). Database: Supabase project `qcjtiypfexmdyogaoled` (all migrations through `…800_metrics_and_account` pushed). Domain and DNS: Cloudflare. Sign-in email: Resend via custom SMTP from `hello@porto-app.com`, email limit raised in Supabase. Checked live: headers, worker pages, `/demo`, database connection and a real magic-link sign-in. **Still to confirm:** the dashboard shows the region as Sydney (ap-southeast-2). **Before families sign up:** reword the Supabase email templates, set `VITE_PRIVACY_CONTACT_EMAIL` in Netlify, and add to the privacy text that an email service (Resend, US) sends sign-in links. **Consider Supabase Pro while the trial runs:** free projects pause after a week of inactivity and have no daily backups.
2. **Trial values:** the invite codes (`<<TRIAL_INVITE_CODES>>`), the privacy contact email (`<<PRIVACY_CONTACT_EMAIL>>`) and the team emails for `/team` (`<<TEAM_EMAILS>>`). Placeholders are used until then.
4. **Home-screen installs for workers:** the manifest can't carry a per-share link. Since Phase 4, the token is kept only for the browser tab (the address becomes `/s/open`), so an icon added to the home screen won't reopen the profile once the tab is closed. For the trial, workers open the link from their messages each shift. Keeping the token longer on the worker's phone would make the icon work, but it's a privacy trade-off. Is the current behaviour acceptable?
