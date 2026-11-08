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

## Questions for Jackie

1. **Supabase:** please create a project in **Sydney (ap-southeast-2)** and share the project URL and anon key (never the service-role key). Needed for Phase 1.
2. **Trial values:** the invite codes (`<<TRIAL_INVITE_CODES>>`), the privacy contact email (`<<PRIVACY_CONTACT_EMAIL>>`) and the team emails for `/team` (`<<TEAM_EMAILS>>`). Placeholders are used until then.
3. **Netlify:** connect a site to `jackiexie25-arch/Porto-MVP` when you're ready to deploy (Phase 4).
4. **Home-screen installs for workers:** the manifest can't carry a per-share `start_url`. On Android, an installed icon would open `/`, not the worker's link. iOS keeps the current URL. Is "open the link from your messages" acceptable for the trial, or do you want a small "Open my last shared link" step? A step like that would mean storing the token on the worker's phone, which is a privacy trade-off.
