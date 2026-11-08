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
- Supabase's own magic-link **email template**: it still says "Magic Link" and needs rewording in Porto's voice in the Supabase dashboard (Authentication, then Emails).

## Questions for Jackie

1. **Supabase:** please create a project in **Sydney (ap-southeast-2)** and share the project URL and anon key (never the service-role key). Phase 1 is built and tested without it, but sign-up can't be tried end to end until it exists. Setup steps are in the README.
2. **Trial values:** the invite codes (`<<TRIAL_INVITE_CODES>>`), the privacy contact email (`<<PRIVACY_CONTACT_EMAIL>>`) and the team emails for `/team` (`<<TEAM_EMAILS>>`). Placeholders are used until then.
3. **Netlify:** connect a site to `jackiexie25-arch/Porto-MVP` when you're ready to deploy (Phase 4).
4. **Home-screen installs for workers:** the manifest can't carry a per-share `start_url`. On Android, an installed icon would open `/`, not the worker's link. iOS keeps the current URL. Is "open the link from your messages" acceptable for the trial, or do you want a small "Open my last shared link" step? A step like that would mean storing the token on the worker's phone, which is a privacy trade-off.
